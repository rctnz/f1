"use client";

import { useRef } from "react";
import { gsap, MOTION, ScrollTrigger, stick, useGSAP } from "@/lib/gsap";
import { BASE, type Part } from "@/lib/data";
import { anchors, hooks, isStageOn, onStageFrame, smooth, stage, whenStageReady } from "@/lib/stage";
import s from "./Breakdown.module.css";

type Props = {
  id: string;
  /** mono header, e.g. ["A10", "EXPLODED VIEW"] */
  kicker: [string, string];
  title: string;
  intro: string;
  /** one label per anchor of the car, in the model's anchor order (components/stage/car.ts) */
  parts: Part[];
  /** the picture shown where the 3D stage is not running: file in public/stills, and its pixel size */
  still: { file: string; width: number; height: number };
};

const TOUR0 = 0.36; // where in the pin the walk down the labels starts, and how much of the pin it takes
const TOUR = 0.5;
const WIDE = 900; // from here up there is room for a label column and leader lines
const SVG = "http://www.w3.org/2000/svg";

/** text split so a Thai vowel or tone mark never arrives without its consonant */
function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) return Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text), (g) => g.segment);
  return Array.from(text);
}

/**
 * The car's exploded view, after the /breakdown skill: it comes apart group by group, then every part gets a
 * leader line and a numbered label in a column on the right, numbered top to bottom as they sit on screen.
 * The timeline is the scroll: the section pins, the parts lift, the lines draw, and it all goes back together
 * on the way out. While it is held, scrolling walks down the labels: each one in turn types out what its pairing means (the one before closes) and eases that part
 * a little further out. Without the 3D stage the labels are a plain list under a still.
 */
