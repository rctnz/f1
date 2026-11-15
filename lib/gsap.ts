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

type LenisLike = { scrollTo: (target: number | HTMLElement, opts?: Record<string, unknown>) => void; options?: { wheelMultiplier: number; touchMultiplier: number } };

/** scroll to a position through Lenis when it runs, natively otherwise */
export function scrollToY(y: number) {
  const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
}

/** how many sticking sections the page is inside right now: while it is, the wheel moves the page half as far */
let heavy = 0;
const drag = (on: boolean) => {
  heavy = Math.max(0, heavy + (on ? 1 : -1));
  const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
  if (!lenis?.options) return;
  lenis.options.wheelMultiplier = heavy ? 0.5 : 1;
  lenis.options.touchMultiplier = heavy ? 0.5 : 1;
};

/**
 * A magnetic, heavy pinned section. Inside it the page scrolls at half speed. `points` are its resting places as
 * fractions of the pin (0 = just pinned, 1 = let go). When scrolling stops between two of them, the page has to
 * have come at least `threshold` of the way from the one it last rested on to be drawn on to the next; short of
 * that it springs back. Returns a cleanup.
 */
export function stick(st: ScrollTrigger, points: number[], threshold = 0.4) {
  const stops = [...points].sort((a, b) => a - b);
  let rest = stops[0]; // the point last rested on
  let gliding = false;
  let inside = false;
  const zone = ScrollTrigger.create({
    start: () => st.start,
    end: () => st.end,
    onToggle: (self) => {
      if (self.isActive === inside) return;
      inside = self.isActive;
      drag(inside);
      if (!inside) rest = self.progress > 0.5 ? stops[stops.length - 1] : stops[0];
    },
  });
  const onEnd = () => {
    if (gliding) {
      gliding = false;
      return;
    }
    const len = st.end - st.start;
    const y = window.scrollY;
    if (len < 80 || y <= st.start + 2 || y >= st.end - 2) return;
    const p = (y - st.start) / len;
    // the two resting places this position lies between
    let hi = stops.findIndex((v) => v >= p);
    if (hi <= 0) hi = 1;
    const a = stops[hi - 1];
    const b = stops[hi];
    const frac = (p - a) / (b - a);
    // from whichever of the two it set off, has it come far enough?
    const to = rest <= a ? (frac >= threshold ? b : a) : 1 - frac >= threshold ? a : b;
    rest = to;
    if (Math.abs(to - p) * len < 6) return;
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    if (!lenis) return;
    gliding = true;
    lenis.scrollTo(st.start + len * to, { duration: 0.9, easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
  };
  ScrollTrigger.addEventListener("scrollEnd", onEnd);
  return () => {
    ScrollTrigger.removeEventListener("scrollEnd", onEnd);
    if (inside) drag(false);
    zone.kill();
  };
}

export { gsap, ScrollTrigger, useGSAP };
