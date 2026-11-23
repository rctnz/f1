import type * as T from "three";
import { anchors, clamp01, emitStageFrame, gridPPM, hooks, in2, inOut3, lerp, out3, smooth, stage, wheelStep, type Act, type Pt } from "@/lib/stage";
import { makeGround } from "./ground";
import { buildCar, type CarRig } from "./car";
import { buildWheel, type WheelFaces, type WheelRig } from "./wheel";

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
  faces: WheelFaces,
): Promise<Scene | null> {
  // WebGL without a graphics card behind it (hardware acceleration off, or a blocked driver) is drawn by the CPU, at
  // about a frame a second for this scene: then the flat layout with its rendered stills is the better page. Asked
  // of a throwaway canvas first, so a refusal is quiet.
  {
    const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) return null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (/basic render|swiftshader|llvmpipe|software/i.test(name)) return null;
  }
  let renderer: T.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: true });
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
  // a lamp close to the steering wheel: its reflection in the lacquer moves across the weave as the wheel turns
  const lamp = new THREE.PointLight(0xffffff, 0, 0, 2);
  lamp.position.set(-0.45, 0.75, 1.5);
  scene.add(key, rim, kicker, lamp, new THREE.HemisphereLight(0xdfe6ff, 0x16181c, 0.4));

  // the asphalt grain; a flat grey stands in if the picture fails to load
  const asphalt = await new THREE.TextureLoader().loadAsync(`${base}/models/asphalt.webp`).catch(() => {
    const flat = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255]), 1, 1);
    flat.needsUpdate = true;
    return flat as T.Texture;
  });
  asphalt.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = makeGround(THREE, asphalt);
  scene.add(ground.mesh);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 400);
  const target = new THREE.Vector3();

  let car: CarRig | null = null;
  let wheel: WheelRig | null = null;
  let w = 1;
  let h = 1;
  let last = "";
  let lastTravel = 0;
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
    const up = stage.gridUp > 0;
    // overhead: the lane fills the screen and the car fills the lane. On an upright screen the shot is turned a
    // quarter (az -90 puts the car's nose at the top), so the car is as long as the screen is tall.
    const GRID: Pose = {
      az: up ? -Math.PI / 2 : 0, el: rad(89.4), frameW: w / (stage.gridPpm > 0 ? stage.gridPpm : gridPPM(w, h, 104, up)), fov: 18, tx: 0, ty: 0, tz: 0,
      sx: stage.gridX > 0 ? clamp01(stage.gridX / w) : up ? 0.5 : 0.44,
      sy: stage.gridY > 0 ? clamp01(stage.gridY / h) : mobile ? 0.55 : 0.56,
    };
    // beside the lap's words on a wide screen; under them where the page stacks (the same 1024px as Season.module.css)
    const stacked = w < 1024;
    const SIDE: Pose = { az: 0, el: rad(7), frameW: mobile ? 7.6 : stacked ? 9.2 : clamp(w / 125, 9.5, 13.5), fov: 24, tx: 0, ty: 0.55, tz: 0, sx: stacked ? 0.5 : 0.67, sy: stacked ? 0.72 : 0.57 };
    const calY = stage.calY > 0 ? clamp01(stage.calY / h) : 0.86;
    const CAL: Pose = { az: 0, el: rad(5), frameW: w / 100, fov: 22, tx: 0, ty: 0.5, tz: 0, sx: 0.5, sy: calY };
    // the car apart is about 4.5 m tall on screen: on a short, wide screen the height sets the scale, not the width,
    // and it sits a little lower, clear of the heading
    const PIT: Pose = { az: rad(35), el: rad(30), frameW: mobile ? 7.5 : Math.max(clamp(w / 140, 8.6, 11.6), 5.8 * (w / h)), fov: 26, tx: 0, ty: 0.45, tz: 0, sx: mobile ? 0.5 : 0.36, sy: mobile ? 0.44 : 0.52 + clamp((760 - h) / 1200, 0, 0.06) };
    return { GRID, SIDE, CAL, PIT, mobile, stacked, up };
  }

  /** beyond the right-hand edge of what pose p shows, with room for the whole car */
  const offRight = (p: Pose) => p.frameW * (1 - p.sx) + 3.4;
  const offLeft = (p: Pose) => -(p.frameW * p.sx + 3.4);

  function applyCar(s: State) {
    if (!car) return;
    const { GRID, SIDE, CAL, PIT, mobile, stacked, up } = carShots();
    // how far the car must go to be out of the picture: off the top of the turned grid shot, off the right of any other
    const offTop = GRID.frameW * (h / w) * GRID.sy + 3.4;
    const clear = (q: Pose) => (up ? lerp(offTop, offRight(q), smooth(0, 0.4, s.chase)) : offRight(q));

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
      x = lerp(in2(s.launch) * clear(p) - (1 - s.arrive) * 12.5, 0, caught) + in2(s.away) * offRight(p);
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
    ground.uniforms.uMark.value = Math.min(16, in2(s.launch) * (up ? offTop : offRight(GRID)));
    ground.uniforms.uCentre.value.set(p.tx, p.tz);
    // the lane fades out beyond what the shot shows; the turned grid shot shows more of it, along the screen's height
    const reach = up ? lerp(Math.max(1, h / w), 1, inOut3(s.chase)) : 1;
    ground.uniforms.uNear.value = p.frameW * 1.1 * reach;
    ground.uniforms.uFar.value = p.frameW * 2.6 * reach;
    // keep the paint out from behind the words: the lap's words (a column on the left, or a block above the car),
    // and the label column beside the exploded view
    const words = (1 - smooth(0, 0.6, s.toCal)) * (1 - kPit); // the lap's words are on screen
    const mx = ground.uniforms.uMaskX.value;
    const my = ground.uniforms.uMaskY.value;
    const band = ground.uniforms.uBandY.value;
    const box = ground.uniforms.uBox.value;
    // the exploded view's heading ends about 250px down: the far end of the lane fades out before it gets there
    const headFoot = 250 / h;
    // either way the clear patch rides up with the section: its top edge is a screen down when the chase starts
    const top = 1 - clamp01(s.chase);
    let k = s.chase > 0 ? words : 0;
    if (!stacked) {
      k *= smooth(0.55, 0.97, s.chase); // beside the words the track stays whole until they are nearly in place
      box.set(lerp(-1, 0.33, k), lerp(-0.5, 0.5, k), top - 0.06, top);
      mx.set(-1, -0.5, lerp(2, 0.56, kPit), lerp(3, 0.7, kPit));
      my.set(lerp(-1, headFoot, kPit), lerp(-0.5, headFoot + 90 / h, kPit), 2, 3);
      band.set(-2, -1.5, -1, -0.5);
    } else {
      box.set(-1, -0.5, 2, 3);
      band.set(top - 0.06, top, lerp(-1, top + 0.34, k), lerp(-0.5, top + 0.48, k));
      if (mobile) {
        mx.set(-1, -0.5, 2, 3);
        my.set(lerp(-1, 0.34, kPit * 0.6), lerp(-0.5, 0.48, kPit * 0.6), lerp(2, 0.6, kPit), lerp(3, 0.7, kPit));
      } else {
        mx.set(-1, -0.5, lerp(2, 0.56, kPit), lerp(3, 0.7, kPit));
        my.set(lerp(-1, headFoot, kPit), lerp(-0.5, headFoot + 90 / h, kPit), 2, 3);
      }
    }

    car.root.position.set(x, 0, 0);
    car.spin((x + travel) / car.wheelRadius);
    car.explode(ex, s.nudge);
  }

  // ---- the steering wheel's shots ------------------------------------------------------------------------------
  /**
   * One beat for the team, then one for each driver. On a driver's beat the camera pushes in on their side of the
   * wheel (their button and the dash beside it), from the left for one driver and from the right for the next, and
   * the wheel leans into that side. x, y: the point looked at, in wheel units; zoom: how much closer than the team shot.
   */
  const FOCUS: [number, number, number][] = [
    [0, 0.02, 1],
    [0.14, 0.06, 1.25], // the red button, right of the dash
    [-0.14, 0.11, 1.25], // the yellow one, left
    [0.14, 0.11, 1.25], // the white one, right
    [-0.15, 0.02, 1.25], // the green one, left
  ];
  /** where on the screen that point sits: the wheel takes the left for one driver and the right for the next, and their name takes the other side */
  const SX = [0.67, 0.35, 0.67, 0.35, 0.67];
  const STEER = [0, -0.16, 0.16, -0.12, 0.12];
  function applyWheel(s: State) {
    if (!wheel) return;
    const mobile = w < 768;
    // as wide as the column beside the roll call allows, and no taller than two thirds of the screen
    const frameW = mobile ? 1.45 : Math.max(clamp(w / 620, 2.1, 2.9), 1.45 * (w / h));
    const kin = out3(clamp01(s.wheelIn));
    const { k, f, face } = wheelStep(s.wheelBeat, STEER.length - 1);
    // the move to each close-up takes the first half of the beat, and the shot holds for the rest; between two
    // close-ups the camera eases back on the way across, so the swing from one side to the other reads
    // a long, soft move: it takes most of the beat and eases in and out with no hard start or stop
    const u = clamp01(f / 0.82);
    const t = u * u * u * (u * (u * 6 - 15) + 10);
    const a = FOCUS[Math.max(0, k - 1)];
    const b = FOCUS[k];
    const fx = lerp(a[0], b[0], t) * (mobile ? 0.35 : 1); // a phone has no room to look off to one side
    const fy = lerp(a[1], b[1], t);
    const zoom = lerp(a[2], b[2], t) * (1 - (k > 1 ? 0.14 * Math.sin(Math.PI * t) : 0));
    const steer = lerp(STEER[Math.max(0, k - 1)], STEER[k], t);
    const sx = mobile ? 0.5 : lerp(SX[Math.max(0, k - 1)], SX[k], t);
    // the wheel always turns its face to the names: to the right when it stands on the left of the screen, and back
    const toward = mobile ? 0 : clamp((0.5 - sx) / 0.2, -1, 1);
    // each driver is called like a gear change: their button goes in, the mode dial clicks on, the wheel kicks back
    const called = k > 0;
    const kick = called ? 0.3 * Math.sin(Math.PI * clamp01((f - 0.12) / 0.3)) : 0;
    setCamera({
      az: 0,
      el: rad(7),
      frameW: frameW / (mobile ? 1 + (zoom - 1) * 0.5 : zoom),
      fov: 24,
      // the point looked at, where it is once the wheel has turned
      tx: fx * Math.cos(steer) - fy * Math.sin(steer),
      ty: fx * Math.sin(steer) + fy * Math.cos(steer),
      tz: 0,
      sx,
      sy: mobile ? 0.46 : 0.55,
    });
    // it comes and goes with the page: one screen under its place while the section arrives, one screen over it as
    // the section leaves, at the page's own speed, so it never crosses the heading. It turns to face us on the way in.
    const ride = (clamp01(s.wheelOut) - (1 - clamp01(s.wheelIn))) * h * (frameW / w);
    wheel.root.position.set(0, ride, -0.06 * kick);
    wheel.root.scale.setScalar(lerp(0.86, 1, kin) * (1 - 0.02 * kick));
    wheel.pose(steer, lerp(rad(-120), 0, kin) + toward * rad(24), rad(-11));
    wheel.show(face);
    wheel.press(k - 1, called ? smooth(0.1, 0.2, f) * (1 - smooth(0.34, 0.5, f)) : 0);
    wheel.click(called ? k - 1 + smooth(0.12, 0.3, f) : 0);
    // the shift lights climb through each beat and drop on the change, like a run through the gears
    wheel.rev(smooth(0.06, 0.72, f) * kin);
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
    }
    last = ""; // put the real picture back on the next frame
    return out;
  };
  hooks.invalidate = () => {
    last = "";
  };
  hooks.info = () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
  hooks.groundOpacity = (v: number) => {
    ground.uniforms.uOpacity.value = v;
    last = "";
  };

  // ---- frame ---------------------------------------------------------------------------------------------------
  const sig = () => {
    const s = stage;
    return [s.act, s.arrive, s.gridX, s.gridY, s.gridPpm, s.gridUp, s.launch, s.chase, s.orbit, s.away, s.toCal, s.calX, s.calY, s.calRun, s.pit, s.explode, s.nudge.map((v) => v.toFixed(3)).join(","), s.wheelIn, s.wheelBeat, s.wheelOut].map((n) => (typeof n === "number" ? n.toFixed(4) : n)).join("|") + `|${w}x${h}|${car ? 1 : 0}${wheel ? 1 : 0}`;
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
    // the wheel is black on a dark page: more of the room, turned so its bright wall is not what the flat face
    // mirrors, a hard light from behind for the edges and the lamp for a soft mark on the lacquer
    scene.environmentIntensity = isWheel ? 1.0 : 0.62;
    scene.environmentRotation.y = isWheel ? 4.8 : 0;
    kicker.intensity = isWheel ? 3.4 : 0;
    lamp.intensity = isWheel ? 2 : 0;
    if (isWheel) applyWheel(stage);
    else applyCar(stage);
    // the paint on the ground is smeared by however far the ground moved since the last frame drawn, so kerbs and
    // chequers blur at speed instead of strobing; once it stops one more frame follows, to draw it sharp again
    const travelled = Math.abs(ground.uniforms.uTravel.value - lastTravel);
    lastTravel = ground.uniforms.uTravel.value;
    ground.uniforms.uBlur.value = isWheel ? 0 : Math.min(3, travelled * 0.8);
    if (travelled > 0.005) last = "";
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera);
    if (car && !isWheel) project(car.anchors, anchors.car);
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
  const { mergeGeometries } = await import("three/addons/utils/BufferGeometryUtils.js");
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  try {
    const [gltf, shadow] = await Promise.all([loader.loadAsync(`${base}/models/car.glb`), new THREE.TextureLoader().loadAsync(`${base}/models/car-shadow.png`)]);
    if (!alive) return null;
    car = buildCar(THREE, gltf.scene, shadow, renderer.capabilities.getMaxAnisotropy(), mergeGeometries);
    scene.add(car.root);
    applyCar(stage);
    await renderer.compileAsync(scene, camera); // shaders ready before the first frame, so nothing hitches on scroll
    last = "";
  } catch {
    cleanup();
    return null;
  }

  // The steering wheel loads after the car, which does not wait for it, and is fitted once the page's fonts are in
  // (its dash is drawn with them). Its shaders are compiled straight away, so its first appearance costs nothing.
  void (async () => {
    const [file] = await Promise.all([loader.loadAsync(`${base}/models/wheel.glb`), document.fonts?.ready]);
    if (!alive || !car) return;
    const rig = buildWheel(THREE, faces, file.scene);
    scene.add(rig.root);
    car.root.visible = false;
    const compiled = renderer.compileAsync(scene, camera); // gathers what is visible now, then waits
    car.root.visible = true;
    rig.root.visible = false;
    await compiled.catch(() => undefined);
    wheel = rig;
    last = "";
  })().catch(() => undefined); // no wheel: the roll call still runs, with nothing on stage

  function cleanup() {
    alive = false;
    ticker.remove(frame);
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    delete hooks.layout;
    delete hooks.invalidate;
    delete hooks.info;
    delete hooks.groundOpacity;
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
