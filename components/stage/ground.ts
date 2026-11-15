type Three = typeof import("three");

/**
 * The track surface. It has no colour of its own: the page background is the asphalt, and this plane only adds what
 * is painted or left on it (grid slot, start line, kerb, tyre marks, streaks at speed), so there is no edge to hide.
 * Ground coordinates are metres with the grid slot at the origin and the car pointing along +x.
 */
export function makeGround(THREE: Three) {
  const uniforms = {
    uTravel: { value: 0 }, // metres of track that have gone by under the camera
    uSpeed: { value: 0 }, // 0..1 streaks
    uMark: { value: 0 }, // metres of rubber laid from the slot
    uCentre: { value: new THREE.Vector2() }, // world xz the far fade is centred on
    uNear: { value: 14 },
    uFar: { value: 34 },
    uOpacity: { value: 1 },
    // keep-outs in screen space (0..1): paint fades away where the page has words on top of it
    uRes: { value: new THREE.Vector2(1, 1) },
    uMaskX: { value: new THREE.Vector4(-1, -0.5, 2, 3) }, // fade in from the left between x and y, out to the right between z and w
    uMaskY: { value: new THREE.Vector4(-1, -0.5, 2, 3) }, // the same from the top, and to the bottom
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTravel, uSpeed, uMark, uNear, uFar, uOpacity;
      uniform vec2 uCentre, uRes;
      uniform vec4 uMaskX, uMaskY;
      varying vec3 vW;

      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      // 1 inside the box (centre c, half size h), antialiased by the pixel footprint
      float box(vec2 p, vec2 c, vec2 h) {
        vec2 d = abs(p - c) - h;
        float sd = max(d.x, d.y);
        float aa = fwidth(sd) * 0.75 + 1e-4;
        return 1.0 - smoothstep(-aa, aa, sd);
      }
      void over(inout vec4 dst, vec3 c, float k) { dst.rgb = mix(dst.rgb, c, k); dst.a = dst.a + k * (1.0 - dst.a); }

      void main() {
        vec2 g = vec2(vW.x + uTravel, vW.z);
        vec4 o = vec4(0.0);
        vec3 WHITE = vec3(0.90, 0.92, 0.94), RED = vec3(0.76, 0.07, 0.12), YELLOW = vec3(1.0, 0.84, 0.04);
        float wear = 0.86 + 0.14 * noise(g * 13.0);
        // paint only shows in the lane the car is in; further across the track it thins out to bare asphalt
        float lane = 1.0 - smoothstep(2.6, 4.6, -g.y);

        // asphalt: a faint mottle, so rubber and paint have something to sit on
        float grain = noise(g * 22.0) * 0.6 + noise(g * 5.0) * 0.4;
        over(o, vec3(0.62, 0.66, 0.72), 0.055 * grain * lane);

        // start line, a little way ahead of the slot
        over(o, WHITE, box(g, vec2(5.05, -1.6), vec2(0.11, 3.9)) * wear * 0.95 * lane);

        // grid slot: a line across the nose, two short side lines, yellow marks to line the car up
        float slot = box(g, vec2(3.22, 0.0), vec2(0.07, 1.32));
        slot = max(slot, box(g, vec2(2.52, 1.32), vec2(0.77, 0.06)));
        slot = max(slot, box(g, vec2(2.52, -1.32), vec2(0.77, 0.06)));
        over(o, WHITE, slot * wear * 0.95);
        float tick = max(box(g, vec2(3.22, 1.72), vec2(0.07, 0.26)), box(g, vec2(3.22, -1.72), vec2(0.07, 0.26)));
        over(o, YELLOW, tick * wear * 0.95);

        // track edge on the camera side: white line, then a red and white kerb
        over(o, WHITE, box(vec2(0.0, g.y), vec2(0.0, 2.36), vec2(1.0, 0.07)) * wear * 0.9);
        float kerb = box(vec2(0.0, g.y), vec2(0.0, 2.80), vec2(1.0, 0.30));
        float block = step(0.5, fract(g.x / 3.0));
        over(o, mix(RED, WHITE, block), kerb * (0.86 + 0.14 * noise(g * 3.0)));

        // rubber laid at the start: two strips from the rear tyres
        float len = smoothstep(-2.3, -1.9, g.x) * (1.0 - smoothstep(-2.2 + uMark - 1.2, -2.0 + uMark, g.x));
        float strip = max(box(vec2(0.0, g.y), vec2(0.0, 0.775), vec2(1.0, 0.19)), box(vec2(0.0, g.y), vec2(0.0, -0.775), vec2(1.0, 0.19)));
        float rubber = strip * len * (0.55 + 0.45 * noise(vec2(g.x * 2.2, g.y * 26.0))) * step(0.02, uMark);
        over(o, vec3(0.012, 0.012, 0.014), rubber * 0.78);

        // at speed the surface smears into long streaks
        float st = noise(vec2(g.x * 0.055, g.y * 15.0));
        float streak = smoothstep(0.70, 0.92, st) * (0.5 + 0.5 * noise(vec2(g.x * 0.4, g.y * 3.0)));
        over(o, vec3(0.80, 0.84, 0.90), streak * 0.22 * uSpeed);

        float d = distance(vW.xz, uCentre);
        o.a *= (1.0 - smoothstep(uNear, uFar, d)) * uOpacity;
        vec2 sp = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
        o.a *= smoothstep(uMaskX.x, uMaskX.y, sp.x) * (1.0 - smoothstep(uMaskX.z, uMaskX.w, sp.x));
        o.a *= smoothstep(uMaskY.x, uMaskY.y, sp.y) * (1.0 - smoothstep(uMaskY.z, uMaskY.w, sp.y));
        gl_FragColor = o;
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
