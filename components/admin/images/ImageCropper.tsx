"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { aspectOptions, type AspectId, type CropRect } from "@/lib/admin/images";

/**
 * Crop and focus: a frame in the chosen shape that can be dragged and zoomed over the picture, and a dot marking the
 * part that must always stay in view when the layout crops it further.
 */
export function ImageCropper({
  bitmap,
  previewUrl,
  aspect,
  onAspect,
  onChange,
}: {
  bitmap: ImageBitmap;
  previewUrl: string;
  aspect: AspectId;
  onAspect: (aspect: AspectId) => void;
  onChange: (crop: CropRect, focus: { x: number; y: number }) => void;
}) {
  const ratio = aspectOptions.find((option) => option.id === aspect)?.ratio || bitmap.width / bitmap.height;
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  // The largest frame of the shape that fits, shrunk by the zoom; kept inside the picture.
  const baseWidth = Math.min(bitmap.width, bitmap.height * ratio);
  const cropWidth = baseWidth / zoom;
  const cropHeight = cropWidth / ratio;
  const x = Math.min(Math.max(center.x * bitmap.width - cropWidth / 2, 0), bitmap.width - cropWidth);
  const y = Math.min(Math.max(center.y * bitmap.height - cropHeight / 2, 0), bitmap.height - cropHeight);

  useEffect(() => {
    onChange({ x: Math.round(x), y: Math.round(y), width: Math.round(cropWidth), height: Math.round(cropHeight) }, focus);
  }, [x, y, cropWidth, cropHeight, focus, onChange]);

  function onPointerDown(event: ReactPointerEvent) {
    (event.target as Element).setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, cx: center.x, cy: center.y };
  }
  function onPointerMove(event: ReactPointerEvent) {
    if (!drag.current || !frameRef.current) return;
    const box = frameRef.current.getBoundingClientRect();
    // Dragging moves the picture under the frame, as on a phone.
    const dx = (event.clientX - drag.current.x) / box.width;
    const dy = (event.clientY - drag.current.y) / box.height;
    setCenter({
      x: Math.min(1, Math.max(0, drag.current.cx - (dx * cropWidth) / bitmap.width)),
      y: Math.min(1, Math.max(0, drag.current.cy - (dy * cropHeight) / bitmap.height)),
    });
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Form" className="flex flex-wrap gap-2">
        {aspectOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={aspect === option.id}
            onClick={() => {
              onAspect(option.id);
              setZoom(1);
            }}
            className={`min-h-10 rounded-xl px-3.5 text-[13px] font-semibold ring-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
              aspect === option.id ? "bg-admin text-admin-contrast ring-admin" : "bg-white text-admin-ink ring-admin-line hover:bg-stone-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <p className="mb-2 text-[13px] text-admin-muted">Dra i bilden för att flytta den inom ramen.</p>
          <div
            ref={frameRef}
            className="relative mx-auto w-full max-w-[520px] cursor-grab touch-none overflow-hidden rounded-xl bg-stone-900 active:cursor-grabbing"
            style={{ aspectRatio: `${cropWidth} / ${cropHeight}` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                width: `${(bitmap.width / cropWidth) * 100}%`,
                left: `${(-x / cropWidth) * 100}%`,
                top: `${(-y / cropHeight) * 100}%`,
              }}
            />
          </div>
          <label className="mt-3 flex items-center gap-3 text-[13px] font-semibold text-admin-ink">
            Zoom
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1 accent-[rgb(var(--admin-primary))]" />
          </label>
        </div>

        <div>
          <p className="mb-2 text-[13px] text-admin-muted">Tryck på det viktigaste i bilden – den delen syns alltid.</p>
          <button
            type="button"
            className="relative block w-full overflow-hidden rounded-xl bg-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
            style={{ aspectRatio: `${cropWidth} / ${cropHeight}` }}
            aria-label={`Fokuspunkt: ${Math.round(focus.x)} procent från vänster, ${Math.round(focus.y)} procent uppifrån. Piltangenterna flyttar den.`}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setFocus({ x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 });
            }}
            onKeyDown={(event) => {
              const step = 5;
              const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
              const move = moves[event.key];
              if (!move) return;
              event.preventDefault();
              setFocus((f) => ({ x: Math.min(100, Math.max(0, f.x + move[0])), y: Math.min(100, Math.max(0, f.y + move[1])) }));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="pointer-events-none absolute max-w-none"
              style={{
                width: `${(bitmap.width / cropWidth) * 100}%`,
                left: `${(-x / cropWidth) * 100}%`,
                top: `${(-y / cropHeight) * 100}%`,
              }}
            />
            <span
              aria-hidden="true"
              className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-admin/70 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
              style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
