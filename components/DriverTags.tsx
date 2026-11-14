"use client";

import { useRef, type CSSProperties } from "react";
import { gsap, MOTION, useGSAP } from "@/lib/gsap";
import { DRIVERS } from "@/lib/data";
import PhotoSlot from "./PhotoSlot";
import KeyBar from "./KeyTags";
import s from "./DriverTags.module.css";

const SWING = [-5, 4, -3, 5];

// card livery per car number: dark end, light end, text colour (yellow takes dark text for contrast)
const LIVERY: Record<string, [string, string, string]> = {
  "25": ["#6e0a12", "#c1121f", "#ffffff"],
  "33": ["#b08c00", "#ffd60a", "#111111"],
  "40": ["#2b2f35", "#686e77", "#ffffff"],
  "41": ["#053f30", "#0f9f74", "#ffffff"],
};

export default function DriverTags({ photos }: { photos: Record<string, string | null> }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const tags = gsap.utils.toArray<HTMLElement>("[data-lanyard]", ref.current);
        // the cards swing in on their lanyards, scrolling down or back up
        gsap.from(tags, {
          rotation: (i) => SWING[i % SWING.length],
          transformOrigin: "50% 0%",
          duration: 0.9,
          stagger: 0.08,
          ease: "power4.out",
          scrollTrigger: {
            trigger: ref.current?.querySelector("[data-tags]"),
            start: "top 85%",
            end: "bottom 15%",
            toggleActions: "play reverse play reverse",
          },
        });
      });
    },
    { scope: ref },
  );

  return (
    <section className={s.drivers} id="drivers" aria-labelledby="drv-title" ref={ref}>
      <div className="wrap">
        <header className="secHead">
          <h2 className="secTitle" id="drv-title">
            Driver Tags
          </h2>
          <p>นักขับทีม A10 ทั้ง 4 คน เบอร์รถคือเลขสองตัวท้ายของรหัสนักศึกษา</p>
        </header>
        <ul className={s.tags} data-tags>
          {DRIVERS.map((d) => {
            const [dark, light, ink] = LIVERY[d.no];
            return (
              <li key={d.id} className={s.lanyard} data-lanyard>
                <span className={s.strap} aria-hidden="true" />
                <span className={s.clip} aria-hidden="true">
                  <span className={s.clipSlot} />
                </span>
                <div className={s.cardWrap}>
                  <span className={s.shadow} aria-hidden="true" />
                  <article
                    className={s.card}
                    aria-labelledby={`d-${d.id}`}
                    style={{ "--dark": dark, "--light": light, "--ink": ink } as CSSProperties}
                  >
                    <div className={s.head}>
                      <KeyBar d={d} />
                      <span className={s.slot} aria-hidden="true" />
                    </div>
                    <div className={s.body}>
                      <div className={s.text}>
                        <p className={s.first} aria-hidden="true">
                          {d.first}
                        </p>
                        <h3 className={s.last} id={`d-${d.id}`}>
                          <span className="sr">{d.first} </span>
                          {d.last}
                        </h3>
                        <p className={s.team}>TEAM A10</p>
                        <p className={s.id}>{d.id}</p>
                        <p className={s.num}>
                          <span className="sr">เบอร์รถ </span>
                          {d.no}
                        </p>
                        <span className={s.flag} aria-hidden="true" />
                      </div>
                      <PhotoSlot
                        className={s.photo}
                        id={`driver-${d.no}`}
                        src={photos[`driver-${d.no}`] ?? null}
                        label={`DRIVER ${d.no}`}
                        alt={`รูปของ ${d.first} ${d.last}`}
                        shape="portrait"
                      />
                    </div>
                    <p className={s.bar}>
                      <span>CPE102 · KMUTT</span>
                      <span>SEASON 2026</span>
                    </p>
                  </article>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
