"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

/**
 * A list whose items can be reordered: drag by the handle (mouse or finger), or with the keyboard via the handle's
 * arrow keys and the up/down buttons. Calls onMove once, when an item is dropped in its new place.
 */
export function SortableList<T extends { id: string }>({
  items,
  onMove,
  renderItem,
  label,
}: {
  items: T[];
  onMove: (order: string[]) => void;
  renderItem: (item: T, handle: ReactNode, index: number) => ReactNode;
  label: string;
}) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const shown = order ? order.map((id) => items.find((item) => item.id === id)!).filter(Boolean) : items;

  function move(id: string, by: number) {
    const ids = items.map((item) => item.id);
    const from = ids.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    onMove(ids);
    setAnnouncement(`Flyttad till plats ${to + 1} av ${ids.length}.`);
  }

  function startDrag(event: React.PointerEvent, id: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    setDraggingId(id);
    setOrder(items.map((item) => item.id));
  }

  function dragMove(event: React.PointerEvent) {
    if (!draggingId || !order || !listRef.current) return;
    // Where the pointer is among the items' middles decides the dragged item's place.
    const rows = Array.from(listRef.current.children) as HTMLElement[];
    const others = order.filter((id) => id !== draggingId);
    let index = others.length;
    for (let i = 0, seen = 0; i < rows.length; i++) {
      const id = rows[i].dataset.sortId;
      if (id === draggingId) continue;
      const box = rows[i].getBoundingClientRect();
      if (event.clientY < box.top + box.height / 2) {
        index = seen;
        break;
      }
      seen++;
    }
    const next = [...others.slice(0, index), draggingId, ...others.slice(index)];
    if (next.join() !== order.join()) setOrder(next);
  }

  function endDrag() {
    if (draggingId && order && order.join() !== items.map((item) => item.id).join()) {
      onMove(order);
      setAnnouncement(`Flyttad till plats ${order.indexOf(draggingId) + 1} av ${order.length}.`);
    }
    setDraggingId(null);
    setOrder(null);
  }

  return (
    <>
      <ul ref={listRef} aria-label={label} className="space-y-2">
        {shown.map((item, index) => {
          const handle = (
            <span className="flex shrink-0 items-center">
              <button
                type="button"
                aria-label="Dra för att flytta (eller använd piltangenterna)"
                onPointerDown={(event) => startDrag(event, item.id)}
                onPointerMove={dragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    move(item.id, -1);
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    move(item.id, 1);
                  }
                }}
                className="flex h-11 w-8 cursor-grab touch-none items-center justify-center rounded-lg text-stone-300 hover:bg-stone-100 hover:text-admin-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin active:cursor-grabbing"
              >
                <GripVertical aria-hidden="true" className="h-5 w-5" />
              </button>
              <span className="flex flex-col transition-opacity can-hover:opacity-0 can-hover:group-hover/sort:opacity-100 group-focus-within/sort:opacity-100">
                <button
                  type="button"
                  aria-label="Flytta upp"
                  disabled={index === 0}
                  onClick={() => move(item.id, -1)}
                  className="flex h-[22px] w-7 items-center justify-center rounded text-stone-400 hover:text-admin-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
                >
                  <ChevronUp aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Flytta ner"
                  disabled={index === shown.length - 1}
                  onClick={() => move(item.id, 1)}
                  className="flex h-[22px] w-7 items-center justify-center rounded text-stone-400 hover:text-admin-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
                >
                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                </button>
              </span>
            </span>
          );
          return (
            <li
              key={item.id}
              data-sort-id={item.id}
              className={`group/sort transition-[box-shadow,transform] ${draggingId === item.id ? "relative z-10 scale-[1.01] rounded-2xl shadow-xl" : ""}`}
            >
              {renderItem(item, handle, index)}
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
