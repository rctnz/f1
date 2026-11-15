"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { MODEL_CREDITS } from "@/lib/data";
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
        const scrub = { trigger: ref.current, start: "top bottom", end: "bottom bottom", scrub: 0.25 };
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
        <div className={s.credits}>
          <p>
            <strong>โมเดล 3D</strong>
          </p>
          <ul>
            {MODEL_CREDITS.map((c) => (
              <li key={c.title}>
                {c.what}:{" "}
                <a href={c.source} target="_blank" rel="noopener noreferrer">
                  {c.title}
                </a>{" "}
                โดย{" "}
                <a href={c.profile} target="_blank" rel="noopener noreferrer">
                  {c.author}
                </a>{" "}
                สัญญาอนุญาต{" "}
                <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">
                  {c.license}
                </a>{" "}
                <span className={s.nw2}>{c.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={s.flags} aria-hidden="true">
        <div className={s.flagRow} data-row="a" />
        <div className={s.flagRow} data-row="b" />
      </div>
    </footer>
  );
}
