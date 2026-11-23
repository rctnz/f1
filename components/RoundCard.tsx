/* eslint-disable @next/next/no-img-element */
import { PHOTO_CAPTIONS, titleOf, type Round } from "@/lib/data";
import PhotoSlot from "./PhotoSlot";
import s from "./Rounds.module.css";

export default function RoundCard({
  r,
  photo,
  more,
}: {
  r: Round;
  photo: string | null;
  more: string[];
}) {
  return (
    <article
      className={`${s.round} ${r.n % 2 === 0 ? s.flip : ""}`}
      id={`round-${r.nn}`}
      aria-labelledby={`round-${r.nn}-t`}
      data-round={r.nn}
      data-code={r.code}
    >
      <div className={s.rule} data-rule />
      <div className={s.grid}>
        <div className={s.head}>
          <p className={s.num} aria-hidden="true" data-num>
            {r.nn}
          </p>
          <p className="tag">
            <span>
              <span>
                ROUND {r.nn} · {r.date}
              </span>
            </span>
          </p>
          <div className={s.titleMask}>
            {/* หัวข้อ Week 8: แก้ที่ lib/data.ts */}
            <h3
              className={`${s.title} ${r.title ? "" : "todo"}`}
              id={`round-${r.nn}-t`}
              data-title
            >
              {titleOf(r)}
            </h3>
          </div>
          {r.subtitle ? (
            <p className={s.sub}>{r.subtitle}</p>
          ) : (
            !r.title && <p className={`${s.sub} todo`}>(ใส่หัวข้อรอง)</p>
          )}
          <p className={s.strip} data-strip>
            <span>RND {r.nn}</span>
            <span>{r.code}</span>
            <span className={r.status === "FIN" ? s.fin : s.next}>
              {r.status}
            </span>
          </p>
        </div>
        <div className={s.notes}>
          {r.notes.length === 0 ? (
            <p className={s.todoNote}>(ใส่บันทึก)</p>
          ) : (
            r.notes.map((b, i) =>
              typeof b === "string" ? (
                <p key={i}>{b}</p>
              ) : (
                <div key={i}>
                  <p>{b.lead}</p>
                  <ol>
                    {b.list.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ol>
                </div>
              ),
            )
          )}
        </div>
        <PhotoSlot
          className={s.photo}
          id={`week-${r.nn}`}
          src={photo}
          label={`WEEK ${r.nn}`}
          alt={`รูปกิจกรรม ROUND ${r.nn}: ${titleOf(r)}`}
          shape="week"
        />
        {more.length > 0 && (
          <ul className={s.more} data-n={more.length}>
            {more.map((src, i) => (
              <li key={src}>
                <figure className={s.shot}>
                  <span className={s.shotImg}>
                    <img
                      src={src}
                      alt={
                        PHOTO_CAPTIONS[r.nn]?.[i] ||
                        `รูปกิจกรรม ROUND ${r.nn} รูปที่ ${i + 2}`
                      }
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  {PHOTO_CAPTIONS[r.nn]?.[i] && (
                    <figcaption>{PHOTO_CAPTIONS[r.nn][i]}</figcaption>
                  )}
                </figure>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
