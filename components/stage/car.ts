import type * as T from "three";
import { clamp01, inOut3, smooth } from "@/lib/stage";

type Three = typeof import("three");

export type Anchor = { object: T.Object3D; at: T.Vector3 };
export type CarRig = {
  /** moves along the track; the car points along +x and stands on y = 0 */
  root: T.Group;
  wheelRadius: number;
  /** absolute wheel angle in radians (distance rolled / radius) */
  spin: (angle: number) => void;
  /** 0 = assembled, 1 = fully apart; the part under label `focus` eases a little further out by k */
  explode: (t: number, focus?: number, k?: number) => void;
  /** where each label's leader line starts, in the order of CAR_PARTS (lib/data.ts) */
  anchors: Anchor[];
};

/** which exploded-view group each top-level part of the file belongs to */
const RULES: [RegExp, string][] = [
  [/^FWING/, "fwing"],
  [/^FRONT_186/, "nose"],
  [/^HALO/, "halo"],
  [/^(CAR_CHASSIS|HEADREST|MIRROR|CAMERAS|ANTENNA)/, "body"],
  [/^COCKPIT_HR/, "cockpit"],
  [/^(DRS1|ERS_LIGHTS)/, "rear"],
  [/^HUB_RF/, "wFR"],
  [/^HUB_LF/, "wFL"],
  [/^SUSP_RR/, "wRR"],
  [/^SUSP_LR/, "wRL"],
  [/^SUS_\w+_FR_/, "sFR"],
  [/^SUS_\w+_FL_/, "sFL"],
  [/^SUS_\w+_RR_/, "sRR"],
  [/^SUS_\w+_RL_/, "sRL"],
  [/^SCREWS/, "screws"],
];

/** how far each group travels (metres: forward, up, to the car's right) and when it leaves (0 = first) */
const APART: Record<string, [number, number, number, number]> = {
  halo: [0, 1.5, 0, 0],
  body: [0, 0.92, 0, 1],
  cockpit: [0, 0.42, 0, 2],
  nose: [0.8, 0.22, 0, 3],
  fwing: [1.55, 0, 0, 4],
  rear: [-1.3, 0.3, 0, 4],
  wFR: [0.2, 0, 0.95, 5],
  wFL: [0.2, 0, -0.95, 5],
  sFR: [0.1, 0, 0.42, 5],
  sFL: [0.1, 0, -0.42, 5],
  wRR: [-0.2, 0, 0.95, 6],
  wRL: [-0.2, 0, -0.95, 6],
  sRR: [-0.1, 0, 0.42, 6],
  sRL: [-0.1, 0, -0.42, 6],
  floor: [0, 0, 0, 7],
  screws: [0, 0, 0, 7],
};
const STEP = 0.07; // gap between one group leaving and the next
const LAST = 7;

const WHEELS: [string, string][] = [
  ["WHEEL_RF_19", "wFR"],
  ["WHEEL_LF_40", "wFL"],
  ["HUB_RR_70", "wRR"],
  ["HUB_LR_55", "wRL"],
];

/** the file ships every surface as a mirror-finish metal; these are the finishes the parts really have */
function finish(THREE: Three, m: T.MeshPhysicalMaterial, aniso: number) {
  const n = m.name;
  if (m.map) m.map.anisotropy = aniso;
  const set = (metalness: number, roughness: number, clearcoat = 0, clearcoatRoughness = 0.2) => {
    m.metalness = metalness;
    m.roughness = roughness;
    if ("clearcoat" in m) {
      m.clearcoat = clearcoat;
      m.clearcoatRoughness = clearcoatRoughness;
    }
  };
  if (n === "CAR_CHASSIS") set(0.42, 0.36, 1, 0.07); // lacquered paint
  else if (n === "TIRE_TREAD") set(0, 0.95);
  else if (n === "TIRE_SIDES") set(0, 0.72);
  else if (/CARBON|FLOOR|INTERNAL|PADDING/.test(n)) set(0.25, 0.46, 0.45, 0.35);
  else if (/RIM_COVER|WHEEL_NUTS|^material$/.test(n)) set(0.45, 0.48);
  else if (/chrome|EXHAUST|METAL|SCREWS/.test(n)) set(1, 0.3);
  else if (n === "DECALS_1") {
    set(0, 0.5);
    m.transparent = true;
    m.depthWrite = false;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
    m.side = THREE.FrontSide;
  } else if (/LEDS|LIGHTS|material_30/.test(n)) set(0, 0.4);
  else set(0.1, 0.62);
  m.needsUpdate = true;
}

