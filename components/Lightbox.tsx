"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import s from "./Lightbox.module.css";

type Shot = { src: string; alt: string; caption: string };
type LenisLike = { stop: () => void; start: () => void };

/**
 * Click any picture marked data-zoom and it opens large over the page; click again, or press Esc, to put it back.
 * One of these sits at the end of the page and listens for clicks on the whole document.
 */
export default function Lightbox() {
  const [shot, setShot] = useState<Shot | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fromRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const img = (e.target as HTMLElement | null)?.closest?.("img[data-zoom]") as HTMLImageElement | null;
      if (!img) return;
      fromRef.current = img;
      setShot({ src: img.currentSrc || img.src, alt: img.alt, caption: img.dataset.zoom ?? "" });
    };
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if ((e.key === "Enter" || e.key === " ") && el?.matches("img[data-zoom]")) {
        e.preventDefault();
        el.click();
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!shot) return;
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    lenis?.stop();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShot(null);
    };
    document.addEventListener("keydown", onKey);
    const from = fromRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      lenis?.start();
      from?.focus?.({ preventScroll: true });
    };
  }, [shot]);

  if (!shot) return null;
  return (
    <div className={s.veil} role="dialog" aria-modal="true" aria-label={shot.caption || shot.alt} onClick={() => setShot(null)}>
      <figure className={s.fig}>
        <img className={s.img} src={shot.src} alt={shot.alt} />
        {shot.caption && <figcaption className={s.cap}>{shot.caption}</figcaption>}
      </figure>
      <button ref={closeRef} type="button" className={s.close} onClick={() => setShot(null)}>
        ปิด
      </button>
    </div>
  );
}
