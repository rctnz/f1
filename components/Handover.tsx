"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import s from "./Handover.module.css";

type Theme = "poster" | "tele";

/** the diagonal seam between a white and a black section, with a chequered strip riding on it */
export default function Handover({ from, to, clear }: { from: Theme; to: Theme; clear?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.fromTo(
          ref.current!.querySelector("[data-strip]"),
          { xPercent: 0 },
          { xPercent: -12, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: 0.6 } },
        );
      });
    },
    { scope: ref },
  );

  return (
    <div className={`${s.handover} ${s[from + "From"]} ${s[to + "To"]} ${clear ? s.clear : ""}`} aria-hidden="true" ref={ref}>
      <div className={s.fill} />
      <div className={s.stripWrap}>
        <div className={s.strip} data-strip />
      </div>
    </div>
  );
}
