"use client";

import { useRef, type CSSProperties } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { ABOUT, FIN_COUNT, ROUNDS } from "@/lib/data";
import { isStageOn, stage } from "@/lib/stage";
import PhotoSlot from "./PhotoSlot";
import s from "./Season.module.css";

/** a digit drawn as a 0–9 column; at rest (and without script) it already shows its final value */
function Digit({ d }: { d: number }) {
  return (
    <span className={s.digit}>
      <span className={s.sizer}>{d}</span>
      <span className={s.col} style={{ "--d": d } as CSSProperties} data-col={d}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i}>{i}</span>
        ))}
      </span>
    </span>
  );
}

function Num({ n }: { n: number }) {
  return (
    <>
      {String(n)
        .split("")
        .map((c, i) => (
          <Digit key={i} d={Number(c)} />
        ))}
    </>
  );
}

/**
 * How far the season has got. While this section rises into place the camera drops from overhead to the side and
 * catches the car; the section then pins and the scroll takes the camera once round it.
 */
export default function Season({ cover }: { cover: string | null }) {
  const ref = useRef<HTMLElement>(null);
  const total = ROUNDS.length;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const root = ref.current;
        if (!root) return;
        const q = gsap.utils.selector(root);

        gsap.fromTo(stage, { chase: 0 }, { chase: 1, ease: "none", scrollTrigger: { trigger: root, start: "top bottom", end: "top top", scrub: 0.25 } });

        const lap = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => "+=" + (isStageOn() ? Math.round(window.innerHeight * 1.7) : 0), // no car to lap, no hold
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        lap.fromTo(stage, { orbit: 0 }, { orbit: 1, duration: 0.84 }, 0);
        lap.fromTo(stage, { away: 0 }, { away: 1, duration: 0.16 }, 0.84);

        // the count rolls up and the words step in as the section arrives, and step back out on the way up
        const cols = q("[data-col]");
        const rise = q("[data-rise]");
        const photo = q("[data-reveal]");
        gsap.set(cols, { y: 0, yPercent: 0 });
        gsap.set(rise, { y: 24, opacity: 0 });
        gsap.set(photo, { clipPath: "inset(0 100% 0 0)" });
        const enter = gsap.timeline({
          defaults: { ease: "expo.out" },
          scrollTrigger: { trigger: root, start: "top 82%", toggleActions: "play none none reverse" },
        });
        cols.forEach((col) => enter.to(col, { yPercent: -10 * Number(col.dataset.col), duration: 0.9 }, 0));
        enter.to(rise, { y: 0, opacity: 1, duration: 0.3, stagger: 0.06 }, 0.12);
        enter.to(photo, { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power3.inOut" }, 0.2);

        return () => {
          stage.chase = stage.orbit = stage.away = 0;
        };
      });
    },
    { scope: ref },
  );

  return (
    <section className={s.season} id="season" aria-labelledby="season-title" ref={ref}>
      <div className={`wrap ${s.inner}`}>
        <div className={s.copy}>
          <h2 className={s.counter} id="season-title">
            <span className="sr">
              จบแล้ว {FIN_COUNT} จาก {total} สนาม
            </span>
            <span aria-hidden="true" className={s.counterVis}>
              <span className={s.counterRed}>
                <Num n={FIN_COUNT} />
              </span>
              <span className={s.slash}>/</span>
              <span>
                <Num n={total} />
              </span>
            </span>
          </h2>
          <p className={s.label} data-rise>
            สนามที่จบแล้ว
          </p>
          <p className={s.lead} data-rise>
            {ABOUT[0]} บันทึกของทีม A10 เล่า {total} สัปดาห์เป็นฤดูกาลแข่ง {total} สนาม ตั้งแต่ {ROUNDS[0].date} ถึง {ROUNDS[total - 1].date} 2026
          </p>
          <div className={s.coverWrap} data-reveal>
            <PhotoSlot id="cover" src={cover} label="ปก 16:9" alt="รูปปกทีม A10" shape="cover" eager className={s.cover} />
          </div>
        </div>
      </div>
    </section>
  );
}
