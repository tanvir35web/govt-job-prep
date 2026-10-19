"use client";

import { useEffect, useRef, useState } from "react";

// iOS sheet: slides up, dims the page, and closes on Done, backdrop tap, Escape or a downward drag.
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    // Capturing the pointer would swallow the Done button's click.
    if ((e.target as HTMLElement).closest("button")) return;
    startY.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging) setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onPointerUp = () => {
    setDragging(false);
    if (dragY > 100) onClose();
    else setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="বন্ধ করুন" onClick={onClose} className="absolute inset-0 animate-backdrop-in bg-black/40" />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-w-lg max-h-[85dvh] animate-sheet-up flex-col rounded-t-[14px] bg-canvas shadow-2xl dark:bg-surface ${
          !dragging ? "transition-transform duration-300 ease-out" : ""
        }`}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
      >
        <div className="touch-none select-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div className="mx-auto mt-1.5 h-[5px] w-9 rounded-full bg-tertiary" />
          <div className="px-safe grid grid-cols-[1fr_auto_1fr] items-center py-2.5">
            <span />
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="pressable justify-self-end text-[17px] font-semibold text-tint">
              সম্পন্ন
            </button>
          </div>
        </div>
        <div className="px-safe overflow-y-auto overscroll-contain pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
