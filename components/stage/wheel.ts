import type * as T from "three";
import { clamp01, inOut3 } from "@/lib/stage";
import type { Anchor } from "./car";

type Three = typeof import("three");

export type WheelRig = {
  root: T.Group;
  /** yaw in radians, and how far it has been laid back on the bench (0 = facing the camera, 1 = flat, face up) */
  pose: (yaw: number, lie: number) => void;
  /** 0 = assembled, 1 = layers fully apart */
  explode: (t: number) => void;
  /** where each label's leader line starts, in the order of WHEEL_PARTS (lib/data.ts) */
  anchors: Anchor[];
};

export type Display = { done: number; total: number; poster: string; mono: string };

/** how far each layer lifts along the wheel's face normal (the wheel is 1 unit wide) and when it leaves */
const LAYERS: [string, number, number][] = [
  ["screen", 0.84, 0],
  ["dials", 0.62, 1],
  ["controls", 0.42, 2],
  ["body", 0.14, 3],
  ["grips", -0.1, 3],
  ["paddles", -0.4, 4],
  ["hub", -0.7, 5],
];
const STEP = 0.07;
const LAST = 5;

/** what the dash shows: the season so far, drawn with the page's own type */
function drawDisplay(THREE: Three, d: Display) {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 352;
  const g = c.getContext("2d")!;
  g.fillStyle = "#07080a";
  g.fillRect(0, 0, c.width, c.height);
  g.textBaseline = "alphabetic";
  // rounds done, large
  g.font = `italic 900 200px ${d.poster}`;
  const a = String(d.done);
  const b = `/${d.total}`;
  const wa = g.measureText(a).width;
  const wb = g.measureText(b).width;
  const x0 = (c.width - wa - wb) / 2;
  g.fillStyle = "#ff3b30";
  g.fillText(a, x0, 222);
  g.fillStyle = "#eef1f4";
  g.fillText(b, x0 + wa, 222);
  // one cell per round
  const n = d.total;
  const gap = 6;
  const cw = (c.width - 80 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i < d.done ? "#ff3b30" : "#2a2e35";
    g.fillRect(40 + i * (cw + gap), 270, cw, 22);
  }
  g.font = `600 30px ${d.mono}`;
  g.fillStyle = "#a3aab3";
  g.fillText("A10", 40, 52);
  g.textAlign = "right";
  g.fillText("ROUNDS", c.width - 40, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildWheel(THREE: Three, model: T.Object3D, aniso: number, display: Display): WheelRig {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.order = "YXZ"; // lie back first, then turn on the bench
  root.add(tilt);

  // the file's face looks along +y with the top of the wheel towards -z: stand it up, facing +z, 1 unit wide
  const fit = new THREE.Group();
  fit.rotation.x = Math.PI / 2;
  fit.add(model);
  tilt.add(fit);
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(fit);
  const scale = 1 / (box.max.x - box.min.x);
  fit.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(fit);
  const c = box.getCenter(new THREE.Vector3());
  fit.position.set(-c.x, -c.y, -c.z);
  root.updateMatrixWorld(true);

  model.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const m = mesh.material as T.MeshStandardMaterial;
    for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = aniso;
  });

  const layers: Record<string, T.Group> = {};
  for (const [name] of LAYERS) {
    const node = model.getObjectByName(name);
    if (!node) continue;
    const g = new THREE.Group();
    g.name = name;
    tilt.add(g);
    g.attach(node);
    layers[name] = g;
  }

  // the blank LCD gets a picture: a plane just proud of the glass
  if (layers.screen) {
    const b = new THREE.Box3().setFromObject(layers.screen);
    const size = b.getSize(new THREE.Vector3());
    const mid = b.getCenter(new THREE.Vector3());
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.985, size.y * 0.97), new THREE.MeshBasicMaterial({ map: drawDisplay(THREE, display), toneMapped: false }));
    lcd.position.set(mid.x, mid.y, b.max.z + 0.0015);
    layers.screen.add(lcd);
  }

  // leader lines start at each layer's right-hand edge, towards the label column
  const edge = (name: string, fx = 0.94, fy = 0.5): Anchor | null => {
    const g = layers[name];
    if (!g) return null;
    const b = new THREE.Box3().setFromObject(g);
    return { object: g, at: new THREE.Vector3(b.min.x + (b.max.x - b.min.x) * fx, b.min.y + (b.max.y - b.min.y) * fy, b.max.z) };
  };
  const anchors = [edge("screen", 0.97, 0.5), edge("dials", 0.97, 0.5), edge("controls", 0.9, 0.42), edge("grips", 0.93, 0.3), edge("paddles", 0.9, 0.5), edge("hub", 0.9, 0.5)].filter(Boolean) as Anchor[];

  return {
    root,
    anchors,
    pose(yaw, lie) {
      tilt.rotation.set((-Math.PI / 2) * lie, yaw, 0);
    },
    explode(t) {
      const T0 = clamp01(t) * (1 + STEP * LAST);
      for (const [name, z, k] of LAYERS) {
        const g = layers[name];
        if (g) g.position.z = z * inOut3(clamp01(T0 - k * STEP));
      }
    },
  };
}
