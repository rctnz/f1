"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin, useGSAP);
}

/** every animation lives under this query; pins also need DESKTOP */
export const MOTION = "(prefers-reduced-motion: no-preference)";
export const DESKTOP = "(min-width: 1024px)";
export const PIN_OK = "(min-width: 1024px) and (min-height: 700px)";

type LenisLike = { scrollTo: (target: number | HTMLElement, opts?: Record<string, unknown>) => void };

/** scroll to a position through Lenis when it runs, natively otherwise */
export function scrollToY(y: number) {
  const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
}

/**
 * Makes a pinned section hold on: when scrolling stops part-way through it, the page glides on to the nearest of
 * `points` (fractions of the pin, e.g. 0 = just pinned, 1 = let go). Returns a cleanup.
 */
export function stick(st: ScrollTrigger, points: number[]) {
  let gliding = false;
  const onEnd = () => {
    if (gliding) {
      gliding = false;
      return;
    }
    const len = st.end - st.start;
    const y = window.scrollY;
    if (len < 80 || y <= st.start + 2 || y >= st.end - 2) return;
    const p = (y - st.start) / len;
    const to = points.reduce((best, v) => (Math.abs(v - p) < Math.abs(best - p) ? v : best), points[0]);
    if (Math.abs(to - p) * len < 6) return;
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    if (!lenis) return;
    gliding = true;
    lenis.scrollTo(st.start + len * to, { duration: 0.7, easing: (t: number) => 1 - Math.pow(1 - t, 3) });
  };
  ScrollTrigger.addEventListener("scrollEnd", onEnd);
  return () => ScrollTrigger.removeEventListener("scrollEnd", onEnd);
}

export { gsap, ScrollTrigger, useGSAP };
