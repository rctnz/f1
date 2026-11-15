"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { deletePhoto, getPhoto, PHOTO_EVENT, setPhoto, shrink } from "@/lib/photoStore";
import s from "./PhotoSlot.module.css";

type Props = {
  id: string;
  /** a file found in public/photos by the server; when set it wins and the slot is not editable */
  src: string | null;
  label: string;
  alt: string;
  shape: "cover" | "week" | "square" | "portrait";
  eager?: boolean;
  className?: string;
  children?: ReactNode;
};

export default function PhotoSlot({ id, src, label, alt, shape, eager, className, children }: Props) {
  const [local, setLocal] = useState<string | null>(null);
  const [drop, setDrop] = useState(false);
  const urlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  async function accept(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const blob = await shrink(file);
    show(blob);
    setPhoto(id, blob);
  }

  function clear() {
    deletePhoto(id);
    show(null);
    inputRef.current?.focus();
  }

  const editable = !src;
  const shown = src ?? local;
  const dragProps = editable
    ? {
        onDragOver: (e: DragEvent) => {
          e.preventDefault();
          setDrop(true);
        },
        onDragLeave: () => setDrop(false),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDrop(false);
          accept(e.dataTransfer.files[0]);
        },
      }
    : {};
  const Frame = editable ? "label" : "span";
  const slanted = shape === "cover" || shape === "week";

  return (
    <figure className={`${s.slot} ${s[shape]} ${drop ? s.drop : ""} ${className ?? ""}`} data-slot={id}>
      <Frame className={s.frame} {...dragProps}>
        <span className={s.media} data-media>
          {shown ? (
            <img className={s.img} src={shown} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />
          ) : (
            <span className={s.empty}>
              <span className={s.chip}>
                <span className={s.chipLabel}>
                  {label} <span className={s.nw}>·&nbsp;เพิ่มรูป</span>
                </span>
                <span className={s.hint}>คลิกหรือลากรูปมาวาง</span>
              </span>
            </span>
          )}
        </span>
        {editable && (
          <input
            ref={inputRef}
            className={s.input}
            type="file"
            accept="image/*"
            aria-label={`เพิ่มรูป ${label}`}
            onChange={(e) => {
              accept(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        )}
      </Frame>
      {slanted && (
        <svg className={s.outline} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <polygon points="8,0 100,0 92,100 0,100" />
        </svg>
      )}
      {children}
      {editable && local && (
        <button type="button" className={s.clear} onClick={clear} aria-label={`ลบรูป ${label}`}>
          ลบรูป
        </button>
      )}
    </figure>
  );
}
