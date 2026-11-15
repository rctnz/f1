import { anchors, clamp01, emitStageFrame, hooks, lerp, out3, smooth, stage, type Pt } from "@/lib/stage";

type Box = [number, number, number, number]; // x, y, width, height in the reference frame
type Reel = { box: Box; n: number; parts?: number[]; anchors?: [number, number][][]; at?: [number, number] };
type Manifest = { ref: [number, number]; scale: number; lap: Reel; road: Reel; car: Reel; pit: Reel; wheel: Reel };

/**
 * The stage without a graphics card. tools/film/capture.mjs renders every 3D shot of the page ahead of time
 * (public/film); this plays those frames on a plain 2D canvas, picked by the same numbers in `stage` that the live
 * scene reads (components/stage/scene.ts), so the sections above it cannot tell the difference: they pin, scrub and
 * pin their labels to the same points. What it leaves out is small: wheels do not turn and tyres leave no marks.
 * The hero's own stills (Hero.tsx) cover the grid shot, so the film starts where the camera catches the car.
 */
export async function createFilm(
  el: HTMLElement,
  base: string,
  ticker: { add: (fn: () => void) => void; remove: (fn: () => void) => void },
): Promise<{ dispose: () => void } | null> {
  let m: Manifest;
  try {
    m = await (await fetch(`${base}/film/manifest.json`)).json();
  } catch {
    return null;
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  el.appendChild(canvas);

  const load = (src: string) => {
    const img = new Image();
    img.decoding = "async";
    img.src = `${base}/film/${src}`;
    return img;
  };
  const strip = (name: string, n: number) => Array.from({ length: n }, (_, i) => load(`${name}/${String(i).padStart(2, "0")}.webp`));
  // in the order the page reaches them
  const lap = strip("lap", m.lap.n);
  const road = load("road.webp");
  const car = load("car.webp");
  const pit = strip("pit", m.pit.n);
  const wheel = strip("wheel", m.wheel.n);

  let w = 1;
  let h = 1;
  let last = "";
  let alive = true;
  const [RW, RH] = m.ref;

  const frame = () => {
    if (!alive || document.hidden) return;
    const s = stage;
    const now = [s.act, s.chase, s.orbit, s.away, s.toCal, s.calX, s.calY, s.pit, s.explode, s.wheelIn, s.wheelBeat, s.wheelOut].map((v) => (typeof v === "number" ? v.toFixed(4) : v)).join("|") + `|${w}x${h}`;
    if (now === last) return;
    last = now;
    ctx.clearRect(0, 0, w, h);
    // the reference frame, fitted to this screen's width and centred on its height
    const k = w / RW;
    const oy = (h - RH * k) / 2;
    let waiting = false;
    const put = (img: HTMLImageElement, x: number, y: number, bw: number, bh: number, alpha = 1) => {
      if (!img.complete || !img.naturalWidth) {
        waiting = true;
        return;
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, x, y, bw, bh);
    };
    const full = (img: HTMLImageElement, r: Reel, dy = 0, alpha = 1) => put(img, r.box[0] * k, oy + r.box[1] * k + dy, r.box[2] * k, r.box[3] * k, alpha);

    if (s.act === "wheel") {
      // ten frames to a beat; it rides in and out with the page like the live one
      const i = Math.round(clamp01(s.wheelBeat / 5) * (m.wheel.n - 1));
      full(wheel[i], m.wheel, -(clamp01(s.wheelOut) - (1 - clamp01(s.wheelIn))) * h);
    } else if (s.pit > 0) {
      const [move, apart] = m.pit.parts ?? [m.pit.n, 0];
      const i = s.explode > 0 ? move + Math.min(apart - 1, Math.ceil(clamp01(s.explode) * apart) - 1) : Math.max(0, Math.ceil(clamp01(s.pit) * move) - 1);
      full(pit[i], m.pit);
      const pts = m.pit.anchors?.[i];
      if (pts) {
        pts.forEach(([x, y], n) => {
          (anchors.car[n] ||= { x: 0, y: 0 }).x = x * k;
          anchors.car[n].y = oy + y * k;
        });
        anchors.car.length = pts.length;
      }
    } else if (s.toCal > 0) {
      // the calendar's low shot shows 100 px to the metre on any screen, so its two pictures are drawn at their own
      // size: the road right across, the car run in from the left to under the open card
      const [ax, ay] = m.car.at ?? [RW / 2, RH / 2];
      const y = (s.calY > 0 ? s.calY : h * 0.86) - ay;
      put(road, 0, y + m.road.box[1], w, m.road.box[3], smooth(0, 0.5, s.toCal));
      const x = lerp(-340, s.calX, out3(smooth(0.45, 1, s.toCal)));
      put(car, x - ax + m.car.box[0], y + m.car.box[1], m.car.box[2], m.car.box[3]);
    } else if (s.chase >= 0.4) {
      const [chase, orbit, away] = m.lap.parts ?? [m.lap.n, 0, 0];
      const i = s.away > 0 ? chase + orbit + Math.min(away - 1, Math.ceil(clamp01(s.away) * away) - 1) : s.orbit > 0 ? chase + Math.min(orbit - 1, Math.ceil(clamp01(s.orbit) * orbit) - 1) : Math.round(((Math.min(1, s.chase) - 0.4) / 0.6) * (chase - 1));
      full(lap[i], m.lap, 0, smooth(0.4, 0.55, s.chase));
    }
    ctx.globalAlpha = 1;
    if (waiting) last = ""; // a frame still on its way: try again on the next tick
    emitStageFrame();
  };

  const resize = () => {
    w = el.clientWidth || 1;
    h = el.clientHeight || 1;
    canvas.width = w;
    canvas.height = h;
    last = "";
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  hooks.layout = () => {
    const k = w / RW;
    const oy = (h - RH * k) / 2;
    const end = m.pit.anchors?.[m.pit.n - 1] ?? [];
    return end.map(([x, y]): Pt => ({ x: x * k, y: oy + y * k }));
  };
  hooks.invalidate = () => {
    last = "";
  };
  ticker.add(frame);

  return {
    dispose() {
      alive = false;
      ticker.remove(frame);
      ro.disconnect();
      delete hooks.layout;
      delete hooks.invalidate;
      canvas.remove();
    },
  };
}
