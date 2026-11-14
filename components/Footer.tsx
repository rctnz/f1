"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import s from "./Footer.module.css";

export default function Footer() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const q = gsap.utils.selector(ref);
        gsap.from(q("[data-fl]"), {
          yPercent: 105,
          duration: 0.7,
          stagger: 0.08,
          ease: "power4.out",
          scrollTrigger: { trigger: q("[data-big]")[0], start: "top 90%", end: "bottom 10%", toggleActions: "play reverse play reverse" },
        });
        const scrub = { trigger: ref.current, start: "top bottom", end: "bottom bottom", scrub: 0.6 };
        gsap.fromTo(q("[data-row='a']"), { xPercent: 0 }, { xPercent: -8, ease: "none", scrollTrigger: scrub });
        gsap.fromTo(q("[data-row='b']"), { xPercent: -8 }, { xPercent: 0, ease: "none", scrollTrigger: { ...scrub } });
      });
    },
    { scope: ref },
  );

  return (
    <footer className={`tele ${s.foot}`} aria-labelledby="foot-title" ref={ref}>
      <div className="wrap">
        <h2 className={s.big} id="foot-title" data-big>
          <span className={s.mask}>
            <span data-fl>SEE YOU AT THE</span>
          </span>
          <span className={`${s.mask} ${s.red}`}>
            <span data-fl>FINISH LINE</span>
          </span>
        </h2>
        <div className={s.row}>
          <p>
            <strong>A10 / CPE102</strong> · <span className={s.nw}>มจธ. (KMUTT)</span> · <span className={s.nw}>SEASON 2026</span>
          </p>
          <a className={s.top} href="#top">
            กลับขึ้นด้านบน
          </a>
        </div>
      </div>
      <div className={s.flags} aria-hidden="true">
        <div className={s.flagRow} data-row="a" />
        <div className={s.flagRow} data-row="b" />
      </div>
    </footer>
  );
}
