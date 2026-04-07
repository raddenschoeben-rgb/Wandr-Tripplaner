import { useState, useRef, useEffect, useCallback } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { vi } from "date-fns/locale";
import { format, parseISO, isValid } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  startError?: string;
  endError?: string;
}

function toDate(str: string): Date | undefined {
  if (!str) return undefined;
  try {
    const d = parseISO(str);
    return isValid(d) ? d : undefined;
  } catch {
    return undefined;
  }
}

function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function formatDisplay(str: string): string {
  const d = toDate(str);
  if (!d) return "";
  return format(d, "dd/MM/yyyy");
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  startError,
  endError,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [focusField, setFocusField] = useState<"start" | "end">("start");
  const [hoverDate, setHoverDate] = useState<Date | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  const range: DateRange = {
    from: toDate(startDate),
    to: toDate(endDate),
  };

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function openPicker(field: "start" | "end") {
    setFocusField(field);
    setOpen(true);
  }

  const handleSelect = useCallback(
    (selected: DateRange | undefined) => {
      if (!selected) return;

      const { from, to } = selected;

      if (focusField === "start") {
        if (from) {
          onStartChange(toISO(from));
          // If end is before new start, clear end
          if (endDate && toDate(endDate) && from > toDate(endDate)!) {
            onEndChange("");
          }
          setFocusField("end");
        }
      } else {
        if (to) {
          onEndChange(toISO(to));
          setOpen(false);
        } else if (from) {
          // Clicked same day or earlier → treat as single day trip
          onEndChange(toISO(from));
          setOpen(false);
        }
      }
    },
    [focusField, endDate, onStartChange, onEndChange],
  );

  // When clicking a day without a range selected yet, initialise from
  function handleDayClick(day: Date) {
    if (focusField === "start") {
      onStartChange(toISO(day));
      if (endDate && toDate(endDate) && day > toDate(endDate)!) {
        onEndChange("");
      }
      setFocusField("end");
    } else {
      const start = toDate(startDate);
      if (start && day < start) {
        // Clicked before start → swap
        onStartChange(toISO(day));
        onEndChange(toISO(start));
        setOpen(false);
      } else {
        onEndChange(toISO(day));
        setOpen(false);
      }
    }
  }

  // Compute effective range for preview while hovering
  const previewRange: DateRange = (() => {
    const from = toDate(startDate);
    if (focusField === "end" && from && hoverDate) {
      if (hoverDate >= from) return { from, to: hoverDate };
      return { from: hoverDate, to: from };
    }
    return range;
  })();

  const startFocused = open && focusField === "start";
  const endFocused = open && focusField === "end";

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Start date input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Ngày đi</label>
          <button
            type="button"
            onClick={() => openPicker("start")}
            className={cn(
              "flex items-center gap-2 w-full rounded-xl border bg-background px-3 py-2 text-sm transition-all text-left",
              startFocused
                ? "border-primary ring-2 ring-primary/20 shadow-sm"
                : startError
                  ? "border-destructive"
                  : "border-border hover:border-primary/50",
            )}
          >
            <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className={startDate ? "text-foreground" : "text-muted-foreground"}>
              {startDate ? formatDisplay(startDate) : "Chọn ngày"}
            </span>
          </button>
          {startError && (
            <p className="text-xs text-destructive">{startError}</p>
          )}
        </div>

        {/* End date input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Ngày về</label>
          <button
            type="button"
            onClick={() => openPicker("end")}
            className={cn(
              "flex items-center gap-2 w-full rounded-xl border bg-background px-3 py-2 text-sm transition-all text-left",
              endFocused
                ? "border-primary ring-2 ring-primary/20 shadow-sm"
                : endError
                  ? "border-destructive"
                  : "border-border hover:border-primary/50",
            )}
          >
            <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className={endDate ? "text-foreground" : "text-muted-foreground"}>
              {endDate ? formatDisplay(endDate) : "Chọn ngày"}
            </span>
          </button>
          {endError && (
            <p className="text-xs text-destructive">{endError}</p>
          )}
        </div>
      </div>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 z-50 mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header hint */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-sm font-semibold text-foreground">
              {focusField === "start" ? "Chọn ngày đi" : "Chọn ngày về"}
            </span>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  onStartChange("");
                  onEndChange("");
                  setFocusField("start");
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Xoá
              </button>
            )}
          </div>

          {/* Summary bar */}
          <div className="flex items-center gap-2 mx-5 mb-3 px-3 py-2 rounded-xl bg-muted/50 text-sm">
            <span
              className={cn(
                "flex-1 text-center py-0.5 rounded-lg transition-colors cursor-pointer",
                focusField === "start" ? "bg-primary text-primary-foreground font-medium" : "text-foreground",
              )}
              onClick={() => setFocusField("start")}
            >
              {startDate ? formatDisplay(startDate) : "Ngày đi"}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span
              className={cn(
                "flex-1 text-center py-0.5 rounded-lg transition-colors cursor-pointer",
                focusField === "end" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground",
              )}
              onClick={() => startDate && setFocusField("end")}
            >
              {endDate ? formatDisplay(endDate) : "Ngày về"}
            </span>
          </div>

          {/* Calendar */}
          <DayPicker
            mode="range"
            numberOfMonths={2}
            selected={previewRange}
            onDayClick={handleDayClick}
            onDayMouseEnter={(day) => setHoverDate(day)}
            onDayMouseLeave={() => setHoverDate(undefined)}
            disabled={{ before: today }}
            locale={vi}
            weekStartsOn={1}
            classNames={{
              root: "p-4 pt-0",
              months: "flex gap-6",
              month: "flex flex-col gap-2 min-w-[220px]",
              month_caption: "flex items-center justify-center h-8 font-semibold text-sm text-foreground capitalize",
              nav: "absolute inset-x-4 top-[86px] flex justify-between pointer-events-none",
              button_previous:
                "pointer-events-auto h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors",
              button_next:
                "pointer-events-auto h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors",
              weekdays: "flex",
              weekday: "flex-1 text-center text-[11px] font-medium text-muted-foreground py-1",
              week: "flex",
              day: "flex-1 aspect-square relative",
              day_button:
                "w-full h-full flex items-center justify-center text-sm rounded-full transition-colors hover:bg-accent",
              selected: "",
              range_start:
                "bg-primary/15 rounded-l-full [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-semibold",
              range_end:
                "bg-primary/15 rounded-r-full [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-semibold",
              range_middle:
                "bg-primary/10 rounded-none [&>button]:hover:bg-primary/20",
              today:
                "[&>button]:font-bold [&>button]:ring-2 [&>button]:ring-primary/30",
              outside: "[&>button]:text-muted-foreground/40 [&>button]:pointer-events-none",
              disabled: "[&>button]:text-muted-foreground/30 [&>button]:pointer-events-none",
            }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                ),
            }}
          />

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <div className="text-xs text-muted-foreground">
              {startDate && endDate ? (
                (() => {
                  const s = toDate(startDate);
                  const e = toDate(endDate);
                  if (s && e) {
                    const days =
                      Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
                    return (
                      <span className="font-medium text-foreground">
                        {days} {days === 1 ? "ngày" : "ngày"}
                      </span>
                    );
                  }
                  return null;
                })()
              ) : (
                <span>Chọn ngày đi và ngày về</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
