import type * as T from "three";
import { anchors, clamp01, emitStageFrame, gridFrameW, hooks, in2, inOut3, lerp, out3, smooth, stage, type Act, type Pt } from "@/lib/stage";
import { makeGround } from "./ground";
import { buildCar, type CarRig } from "./car";
import { buildWheel, type Display, type WheelRig } from "./wheel";

type Three = typeof import("three");
type State = typeof stage;

const TAU = Math.PI * 2;
const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** a camera described the way a director would: where it looks, from which side, and how much it takes in */
type Pose = {
  az: number; // radians round the target; 0 = side-on, car nose to the right
  el: number; // radians above the ground
  frameW: number; // metres across the screen at the target
  fov: number; // degrees; long lenses keep the car's proportions
  tx: number;
  ty: number;
  tz: number;
  sx: number; // where the target sits on screen, 0..1
  sy: number;
};

const shortest = (a: number, b: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
function mixPose(a: Pose, b: Pose, t: number): Pose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    az: a.az + shortest(a.az, b.az) * t,
    el: lerp(a.el, b.el, t),
    frameW: lerp(a.frameW, b.frameW, t),
    fov: lerp(a.fov, b.fov, t),
    tx: lerp(a.tx, b.tx, t),
    ty: lerp(a.ty, b.ty, t),
    tz: lerp(a.tz, b.tz, t),
    sx: lerp(a.sx, b.sx, t),
    sy: lerp(a.sy, b.sy, t),
  };
}

export type Scene = { dispose: () => void };

/**
 * Builds the stage and starts drawing. Everything on screen is derived from `stage` (lib/stage.ts):
 * nothing here keeps time, so a frame is only drawn when one of those numbers, or the viewport, has changed.
 */
