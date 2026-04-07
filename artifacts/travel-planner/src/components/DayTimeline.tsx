import React, { useRef, useState, useCallback, useEffect } from "react";
import { Trash2 } from "lucide-react";
import type { ItineraryItem } from "@workspace/api-client-react";
import { getTagIcon } from "@/lib/tag-icons";
import { fmtCost } from "@/lib/utils";

const PX_PER_MIN = 1.4;
const DAY_START_H = 6;
const DAY_END_H = 24;
const DAY_START_MIN = DAY_START_H * 60;
const DAY_END_MIN = DAY_END_H * 60;
const GRID_HEIGHT = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN;
const MIN_DURATION = 15;
const SNAP_MINS = 15;
const DEFAULT_DURATION = 60;
const HOUR_H = 60 * PX_PER_MIN;
const HOURS = Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => DAY_START_H + i);

function formatHour(h: number) {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function formatTime(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}
function snapTo(v: number, snap: number) {
  return Math.round(v / snap) * snap;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function minToY(min: number) {
  return (min - DAY_START_MIN) * PX_PER_MIN;
}
function yToMin(y: number) {
  return DAY_START_MIN + y / PX_PER_MIN;
}

function computeEffectiveStart(
  items: ItineraryItem[],
  localOverrides: Map<number, { startMinutes?: number; duration?: number }>,
): Map<number, number> {
  const map = new Map<number, number>();
  let cur = 8 * 60;
  for (const item of items) {
    const override = localOverrides.get(item.id);
    const start =
      override?.startMinutes != null
        ? override.startMinutes
        : item.startMinutes != null
        ? item.startMinutes
        : cur;
    map.set(item.id, start);
    const dur =
      override?.duration != null
        ? override.duration
        : item.estimatedDuration ?? item.place?.estimatedDuration ?? DEFAULT_DURATION;
    if (item.startMinutes == null && override?.startMinutes == null) {
      cur = start + dur;
    }
  }
  return map;
}

/**
 * Resolves a proposed start time so it never overlaps existing items.
 * Finds the nearest free gap that fits `duration` minutes.
 */
function resolveNoOverlap(
  proposedStart: number,
  duration: number,
  excludeId: number,
  items: ItineraryItem[],
  startMap: Map<number, number>,
  getDur: (item: ItineraryItem) => number,
): number {
  const occupied = items
    .filter((i) => i.id !== excludeId)
    .map((i) => {
      const s = startMap.get(i.id) ?? DAY_START_MIN;
      return { start: s, end: s + getDur(i) };
    })
    .sort((a, b) => a.start - b.start);

  // Build list of free gaps
  const gaps: { start: number; end: number }[] = [];
  let cur = DAY_START_MIN;
  for (const occ of occupied) {
    if (occ.start > cur) gaps.push({ start: cur, end: occ.start });
    cur = Math.max(cur, occ.end);
  }
  if (cur < DAY_END_MIN) gaps.push({ start: cur, end: DAY_END_MIN });

  if (gaps.length === 0) return DAY_START_MIN;

  // Viable gaps that can hold the dragged block
  const viable = gaps.filter((g) => g.end - g.start >= duration);
  if (viable.length === 0) {
    // Fall back to largest gap
    const biggest = gaps.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
    return clamp(proposedStart, biggest.start, biggest.end - Math.min(duration, biggest.end - biggest.start));
  }

  // Check if proposed position already fits in a viable gap
  for (const gap of viable) {
    if (proposedStart >= gap.start && proposedStart + duration <= gap.end) {
      return proposedStart; // already valid
    }
    if (proposedStart >= gap.start && proposedStart < gap.end) {
      // Starts in gap but overflows — clamp
      return Math.min(proposedStart, gap.end - duration);
    }
  }

  // Not in any viable gap — find the nearest viable gap boundary
  let bestPos = viable[0].start;
  let bestDist = Infinity;
  for (const gap of viable) {
    // Two candidate positions for this gap: fill from start, or snap to end - duration
    const maxStart = gap.end - duration;
    const candidates = [gap.start, maxStart];
    for (const c of candidates) {
      const d = Math.abs(c - proposedStart);
      if (d < bestDist) {
        bestDist = d;
        bestPos = c;
      }
    }
  }
  return bestPos;
}

interface Props {
  items: ItineraryItem[];
  selectedItemId: number | null;
  symbol: string;
  onItemClick: (item: ItineraryItem) => void;
  onItemRemove: (itemId: number) => void;
  onDurationChange: (itemId: number, newDuration: number) => Promise<void>;
  onMove: (itemId: number, newStartMinutes: number) => Promise<void>;
}

type DragKind = "resize" | "move";
interface DragState {
  id: number;
  kind: DragKind;
  startY: number;
  origDuration: number;
  origStart: number;
}

export default function DayTimeline({ items, selectedItemId, symbol, onItemClick, onItemRemove, onDurationChange, onMove }: Props) {
  const [localOverrides, setLocalOverrides] = useState<Map<number, { startMinutes?: number; duration?: number }>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset local state when items change (ids change)
  useEffect(() => {
    setLocalOverrides(new Map());
  }, [items.map((i) => i.id).join(",")]);

  // Auto-scroll to first item on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, minToY(8 * 60) - 32);
    }
  }, []);

  const startMap = computeEffectiveStart(items, localOverrides);

  // Sort items by effective start for display (preserving DB order for equal times)
  const displayItems = [...items].sort((a, b) => (startMap.get(a.id) ?? 0) - (startMap.get(b.id) ?? 0));

  function getDuration(item: ItineraryItem) {
    return (
      localOverrides.get(item.id)?.duration ??
      item.estimatedDuration ??
      item.place?.estimatedDuration ??
      DEFAULT_DURATION
    );
  }

  // ── Pointer handlers (shared across resize+move) ─────────────────────
  function handlePointerDown(e: React.PointerEvent, item: ItineraryItem, kind: DragKind) {
    e.stopPropagation();
    e.preventDefault();
    const origStart = startMap.get(item.id) ?? 8 * 60;
    dragRef.current = {
      id: item.id,
      kind,
      startY: e.clientY,
      origDuration: getDuration(item),
      origStart,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent, itemId: number) {
    const drag = dragRef.current;
    if (!drag || drag.id !== itemId) return;
    e.preventDefault();
    const dy = e.clientY - drag.startY;
    const deltaMins = dy / PX_PER_MIN;

    if (drag.kind === "resize") {
      const newDur = Math.max(MIN_DURATION, snapTo(drag.origDuration + deltaMins, SNAP_MINS));
      setLocalOverrides((prev) => {
        const next = new Map(prev);
        const cur = next.get(itemId) ?? {};
        next.set(itemId, { ...cur, duration: newDur });
        return next;
      });
    } else {
      // move — compute raw proposed position then resolve no-overlap
      const rawStart = clamp(
        snapTo(drag.origStart + deltaMins, SNAP_MINS),
        DAY_START_MIN,
        DAY_END_MIN - drag.origDuration,
      );
      const resolved = resolveNoOverlap(rawStart, drag.origDuration, itemId, items, startMap, getDuration);
      setLocalOverrides((prev) => {
        const next = new Map(prev);
        const cur = next.get(itemId) ?? {};
        next.set(itemId, { ...cur, startMinutes: resolved });
        return next;
      });
    }
  }

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent, item: ItineraryItem) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== item.id) return;
      dragRef.current = null;

      const ov = localOverrides.get(item.id);
      if (drag.kind === "resize") {
        const finalDur = ov?.duration ?? drag.origDuration;
        await onDurationChange(item.id, finalDur);
      } else {
        const finalStart = ov?.startMinutes ?? drag.origStart;
        await onMove(item.id, finalStart);
      }
    },
    [localOverrides, onDurationChange, onMove],
  );


  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto select-none" style={{ minHeight: 0 }}>
      <div className="flex" style={{ minHeight: GRID_HEIGHT + HOUR_H }}>
        {/* Hour labels */}
        <div className="w-14 shrink-0 relative" style={{ height: GRID_HEIGHT + HOUR_H }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-2 flex items-center"
              style={{ top: minToY(h * 60) - 7, height: 14 }}
            >
              <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                {h < DAY_END_H ? formatHour(h) : ""}
              </span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          className="flex-1 relative border-l border-border/40"
          style={{ height: GRID_HEIGHT + HOUR_H }}
        >
          {/* Hour lines */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-border/30"
              style={{ top: minToY(h * 60) }}
            />
          ))}
          {/* Half-hour lines */}
          {HOURS.slice(0, -1).map((h) => (
            <div
              key={`hh-${h}`}
              className="absolute left-0 right-0 border-t border-border/15"
              style={{ top: minToY(h * 60 + 30) }}
            />
          ))}


          {/* Event blocks */}
          {displayItems.map((item) => {
            const startMin = startMap.get(item.id) ?? 8 * 60;
            const dur = getDuration(item);
            const top = minToY(startMin);
            const height = Math.max(MIN_DURATION * PX_PER_MIN, dur * PX_PER_MIN);
            const endMin = startMin + dur;
            const isSelected = selectedItemId === item.id;
            const isDragging = dragRef.current?.id === item.id;
            const firstTag = item.place?.tags?.[0];
            const accent = firstTag?.color ?? "#6366f1";
            const icon = firstTag ? getTagIcon(firstTag) : null;
            const cost = item.estimatedCost ?? item.place?.estimatedCost;

            return (
              <div
                key={item.id}
                className="absolute left-1 right-1 rounded-md overflow-hidden group"
                style={{
                  top,
                  height,
                  background: accent + "22",
                  borderLeft: `3px solid ${accent}`,
                  outline: isSelected ? `2px solid ${accent}` : "none",
                  outlineOffset: "1px",
                  zIndex: isDragging ? 30 : isSelected ? 10 : 5,
                  cursor: isDragging ? "grabbing" : "grab",
                  transition: isDragging ? "none" : "box-shadow 0.1s",
                  boxShadow: isDragging ? "0 4px 16px rgba(0,0,0,0.18)" : undefined,
                }}
                onClick={(e) => { if (!dragRef.current) onItemClick(item); }}
                onPointerDown={(e) => {
                  // Only drag from body (not the resize handle)
                  if ((e.target as HTMLElement).closest("[data-resize]")) return;
                  handlePointerDown(e, item, "move");
                }}
                onPointerMove={(e) => handlePointerMove(e, item.id)}
                onPointerUp={(e) => handlePointerUp(e, item)}
                onPointerCancel={() => {
                  dragRef.current = null;
                  setLocalOverrides((prev) => {
                    const next = new Map(prev);
                    next.delete(item.id);
                    return next;
                  });
                }}
              >
                {/* Content */}
                <div className="px-1.5 pt-1 pb-4 h-full overflow-hidden pointer-events-none">
                  <div className="flex items-start gap-1">
                    {icon && <span className="text-sm shrink-0 leading-none mt-px">{icon}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: accent }}>
                        {item.place?.name ?? item.customName ?? "Địa điểm"}
                      </p>
                      {height > 40 && (
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                          {formatTime(startMin)} – {formatTime(endMin)}
                        </p>
                      )}
                      {height > 60 && cost != null && (
                        <p className="text-[10px] font-medium mt-0.5" style={{ color: accent + "cc" }}>
                          {fmtCost(cost, symbol)}
                        </p>
                      )}
                      {height > 80 && (item.place?.tags?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {item.place!.tags!.slice(0, 2).map((tag) => (
                            <span
                              key={tag.id}
                              className="text-[9px] px-1 py-px rounded-full border leading-tight"
                              style={{ background: tag.color + "22", color: tag.color, borderColor: tag.color + "55" }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  className="absolute top-0.5 right-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all z-10"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onItemRemove(item.id); }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                {/* Resize handle */}
                <div
                  data-resize="true"
                  className="absolute bottom-0 left-0 right-0 h-4 flex items-center justify-center cursor-ns-resize group/resize z-10"
                  onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, item, "resize"); }}
                  onPointerMove={(e) => { e.stopPropagation(); handlePointerMove(e, item.id); }}
                  onPointerUp={(e) => { e.stopPropagation(); handlePointerUp(e, item); }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="w-8 h-1 rounded-full opacity-40 group-hover/resize:opacity-80 transition-opacity"
                    style={{ background: accent }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
