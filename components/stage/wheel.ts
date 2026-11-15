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
  /** what the dash shows and whose button is ringed: -1 = the team, 0.. = that driver */
  show: (face: number) => void;
  /** 0..1: how far the row of shift lights has filled */
  rev: (t: number) => void;
  /** the ring round one driver's button pulses out by k (0..1) as they are called */
  press: (driver: number, k: number) => void;
  /** the middle dial, one click round per driver */
  click: (turns: number) => void;
};

/** the wheel is this wide in the scene's units, whatever size the file was drawn at */
const WIDTH = 1.08;
const LED_OFF = 0x23262b;
const LED_ON = [0x34d399, 0xff3b30, 0xffd60a]; // a third of the row each, left to right

/**
 * Which button the roll call rings for each driver, in the file's own coordinates (x right, y up, as built by
 * tools/models/build-wheel.mjs): the red one, the yellow one, the white one and the green one, so every driver
 * gets the cap in their own colour, and the four fall right, left, right, left.
 */
const DRIVER_BUTTONS: [number, number][] = [
  [0.994, -0.04],
  [-0.953, 0.28],
  [0.936, 0.28],
  [-1.023, -0.375],
];
const BUTTON_RADIUS = 0.105;

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

/**
 * The steering wheel of the driver roll call: "McLaren Formula 1 Steering Wheel" by dhimasdc9 (CC BY 4.0, credited
 * in the footer), lightened by tools/models/build-wheel.mjs. On top of the file the page adds its own dash (the
 * team, or the driver being called), drives the row of shift lights, turns the middle dial and rings one button.
 * Centred on the origin, facing +z.
 */
export function buildWheel(THREE: Three, faces: WheelFaces, model: T.Object3D): WheelRig {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.order = "YXZ"; // lean first, then turn
  const spin = new THREE.Group(); // steering
  root.add(tilt);
  tilt.add(spin);

  // fit: WIDTH across, centred, its face on z = 0
  const holder = new THREE.Group();
  holder.add(model);
  spin.add(holder);
  root.updateMatrixWorld(true);
  const all = new THREE.Box3().setFromObject(model);
  const k = WIDTH / (all.max.x - all.min.x);
  const mid = all.getCenter(new THREE.Vector3());
  holder.scale.setScalar(k);
  holder.position.set(-mid.x * k, -mid.y * k, -all.max.z * k);
  root.updateMatrixWorld(true);
  /** a point given in the file's coordinates, in the wheel's */
  const at = (x: number, y: number, z = all.max.z) => new THREE.Vector3((x - mid.x) * k, (y - mid.y) * k, (z - all.max.z) * k);
  const boxOf = (name: string) => {
    const o = model.getObjectByName(name);
    return o ? new THREE.Box3().setFromObject(o) : null;
  };

  model.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const m = mesh.material as T.MeshStandardMaterial;
    if (m && "envMapIntensity" in m) m.envMapIntensity = 0.55; // black parts on a dark page: little of the bright room in them
  });

  // ---- dash: the page's own picture, laid just in front of the file's blank screen and its glass --------------------
  const textures = [-1, ...faces.drivers.map((_, i) => i)].map((i) => drawFace(THREE, faces, i));
  const dash = new THREE.MeshBasicMaterial({ map: textures[0], toneMapped: false });
  const screen = boxOf("SCREEN");
  if (screen) {
    const size = screen.getSize(new THREE.Vector3());
    const c = screen.getCenter(new THREE.Vector3());
    const front = Math.max(screen.max.z, boxOf("GLASS")?.max.z ?? -1) + 0.0015;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.985, size.y * 0.985), dash);
    plane.position.set(c.x, c.y, front);
    spin.add(plane);
  }

  // ---- shift lights: the file's row of lamps is one mesh; its triangles are sorted into lamps by where they sit,
  // and each lamp gets a material of its own so it can be lit ---------------------------------------------------------
  const leds: T.MeshBasicMaterial[] = [];
  const row = model.getObjectByName("LEDS_TOP") as T.Mesh | undefined;
  if (row?.isMesh && row.geometry.index) {
    const geo = row.geometry;
    const pos = geo.getAttribute("position");
    const idx = geo.index!;
    const v = new THREE.Vector3();
    const tris: { x: number; i: [number, number, number] }[] = [];
    for (let t = 0; t < idx.count; t += 3) {
      const i: [number, number, number] = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
      let x = 0;
      for (const n of i) x += v.fromBufferAttribute(pos, n).applyMatrix4(row.matrixWorld).x / 3;
      tris.push({ x, i });
    }
    tris.sort((p, q) => p.x - q.x);
    const gap = (tris[tris.length - 1].x - tris[0].x) / 80; // lamps are further apart than this, a lamp's own triangles are not
    const order: number[] = [];
    geo.clearGroups();
    let start = 0;
    tris.forEach((t, n) => {
      if (n > 0 && t.x - tris[n - 1].x > gap) {
        geo.addGroup(start, order.length - start, leds.length);
        leds.push(new THREE.MeshBasicMaterial({ color: LED_OFF, toneMapped: false }));
        start = order.length;
      }
      order.push(...t.i);
    });
    geo.addGroup(start, order.length - start, leds.length);
    leds.push(new THREE.MeshBasicMaterial({ color: LED_OFF, toneMapped: false }));
    geo.setIndex(order);
    row.material = leds;
  }

  // ---- the middle dial turns about its own centre ---------------------------------------------------------------
  const knob = model.getObjectByName("KNOB_MID");
  const dial = new THREE.Group();
  if (knob) {
    dial.position.copy(new THREE.Box3().setFromObject(knob).getCenter(new THREE.Vector3()));
    spin.add(dial);
    dial.updateMatrixWorld(true);
    dial.attach(knob);
  }

  // ---- a ring round each driver's button, in their colour, shown while they are being called ----------------------
  const face = (boxOf("BUTTONS")?.max.z ?? 0) + 0.002;
  const rings = faces.drivers.slice(0, DRIVER_BUTTONS.length).map((d, i) => {
    const [x, y] = DRIVER_BUTTONS[i];
    const r = BUTTON_RADIUS * k;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.12, r * 1.36, 48), new THREE.MeshBasicMaterial({ color: d.color, toneMapped: false }));
    ring.position.copy(at(x, y)).setZ(face);
    ring.visible = false;
    spin.add(ring);
    return ring;
  });

  let shown = 0;
  let lit = -1;
  return {
    root,
    pose(steer, yaw, pitch) {
      spin.rotation.z = steer;
      tilt.rotation.set(pitch, yaw, 0);
    },
    show(f) {
      const i = Math.max(0, Math.min(textures.length - 1, f + 1));
      if (i === shown) return;
      shown = i;
      dash.map = textures[i];
      rings.forEach((ring, d) => (ring.visible = d === f));
    },
    rev(t) {
      const n = Math.round(Math.max(0, Math.min(1, t)) * leds.length);
      if (n === lit) return;
      lit = n;
      leds.forEach((m, i) => m.color.setHex(i < n ? LED_ON[Math.min(2, Math.floor((i * 3) / leds.length))] : LED_OFF));
    },
    press(driver, amount) {
      rings.forEach((ring, d) => ring.scale.setScalar(d === driver ? 1 + 0.3 * amount : 1));
    },
    click(turns) {
      dial.rotation.z = (-turns / 12) * Math.PI * 2;
    },
  };
}
