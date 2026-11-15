"use client";

import { useRef, type ReactNode } from "react";
import { gsap, MOTION, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { gridFrameW, stage, whenStageReady } from "@/lib/stage";
import s from "./Hero.module.css";

const LINES = ["ENGINEERING", "EXPLORATION", "GRAND PRIX"];

/**
 * First screen: the headline over an overhead shot of the car on its grid slot.
 * The block pins while the start lights come on, one column per stretch of scroll; lights out sends the car
 * off the right of a camera that never moves.
 */
export default function Hero({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const root = ref.current;
        if (!root) return;
        const q = gsap.utils.selector(root);

        // on load: the headline rises out of its own baseline
        const words = q("[data-hl-in]");
        gsap.set(words, { y: 0, yPercent: 110 }); // y: 0 so GSAP does not inherit the CSS pre-hide transform
        document.documentElement.classList.add("hero-ready");
        const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
        intro.to(words, { yPercent: 0, duration: 0.8, stagger: 0.08 }, 0);
        intro.from(q("[data-fade]"), { y: 12, opacity: 0, duration: 0.5, stagger: 0.06 }, 0.3);

        // the grid slot sits just under the headline, wherever that ends on this screen
        const title = q("[data-title]")[0];
        const place = () => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const ppm = w / gridFrameW(w); // px per metre in the overhead shot
          const below = title.getBoundingClientRect().bottom - root.getBoundingClientRect().top;
          const half = 1.0 * ppm; // the car is 2 m across
          stage.gridY = Math.min(h - half - 26, Math.max(below + half + (w < 768 ? 20 : 30), h * 0.5));
          stage.gridX = w < 768 ? w * 0.47 : Math.min(w * 0.6, w - 5.4 * ppm - 16);
        };
        place();
        ScrollTrigger.addEventListener("refresh", place);

        // once the car has loaded it rolls forward into the slot, if the page is still at the top
        if (window.scrollY < 40) stage.arrive = 0;
        const cancelReady = whenStageReady(() => {
          gsap.to(stage, { arrive: 1, duration: window.scrollY < 40 ? 1.1 : 0, ease: "expo.out", delay: 0.1 });
        });

        // on scroll: the page holds until all five columns are lit, then lights out and away
        const units = q("[data-unit]");
        const lit = q("[data-light]");
        const start = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => "+=" + Math.round(window.innerHeight * 2.3),
            pin: true,
            scrub: 0.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        units.forEach((u, i) => start.to(u.querySelectorAll("[data-light]"), { opacity: 1, duration: 0.12 }, i * 0.2));
        start.to(q("[data-hint]"), { opacity: 0, duration: 0.1 }, 0.95);
        start.to({}, { duration: 0.28 }); // all five lit, hold
        start.to(lit, { opacity: 0, duration: 0.03 }, ">");
        start.fromTo(q("[data-go]"), { opacity: 0 }, { opacity: 1, duration: 0.05 }, "<");
        start.fromTo(stage, { launch: 0 }, { launch: 1, duration: 0.62 }, "<");
        start.to({}, { duration: 0.06 });

        // after the start: the three lines slide against each other while the block scrolls away
        const hl = q("[data-hl]");
        gsap
          .timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: root, pinnedContainer: root, start: "top top", end: "bottom top", scrub: 0.6 } })
          .to(hl[0], { xPercent: -3 }, 0)
          .to(hl[1], { xPercent: 2 }, 0)
          .to(hl[2], { xPercent: -5 }, 0);

        return () => {
          cancelReady();
          ScrollTrigger.removeEventListener("refresh", place);
          stage.arrive = 1;
          stage.launch = 0;
          stage.gridX = stage.gridY = 0;
        };
      });
    },
    { scope: ref },
  );

  return (
    <div className={s.start} id="top" ref={ref}>
      {children}
      <section className={s.hero} aria-labelledby="hero-title">
        <div className={`wrap ${s.inner}`}>
          <p className="tag" data-fade>
            <span>
              <span>SEASON 2026 · 16 ROUNDS</span>
            </span>
          </p>

          <h1 className={s.title} id="hero-title" data-title>
            {LINES.map((line, i) => (
              <span key={line} className={`${s.line} ${i === 2 ? s.red : ""}`} data-hl>
                <span className={s.lineIn} data-hl-in>
                  {line}
                </span>
              </span>
            ))}
          </h1>

          <div className={s.gantryWrap} aria-hidden="true" data-fade>
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
      </section>
    </div>
  );
}
