"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { BASE, FIN_COUNT, ROUNDS } from "@/lib/data";
import { hooks, stage, STAGE_READY } from "@/lib/stage";
import s from "./Stage.module.css";

/**
 * One WebGL canvas fixed behind the whole page. Sections above it are either solid (they cover it) or clear
 * (the car shows through), so the same car carries from the hero down through the calendar and the exploded view.
 * three.js loads after first paint; until the scene is up, and wherever WebGL or motion is not available,
 * the page keeps its flat layout (html has no data-stage attribute).
 */
export default function Stage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    let alive = true;
    let dispose = () => {};

    (async () => {
      const [THREE, { createScene }] = await Promise.all([import("three"), import("./scene")]);
      await document.fonts?.ready;
      if (!alive) return;
      const css = getComputedStyle(document.documentElement);
      const scene = await createScene(THREE, el, BASE, gsap.ticker, {
        done: FIN_COUNT,
        total: ROUNDS.length,
        poster: css.getPropertyValue("--f-kanit").trim() || "sans-serif",
        mono: css.getPropertyValue("--f-jb").trim() || "monospace",
      });
      if (!scene) return;
      if (!alive) {
        scene.dispose();
        return;
      }
      dispose = scene.dispose;
      if (process.env.NODE_ENV !== "production") Object.assign(window, { __stage: stage, __stageHooks: hooks }); // for poking at in the console
      document.documentElement.dataset.stage = "on";
      window.dispatchEvent(new Event(STAGE_READY));
      ScrollTrigger.refresh();
    })();

    return () => {
      alive = false;
      delete document.documentElement.dataset.stage;
      dispose();
    };
  }, []);

  return <div className={s.stage} ref={ref} aria-hidden="true" />;
}
