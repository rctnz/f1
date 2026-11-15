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
  gridX: 0, // px: where the car sits on screen in the overhead shot (0 = let the scene choose)
  gridY: 0,
  gridPpm: 0, // px per metre in that shot (0 = let the scene choose)
  gridUp: 0, // 1 on an upright screen: the shot is turned a quarter, so the car points up the screen

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
  focus: -1, // which labelled part the pointer is on (-1 = none)
  focusK: 0, // 0 → 1: that part eases a little further out

  // steering wheel beside the driver roll call
  wheelIn: 0, // the section arriving: the wheel comes up with the page and turns to face the camera
  wheelBeat: 0, // 0 → 5: one beat for the team, then one for each driver
  wheelOut: 0, // the section leaving: the wheel goes up with the page
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
  /** fade the track out or in (tools/film/capture.mjs photographs the car without it) */
  groundOpacity: (v: number) => void;
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

/** an upright screen (a phone, a tablet held upright): the grid shot is turned so the car runs up the screen */
export const gridIsUp = (w: number, h: number, top = 104) => h - top > w * 1.15;

/**
 * px per metre in the overhead grid shot: the lane and its two kerbs (4 m) across the short way of the space
 * under the header, unless the car and the start line (7.1 m) would then not fit the long way.
 */
export const gridPPM = (w: number, h: number, top = 104, up = false) =>
  Math.max(36, up ? Math.min(w / 4.0, (h - top) / 7.1) : Math.min((h - top) / 4.0, w / 7.1));

/** where the wheel's roll call is: k = 0 for the team, 1.. for each driver; f = how far into that beat; face = what the dash shows */
export function wheelStep(beat: number, drivers = 4) {
  const b = Math.min(drivers + 0.999, Math.max(0, beat));
  const k = Math.floor(b);
  const f = b - k;
  return { k, f, face: k === 0 ? -1 : f > 0.22 ? k - 1 : k - 2 };
}

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
