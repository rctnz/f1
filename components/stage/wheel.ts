import type * as T from "three";

type Three = typeof import("three");

export type WheelFaces = {
  done: number;
  total: number;
  drivers: { no: string; first: string; last: string; color: string }[];
  poster: string;
  mono: string;
};

export type WheelRig = {
  root: T.Group;
  /** steering angle (radians, positive = left), then how the whole wheel is turned and leant towards the camera */
  pose: (steer: number, yaw: number, pitch: number) => void;
  /** what the dash shows and whose button is lit: -1 = the team, 0.. = that driver */
  show: (face: number) => void;
  /** 0..1: how far the row of shift lights has filled */
  rev: (t: number) => void;
  /** one driver's button pushed in by k (0..1); every other button sits proud */
  press: (driver: number, k: number) => void;
  /** the mode dial, one click round per driver */
  click: (turns: number) => void;
};

type XY = [number, number];

const LEDS = 15;
const LED_OFF = 0x23262b;
const LED_ON = [0x34d399, 0xff3b30, 0xffd60a]; // five of each, left to right
const RING_OFF = 0x343840;
const FACE = 0.045; // z of the faceplate's front surface

// where the controls sit on the faceplate (wheel units: the wheel is a little over one unit wide, +y up)
const BUTTON_X = 0.262;
const BUTTON_Y = [0.128, 0.048, -0.032];
const DIALS: { x: number; y: number; name: string; ticks: number }[] = [
  { x: -0.155, y: -0.15, name: "ROUND", ticks: 16 },
  { x: 0, y: -0.15, name: "MODE", ticks: 12 },
  { x: 0.155, y: -0.15, name: "BIAS", ticks: 12 },
];

/** the dash: the team's season count, or one driver's number and name, drawn with the page's own type */
function drawFace(THREE: Three, f: WheelFaces, face: number) {
  const c = document.createElement("canvas");
  c.width = 704;
  c.height = 416;
  const g = c.getContext("2d")!;
  g.fillStyle = "#07080a";
  g.fillRect(0, 0, c.width, c.height);
  g.textBaseline = "alphabetic";
  const fit = (text: string, font: (px: number) => string, px: number, max: number) => {
    let size = px;
    g.font = font(size);
    while (g.measureText(text).width > max && size > 12) {
      size -= 2;
      g.font = font(size);
    }
  };
  if (face < 0) {
    g.fillStyle = "#eef1f4";
    g.font = `italic 900 210px ${f.poster}`;
    g.fillText("A10", 44, 232);
    g.font = `600 30px ${f.mono}`;
    g.fillStyle = "#a3aab3";
    g.textAlign = "right";
    g.fillText("CPE102", c.width - 44, 70);
    g.fillStyle = "#ff3b30";
    g.font = `italic 900 76px ${f.poster}`;
    g.fillText(`${f.done}/${f.total}`, c.width - 44, 232);
    g.textAlign = "left";
    const gap = 8;
    const cw = (c.width - 88 - gap * (f.total - 1)) / f.total;
    for (let i = 0; i < f.total; i++) {
      g.fillStyle = i < f.done ? "#ff3b30" : "#2a2e35";
      g.fillRect(44 + i * (cw + gap), 300, cw, 30);
    }
  } else {
    const d = f.drivers[face];
    g.fillStyle = d.color;
    g.font = `italic 900 250px ${f.poster}`;
    g.fillText(d.no, 36, 262);
    const left = 44 + g.measureText(d.no).width + 28;
    g.fillStyle = "#a3aab3";
    g.font = `600 28px ${f.mono}`;
    g.fillText(`DRIVER ${face + 1}/${f.drivers.length}`, left, 96);
    g.fillStyle = "#eef1f4";
    fit(d.last, (px) => `italic 800 ${px}px ${f.poster}`, 60, c.width - left - 36);
    g.fillText(d.last, left, 170);
    g.fillStyle = "#a3aab3";
    fit(d.first, (px) => `600 ${px}px ${f.mono}`, 30, c.width - left - 36);
    g.fillText(d.first, left, 216);
    g.fillStyle = d.color;
    g.fillRect(44, 316, c.width - 88, 18);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** carbon: a 2x2 twill, every tow lit along its length, tiled across the body */
function weave(THREE: Three) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const cell = 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const over = ((x + y) >> 1) % 2 === 0;
      const v = over ? 36 : 20;
      const grd = g.createLinearGradient(x * cell, y * cell, x * cell + (over ? cell : 0), y * cell + (over ? 0 : cell));
      grd.addColorStop(0, `rgb(${v + 12},${v + 13},${v + 16})`);
      grd.addColorStop(1, `rgb(${v - 10},${v - 9},${v - 7})`);
      g.fillStyle = grd;
      g.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(15, 15);
  tex.anisotropy = 8;
  return tex;
}

/**
 * The grips' colour: charcoal with one red band right round near the top. An extruded shape takes (x, y) as uv on
 * its faces and (y, 1 - z) on its walls, so the band is painted both across and down the picture and each surface
 * finds it at the same height. The picture spans -0.6..0.6 wheel units.
 */
function gripMap(THREE: Three, from: number, to: number) {
  const N = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  g.fillStyle = "#17191c";
  g.fillRect(0, 0, N, N);
  const t = (v: number) => (v / 1.2 + 0.5) * N;
  g.fillStyle = "#a30f1a"; // a shade under the page's red: the grips' sheen lifts it back
  g.fillRect(0, N - t(to), N, t(to) - t(from)); // across: where a face's y is in the band
  g.fillRect(t(from), 0, t(to) - t(from), N); // down: where a wall's y is in the band
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / 1.2, 1 / 1.2);
  tex.offset.set(0.5, 0.5);
  tex.anisotropy = 8;
  return tex;
}

