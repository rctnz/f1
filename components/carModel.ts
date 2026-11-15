import type * as T from "three";

type Three = typeof import("three");

/**
 * An original single-seater built from primitives: red and white A10 livery, no real team marks.
 * Units are roughly metres. The car points along +x, sits on y = 0, centred on x = 0.
 */
export function buildCar(THREE: Three, numberFont: string) {
  const root = new THREE.Group(); // moves (drive in / out)
  const spinner = new THREE.Group(); // turns (scroll spin)
  root.add(spinner);

  // materials
  const red = new THREE.MeshPhysicalMaterial({ color: 0xa30d19, metalness: 0.2, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xeef1f4, metalness: 0.1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const carbon = new THREE.MeshPhysicalMaterial({ color: 0x15171a, metalness: 0.25, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.92, metalness: 0 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.85, roughness: 0.32 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.5 });
  const visor = new THREE.MeshPhysicalMaterial({ color: 0x0b0d10, metalness: 0.6, roughness: 0.1, clearcoat: 1 });
  const rain = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 0.6 });

  const add = (g: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    spinner.add(mesh);
    return mesh;
  };

  // side profile (x, y) extruded across z, with soft edges
  const side = (start: [number, number][], curve: [number, number][], end: [number, number][], depth: number, bevel: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(start[0][0], start[0][1]);
    start.slice(1).forEach(([x, y]) => sh.lineTo(x, y));
    if (curve.length) sh.splineThru(curve.map(([x, y]) => new THREE.Vector2(x, y)));
    end.forEach(([x, y]) => sh.lineTo(x, y));
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {
      depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 24,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  };
  const warp = (g: T.BufferGeometry, fn: (v: T.Vector3) => void) => {
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      fn(v);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  };
  const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const rod = (a: [number, number, number], b: [number, number, number], r = 0.018) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const g = new THREE.CylinderGeometry(r, r, len, 8);
    const m = add(g, carbon);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return m;
  };

  // floor / plank
  {
    const sh = new THREE.Shape();
    const pts: [number, number][] = [
      [1.3, 0.3], [0.95, 0.32], [0.8, 0.82], [-1.25, 0.86], [-1.9, 0.6], [-2.35, 0.48],
      [-2.35, -0.48], [-1.9, -0.6], [-1.25, -0.86], [0.8, -0.82], [0.95, -0.32], [1.3, -0.3],
    ];
    sh.moveTo(...pts[0]);
    pts.slice(1).forEach((p) => sh.lineTo(...p));
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false });
    g.rotateX(Math.PI / 2);
    g.translate(0, 0.12, 0);
    add(g, carbon);
  }

  // survival cell + engine cover: narrows toward the gearbox
  {
    const g = side(
      [[1.35, 0.22], [1.35, 0.5]],
      [[0.95, 0.56], [0.6, 0.62], [0.25, 0.64], [-0.1, 0.86], [-0.35, 0.98], [-0.7, 0.93], [-1.2, 0.79], [-1.7, 0.63], [-2.2, 0.49], [-2.38, 0.42]],
      [[-2.38, 0.22]],
      0.58, 0.05,
    );
    warp(g, (v) => {
      const t = clamp01((-0.2 - v.x) / 2.2);
      const f = clamp01((v.x - 0.9) / 0.5);
      v.z *= (1 - 0.55 * t) * (1 - 0.22 * f);
    });
    add(g, red);
  }

  // sidepods with a coke-bottle waist
  for (const sgn of [1, -1]) {
    const g = side(
      [[0.78, 0.2], [0.78, 0.5]],
      [[0.6, 0.57], [0.2, 0.6], [-0.4, 0.56], [-1.0, 0.44], [-1.55, 0.3]],
      [[-1.6, 0.2]],
      0.44, 0.07,
    );
    g.translate(0, 0, sgn * 0.53);
    warp(g, (v) => {
      const t = clamp01((-0.2 - v.x) / 1.35);
      v.z *= 1 - 0.42 * t;
    });
    add(g, red);
    add(box(0.07, 0.22, 0.34), carbon, 0.8, 0.4, sgn * 0.53); // inlet
    // white flash along the top of the pod
    const flash = add(box(1.2, 0.012, 0.16), white, 0.05, 0.645, sgn * 0.53);
    flash.rotation.z = -0.04;
  }

  // nose, tapering to the tip
  {
    const g = side(
      [[1.3, 0.2], [1.3, 0.52]],
      [[1.7, 0.47], [2.2, 0.33], [2.6, 0.21]],
      [[2.68, 0.16], [2.62, 0.12], [1.3, 0.18]],
      0.34, 0.04,
    );
    warp(g, (v) => {
      v.z *= 1 - 0.62 * clamp01((v.x - 1.3) / 1.38);
    });
    add(g, red);
    add(box(0.16, 0.05, 0.12), white, 2.58, 0.17, 0); // nose tip
  }

  // front wing: three elements and endplates
  add(box(0.5, 0.035, 1.92), carbon, 2.56, 0.1, 0);
  const fw2 = add(box(0.34, 0.03, 1.72), carbon, 2.44, 0.155, 0);
  fw2.rotation.z = -0.28;
  const fw3 = add(box(0.24, 0.03, 1.6), red, 2.33, 0.21, 0);
  fw3.rotation.z = -0.42;
  for (const sgn of [1, -1]) {
    add(box(0.62, 0.24, 0.03), red, 2.5, 0.19, sgn * 0.98);
    rod([2.2, 0.2, sgn * 0.08], [2.42, 0.12, sgn * 0.12], 0.02);
  }

  // rear wing, beam wing, pylon
  for (const sgn of [1, -1]) add(box(0.78, 0.64, 0.035), red, -2.46, 0.72, sgn * 0.63);
  add(box(0.44, 0.05, 1.24), carbon, -2.45, 0.95, 0);
  const flap = add(box(0.3, 0.04, 1.24), carbon, -2.6, 1.07, 0);
  flap.rotation.z = 0.38;
  add(box(0.3, 0.04, 1.1), carbon, -2.4, 0.46, 0);
  add(box(0.26, 0.42, 0.05), carbon, -2.32, 0.76, 0);
  add(box(0.05, 0.08, 0.1), rain, -2.42, 0.32, 0);
  const diff = add(box(0.5, 0.03, 1.0), carbon, -2.3, 0.16, 0);
  diff.rotation.z = -0.25;

  // shark fin with the car number on both sides
  {
    const g = side([[-0.45, 0.96]], [], [[-2.3, 1.02], [-2.3, 0.52], [-1.6, 0.64], [-1.0, 0.79], [-0.45, 0.93]], 0.022, 0);
    add(g, red);
  }

  // cockpit, driver helmet, halo, airbox, mirrors
  const pit = add(new THREE.SphereGeometry(1, 24, 12), carbon, 0.28, 0.63, 0);
  pit.scale.set(0.52, 0.1, 0.24);
  add(new THREE.SphereGeometry(0.13, 24, 16), white, 0.14, 0.74, 0);
  const vz = add(box(0.06, 0.05, 0.16), visor, 0.25, 0.76, 0);
  vz.rotation.z = -0.2;
  {
    const hoop = new THREE.CatmullRomCurve3(
      ([[0.02, 0.8, 0.3], [0.35, 0.85, 0.3], [0.58, 0.85, 0.14], [0.64, 0.85, 0], [0.58, 0.85, -0.14], [0.35, 0.85, -0.3], [0.02, 0.8, -0.3]] as const).map(
        ([x, y, z]) => new THREE.Vector3(x, y, z),
      ),
    );
    add(new THREE.TubeGeometry(hoop, 48, 0.032, 8, false), carbon);
    rod([0.62, 0.62, 0], [0.64, 0.85, 0], 0.03);
    rod([0.02, 0.8, 0.3], [0.0, 0.64, 0.28], 0.025);
    rod([0.02, 0.8, -0.3], [0.0, 0.64, -0.28], 0.025);
  }
  const airbox = add(new THREE.SphereGeometry(1, 20, 12), carbon, -0.24, 0.94, 0);
  airbox.scale.set(0.06, 0.07, 0.1);
  for (const sgn of [1, -1]) {
    rod([0.6, 0.6, sgn * 0.28], [0.6, 0.7, sgn * 0.42], 0.012);
    add(box(0.06, 0.06, 0.14), red, 0.6, 0.72, sgn * 0.46);
  }

  // number decals (canvas textures)
  const decal = (text: string, w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.font = `italic 900 190px ${numberFont}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 256, 140);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  };
  for (const sgn of [1, -1]) {
    const fin = decal("A10", 0.5, 0.25);
    fin.position.set(-1.85, 0.8, sgn * 0.016);
    if (sgn < 0) fin.rotation.y = Math.PI;
    spinner.add(fin);
    const pod = decal("A10", 0.62, 0.31);
    pod.position.set(-0.2, 0.4, sgn * 0.835);
    if (sgn < 0) pod.rotation.y = Math.PI;
    spinner.add(pod);
  }

  // wheels
  const wheels: T.Group[] = [];
  const wheel = (x: number, z: number, r: number, w: number) => {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 48, 1), rubber);
    tire.rotation.x = Math.PI / 2;
    g.add(tire);
    for (const s of [1, -1]) {
      const lip = new THREE.Mesh(new THREE.TorusGeometry(r - 0.028, 0.03, 10, 48), rubber);
      lip.position.z = (s * w) / 2;
      g.add(lip);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.8, 0.011, 8, 48), yellow);
      ring.position.z = s * (w / 2 + 0.006);
      g.add(ring);
      const cover = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.02, 32), rimMat);
      cover.rotation.x = Math.PI / 2;
      cover.position.z = s * (w / 2 - 0.004);
      g.add(cover);
      for (let k = 0; k < 5; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, 0.03, 0.012), carbon);
        spoke.rotation.z = (k / 5) * Math.PI * 2;
        spoke.position.set(Math.cos(spoke.rotation.z) * r * 0.27, Math.sin(spoke.rotation.z) * r * 0.27, s * (w / 2 + 0.008));
        g.add(spoke);
      }
    }
    g.position.set(x, r, z);
    spinner.add(g);
    wheels.push(g);
    return g;
  };
  wheel(1.75, 0.82, 0.36, 0.36);
  wheel(1.75, -0.82, 0.36, 0.36);
  wheel(-1.85, 0.78, 0.37, 0.44);
  wheel(-1.85, -0.78, 0.37, 0.44);

  // suspension arms from the chassis to each hub
  for (const sgn of [1, -1]) {
    rod([1.45, 0.42, sgn * 0.2], [1.75, 0.42, sgn * 0.62]);
    rod([1.05, 0.4, sgn * 0.22], [1.75, 0.42, sgn * 0.62]);
    rod([1.45, 0.24, sgn * 0.2], [1.75, 0.3, sgn * 0.62]);
    rod([1.05, 0.24, sgn * 0.22], [1.75, 0.3, sgn * 0.62]);
    rod([-1.9, 0.5, sgn * 0.2], [-1.85, 0.44, sgn * 0.56]);
    rod([-1.6, 0.48, sgn * 0.24], [-1.85, 0.44, sgn * 0.56]);
    rod([-2.1, 0.26, sgn * 0.22], [-1.85, 0.3, sgn * 0.56]);
  }

  spinner.add(contactShadow(THREE));

  return { root, spinner, wheels };
}

/** soft radial shadow on the ground under a car pointing along x */
export function contactShadow(THREE: Three, w = 6.6, d = 2.8) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grd.addColorStop(0, "rgba(0,0,0,0.75)");
  grd.addColorStop(0.6, "rgba(0,0,0,0.35)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  return shadow;
}