export default function Breakdown({ id, kicker, title, intro, parts, still }: Props) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();

      mm.add(MOTION, () => {
        const labels = q("[data-label]") as HTMLElement[];
        const pins = q("[data-pin]") as HTMLElement[];
        const phone = q("[data-phone-note]")[0] as HTMLElement | undefined;
        const notes = labels.map((l) => l.querySelector("[data-note]") as HTMLElement | null);
        const typed = labels.map((l) => l.querySelector("[data-type]") as HTMLElement | null);
        const svg = q("[data-leads]")[0] as unknown as SVGSVGElement;
        const n = labels.length;
        const lines: SVGPolylineElement[] = [];
        const dots: SVGCircleElement[] = [];
        for (let i = 0; i < n; i++) {
          const line = document.createElementNS(SVG, "polyline");
          const dot = document.createElementNS(SVG, "circle");
          dot.setAttribute("r", "5");
          svg.append(line, dot);
          lines.push(line);
          dots.push(dot);
        }

        const local = { lab: 0, tour: 0 }; // 0 → 1: leader lines drawn and labels in
        const open = { i: -1 }; // the label being pointed at
        const hgt = labels.map(() => ({ h: 0 })); // how far each label's note is open (px)
        let rank: number[] = []; // rank[i] = place of label i in screen order, top first
        let LX = 0;
        let LY: number[] = [];
        let wide = true;
        let laid = false;
        let near = false; // true from the moment the section starts to show until it has gone

        // label column: numbered by where each part ends up on screen, spaced so no two labels collide
        const layout = () => {
          const pts = hooks.layout?.("car");
          if (!pts || pts.length < n) return;
          const w = window.innerWidth;
          const h = window.innerHeight;
          wide = w >= WIDE;
          const byY = pts.map((p, i) => [p.y, i]).sort((a, b) => a[0] - b[0]);
          rank = [];
          byY.forEach(([, i], k) => {
            rank[i] = k;
            const num = String(k + 1).padStart(2, "0");
            labels[i].querySelector("[data-n]")!.textContent = num;
            pins[i].textContent = num;
            labels[i].style.order = String(k);
          });
          if (wide) {
            const colW = labels[0].offsetWidth || 280;
            const gutter = Math.max(32, (w - Math.min(w - 64, 1280)) / 2);
            LX = Math.round(Math.min(w - colW - gutter - 22, Math.max(w * 0.62, Math.max(...pts.map((p) => p.x)) + 120)));
            // the column starts under the heading line and keeps room below the last label for one note to open;
            // on a short screen the labels close up (never closer than one label), and then the note's room gives way
            const TOP = 104;
            const LABEL = 60;
            const NOTE = 100;
            const gap = Math.max(70, Math.min(88, (h - TOP - LABEL - NOTE - 12) / (n - 1)));
            const out: number[] = [];
            let prev = -1e9;
            byY.forEach(([y, i]) => {
              const yy = Math.max(y, prev + gap);
              out[i] = yy;
              prev = yy;
            });
            const over = Math.max(0, prev - (h - LABEL - NOTE - 12));
            const lift = over - Math.max(0, TOP - (out[byY[0][1]] - over));
            LY = out.map((y) => y - lift);
          }
          laid = true;
        };

        // every frame the scene draws (and every step of the label and note timelines): pin lines and labels to the parts
        const draw = () => {
          if (!near || stage.act !== "car") return;
          const pts = anchors.car;
          if (pts.length < n) return;
          if (!laid) layout();
          if (!laid) return;
          for (let i = 0; i < n; i++) {
            const t0 = rank[i] * 0.11;
            const a = smooth(t0, t0 + 0.3, local.lab);
            const la = smooth(t0 + 0.18, t0 + 0.45, local.lab);
            const ax = pts[i].x;
            const ay = pts[i].y;
            const label = labels[i];
            label.style.visibility = la > 0.02 ? "visible" : "hidden";
            label.style.opacity = String(la);
            if (wide) {
              // labels under the open one step down to make room for its note
              let ey = LY[i];
              for (let j = 0; j < n; j++) if (rank[j] < rank[i]) ey += hgt[j].h;
              const mx = Math.max(ax + 40, LX - 90);
              const seg0 = Math.hypot(mx - ax, ey - ay);
              const seg1 = LX - mx;
              let rem = a * (seg0 + seg1);
              let d = `${ax.toFixed(1)},${ay.toFixed(1)} `;
              if (rem <= seg0) d += `${(ax + ((mx - ax) * rem) / seg0).toFixed(1)},${(ay + ((ey - ay) * rem) / seg0).toFixed(1)}`;
              else {
                rem -= seg0;
                d += `${mx.toFixed(1)},${ey.toFixed(1)} ${(mx + rem).toFixed(1)},${ey.toFixed(1)}`;
              }
              lines[i].setAttribute("points", d);
              const lit = open.i === i;
              lines[i].style.opacity = a > 0 ? (open.i >= 0 && !lit ? "0.3" : "0.85") : "0";
              lines[i].style.stroke = lit ? "#ff3b30" : "";
              dots[i].setAttribute("cx", ax.toFixed(1));
              dots[i].setAttribute("cy", ay.toFixed(1));
              dots[i].setAttribute("r", lit ? "7" : "5");
              dots[i].style.opacity = a > 0 ? "1" : "0";
              label.style.transform = `translate(${(LX + 22 + 18 * (1 - la)).toFixed(1)}px, ${(ey - 11).toFixed(1)}px)`;
            } else {
              // no room for a column: numbered markers ride on the parts, the list sits under the model
              pins[i].style.opacity = String(a);
              pins[i].style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px) translate(-50%, -50%) scale(${(0.6 + 0.4 * a).toFixed(3)})`;
              label.style.transform = `translateY(${(8 * (1 - la)).toFixed(1)}px)`;
            }
          }
        };
        const offFrame = onStageFrame(draw);
        const relayout = () => {
          laid = false;
          if (isStageOn()) layout();
          draw();
        };
        const cancelReady = whenStageReady(relayout);
        ScrollTrigger.addEventListener("refresh", relayout);

        // pointing at a label: its note opens and types itself out, and the part it names eases out of the car
        let typing: gsap.core.Tween | null = null;
        const setOpen = (i: number) => {
          if (!isStageOn() || open.i === i) return;
          typing?.kill();
          if (!wide) {
            // a phone: one line of words under the car, for the part the scroll is on
            const was = open.i;
            open.i = i;
            if (was >= 0) {
              labels[was].removeAttribute("data-on");
              pins[was].removeAttribute("data-on");
            }
            stage.nudge.forEach((_, n) => gsap.to(stage.nudge, { [n]: n === i ? 1 : 0, duration: 0.4, ease: "power3.out", overwrite: "auto" }));
            if (!phone) return;
            if (i < 0) {
              phone.textContent = "";
              return;
            }
            labels[i].setAttribute("data-on", "");
            pins[i].setAttribute("data-on", "");
            const chars = graphemes(notes[i]?.querySelector("[data-full]")?.textContent ?? "");
            const count = { n: 0 };
            typing = gsap.to(count, {
              n: chars.length,
              duration: Math.min(1.2, chars.length * 0.014),
              ease: "none",
              onUpdate: () => {
                phone.textContent = chars.slice(0, Math.round(count.n)).join("");
              },
            });
            return;
          }
          const was = open.i;
          open.i = i;
          const slide = (n: number, to: number, done?: () => void) =>
            gsap.to(hgt[n], {
              h: to,
              duration: 0.34,
              ease: "power3.out",
              overwrite: true,
              onUpdate: () => {
                if (notes[n]) notes[n]!.style.height = `${hgt[n].h.toFixed(1)}px`;
                draw();
              },
              onComplete: done,
            });
          // the one being left closes at the pace the new one opens, so the labels between them glide instead of jumping
          if (was >= 0) {
            labels[was].removeAttribute("data-open");
            slide(was, 0, () => {
              if (open.i !== was && typed[was]) typed[was]!.textContent = "";
            });
          }
          // each part has its own ease: the one named moves out while the one left settles back, neither snaps
          stage.nudge.forEach((_, n) => gsap.to(stage.nudge, { [n]: n === i ? 1 : 0, duration: 0.4, ease: "power3.out", overwrite: "auto" }));
          if (i < 0) return;
          const note = notes[i];
          const out = typed[i];
          if (!note || !out) return;
          labels[i].setAttribute("data-open", "");
          const full = note.querySelector("[data-full]") as HTMLElement;
          slide(i, full.offsetHeight);
          const chars = graphemes(full.textContent ?? "");
          const count = { n: 0 };
          typing = gsap.to(count, {
            n: chars.length,
            duration: Math.min(1.5, chars.length * 0.017),
            ease: "none",
            onUpdate: () => {
              out.textContent = chars.slice(0, Math.round(count.n)).join("");
            },
            onComplete: () => labels[i].setAttribute("data-open", "done"),
          });
        };
        const vh = () => window.innerHeight;
        // approach: while the section rises into place the camera comes round to the car
        gsap.fromTo(stage, { pit: 0 }, { pit: 1, ease: "none", scrollTrigger: { trigger: root, start: "top bottom", end: "top top", scrub: 0.25 } });
        // on screen: from the first sliver of the section until the pin has let go and it has scrolled away
        ScrollTrigger.create({
          trigger: root,
          start: "top bottom",
          end: () => "+=" + Math.round(vh() * 6.4),
          onToggle: (self) => {
            near = self.isActive;
            if (!near) setOpen(-1);
            hooks.invalidate?.();
          },
        });

        // pinned: apart, labelled, held, then back together before the page moves on
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => "+=" + (isStageOn() ? Math.round(vh() * 4.4) : 0), // nothing comes apart without the stage, so no hold
            pin: true,
            scrub: 0.25,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        tl.fromTo(stage, { explode: 0 }, { explode: 1, duration: 0.2 }, 0);
        tl.fromTo(local, { lab: 0 }, { lab: 1, duration: 0.2, onUpdate: draw }, 0.14);
        // then the scroll walks down the labels: each one's note opens in turn, and closes as the next one opens
        tl.fromTo(
          local,
          { tour: 0 },
          {
            tour: n,
            duration: TOUR,
            onUpdate: () => setOpen(local.tour > 0.001 && local.tour < n - 0.001 ? rank.indexOf(Math.min(n - 1, Math.floor(local.tour))) : -1),
          },
          TOUR0,
        );
        tl.to(local, { lab: 0, duration: 0.06, onUpdate: draw }, 0.88);
        tl.to(stage, { explode: 0, duration: 0.09 }, 0.91);
        // it holds on: stop part-way and the page settles on the labelled view, or lets go
        const unstick = stick(tl.scrollTrigger!, [0, ...labels.map((_, k) => TOUR0 + ((k + 0.5) / n) * TOUR), 1]);

        // the heading steps in as the section arrives
        const head = q("[data-head] > *");
        gsap.set(head, { y: 24, opacity: 0 });
        gsap.to(head, {
          y: 0,
          opacity: 1,
          duration: 0.3,
          stagger: 0.06,
          ease: "expo.out",
          scrollTrigger: { trigger: root, start: "top 45%", toggleActions: "play none none reverse" },
        });

        return () => {
          offFrame();
          cancelReady();
          ScrollTrigger.removeEventListener("refresh", relayout);
          typing?.kill();
          gsap.killTweensOf(hgt);
          unstick();
          lines.forEach((l) => l.remove());
          dots.forEach((d) => d.remove());
          gsap.killTweensOf(stage.nudge);
          stage.pit = stage.explode = 0;
          stage.nudge.fill(0);
          [...labels, ...pins, ...(notes.filter(Boolean) as HTMLElement[])].forEach((el) => el.removeAttribute("style"));
          labels.forEach((l) => l.removeAttribute("data-open"));
          typed.forEach((t) => t && (t.textContent = ""));
        };
      });
    },
    { scope: ref },
  );

  return (
    <section className={s.bd} id={id} aria-labelledby={`${id}-title`} ref={ref}>
      <div className={s.frame}>
        <header className={`wrap ${s.head}`} data-head>
          <p className={s.kicker}>
            <b>{kicker[0]}</b> / {kicker[1]}
          </p>
          <h2 className="secTitle" id={`${id}-title`}>
            {title}
          </h2>
          <p className={s.intro}>{intro}</p>
        </header>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.still} src={`${BASE}/stills/${still.file}`} width={still.width} height={still.height} alt="" loading="lazy" decoding="async" />

        <svg className={s.leads} data-leads aria-hidden="true" />
        <div className={s.pins} aria-hidden="true">
          {parts.map((p, i) => (
            <span key={p.name} className={s.pin} data-pin>
              {String(i + 1).padStart(2, "0")}
            </span>
          ))}
        </div>

        <p className={`wrap ${s.phoneNote}`} data-phone-note aria-hidden="true" />
        <ol className={`wrap ${s.labels}`} data-labels>
          {parts.map((p, i) => (
            <li key={p.name} className={s.label} data-label>
              <span className={s.n} data-n aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              {p.href ? (
                <a className={s.t} href={p.href} aria-describedby={p.desc ? `${id}-note-${i}` : undefined}>
                  {p.name}
                </a>
              ) : (
                <span className={s.t}>{p.name}</span>
              )}
              <span className={s.s}>{p.note}</span>
              {p.desc && (
                <span className={s.note} data-note>
                  {/* the whole sentence sets the size (and is what a screen reader gets); the typed copy is drawn over it */}
                  <span className={s.full} id={`${id}-note-${i}`} data-full>
                    {p.desc}
                  </span>
                  <span className={s.type} data-type aria-hidden="true" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