export async function createScene(
  THREE: Three,
  el: HTMLElement,
  base: string,
  ticker: { add: (fn: () => void) => void; remove: (fn: () => void) => void },
  display: Display,
): Promise<Scene | null> {
  let renderer: T.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null; // no WebGL: the page keeps its flat layout
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  {
    const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.62;
    room.dispose();
    pmrem.dispose();
  }
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(4, 10, 6);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.5);
  rim.position.set(-7, 4, -6);
  const kicker = new THREE.DirectionalLight(0xffffff, 0);
  kicker.position.set(-3, 5, -6);
  scene.add(key, rim, kicker, new THREE.HemisphereLight(0xdfe6ff, 0x16181c, 0.4));

  const ground = makeGround(THREE);
  scene.add(ground.mesh);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 400);
  const target = new THREE.Vector3();

  let car: CarRig | null = null;
  let wheel: WheelRig | null = null;
  let w = 1;
  let h = 1;
  let last = "";
  let alive = true;

  // ---- camera ------------------------------------------------------------------------------------------------
  function setCamera(p: Pose) {
    camera.fov = p.fov;
    camera.aspect = w / h;
    const fovX = 2 * Math.atan(Math.tan(rad(p.fov) / 2) * camera.aspect);
    const dist = p.frameW / 2 / Math.tan(fovX / 2);
    target.set(p.tx, p.ty, p.tz);
    camera.position.set(p.tx + dist * Math.cos(p.el) * Math.sin(p.az), p.ty + dist * Math.sin(p.el), p.tz + dist * Math.cos(p.el) * Math.cos(p.az));
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.setViewOffset(w, h, (0.5 - p.sx) * w, (0.5 - p.sy) * h, w, h);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  // ---- the car's shots -----------------------------------------------------------------------------------------
  function carShots() {
    const mobile = w < 768;
    const GRID: Pose = {
      az: 0, el: rad(89.4), frameW: gridFrameW(w), fov: 18, tx: 0, ty: 0, tz: 0,
      sx: stage.gridX > 0 ? clamp01(stage.gridX / w) : mobile ? 0.5 : 0.61,
      sy: stage.gridY > 0 ? clamp01(stage.gridY / h) : mobile ? 0.8 : 0.73,
    };
    const SIDE: Pose = { az: 0, el: rad(7), frameW: mobile ? 7.6 : clamp(w / 125, 9.5, 13.5), fov: 24, tx: 0, ty: 0.55, tz: 0, sx: mobile ? 0.5 : 0.67, sy: mobile ? 0.72 : 0.57 };
    const calY = stage.calY > 0 ? clamp01(stage.calY / h) : 0.86;
    const CAL: Pose = { az: 0, el: rad(5), frameW: w / 100, fov: 22, tx: 0, ty: 0.5, tz: 0, sx: 0.5, sy: calY };
    const PIT: Pose = { az: rad(35), el: rad(30), frameW: mobile ? 7.5 : clamp(w / 140, 8.6, 11.6), fov: 26, tx: 0, ty: 0.45, tz: 0, sx: mobile ? 0.5 : 0.36, sy: mobile ? 0.44 : 0.52 };
    return { GRID, SIDE, CAL, PIT, mobile };
  }

  /** beyond the right-hand edge of what pose p shows, with room for the whole car */
  const offRight = (p: Pose) => p.frameW * (1 - p.sx) + 3.4;
  const offLeft = (p: Pose) => -(p.frameW * p.sx + 3.4);

  function applyCar(s: State) {
    if (!car) return;
    const { GRID, SIDE, CAL, PIT, mobile } = carShots();

    // camera: overhead -> side -> one lap -> low under the cards -> round to three-quarter
    let p = mixPose(GRID, SIDE, inOut3(s.chase));
    if (s.orbit > 0 && s.orbit < 1) {
      const lift = Math.sin(s.orbit * Math.PI);
      p = { ...p, az: p.az + s.orbit * TAU, el: p.el + lift * rad(11), frameW: p.frameW * (1 + 0.07 * lift) };
    }
    p = mixPose(p, CAL, smooth(0, 0.6, s.toCal));

    // where the car is, relative to the camera's target
    let x: number;
    if (s.toCal < 0.3) {
      const caught = out3(smooth(0.38, 1, s.chase));
      x = lerp(in2(s.launch) * offRight(p) - (1 - s.arrive) * 12.5, 0, caught) + in2(s.away) * offRight(p);
    } else {
      const xCal = (s.calX / w - 0.5) * CAL.frameW;
      x = lerp(offLeft(p), xCal, out3(smooth(0.45, 1, s.toCal)));
    }

    // exploded view: the camera comes round and centres on the car
    const kPit = inOut3(s.pit);
    const ex = clamp01(s.explode);
    const exCam = smooth(0, 1, ex);
    const pitPose: Pose = { ...PIT, tx: x, el: PIT.el - rad(6) * exCam, frameW: PIT.frameW * (1 + (mobile ? 0.3 : 0.26) * exCam), ty: PIT.ty + 0.5 * exCam };
    p = mixPose(p, pitPose, kPit);
    setCamera(p);

    // the ground slides back by everything the car has covered since the start
    const travel = 46 * inOut3(s.chase) + 40 * s.orbit + 12 * s.away + 34 * s.toCal + s.calRun / 100 + 9 * out3(s.pit);
    const speed = smooth(0.1, 0.6, s.chase) * (1 - smooth(0, 0.75, s.pit));
    ground.uniforms.uTravel.value = travel;
    ground.uniforms.uSpeed.value = speed;
    ground.uniforms.uMark.value = Math.min(16, in2(s.launch) * offRight(GRID));
    ground.uniforms.uCentre.value.set(p.tx, p.tz);
    ground.uniforms.uNear.value = p.frameW * 1.1;
    ground.uniforms.uFar.value = p.frameW * 2.6;
    // keep the paint out from behind the words: the left column beside the lap, the label column beside the exploded view
    const beside = inOut3(s.chase) * (1 - smooth(0, 0.6, s.toCal)) * (1 - kPit);
    const mx = ground.uniforms.uMaskX.value;
    const my = ground.uniforms.uMaskY.value;
    if (w >= 768) {
      mx.set(lerp(-1, 0.33, beside), lerp(-0.5, 0.5, beside), lerp(2, 0.56, kPit), lerp(3, 0.7, kPit));
      my.set(-1, -0.5, 2, 3);
    } else {
      mx.set(-1, -0.5, 2, 3);
      my.set(lerp(-1, 0.34, Math.max(beside, kPit * 0.6)), lerp(-0.5, 0.48, Math.max(beside, kPit * 0.6)), lerp(2, 0.6, kPit), lerp(3, 0.7, kPit));
    }

    car.root.position.set(x, 0, 0);
    car.spin((x + travel) / car.wheelRadius);
    car.explode(ex);
  }

  // ---- the steering wheel's shots ------------------------------------------------------------------------------
  function applyWheel(s: State) {
    if (!wheel) return;
    const mobile = w < 768;
    const k = clamp01(s.wheelIn);
    const ex = clamp01(s.wheelExplode);
    const kx = smooth(0, 1, ex);
    // arrives face-on, then lies back like a part on a bench while its layers lift apart
    const FRONT: Pose = { az: rad(-12), el: rad(6), frameW: mobile ? 1.9 : clamp(w / 480, 2.6, 3.6), fov: 24, tx: 0, ty: 0, tz: 0, sx: mobile ? 0.5 : 0.4, sy: mobile ? 0.36 : 0.54 };
    const APART: Pose = { ...FRONT, az: rad(-33), el: rad(27), frameW: FRONT.frameW * (mobile ? 1.5 : 1.42), ty: 0.07 };
    setCamera(mixPose(FRONT, APART, kx));
    wheel.root.position.set(0, lerp(0.5, 0, out3(k)), 0);
    wheel.root.scale.setScalar(lerp(0.9, 1, out3(k)));
    wheel.pose(lerp(rad(-150), 0, out3(k)), kx);
    wheel.explode(ex);
  }

  // ---- labels --------------------------------------------------------------------------------------------------
  const v = new THREE.Vector3();
  function project(list: { object: T.Object3D; at: T.Vector3 }[], into: Pt[]) {
    list.forEach((a, i) => {
      v.copy(a.at);
      a.object.localToWorld(v);
      v.project(camera);
      (into[i] ||= { x: 0, y: 0 }).x = (v.x * 0.5 + 0.5) * w;
      into[i].y = (-v.y * 0.5 + 0.5) * h;
    });
    into.length = list.length;
  }

  hooks.layout = (act: Act) => {
    const out: Pt[] = [];
    if (act === "car" && car) {
      applyCar({ ...stage, chase: 1, orbit: 1, away: 1, toCal: 1, pit: 1, explode: 1 });
      scene.updateMatrixWorld(true);
      project(car.anchors, out);
    } else if (act === "wheel" && wheel) {
      applyWheel({ ...stage, wheelIn: 1, wheelExplode: 1 });
      scene.updateMatrixWorld(true);
      project(wheel.anchors, out);
    }
    last = ""; // put the real picture back on the next frame
    return out;
  };
  hooks.invalidate = () => {
    last = "";
  };
  hooks.info = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });

  // ---- frame ---------------------------------------------------------------------------------------------------
  const sig = () => {
    const s = stage;
    return [s.act, s.arrive, s.gridX, s.gridY, s.launch, s.chase, s.orbit, s.away, s.toCal, s.calX, s.calY, s.calRun, s.pit, s.explode, s.wheelIn, s.wheelExplode].map((n) => (typeof n === "number" ? n.toFixed(4) : n)).join("|") + `|${w}x${h}|${car ? 1 : 0}${wheel ? 1 : 0}`;
  };
  let onScreen = true;
  const frame = () => {
    if (!alive || !onScreen) return;
    const now = sig();
    if (now === last) return;
    last = now;
    const isWheel = stage.act === "wheel";
    if (car) car.root.visible = !isWheel;
    if (wheel) wheel.root.visible = isWheel;
    ground.mesh.visible = !isWheel;
    // the wheel is black on a dark page: more of the room and a hard light from behind pick out its edges
    scene.environmentIntensity = isWheel ? 1.5 : 0.62;
    kicker.intensity = isWheel ? 3.2 : 0;
    if (isWheel) applyWheel(stage);
    else applyCar(stage);
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera);
    if (car && !isWheel) project(car.anchors, anchors.car);
    if (wheel && isWheel) project(wheel.anchors, anchors.wheel);
    emitStageFrame();
  };

  const resize = () => {
    w = el.clientWidth || 1;
    h = el.clientHeight || 1;
    // sharp on a laptop, never more than about four million pixels to shade
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4.2e6 / (w * h))));
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    ground.uniforms.uRes.value.set(w * dpr, h * dpr);
    last = "";
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  // the tab going to the background, or the canvas being covered by the rest of the page, costs nothing
  const onVis = () => {
    onScreen = !document.hidden;
    last = "";
  };
  document.addEventListener("visibilitychange", onVis);

  ticker.add(frame);

  // models: the car first (the hero needs it), the wheel once the car is in
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { MeshoptDecoder } = await import("three/addons/libs/meshopt_decoder.module.js");
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  try {
    const [gltf, shadow] = await Promise.all([loader.loadAsync(`${base}/models/car.glb`), new THREE.TextureLoader().loadAsync(`${base}/models/car-shadow.png`)]);
    if (!alive) return null;
    car = buildCar(THREE, gltf.scene, shadow, renderer.capabilities.getMaxAnisotropy());
    scene.add(car.root);
    applyCar(stage);
    await renderer.compileAsync(scene, camera); // shaders ready before the first frame, so nothing hitches on scroll
    last = "";
  } catch {
    cleanup();
    return null;
  }

  loader
    .loadAsync(`${base}/models/wheel.glb`)
    .then((gltf) => {
      if (!alive) return;
      wheel = buildWheel(THREE, gltf.scene, renderer.capabilities.getMaxAnisotropy(), display);
      wheel.root.visible = false;
      scene.add(wheel.root);
      last = "";
    })
    .catch(() => {});

  function cleanup() {
    alive = false;
    ticker.remove(frame);
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    delete hooks.layout;
    delete hooks.invalidate;
    delete hooks.info;
    scene.traverse((o) => {
      const m = o as T.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        Object.values(mat).forEach((val) => {
          if (val && (val as T.Texture).isTexture) (val as T.Texture).dispose();
        });
        mat.dispose();
      });
    });
    scene.environment?.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { dispose: cleanup };
}
