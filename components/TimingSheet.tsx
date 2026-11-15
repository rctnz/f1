"use client";

import { useRef } from "react";
import { gsap, MOTION, PIN_OK, useGSAP } from "@/lib/gsap";
import { FIN_COUNT, ROUNDS, titleOf, type Round } from "@/lib/data";
import s from "./TimingSheet.module.css";

const SMALL = `${MOTION} and (max-width: 1023.98px), ${MOTION} and (max-height: 699.98px)`;

function Table({ rounds, from, to }: { rounds: Round[]; from: number; to: number }) {
  return (
    <div className={s.tableWrap} data-table>
      <span className={s.cursor} data-cursor aria-hidden="true" />
      <table className={s.table}>
        <caption className="sr">
          ผลรอบ {from}–{to}
        </caption>
        <thead>
          <tr>
            <th scope="col">RND</th>
            <th scope="col">CODE</th>
            <th scope="col">หัวข้อ</th>
            <th scope="col" className={s.right}>
              สถานะ
            </th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r.n} data-row>
              <td className={s.rnd}>{r.nn}</td>
              <td className={s.code}>{r.code}</td>
              <td className={s.name}>
                <a href={`#round-${r.nn}`} className={r.title ? "" : s.muted}>
                  {titleOf(r)}
                </a>
              </td>
              <td className={s.right}>
                {r.status === "FIN" ? (
                  <span className={s.fin} data-fin>
                    FIN
                  </span>
                ) : (
                  <span className={s.next} data-next>
                    NEXT
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TimingSheet() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);

      const build = (pin: boolean) => {
        const segs = q("[data-seg]");
        const rows = q("[data-row]");
        const fins = q("[data-fin]");
        const nexts = q("[data-next]");
        const last = FIN_COUNT - 1; // the cursor parks on the last finished round
        const [curA, curB] = q("[data-cursor]");
        const lap = q("[data-lap]")[0];
        const rowY = (i: number) => rows[i].offsetTop + rows[i].offsetHeight / 2;

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: pin
            ? { trigger: root, start: "top top", end: "+=160%", pin: true, scrub: 0.25, invalidateOnRefresh: true }
            : { trigger: q("[data-sheet]")[0], start: "top 70%", end: "bottom 60%", scrub: 0.25, invalidateOnRefresh: true },
          onUpdate() {
            const n = String(Math.min(FIN_COUNT, Math.max(1, Math.ceil(tl.progress() * 16)))).padStart(2, "0");
            if (lap.textContent !== n) lap.textContent = n;
          },
        });

        tl.fromTo(curA, { opacity: 0, y: () => rowY(0) }, { opacity: 1, duration: 0.2 }, 0);
        tl.set(curB, { opacity: 0, y: () => rowY(8) }, 0);
        let ni = 0;
        let fi = 0;
        ROUNDS.forEach((r, i) => {
          tl.fromTo(segs[i], { scaleX: 0 }, { scaleX: 1, duration: 0.6 }, i);
          if (r.status !== "FIN") {
            // not raced yet: the segment fills yellow and NEXT stays put
            tl.fromTo(nexts[ni++], { opacity: 0.35 }, { opacity: 1, duration: 0.4 }, i + 0.2);
            return;
          }
          const fin = fins[fi++];
          const cur = i < 8 ? curA : curB;
          if (i === 8) {
            tl.to(curA, { opacity: 0, duration: 0.2 }, i);
            tl.to(curB, { opacity: 1, duration: 0.2 }, i);
          } else if (i > 0 && i <= last) {
            tl.to(cur, { y: () => rowY(i), duration: 0.4 }, i);
          }
          tl.fromTo(fin, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.5 }, i + 0.35);
        });
        tl.to({}, { duration: 0.4 }); // hold on the final lap before the pin lets go
      };

      const mm = gsap.matchMedia();
      mm.add(`${MOTION} and ${PIN_OK}`, () => build(true));
      mm.add(SMALL, () => build(false));
    },
    { scope: ref },
  );

  return (
    <section className={`tele ${s.timing}`} id="timing" aria-labelledby="tim-title" ref={ref}>
      <div className="wrap">
        <div className={s.bar}>
          <h2 className={s.title} id="tim-title">
            TIMING SHEET
            <small>ผลทุกรอบของทีม A10 · CPE102</small>
          </h2>
          <div className={s.meter}>
            <p className={s.lap}>
              <span className="sr">
                LAP {FIN_COUNT}/{ROUNDS.length}
              </span>
              <span aria-hidden="true">
                <span className={s.lapLabel}>LAP</span>
                <b>
                  <span data-lap>{String(FIN_COUNT).padStart(2, "0")}</span>/{ROUNDS.length}
                </b>
              </span>
            </p>
            <div className={s.progress} role="img" aria-label={`จบแล้ว ${FIN_COUNT} จาก ${ROUNDS.length} สนาม`}>
              {ROUNDS.map((r) => (
                <i key={r.n} data-seg className={r.status === "FIN" ? "" : s.segNext} />
              ))}
            </div>
            <p className={s.ends} aria-hidden="true">
              <span>R01 · {ROUNDS[0].date}</span>
              <span>R16 · {ROUNDS[15].date}</span>
            </p>
          </div>
        </div>
        <div className={s.sheet} data-sheet>
          <Table rounds={ROUNDS.slice(0, 8)} from={1} to={8} />
          <Table rounds={ROUNDS.slice(8)} from={9} to={16} />
        </div>
      </div>
    </section>
  );
}
