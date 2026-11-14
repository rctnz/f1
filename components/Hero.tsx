"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { FIN_COUNT, ROUNDS } from "@/lib/data";
import PhotoSlot from "./PhotoSlot";
import s from "./Hero.module.css";

const LINES = ["ENGINEERING", "EXPLORATION", "GRAND PRIX"];

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

/** the header and hero pin together while the start lights come on, one column per stretch of scroll */
export default function Hero({ cover, children }: { cover: string | null; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const total = ROUNDS.length;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const root = ref.current;
        if (!root) return;
        const q = gsap.utils.selector(root);

        // on load: the headline rises and the counter rolls
        const words = q("[data-hl-in]");
        gsap.set(words, { y: 0, yPercent: 110 }); // y: 0 so GSAP does not inherit the CSS pre-hide transform
        document.documentElement.classList.add("hero-ready");
        const intro = gsap.timeline({ defaults: { ease: "power4.out" } });
        intro.to(words, { yPercent: 0, duration: 0.7, stagger: 0.08 }, 0);
        q("[data-col]").forEach((col) => {
          intro.fromTo(col, { y: 0, yPercent: 0 }, { y: 0, yPercent: -10 * Number(col.dataset.col), duration: 0.9 }, 0.3);
        });
        intro.from(q("[data-fade]"), { y: 12, opacity: 0, duration: 0.52, stagger: 0.06 }, 0.45);

        // on scroll: the page holds until all five columns are lit, then lights out and away
        const units = q("[data-unit]");
        const lit = q("[data-light]");
        const start = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => "+=" + Math.round(window.innerHeight * 1.1),
            pin: true,
            scrub: 0.4,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        units.forEach((u, i) => start.to(u.querySelectorAll("[data-light]"), { opacity: 1, duration: 0.12 }, i * 0.2));
        start.to(q("[data-hint]"), { opacity: 0, duration: 0.1 }, 0.95);
        start.to({}, { duration: 0.3 }); // all five lit, hold
        start.to(lit, { opacity: 0, duration: 0.04 }, ">");
        start.fromTo(q("[data-go]"), { opacity: 0 }, { opacity: 1, duration: 0.06 }, "<");
        start.fromTo(q("[data-slot='cover']"), { xPercent: 0 }, { xPercent: -3, duration: 0.25 }, "<");
        start.to({}, { duration: 0.15 });

        // after the start: parallax while the hero scrolls away
        const hero = q("[data-hero]")[0];
        const hl = q("[data-hl]");
        gsap
          .timeline({
            scrollTrigger: { trigger: hero, pinnedContainer: root, start: "top top", end: "bottom top", scrub: 0.6 },
          })
          .fromTo(q("[data-slot='cover'] [data-media]"), { yPercent: -8, scale: 1.16 }, { yPercent: 8, scale: 1.16, ease: "none" }, 0)
          .to(q("[data-speed='1']"), { y: -60, ease: "none" }, 0)
          .to(q("[data-speed='2']"), { y: -140, ease: "none" }, 0)
          .to(q("[data-speed='3']"), { y: -220, ease: "none" }, 0)
          .to(hl[0], { xPercent: -3, ease: "none" }, 0)
          .to(hl[1], { xPercent: 2, ease: "none" }, 0)
          .to(hl[2], { xPercent: -5, ease: "none" }, 0);
      });
    },
    { scope: ref },
  );

  return (
    <div className={s.start} id="top" ref={ref}>
      {children}
      <section className={s.hero} aria-labelledby="hero-title" data-hero>
        <div className={s.speed} aria-hidden="true">
          <i data-speed="1" />
          <i data-speed="2" />
          <i data-speed="3" />
        </div>
        <div className={`wrap ${s.inner}`}>
          <div className={s.top}>
            <p className="tag">
              <span>
                <span>SEASON 2026 · 16 ROUNDS</span>
              </span>
            </p>
            <div className={s.gantryWrap} aria-hidden="true">
              <div className={s.gantry}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={s.unit} data-unit>
                    <span className={s.light}>
                      <i data-light />
                    </span>
                    <span className={s.light}>
                      <i data-light />
                    </span>
                  </span>
                ))}
              </div>
              <p className={s.hint}>
                <span data-hint>เลื่อนลงเพื่อเปิดไฟออกตัว</span>
                <span className={s.go} data-go>
                  LIGHTS OUT
                </span>
              </p>
            </div>
          </div>

          <h1 className={s.title} id="hero-title">
            {LINES.map((line, i) => (
              <span key={line} className={`${s.line} ${i === 2 ? s.red : ""}`} data-hl>
                <span className={s.lineIn} data-hl-in>
                  {line}
                </span>
              </span>
            ))}
          </h1>

          <div className={s.row}>
            <PhotoSlot id="cover" src={cover} label="ปก 16:9" alt="รูปปกทีม A10" shape="cover" eager className={s.cover} />
            <div className={s.meta}>
              <p className={s.counter}>
                <span className="sr">
                  {FIN_COUNT} จาก {total}
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
              </p>
              <p className={s.counterLabel} data-fade>
                สนามที่จบแล้ว
              </p>
              <p className={s.lead} data-fade>
                บันทึกการเรียนวิชา CPE102 ของทีม A10 มจธ. ตลอดภาคเรียน เล่าเป็นฤดูกาลแข่ง {total} สนาม ตั้งแต่ 6 ส.ค. ถึง 20 พ.ย. 2026
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
