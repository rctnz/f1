"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { BASE, DRIVERS, FIN_COUNT, ROUNDS } from "@/lib/data";
import { anchors, hooks, stage, STAGE_READY } from "@/lib/stage";
import s from "./Stage.module.css";

/** true when WebGL is drawn by a graphics card; a software renderer manages about a frame a second for this scene */
function has3D() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/basic render|swiftshader|llvmpipe|software/i.test(name);
  } catch {
    return false;
  }
}

/**
 * One WebGL canvas fixed behind the whole page. Sections above it are either solid (they cover it) or clear
 * (the car shows through), so the same car carries from the hero down through the calendar and the exploded view.
 * three.js loads after first paint. Where there is no graphics card behind WebGL the same shots are played from
 * frames rendered ahead of time instead (film.ts; html also gets data-film). Until either is up, and where motion
 * is not wanted, the page keeps its flat layout (html has no data-stage attribute).
 */
export default function Stage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    let alive = true;
    let dispose = () => {};

    (async () => {
      let scene: { dispose: () => void } | null = null;
      if (has3D()) {
        // the model starts downloading now, alongside three.js, so it is in the cache when the loader asks for it
        void fetch(`${BASE}/models/car.glb`).catch(() => undefined);
        const [THREE, { createScene }] = await Promise.all([import("three"), import("./scene")]);
        if (!alive) return;
        const css = getComputedStyle(document.documentElement);
        scene = await createScene(THREE, el, BASE, gsap.ticker, {
          done: FIN_COUNT,
          total: ROUNDS.length,
          drivers: DRIVERS.map((d) => ({ no: d.no, first: d.firstEn, last: d.lastEn, color: d.color })),
          poster: css.getPropertyValue("--f-kanit").trim() || "sans-serif",
          mono: css.getPropertyValue("--f-jb").trim() || "monospace",
        });
      }
      if (!scene && alive) {
        const { createFilm } = await import("./film");
        scene = await createFilm(el, BASE, gsap.ticker);
        if (scene && alive) document.documentElement.dataset.film = "on";
      }
      if (!scene) return;
      if (!alive) {
        scene.dispose();
        return;
      }
      dispose = scene.dispose;
      if (process.env.NODE_ENV !== "production") Object.assign(window, { __stage: stage, __stageHooks: hooks, __anchors: anchors }); // for poking at in the console
      document.documentElement.dataset.stage = "on";
      window.dispatchEvent(new Event(STAGE_READY));
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    })();

    return () => {
      alive = false;
      delete document.documentElement.dataset.stage;
      delete document.documentElement.dataset.film;
      dispose();
    };
  }, []);

  return <div className={s.stage} ref={ref} aria-hidden="true" />;
}
