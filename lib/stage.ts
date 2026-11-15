/**
 * Where the scroll has taken the 3D stage.
 *
 * Sections write these numbers through scrubbed tweens (0 → 1 unless noted). The scene never animates on its own:
 * every frame it is a pure function of this object, so scrolling back plays the whole thing in reverse and a reload
 * half way down the page lands on the right picture.
 */
export const stage = {
  /** which model has the stage */
  act: "car" as Act,

  // hero: overhead on the grid slot, camera still
  arrive: 1, // on load the car rolls forward into its slot (0 = still behind it)
  launch: 0, // lights out: the car leaves the slot and the frame
  gridX: 0, // px: where the slot sits on screen, measured from the headline (0 = let the scene choose)
  gridY: 0,

  // 13/16: the camera drops to the side and catches the car, then laps it
  chase: 0,
  orbit: 0,
  away: 0, // the car pulls clear again as the section lets go

  // race calendar: the car runs along under the cards
  toCal: 0, // camera settles low, the car drives in under round 1
  calX: 0, // px: screen x of the card the race is at
  calY: 0, // px: screen y the car's body should sit at, below the cards (0 = let the scene choose)
  calRun: 0, // px: how far the card row has travelled

  // exploded view of the car
  pit: 0, // camera comes round to the three-quarter view
  explode: 0,

  // exploded view of the steering wheel
  wheelIn: 0,
  wheelExplode: 0,
};

export type Act = "car" | "wheel";
export type Pt = { x: number; y: number };

/** screen positions (px, viewport) of each act's label anchors, refreshed by the scene on every frame it draws */
export const anchors: Record<Act, Pt[]> = { car: [], wheel: [] };

type Hooks = {
  /** anchors as they will sit once the act is fully apart: used to lay the label column out before anything moves */
  layout: (act: Act) => Pt[];
  /** ask for a redraw after something outside `stage` changed (a texture arrived, the act switched) */
  invalidate: () => void;
  /** what the last frame cost: draw calls and triangles */
  info: () => { calls: number; triangles: number };
};
export const hooks: Partial<Hooks> = {};

const listeners = new Set<() => void>();
/** runs right after the scene has drawn a frame, in the same tick: the place to move anything pinned to a 3D point */
export function onStageFrame(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function emitStageFrame() {
  listeners.forEach((fn) => fn());
}

export const STAGE_READY = "a10:stage-ready";
export const isStageOn = () => typeof document !== "undefined" && document.documentElement.dataset.stage === "on";

/** run fn once the stage is drawing (now if it already is); returns a cleanup */
export function whenStageReady(fn: () => void) {
  if (isStageOn()) {
    fn();
    return () => {};
  }
  const on = () => fn();
  window.addEventListener(STAGE_READY, on, { once: true });
  return () => window.removeEventListener(STAGE_READY, on);
}

/** metres across the screen in the overhead grid shot: the car takes about a third of a wide screen, most of a phone */
export const gridFrameW = (w: number) => (w < 768 ? 7.4 : Math.min(17, Math.max(11.5, w / 95)));

// small maths shared by the scene and the sections
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 below a, 1 above b, smooth in between */
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const inOut3 = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const out3 = (x: number) => 1 - Math.pow(1 - x, 3);
export const in2 = (x: number) => x * x;
