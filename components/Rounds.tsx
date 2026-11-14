"use client";

import { useRef } from "react";
import { DESKTOP, gsap, MOTION, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { ROUNDS } from "@/lib/data";
import RoundCard from "./RoundCard";
import s from "./Rounds.module.css";

// KMUTT Bang Mod as a circuit: the campus boundary traced from the official master plan, shown in greyscale (public/kmutt-map.webp),
// straight edges only, starting and finishing at Gate 1 on Pracha Uthit Road. The map is clipped to the same outline.
const TRACK = "M520 972 L455 955 L400 875 L292 785 L310 700 L285 690 L240 668 L165 720 L100 695 L185 560 L210 550 L40 550 L10 525 L398 12 L412 28 L392 100 L455 118 L585 122 L600 175 L650 230 L660 295 L745 375 L805 412 L955 500 L990 520 L1050 595 L1135 538 L1248 600 L1240 700 L1160 775 L1065 715 L1050 735 L1005 830 L930 800 L850 745 L790 790 L720 880 L640 975 L600 985 Z"; // campus outer edge

/** an original red livery, drawn top-down and pointing along +x so MotionPath can rotate it with the track */
function Car() {
  return (
    <g data-car transform="translate(515 978)">
      <g transform="scale(1.6)">
        {/* rear wing */}
        <rect x="-42" y="-15" width="8" height="30" rx="1.5" fill="#d5d9de" />
        <rect x="-42" y="-15" width="8" height="4" fill="#ff3b30" />
        <rect x="-42" y="11" width="8" height="4" fill="#ff3b30" />
        {/* tyres */}
        <rect x="-35" y="-19" width="13" height="7" rx="2" fill="#050506" stroke="#5a5f66" strokeWidth="1" />
        <rect x="-35" y="12" width="13" height="7" rx="2" fill="#050506" stroke="#5a5f66" strokeWidth="1" />
        <rect x="15" y="-18" width="11" height="6" rx="2" fill="#050506" stroke="#5a5f66" strokeWidth="1" />
        <rect x="15" y="12" width="11" height="6" rx="2" fill="#050506" stroke="#5a5f66" strokeWidth="1" />
        {/* suspension */}
        <path d="M-24 -8 L-28 -13 M-24 8 L-28 13 M13 -3 L20 -12 M13 3 L20 12" stroke="#8d939b" strokeWidth="1.4" />
        {/* body and sidepods */}
        <path d="M-34 -6 C-30 -11 -18 -12 -8 -11 C0 -10 6 -7 11 -3.5 L11 3.5 C6 7 0 10 -8 11 C-18 12 -30 11 -34 6 Z" fill="#c1121f" />
        {/* nose */}
        <path d="M10 -3.5 L36 -1.6 L36 1.6 L10 3.5 Z" fill="#c1121f" />
        {/* white engine-cover stripe and number panel */}
        <path d="M-32 -2 L-6 -2.6 L-6 2.6 L-32 2 Z" fill="#eef1f4" />
        <rect x="18" y="-1.6" width="9" height="3.2" fill="#eef1f4" />
        {/* cockpit and halo */}
        <ellipse cx="-1" cy="0" rx="6" ry="3.6" fill="#0b0d10" />
        <path d="M-6 -3.6 C-1 -6 4 -4 6 0 C4 4 -1 6 -6 3.6" fill="none" stroke="#15171a" strokeWidth="1.6" />
        {/* front wing */}
        <path d="M34 -16 L40 -15 L41 -12 L41 12 L40 15 L34 16 Z" fill="#d5d9de" />
        <rect x="37" y="-13" width="2" height="26" fill="#ff3b30" />
      </g>
    </g>
  );
}

export default function Rounds({ photos }: { photos: Record<string, string | null> }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      mm.add(MOTION, () => {
        q("[data-round]").forEach((art) => {
          const one = (sel: string) => art.querySelector(sel);
          // each time it comes into view (down or up): the rule is laid, the title rises, the strip wipes in
          gsap
            .timeline({ defaults: { ease: "power4.out" }, scrollTrigger: { trigger: art, start: "top 85%", end: "bottom 15%", toggleActions: "play reverse play reverse" } })
            .from(one("[data-rule]"), { scaleX: 0, transformOrigin: "left center", duration: 0.8 })
            .from(one("[data-title]"), { yPercent: 105, duration: 0.6 }, 0.15)
            .from(one("[data-strip]"), { clipPath: "inset(0% 100% 0% 0%)", duration: 0.45 }, 0.35);
          // scrubbed depth: the big number and the photo move at their own speeds
          const scrub = { trigger: art, start: "top bottom", end: "bottom top", scrub: 0.6 };
          gsap.fromTo(one("[data-num]"), { yPercent: 12 }, { yPercent: -12, ease: "none", scrollTrigger: scrub });
          gsap.fromTo(one("[data-media]"), { yPercent: -8, scale: 1.16 }, { yPercent: 8, scale: 1.16, ease: "none", scrollTrigger: { ...scrub } });
        });
      });

      // desktop: the racing line is drawn across the whole season and the car follows it
      mm.add(`${MOTION} and ${DESKTOP}`, () => {
        const list = q("[data-list]")[0];
        const line = q("[data-draw]")[0] as unknown as SVGPathElement;
        const car = q("[data-car]")[0];
        const rnd = q("[data-rail-rnd]")[0];
        const code = q("[data-rail-code]")[0];
        const scrub = { trigger: list, start: "top 60%", end: "bottom bottom", scrub: 0.6 };
        // the server shows the finished season (16/16); with the line drawn by scroll, start the readout at round 01
        rnd.textContent = ROUNDS[0].nn;
        code.textContent = ROUNDS[0].code;
        gsap.fromTo(line, { drawSVG: "0%" }, { drawSVG: "100%", ease: "none", scrollTrigger: scrub });
        gsap.to(car, {
          ease: "none",
          motionPath: { path: line, align: line, alignOrigin: [0.5, 0.5], autoRotate: true },
          scrollTrigger: { ...scrub },
        });
        q("[data-round]").forEach((art) => {
          ScrollTrigger.create({
            trigger: art,
            start: "top center",
            end: "bottom center",
            onToggle: (self) => {
              if (!self.isActive) return;
              rnd.textContent = (art as HTMLElement).dataset.round ?? "";
              code.textContent = (art as HTMLElement).dataset.code ?? "";
            },
          });
        });
      });
    },
    { scope: ref },
  );

  return (
    <section className={s.rounds} id="rounds" aria-labelledby="rnd-title" ref={ref}>
      <div className="wrap">
        <header className="secHead">
          <h2 className="secTitle" id="rnd-title">
            ทุกสนาม
          </h2>
          <p>Week 1 ถึง 16 แต่ละสนามมีหัวข้อที่เรียน บันทึกของทีม และรูปจากวันนั้น</p>
        </header>
        <div className={s.layout}>
          <aside className={s.rail} aria-hidden="true">
            <div className={s.railInner}>
              <svg className={s.track} viewBox="0 0 1252 1052" focusable="false">
                <defs>
                  <clipPath id="campus">
                    <path d={TRACK} />
                  </clipPath>
                </defs>
                <image href="/kmutt-map.webp" x="0" y="0" width="1252" height="1052" className={s.map} clipPath="url(#campus)" />
                <path d={TRACK} className={s.trackBase} />
                <path d={TRACK} className={s.trackDraw} data-draw />
                <g className={s.startLine}>
                  <rect x="508" y="950" width="12" height="12" />
                  <rect x="520" y="962" width="12" height="12" />
                  <rect x="508" y="974" width="12" height="12" />
                  <rect x="532" y="950" width="12" height="12" />
                  <rect x="532" y="974" width="12" height="12" />
                </g>
                <Car />
              </svg>
              <p className={s.railName}>KMUTT CIRCUIT</p>
              <p className={s.railRnd}>
                RND <b data-rail-rnd>16</b>/16
              </p>
              <p className={s.railCode} data-rail-code>
                FPP
              </p>
            </div>
          </aside>
          <div className={s.list} data-list>
            {ROUNDS.map((r) => (
              <RoundCard key={r.n} r={r} photo={photos[`week-${r.nn}`] ?? null} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
