import type * as T from "three";

type Three = typeof import("three");

/** half the width of the asphalt, and the kerb beyond it on each side (metres) */
export const ROAD = 1.7;
export const KERB = 0.3;

/**
 * The track: a lane of textured asphalt with a red and white kerb down each side, a chequered start line just
 * ahead of the car, the rubber it lays at the start and the streaks of the surface at speed.
 * Outside the kerbs the plane is clear, so the page shows through and there is no edge to hide.
 * Ground coordinates are metres with the car's grid position at the origin and the car pointing along +x.
 */
export function makeGround(THREE: Three, asphalt: T.Texture) {
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.colorSpace = THREE.NoColorSpace;
  const uniforms = {
    uAsphalt: { value: asphalt },
    uTravel: { value: 0 }, // metres of track that have gone by under the camera
    uSpeed: { value: 0 }, // 0..1 streaks
    uMark: { value: 0 }, // metres of rubber laid from the grid
    uCentre: { value: new THREE.Vector2() }, // world xz the far fade is centred on
    uNear: { value: 14 },
    uFar: { value: 34 },
    uOpacity: { value: 1 },
    // keep-outs in screen space (0..1): the track fades away where the page has words on top of it
    uRes: { value: new THREE.Vector2(1, 1) },
    uMaskX: { value: new THREE.Vector4(-1, -0.5, 2, 3) }, // fade in from the left between x and y, out to the right between z and w
    uMaskY: { value: new THREE.Vector4(-1, -0.5, 2, 3) }, // the same from the top, and to the bottom
    uBandY: { value: new THREE.Vector4(-2, -1.5, -1, -0.5) }, // a band kept clear: fade out between x and y, back in between z and w
    uBox: { value: new THREE.Vector4(-1, -0.5, 2, 3) }, // a left-hand column kept clear below a line: x fades back in between x and y, the line is soft between z and w
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    defines: { ROAD: ROAD.toFixed(3), KERB: KERB.toFixed(3) },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uAsphalt;
      uniform float uTravel, uSpeed, uMark, uNear, uFar, uOpacity;
      uniform vec2 uCentre, uRes;
      uniform vec4 uMaskX, uMaskY, uBandY, uBox;
      varying vec3 vW;

      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      // 1 where v lies between a and b, antialiased by the pixel footprint
      float strip(float v, float a, float b) {
        float sd = max(a - v, v - b);
        float aa = fwidth(sd) * 0.75 + 1e-4;
        return 1.0 - smoothstep(-aa, aa, sd);
      }
      void over(inout vec4 dst, vec3 c, float k) { dst.rgb = mix(dst.rgb, c, k); dst.a = dst.a + k * (1.0 - dst.a); }

      void main() {
        vec2 g = vec2(vW.x + uTravel, vW.z);
        float side = abs(g.y);
        vec4 o = vec4(0.0);
        vec3 WHITE = vec3(0.88, 0.90, 0.92), RED = vec3(0.74, 0.07, 0.12);

        // asphalt: a fine, even grain, with a little of the same picture much larger so the tile never shows
        float fine = texture2D(uAsphalt, g * 0.42).r;
        float grain = fine * 0.84 + texture2D(uAsphalt, g * 0.097 + 0.37).r * 0.16;
        vec3 tarmac = mix(vec3(0.070, 0.074, 0.082), vec3(0.235, 0.243, 0.256), grain);
        over(o, tarmac, strip(side, -1.0, ROAD + KERB));
        float wear = 0.76 + 0.24 * fine; // paint lies on the stones, thinner where the grain is dark

        // rubber laid at the start: two strips from the rear tyres
        float len = smoothstep(-2.3, -1.9, g.x) * (1.0 - smoothstep(-2.2 + uMark - 1.2, -2.0 + uMark, g.x));
        float tyre = strip(abs(side - 0.775), -1.0, 0.19);
        over(o, vec3(0.010, 0.010, 0.012), tyre * len * (0.5 + 0.5 * noise(vec2(g.x * 2.2, g.y * 26.0))) * step(0.02, uMark) * 0.82);

        // at speed the surface smears into long streaks
        float st = noise(vec2(g.x * 0.055, g.y * 15.0));
        float streak = smoothstep(0.70, 0.92, st) * (0.5 + 0.5 * noise(vec2(g.x * 0.4, g.y * 3.0)));
        over(o, vec3(0.78, 0.82, 0.88), streak * 0.20 * uSpeed * strip(side, -1.0, ROAD));

        // start line, painted on the asphalt: two columns of white squares between two thin white lines, kerb to kerb
        float across = strip(side, -1.0, ROAD);
        float sq = ROAD / 6.0;
        float x0 = 3.02, x1 = x0 + 2.0 * sq;
        float chequer = mod(floor((g.x - x0) / sq) + floor((g.y + ROAD) / sq), 2.0);
        float band = strip(g.x, x0, x1) * across;
        over(o, tarmac * 0.66, band * (1.0 - chequer) * 0.7); // the squares left bare read a shade darker
        over(o, WHITE, band * chequer * wear);
        over(o, WHITE, max(strip(g.x, x0 - 0.14, x0 - 0.08), strip(g.x, x1 + 0.08, x1 + 0.14)) * across * wear);

        // each edge: the kerb, red and white blocks from the asphalt out
        float block = step(0.5, fract(g.x / 2.4));
        over(o, mix(RED, WHITE, block) * (0.84 + 0.16 * fine), strip(side, ROAD, ROAD + KERB));

        float d = distance(vW.xz, uCentre);
        o.a *= (1.0 - smoothstep(uNear, uFar, d)) * uOpacity;
        vec2 sp = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
        o.a *= smoothstep(uMaskX.x, uMaskX.y, sp.x) * (1.0 - smoothstep(uMaskX.z, uMaskX.w, sp.x));
        o.a *= smoothstep(uMaskY.x, uMaskY.y, sp.y) * (1.0 - smoothstep(uMaskY.z, uMaskY.w, sp.y));
        o.a *= max(1.0 - smoothstep(uBandY.x, uBandY.y, sp.y), smoothstep(uBandY.z, uBandY.w, sp.y));
        o.a *= 1.0 - (1.0 - smoothstep(uBox.x, uBox.y, sp.x)) * smoothstep(uBox.z, uBox.w, sp.y);
        gl_FragColor = o;
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
