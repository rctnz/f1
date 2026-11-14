"use client";

import { useRef } from "react";
import { gsap, MOTION, PIN_OK, ScrollTrigger, scrollToY, useGSAP } from "@/lib/gsap";
import { ROUNDS, titleOf } from "@/lib/data";
import s from "./Calendar.module.css";

const SMALL = `${MOTION} and (max-width: 1023.98px), ${MOTION} and (max-height: 699.98px)`;

export default function Calendar() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      // desktop: the section pins and the ticket row drives sideways like cars down the grid
      mm.add(`${MOTION} and ${PIN_OK}`, () => {
        const track = q("[data-track]")[0];
        const row = q("[data-row]")[0];
        const dist = () => Math.max(0, row.scrollWidth - track.clientWidth);
        const tween = gsap.to(row, {
          x: () => -dist(),
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => "+=" + dist(),
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });
        // keyboard: keep the focused ticket on screen
        const onFocus = (e: FocusEvent) => {
          const t = (e.target as HTMLElement).closest<HTMLElement>("[data-ticket]");
          const st = tween.scrollTrigger;
          if (!t || !st) return;
          const li = t.parentElement as HTMLElement;
          const x = gsap.utils.clamp(0, dist(), li.offsetLeft - (track.clientWidth - li.offsetWidth) / 2);
          scrollToY(st.start + x);
        };
        root.addEventListener("focusin", onFocus);
        return () => root.removeEventListener("focusin", onFocus);
      });

      // phones and tablets: tickets come in as they reach the screen
      mm.add(SMALL, () => {
        const items = q("[data-ticket]");
        gsap.set(items, { y: 16, opacity: 0 });
        const show = (els: Element[]) =>
          gsap.to(els, { y: 0, opacity: 1, duration: 0.5, stagger: 0.04, ease: "power4.out", overwrite: true });
        const hide = (els: Element[]) => gsap.set(els, { y: 16, opacity: 0, overwrite: true });
        // plays scrolling down and again scrolling back up
        ScrollTrigger.batch(items, { start: "top 95%", end: "bottom 5%", onEnter: show, onEnterBack: show, onLeave: hide, onLeaveBack: hide });
      });
    },
    { scope: ref },
  );

  return (
    <section className={s.calendar} id="calendar" aria-labelledby="cal-title" ref={ref}>
      <div className="wrap">
        <header className="secHead">
          <h2 className="secTitle" id="cal-title">
            Race Calendar
          </h2>
          <p>16 สนาม สนามละสัปดาห์ กดที่ตั๋วเพื่อไปยังสนามนั้น</p>
        </header>
      </div>
      <div className={s.track} data-track>
        <ol className={s.row} data-row>
          {ROUNDS.map((r) => (
            <li key={r.n}>
              <a className={s.ticket} href={`#round-${r.nn}`} data-ticket>
                <span className={s.stub}>
                  <span className="sr">ROUND </span>
                  {r.nn}
                </span>
                <span className={s.body}>
                  <span className={`${s.name} ${r.title ? "" : "todo"}`}>{titleOf(r)}</span>
                  <span className={s.date}>{r.date} 2026</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
