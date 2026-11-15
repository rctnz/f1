"use client";

import { useRef, type CSSProperties } from "react";
import { gsap, MOTION, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { DRIVERS } from "@/lib/data";
import { hooks, isStageOn, stage, wheelStep } from "@/lib/stage";
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

/**
 * The team. First a roll call: a 3D steering wheel comes up with the section, the section pins, and each stretch
 * of scroll turns the wheel into a corner, pushes that driver's button, changes the dash to them and brings their
 * number and name up beside it, while the shift lights climb as if through the gears. The wheel leaves with the
 * page, and the four tags swing in on their lanyards.
 */
export default function DriverTags({ photos }: { photos: Record<string, string | null> }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        const root = ref.current;
        if (!root) return;
        const q = gsap.utils.selector(root);

        // roll call
        const call = q("[data-call]")[0];
        const who = q("[data-who]") as HTMLElement[]; // the team first, then one per driver
        const vh = () => window.innerHeight;
        let shown = -1;
        const show = (i: number) => {
          if (i === shown) return;
          const prev = shown;
          shown = i;
          // the one leaving is nearly gone before the next arrives, so two numbers are never read on top of each other
          const wait = prev >= 0 ? 0.09 : 0;
          if (prev >= 0) gsap.to(who[prev], { autoAlpha: 0, y: -24, duration: 0.14, ease: "power2.in", overwrite: true });
          const el = who[i];
          gsap.fromTo(el, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3, delay: wait, ease: "expo.out", overwrite: true });
          gsap.fromTo(el.children, { y: 28 }, { y: 0, duration: 0.3, delay: wait, stagger: 0.05, ease: "expo.out", overwrite: true });
        };
        gsap.set(who, { autoAlpha: 0 });
        show(0); // the team is up as the screen arrives

        // arriving: the wheel rides up with the section (no smoothing, so it keeps the page's own pace)
        gsap.fromTo(stage, { wheelIn: 0 }, { wheelIn: 1, ease: "none", scrollTrigger: { trigger: call, start: "top bottom", end: "top top", scrub: true } });
        // the wheel has the stage from the first sliver of this screen until it has ridden off the top
        ScrollTrigger.create({
          trigger: call,
          start: "top bottom",
          end: () => "+=" + Math.round(vh() * 4.6),
          onToggle: (self) => {
            stage.act = self.isActive ? "wheel" : "car";
            hooks.invalidate?.();
          },
        });
        const roll = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: call,
            start: "top top",
            end: () => "+=" + (isStageOn() ? Math.round(vh() * 2.6) : 0), // no wheel, no hold
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        roll.fromTo(stage, { wheelBeat: 0 }, { wheelBeat: who.length, duration: 1, onUpdate: () => show(wheelStep(stage.wheelBeat, who.length - 1).face + 1) }, 0);
        // leaving: once the hold lets go, the wheel rides up and away with the section
        const held = () => roll.scrollTrigger?.end ?? 0;
        gsap.fromTo(
          stage,
          { wheelOut: 0 },
          { wheelOut: 1, ease: "none", immediateRender: false, scrollTrigger: { trigger: call, start: held, end: () => held() + vh(), scrub: true } },
        );

        // the cards swing in on their lanyards, scrolling down or back up
        const tags = q("[data-lanyard]");
        gsap.from(tags, {
          rotation: (i) => SWING[i % SWING.length],
          transformOrigin: "50% 0%",
          duration: 0.9,
          stagger: 0.08,
          ease: "power4.out",
          scrollTrigger: {
            trigger: q("[data-tags]")[0],
            start: "top 85%",
            end: "bottom 15%",
            toggleActions: "play reverse play reverse",
          },
        });

        return () => {
          stage.wheelIn = stage.wheelBeat = stage.wheelOut = 0;
          stage.act = "car";
        };
      });
    },
    { scope: ref },
  );

  return (
    <section className={s.drivers} id="drivers" aria-labelledby="drv-title" ref={ref}>
      <div className={s.call} data-call>
        <div className="wrap">
          <header className="secHead">
            <h2 className="secTitle" id="drv-title">
              Driver Tags
            </h2>
            <p>นักขับทีม A10 ทั้ง 4 คน เบอร์รถคือเลขสองตัวท้ายของรหัสนักศึกษา</p>
          </header>
        </div>
        {/* the roll call beside the 3D wheel: one driver at a time, with the same portrait slot as their tag below */}
        <div className={`wrap ${s.roll}`} data-roll>
          <div className={s.who} data-who>
            <p className={s.no}>A10</p>
            <p className={s.name}>นักขับ 4 คน</p>
            <p className={s.en}>CPE102 / KMUTT</p>
          </div>
          {DRIVERS.map((d, i) => (
            <div key={d.id} className={`${s.who} ${i % 2 === 0 ? s.right : ""}`} data-who style={{ "--c": d.color } as CSSProperties}>
              <PhotoSlot
                className={s.face}
                id={`driver-${d.no}`}
                src={photos[`driver-${d.no}`] ?? null}
                label={`DRIVER ${d.no}`}
                alt={`รูปของ ${d.first} ${d.last}`}
                shape="portrait"
              />
              <p className={s.no}>{d.no}</p>
              <p className={s.name}>
                {d.first} {d.last}
              </p>
              <p className={s.en}>
                {d.firstEn} {d.lastEn}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className={s.list}>
        <div className="wrap">
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
      </div>
    </section>
  );
}