export function buildCar(THREE: Three, model: T.Object3D, shadowMap: T.Texture, aniso: number): CarRig {
  const root = new THREE.Group();
  const turn = new THREE.Group(); // the file's nose points along +z; the track runs along +x
  turn.rotation.y = Math.PI / 2;
  root.add(turn);
  turn.add(model);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turn);
  const c = box.getCenter(new THREE.Vector3());
  turn.position.set(-c.x, -box.min.y, -c.z);
  root.updateMatrixWorld(true);

  const done = new Set<T.Material>();
  model.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false; // the whole car is one subject: it is either in the shot or just off its edge
    const m = mesh.material as T.MeshPhysicalMaterial;
    if (m && !done.has(m)) {
      done.add(m);
      finish(THREE, m, aniso);
    }
  });

  // file the parts under the groups the exploded view moves
  const groups: Record<string, T.Group> = {};
  const group = (name: string) => {
    if (!groups[name]) {
      groups[name] = new THREE.Group();
      groups[name].name = name;
      root.add(groups[name]);
    }
    return groups[name];
  };
  let parts: T.Object3D = model;
  while (parts.children.length === 1 && !(parts.children[0] as T.Mesh).isMesh) parts = parts.children[0];
  for (const child of [...parts.children]) {
    const rule = RULES.find(([re]) => re.test(child.name));
    group(rule ? rule[1] : "floor").attach(child);
  }
  // pieces the build script split out of bigger meshes: the rear wing, and the metal fittings on each wing
  for (const [name, g] of [["RWING", "rear"], ["METAL_R", "rear"], ["METAL_F", "fwing"]]) {
    const piece = groups.floor?.getObjectByName(name);
    if (piece) group(g).attach(piece);
  }

  // each wheel turns about its own centre
  const pivots: T.Group[] = [];
  let wheelRadius = 0.36;
  for (const [name, g] of WHEELS) {
    const wheel = groups[g]?.getObjectByName(name);
    if (!wheel) continue;
    const wb = new THREE.Box3().setFromObject(wheel);
    const pivot = new THREE.Group();
    pivot.position.copy(wb.getCenter(new THREE.Vector3()));
    groups[g].add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(wheel);
    pivots.push(pivot);
    if (name === "WHEEL_RF_19") wheelRadius = (wb.max.y - wb.min.y) / 2;
  }

  // the car's own footprint, blurred: reads as weight on the ground from above and from the side
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  shadow.renderOrder = -1;
  root.add(shadow);

  const at = (g: string, x: number, y: number, z: number): Anchor => ({ object: group(g), at: new THREE.Vector3(x, y, z) });
  const anchors: Anchor[] = [
    at("fwing", 2.44, 0.5, 0.9), // front wing, at the right endplate
    at("halo", 0.28, 0.91, 0.3), // halo, on the hoop
    at("cockpit", 0.6, 0.69, 0.1), // steering wheel in the cockpit
    at("body", -1.25, 0.86, 0.28), // engine cover
    at("wFR", 1.48, 0.7, 0.82), // front right tyre
    at("floor", -0.62, 0.09, 0.74), // floor edge
  ];

  return {
    root,
    wheelRadius,
    anchors,
    spin(angle) {
      for (const p of pivots) p.rotation.z = -angle;
    },
    explode(t, focus = -1, fk = 0) {
      const T0 = clamp01(t) * (1 + STEP * LAST);
      const lifted = focus >= 0 && fk > 0 ? anchors[focus]?.object : null;
      for (const name in groups) {
        const [x, y, z, k] = APART[name] ?? APART.floor;
        const e = inOut3(clamp01(T0 - k * STEP));
        const g = groups[name];
        g.position.set(x * e, y * e, z * e);
        if (g === lifted) {
          // a nudge along the way it already went (straight up for the floor, which never moved)
          const len = Math.hypot(x, y, z);
          const d = 0.16 * fk * clamp01(t);
          if (len > 0) g.position.set(x * e + (x / len) * d, y * e + (y / len) * d, z * e + (z / len) * d);
          else g.position.y = d;
        }
      }
      if (groups.screws) groups.screws.visible = t < 0.01; // loose fasteners would hang where the body was
      shadowMat.opacity = 1 - 0.72 * smooth(0, 0.5, t);
    },
  };
}
