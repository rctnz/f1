"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { getPhoto, PHOTO_EVENT } from "@/lib/photoStore";
import s from "./PhotoSlot.module.css";

type Props = {
  id: string;
  /** a file found in public/photos by the server; it wins over a picture kept in this browser from before */
  src: string | null;
  label: string;
  alt: string;
  shape: "cover" | "week" | "square" | "portrait";
  eager?: boolean;
  className?: string;
  children?: ReactNode;
};

export default function PhotoSlot({
  id,
  src,
  label,
  alt,
  shape,
  eager,
  className,
  children,
}: Props) {
  const [local, setLocal] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const show = (blob: Blob | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = blob ? URL.createObjectURL(blob) : null;
    setLocal(urlRef.current);
  };

  useEffect(() => {
    if (src) return;
    let alive = true;
    const load = () =>
      getPhoto(id).then((b) => {
        if (alive) show(b ?? null);
      });
    load();
    window.addEventListener(PHOTO_EVENT, load); // the same picture can have a second slot elsewhere on the page
    return () => {
      alive = false;
      window.removeEventListener(PHOTO_EVENT, load);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [id, src]);

  const shown = src ?? local;
  const slanted = shape === "cover" || shape === "week";

  return (
    <figure
      className={`${s.slot} ${s[shape]} ${className ?? ""}`}
      data-slot={id}
    >
      <span className={s.frame}>
        <span className={s.media} data-media>
          {shown ? (
            <img
              className={s.img}
              src={shown}
              alt={alt}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              data-zoom=""
              tabIndex={0}
            />
          ) : (
            <span className={s.empty}>
              <span className={s.chip}>
                <span className={s.chipLabel}>{label}</span>
              </span>
            </span>
          )}
        </span>
      </span>
      {slanted && (
        <svg
          className={s.outline}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <polygon points="8,0 100,0 92,100 0,100" />
        </svg>
      )}
      {children}
    </figure>
  );
}
