"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { gsap, MOTION, PIN_OK, ScrollTrigger, scrollToY, useGSAP } from "@/lib/gsap";
import { ROUNDS, titleOf } from "@/lib/data";
import { getPhoto, PHOTO_EVENT } from "@/lib/photoStore";
import { stage } from "@/lib/stage";
import s from "./Calendar.module.css";

const SMALL = `${MOTION} and (max-width: 1023.98px), ${MOTION} and (max-height: 699.98px)`;
const BASE_W = 280; // card width at rest on the pinned row
const OPEN_W = 560; // the card the race is at opens to this width
const ZOOM = 0.4; // its text grows by this much, as a scale, never a reflow

/** week photos: files from public/photos (server) first, then photos added in the browser */
function useWeekPhotos(server: Record<string, string | null>) {
  const [local, setLocal] = useState<Record<string, string>>({});
  useEffect(() => {
    const urls: string[] = [];
    let alive = true;
    const load = async () => {
      const next: Record<string, string> = {};
      for (const r of ROUNDS) {
        const id = `week-${r.nn}`;
        if (server[id]) continue;
        const b = await getPhoto(id);
        if (b) {
          const u = URL.createObjectURL(b);
          urls.push(u);
          next[id] = u;
        }
      }
      if (alive) setLocal(next);
    };
    load();
    window.addEventListener(PHOTO_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(PHOTO_EVENT, load);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [server]);
  return (id: string) => server[id] ?? local[id] ?? null;
}

export default function Calendar({ photos }: { photos: Record<string, string | null> }) {
  const ref = useRef<HTMLElement>(null);
  const photoOf = useWeekPhotos(photos);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      // desktop: the section pins, the row drives sideways and the card the race is at opens wide
      mm.add(`${MOTION} and ${PIN_OK}`, () => {
        const track = q("[data-track]")[0];
        const row = q("[data-row]")[0];
        const items = q("[data-item]");
        const texts = items.map((el) => el.querySelector("[data-text]"));
        const nums = items.map((el) => el.querySelector("[data-num]"));
        const n = items.length;
        // tent weights add up to 1 at every point, so the row's total width never changes while cards open
        const setOpen = (p: number) => {
          const at = p * (n - 1);
          items.forEach((el, i) => {
            const t = Math.max(0, 1 - Math.abs(i - at));
            gsap.set(el, { width: BASE_W + (OPEN_W - BASE_W) * t });
            // the words keep their layout and zoom with the card instead of reflowing
            gsap.set(texts[i], { scale: 1 + ZOOM * t });
            if (nums[i]) gsap.set(nums[i], { scale: 1 + ZOOM * t });
          });
        };
        setOpen(0);
        const dist = () => Math.max(0, row.scrollWidth - track.clientWidth);
        // the 3D car sits under the card the race is at, and the ground runs by as fast as the cards do
        const follow = (p: number) => {
          const at = p * (n - 1);
          const i0 = Math.min(n - 2, Math.floor(at));
          const f = at - i0;
          const a = items[i0].getBoundingClientRect();
          const b = items[i0 + 1].getBoundingClientRect();
          stage.calX = (a.left + a.width / 2) * (1 - f) + (b.left + b.width / 2) * f;
          stage.calRun = dist() * p;
        };
        // while the section rises into place the camera settles low and the car drives in under round 1
        gsap.fromTo(stage, { toCal: 0 }, { toCal: 1, ease: "none", scrollTrigger: { trigger: root, start: "top bottom", end: "top top", scrub: 0.5 } });
        const tween = gsap.to(row, {
          x: () => -dist(),
          ease: "none",
          // driven from the tween, not the trigger, so the cards, the open card and the car share one smoothed position
          onUpdate() {
            const p = this.progress();
            setOpen(p);
            follow(p);
          },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => "+=" + Math.round(dist() * 1.15),
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onRefresh: (self) => {
              // the car's body sits midway between the bottom of the cards and the bottom of the screen
              const bottom = row.getBoundingClientRect().bottom - root.getBoundingClientRect().top;
              stage.calY = bottom + (window.innerHeight - bottom) * 0.6;
              follow(self.animation ? self.animation.progress() : 0);
            },
          },
        });
        // keyboard: jump to the focused card's point in the race
        const onFocus = (e: FocusEvent) => {
          const t = (e.target as HTMLElement).closest<HTMLElement>("[data-item]");
          const st = tween.scrollTrigger;
          if (!t || !st) return;
          const i = items.indexOf(t);
          scrollToY(st.start + (st.end - st.start) * (i / (n - 1)));
        };
        root.addEventListener("focusin", onFocus);
        return () => {
          root.removeEventListener("focusin", onFocus);
          stage.toCal = stage.calRun = stage.calX = stage.calY = 0;
          gsap.set(items, { clearProps: "width" });
          gsap.set([...texts, ...nums].filter(Boolean), { clearProps: "transform" });
        };
      });

      // phones and tablets: cards come in as they reach the screen, down or back up
      mm.add(SMALL, () => {
        const items = q("[data-card]");
        gsap.set(items, { y: 16, opacity: 0 });
        const show = (els: Element[]) =>
          gsap.to(els, { y: 0, opacity: 1, duration: 0.5, stagger: 0.04, ease: "power4.out", overwrite: true });
        const hide = (els: Element[]) => gsap.set(els, { y: 16, opacity: 0, overwrite: true });
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
          <p>16 สนาม สนามละสัปดาห์ กดที่การ์ดเพื่อไปยังสนามนั้น รูปบนการ์ดคือรูปของสนามนั้น</p>
        </header>
      </div>
      <div className={s.track} data-track>
        <ol className={s.row} data-row>
          {ROUNDS.map((r) => {
            const src = photoOf(`week-${r.nn}`);
            return (
              <li key={r.n} className={s.item} data-item>
                <a className={s.card} href={`#round-${r.nn}`} data-card>
                  {src ? (
                    <img className={s.img} src={src} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className={s.empty} aria-hidden="true">
                      <span className={s.emptyNum} data-num>
                        {r.nn}
                      </span>
                    </span>
                  )}
                  <span className={s.shade} aria-hidden="true" />
                  <span className={s.text} data-text>
                    <span className={s.rnd}>ROUND {r.nn}</span>
                    <span className={s.name}>{titleOf(r)}</span>
                    <span className={s.date}>{r.date} 2026</span>
                  </span>
                  {r.status !== "FIN" && <span className={s.next}>NEXT</span>}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
