import type { CSSProperties } from "react";
import type { Driver } from "@/lib/data";
import s from "./KeyTags.module.css";

/** acrylic name bar across the top of a driver card: first name, surname, team, car number in the driver's colour */
export default function KeyBar({ d }: { d: Driver }) {
  return (
    <div className={s.acrylic} style={{ "--c": d.color } as CSSProperties}>
      <p className={s.names}>
        <span className={s.first}>{d.firstEn}</span>
        <span className={s.last} style={{ "--len": d.lastEn.length } as CSSProperties}>
          {d.lastEn}
        </span>
        <span className={s.team}>TEAM A10</span>
      </p>
      <p className={s.num}>
        <span className="sr">เบอร์รถ </span>
        {d.no}
      </p>
      <span className={s.edge} aria-hidden="true" />
    </div>
  );
}
