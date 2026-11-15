"use client";

import { useRef, type ReactNode } from "react";
import { gsap, MOTION, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { BASE } from "@/lib/data";
import { gridIsUp, gridPPM, stage, whenStageReady } from "@/lib/stage";
import s from "./Hero.module.css";

const LINES = ["ENGINEERING", "EXPLORATION", "GRAND PRIX"];

/**
 * The 3D grid shot rendered once, at 1920x945 with the page hidden, as two stills in public/stills: grid.webp is
 * the track, grid-car.webp the car and its shadow alone. They are laid exactly where the live scene will be, so the
 * first screen is whole while three.js and the model are on their way, and they are the whole hero where the 3D
 * stage cannot run (no graphics card behind the browser): the car still drives off at lights out.
 * STILL: that render's size, where the car's origin sat in it and its scale. CAR: the car still's place in it.
 */
const STILL = { w: 1920, h: 945, x: 865.84, y: 526.5, ppm: 209.25 };
const CAR = { x: 207, y: 228, w: 1326 };

/**
 * First screen: the car from overhead, as big as the screen (across a wide one, up an upright one), with the
 * headline laid over it. The block pins. Scrolling first lifts the words off the car, then brings the five
 * start lights on one by one; lights out sends the car out of the frame of a camera that never moves.
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

        // the lane fills the screen under the header; the car and the start line ahead of it sit centred in it
        const hero = q("[data-hero]")[0] as HTMLElement;
        const inner = q("[data-inner]")[0] as HTMLElement;
        const title = q("h1")[0] as HTMLElement;
        const [still, sprite] = q("[data-still]") as HTMLElement[];
        const range = document.createRange();
        const place = () => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const box = hero.getBoundingClientRect();
          const top = box.top - root.getBoundingClientRect().top;
          const up = gridIsUp(w, h, top);
          const ppm = gridPPM(w, h, top, up);
          stage.gridUp = up ? 1 : 0;
          stage.gridPpm = ppm;
          stage.gridX = up ? w / 2 : w / 2 - 0.45 * ppm;
          stage.gridY = top + (h - top) / 2 + (up ? 0.45 * ppm : 0);
          // the shade follows the words: down to the foot of the headline when the car runs up the screen,
          // across to the end of its longest line when the car runs across (neither is moved by the float)
          root.dataset.grid = up ? "up" : "across";
          // the still, scaled to this screen and laid car on car (it is only drawn for the car across the screen)
          const k = ppm / STILL.ppm;
          still.style.width = `${(STILL.w * k).toFixed(1)}px`;
          still.style.left = `${(stage.gridX - STILL.x * k).toFixed(1)}px`;
          still.style.top = `${(stage.gridY - top - STILL.y * k).toFixed(1)}px`;
          sprite.style.width = `${(CAR.w * k).toFixed(1)}px`;
          sprite.style.left = `${(stage.gridX + (CAR.x - STILL.x) * k).toFixed(1)}px`;
          sprite.style.top = `${(stage.gridY - top + (CAR.y - STILL.y) * k).toFixed(1)}px`;
          still.dataset.still = sprite.dataset.still = up ? "off" : "on";
          let right = 0;
          words.forEach((el) => {
            range.selectNodeContents(el);
            right = Math.max(right, range.getBoundingClientRect().right);
          });
          hero.style.setProperty("--text-end", `${Math.round(up ? inner.offsetTop + title.offsetTop + title.offsetHeight : right - box.left)}px`);
        };
        place();
        ScrollTrigger.addEventListener("refresh", place);

        // Car across the screen: the still already shows it on its slot, and the live car simply takes its place.
        // Car up the screen (no still): once loaded it rolls forward to the line, if the page is still at the top.
        const rollIn = stage.gridUp > 0 && window.scrollY < 40;
        if (rollIn) stage.arrive = 0;
        const cancelReady = whenStageReady(() => {
          gsap.to(stage, { arrive: 1, duration: rollIn ? 1.1 : 0, ease: "expo.out", delay: rollIn ? 0.1 : 0 });
        });

        const lift = () => -window.innerHeight * 0.5;
        const float = q("[data-float]");
        const lights = q("[data-light]");
        const start = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => "+=" + Math.round(window.innerHeight * 2.7),
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        // the words float up off the car, line after line, and the shade over it clears
        start.to(float, { y: lift, duration: 0.5, stagger: 0.05, ease: "power1.in" }, 0);
        start.to(float, { opacity: 0, duration: 0.22, stagger: 0.05 }, 0.26);
        start.to(q("[data-scrim]"), { opacity: 0, duration: 0.5 }, 0.04);
        // then the page holds while the five lights come on, left to right
        start.to(q("[data-hint]"), { opacity: 0, duration: 0.08 }, 0.66);
        lights.forEach((l, i) => start.to(l, { opacity: 1, duration: 0.1 }, 0.72 + i * 0.2));
        start.to({}, { duration: 0.26 }); // all five on, hold
        start.to(lights, { opacity: 0, duration: 0.03 }, ">");
        start.fromTo(q("[data-go]"), { opacity: 0 }, { opacity: 1, duration: 0.05 }, "<");
        // lights out and away
        start.fromTo(stage, { launch: 0 }, { launch: 1, duration: 0.62 }, "<");
        // the car's still makes the same run (it is only on screen when the live car is not)
        start.fromTo(sprite, { x: 0 }, { x: () => window.innerWidth - stage.gridX + 3.4 * stage.gridPpm, duration: 0.62, ease: "power2.in" }, "<");
        start.to({}, { duration: 0.06 });

        return () => {
          cancelReady();
          ScrollTrigger.removeEventListener("refresh", place);
          stage.arrive = 1;
          stage.launch = 0;
          stage.gridX = stage.gridY = stage.gridPpm = stage.gridUp = 0;
          delete root.dataset.grid;
          for (const img of [still, sprite]) {
            img.removeAttribute("style");
            img.dataset.still = "";
          }
          hero.style.removeProperty("--text-end");
        };
      });
    },
    { scope: ref },
  );

  return (
    <div className={s.start} id="top" ref={ref}>
      <div className={s.bar}>{children}</div>
      <section className={s.hero} aria-labelledby="hero-title" data-hero>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.still} data-still="" src={`${BASE}/stills/grid.webp`} width={STILL.w} height={STILL.h} alt="" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.still} data-still="" src={`${BASE}/stills/grid-car.webp`} width={CAR.w} height={597} alt="" decoding="async" />
        <div className={s.scrim} data-scrim aria-hidden="true" />

        {/* start gantry: a beam across the track with five lights hanging from it */}
        <div className={s.gantry} aria-hidden="true" data-fade>
          <span className={s.beam} />
          <div className={s.rig}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={s.unit}>
                <i data-light />
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

        <div className={`wrap ${s.inner}`} data-inner>
          <p className="tag" data-fade data-float>
            <span>
              <span>SEASON 2026 · 16 ROUNDS</span>
            </span>
          </p>

          <h1 className={s.title} id="hero-title">
            {LINES.map((line, i) => (
              <span key={line} className={s.line} data-float>
                <span className={s.lineIn} data-hl-in>
                  {i === 2 ? (
                    <span className={s.plate}>
                      <span>{line}</span>
                    </span>
                  ) : (
                    line
                  )}
                </span>
              </span>
            ))}
          </h1>
        </div>
      </section>
    </div>
  );
}
