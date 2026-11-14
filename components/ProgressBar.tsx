"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";

/** a thin red line at the very top that tracks how far down the season you are */
export default function ProgressBar() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      gsap.set(ref.current, { autoAlpha: 1 });
      gsap.fromTo(
        ref.current,
        { scaleX: 0 },
        { scaleX: 1, ease: "none", scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.3 } },
      );
    });
  });
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 40,
        background: "#ff3b30", transformOrigin: "left center", visibility: "hidden", pointerEvents: "none",
      }}
    />
  );
}
