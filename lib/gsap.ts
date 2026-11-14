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

export { gsap, ScrollTrigger, useGSAP };
