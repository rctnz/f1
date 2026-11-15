"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, MOTION, ScrollTrigger } from "@/lib/gsap";

/** Lenis smooth scroll synced to ScrollTrigger; mounted last so every trigger exists before the first sort/refresh. */
export default function SmoothScroll() {
  useEffect(() => {
    let lenis: Lenis | null = null;
    let tick: ((t: number) => void) | null = null;

    if (matchMedia(MOTION).matches) {
      lenis = new Lenis({ autoRaf: false, anchors: true, lerp: 0.13 });
      lenis.on("scroll", ScrollTrigger.update);
      tick = (t: number) => lenis?.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    }

    const refresh = () => {
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    };
    refresh();
    document.fonts?.ready.then(refresh);

    return () => {
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, []);

  return null;
}