/** what is printed on the faceplate: a frame round each column of buttons, their names, and the scale round each dial */
function markings(THREE: Three, f: WheelFaces, names: string[][]) {
  const S = 2000; // px per wheel unit
  const X0 = -0.36;
  const Y0 = 0.225;
  const c = document.createElement("canvas");
  c.width = 0.72 * S;
  c.height = 0.5 * S;
  const g = c.getContext("2d")!;
  const px = (x: number) => (x - X0) * S;
  const py = (y: number) => (Y0 - y) * S;
  const INK = "#c9ced6";

  g.lineWidth = 3;
  g.strokeStyle = "rgba(201, 206, 214, 0.3)";
  for (const sx of [-1, 1]) {
    const x = px(sx * BUTTON_X - 0.043);
    const y = py(BUTTON_Y[0] + 0.062);
    const w = 0.086 * S;
    const h = (BUTTON_Y[0] - BUTTON_Y[2] + 0.106) * S;
    const r = 0.014 * S;
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
    g.stroke();
  }
  g.fillStyle = INK;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `600 ${0.013 * S}px ${f.mono}`;
  [-1, 1].forEach((sx, col) => BUTTON_Y.forEach((y, row) => g.fillText(names[col][row], px(sx * BUTTON_X), py(y + 0.0445))));

  DIALS.forEach((d, i) => {
    for (let k = 0; k < d.ticks; k++) {
      const a = -Math.PI / 2 + (k / d.ticks) * Math.PI * 2; // 0 at the top, clockwise
      const here = i === 0 && k === f.done - 1; // the round the season has reached
      const long = here || k % 4 === 0;
      g.strokeStyle = here ? "#ff3b30" : "rgba(201, 206, 214, 0.78)";
      g.lineWidth = here ? 6 : 3;
      g.beginPath();
      g.moveTo(px(d.x) + Math.cos(a) * 0.0605 * S, py(d.y) + Math.sin(a) * 0.0605 * S);
      g.lineTo(px(d.x) + Math.cos(a) * (long ? 0.0715 : 0.0672) * S, py(d.y) + Math.sin(a) * (long ? 0.0715 : 0.0672) * S);
      g.stroke();
    }
    g.font = `600 ${0.0115 * S}px ${f.mono}`;
    g.fillText(d.name, px(d.x), py(d.y - 0.0885));
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, w: 0.72, h: 0.5, cx: X0 + 0.36, cy: Y0 - 0.25 };
}

/**
 * An original F1-style steering wheel, modelled here in code (no third-party asset): a carbon body with the two
 * handles cut out of the same plate, cushioned grips, a dash that can show the team or any driver, shift lights,
 * a button for each driver in their colour, three dials, and the paddles and quick release behind.
 * A little over one unit wide, facing +z.
 */
export function buildWheel(THREE: Three, faces: WheelFaces): WheelRig {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.order = "YXZ"; // lean first, then turn
  const spin = new THREE.Group(); // steering
  root.add(tilt);
  tilt.add(spin);

  const carbon = new THREE.MeshPhysicalMaterial({ map: weave(THREE), metalness: 0.1, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 0.32 });
  const suede = new THREE.MeshPhysicalMaterial({ map: gripMap(THREE, 0.098, 0.122), roughness: 0.96, metalness: 0, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0x4a4e57), envMapIntensity: 0.5 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.1, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb4bd, metalness: 1, roughness: 0.3 });
  const knurl = new THREE.MeshStandardMaterial({ color: 0xaeb4bd, metalness: 1, roughness: 0.34, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.55, metalness: 0.2, envMapIntensity: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd60a, metalness: 0.8, roughness: 0.3 });
  // caps keep their colour: a shade under it, since the stage lights them hard, little of the room in them, no lacquer
  const cap = (color: number | string) => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), roughness: 0.42, metalness: 0, envMapIntensity: 0.2 });

  const place = <O extends T.Object3D>(o: O, x = 0, y = 0, z = 0) => {
    o.position.set(x, y, z);
    return o;
  };
  const add = <O extends T.Object3D>(o: O, x = 0, y = 0, z = 0) => {
    spin.add(place(o, x, y, z));
    return o;
  };
  /** a closed path through pts with every corner rounded */
  const trace = (path: T.Path, pts: XY[], r: number) => {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const d0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const d1 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const k = Math.min(r, d0 / 2, d1 / 2);
      const ax = p1[0] + ((p0[0] - p1[0]) * k) / d0;
      const ay = p1[1] + ((p0[1] - p1[1]) * k) / d0;
      if (i === 0) path.moveTo(ax, ay);
      else path.lineTo(ax, ay);
      path.quadraticCurveTo(p1[0], p1[1], p1[0] + ((p2[0] - p1[0]) * k) / d1, p1[1] + ((p2[1] - p1[1]) * k) / d1);
    }
    path.closePath();
    return path;
  };
  const mirror = (pts: XY[]): XY[] => pts.map(([x, y]) => [-x, y] as XY).reverse();
  const extrude = (shape: T.Shape, depth: number, bevel: number, mat: T.Material, segments = 4) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: segments, curveSegments: 10 });
    geo.translate(0, 0, -depth / 2);
    return new THREE.Mesh(geo, mat);
  };
  /** a cylinder whose axis points out of the face; r0 is the radius at the front */
  const disc = (r0: number, r1: number, depth: number, mat: T.Material, sides = 32) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, depth, sides), mat);
    m.rotation.x = Math.PI / 2;
    return m;
  };

  // ---- body: one plate, the handles part of it, a slot for the fingers between each handle and the dash ----------
  const half: XY[] = [
    [0.215, 0.2],
    [0.3, 0.228],
    [0.452, 0.24],
    [0.5, 0.19],
    [0.512, -0.03],
    [0.482, -0.25],
    [0.412, -0.28],
    [0.338, -0.226],
    [0.228, -0.258],
  ];
  const body = trace(new THREE.Shape(), [...half, ...mirror(half)], 0.034) as T.Shape;
  const slot: XY[] = [
    [0.342, 0.12],
    [0.39, 0.142],
    [0.402, -0.128],
    [0.352, -0.15],
  ];
  body.holes.push(trace(new THREE.Path(), slot, 0.02), trace(new THREE.Path(), mirror(slot), 0.02));
  add(extrude(body, 0.066, 0.012, carbon));

  // ---- grips: a thick, soft-edged sleeve over each handle, with the red band from the map ------------------------
  const grip: XY[] = [
    [0.428, 0.205],
    [0.458, 0.232],
    [0.498, 0.19],
    [0.512, -0.03],
    [0.484, -0.245],
    [0.42, -0.27],
    [0.412, -0.21],
    [0.426, -0.02],
  ];
  add(extrude(trace(new THREE.Shape(), grip, 0.03) as T.Shape, 0.086, 0.03, suede, 7));
  add(extrude(trace(new THREE.Shape(), mirror(grip), 0.03) as T.Shape, 0.086, 0.03, suede, 7));

  // ---- dash: glossy bezel, the picture, and the shift lights in their own strip above it --------------------------
  const rounded = (w: number, h: number, r: number) =>
    trace(
      new THREE.Shape(),
      [
        [-w / 2, h / 2],
        [w / 2, h / 2],
        [w / 2, -h / 2],
        [-w / 2, -h / 2],
      ],
      r,
    ) as T.Shape;
  add(extrude(rounded(0.372, 0.236, 0.03), 0.016, 0.004, gloss), 0, 0.046, FACE + 0.012);
  const textures = [-1, ...faces.drivers.map((_, i) => i)].map((i) => drawFace(THREE, faces, i));
  const dash = new THREE.MeshBasicMaterial({ map: textures[0], toneMapped: false });
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.336, 0.2), dash), 0, 0.046, FACE + 0.0245);
  add(extrude(rounded(0.35, 0.024, 0.012), 0.006, 0.002, dark), 0, 0.1835, FACE + 0.004);
  const leds: T.MeshBasicMaterial[] = [];
  for (let i = 0; i < LEDS; i++) {
    const m = new THREE.MeshBasicMaterial({ color: LED_OFF, toneMapped: false });
    leds.push(m);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.0155, 0.011, 0.004), m), (i - (LEDS - 1) / 2) * 0.0216, 0.1835, FACE + 0.0095);
  }

  // ---- what is printed on the plate -----------------------------------------------------------------------------
  const [d0, d1, d2, d3] = faces.drivers;
  // the drivers' buttons alternate sides in the order they are called: left, right, left, right
  const print = markings(THREE, faces, [
    [d0?.no ?? "", d2?.no ?? "", "N"],
    [d1?.no ?? "", d3?.no ?? "", "PIT"],
  ]);
  add(new THREE.Mesh(new THREE.PlaneGeometry(print.w, print.h), new THREE.MeshBasicMaterial({ map: print.tex, transparent: true, depthWrite: false, toneMapped: false })), print.cx, print.cy, FACE + 0.0012);

  // ---- buttons: a collar, a ring that lights for the driver being called, and a cap that can be pushed in ----------
  type Button = { cap: T.Mesh; ring: T.MeshBasicMaterial; color: T.Color; z: number };
  const button = (x: number, y: number, color: number | string): Button => {
    add(disc(0.031, 0.031, 0.012, dark), x, y, FACE + 0.004);
    const ring = new THREE.MeshBasicMaterial({ color: RING_OFF, toneMapped: false });
    add(new THREE.Mesh(new THREE.RingGeometry(0.0335, 0.0388, 48), ring), x, y, FACE + 0.002);
    const z = FACE + 0.021;
    return { cap: add(disc(0.0215, 0.0245, 0.022, cap(color)), x, y, z), ring, color: new THREE.Color(color), z };
  };
  const calls: Button[] = [
    button(-BUTTON_X, BUTTON_Y[0], d0?.color ?? 0xff3b30),
    button(BUTTON_X, BUTTON_Y[0], d1?.color ?? 0xffd60a),
    button(-BUTTON_X, BUTTON_Y[1], d2?.color ?? 0xa3aab3),
    button(BUTTON_X, BUTTON_Y[1], d3?.color ?? 0x34d399),
  ];
  button(-BUTTON_X, BUTTON_Y[2], 0xeef1f4);
  button(BUTTON_X, BUTTON_Y[2], 0xeef1f4);

  // ---- dials: a knurled knob on a collar, a coloured cap and a white pointer -------------------------------------
  const dial = (x: number, y: number, color: number) => {
    add(disc(0.056, 0.058, 0.008, dark, 40), x, y, FACE + 0.004);
    const knob = new THREE.Group();
    knob.add(place(disc(0.038, 0.045, 0.04, knurl, 12), 0, 0, 0.02));
    knob.add(place(disc(0.028, 0.028, 0.006, cap(color), 28), 0, 0, 0.043));
    knob.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.022, 0.004), cap(0xeef1f4)), 0, 0.013, 0.047));
    return add(knob, x, y, FACE + 0.008);
  };
  const round = dial(DIALS[0].x, DIALS[0].y, 0xc1121f);
  round.rotation.z = (-(faces.done - 1) / DIALS[0].ticks) * Math.PI * 2; // points at the round the season has reached
  const mode = dial(DIALS[1].x, DIALS[1].y, 0x6b727c);
  dial(DIALS[2].x, DIALS[2].y, 0xffd60a).rotation.z = Math.PI / 3;

  // ---- fixings on the bridges between the dash and the handles ----------------------------------------------------
  for (const [x, y] of [
    [0.318, 0.192],
    [0.3, -0.196],
  ] as XY[]) {
    add(disc(0.0105, 0.0105, 0.006, knurl, 6), x, y, FACE + 0.002);
    add(disc(0.0105, 0.0105, 0.006, knurl, 6), -x, y, FACE + 0.002);
  }

  // ---- behind: gear paddles above, clutch paddles below, and the quick release on the column ----------------------
  for (const sx of [-1, 1]) {
    const blade = (pts: XY[], y: number, z: number) => {
      const s = trace(new THREE.Shape(), pts.map(([x, py]) => [sx * x, py] as XY), 0.012) as T.Shape;
      add(extrude(s, 0.012, 0.003, carbon, 2), 0, y, z);
    };
    blade(
      [
        [0.07, 0.03],
        [0.45, 0.085],
        [0.485, 0.0],
        [0.41, -0.062],
        [0.07, -0.03],
      ],
      0.02,
      -0.085,
    );
    blade(
      [
        [0.06, 0.024],
        [0.33, 0.04],
        [0.355, -0.02],
        [0.29, -0.058],
        [0.06, -0.026],
      ],
      -0.125,
      -0.095,
    );
  }
  add(disc(0.11, 0.11, 0.05, dark, 40), 0, -0.02, -0.062);
  add(disc(0.074, 0.074, 0.11, steel, 32), 0, -0.02, -0.14);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.079, 0.013, 12, 40), gold), 0, -0.02, -0.105);

  let shown = 0;
  let lit = -1;
  const off = new THREE.Color(RING_OFF);
  return {
    root,
    pose(steer, yaw, pitch) {
      spin.rotation.z = steer;
      tilt.rotation.set(pitch, yaw, 0);
    },
    show(face) {
      const i = Math.max(0, Math.min(textures.length - 1, face + 1));
      if (i === shown) return;
      shown = i;
      dash.map = textures[i];
      calls.forEach((b, d) => b.ring.color.copy(d === face ? b.color : off));
    },
    rev(t) {
      const n = Math.round(Math.max(0, Math.min(1, t)) * LEDS);
      if (n === lit) return;
      lit = n;
      leds.forEach((m, i) => m.color.setHex(i < n ? LED_ON[Math.floor(i / 5)] : LED_OFF));
    },
    press(driver, k) {
      calls.forEach((b, d) => (b.cap.position.z = b.z - (d === driver ? 0.012 * k : 0)));
    },
    click(turns) {
      mode.rotation.z = (-turns / DIALS[1].ticks) * Math.PI * 2;
    },
  };
}
