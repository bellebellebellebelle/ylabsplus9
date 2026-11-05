import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, X, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { tzTodayKey } from "@/tep/lib/planning/timezone";

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  durationMin?: number | null;
  onDurationChange?: (value: number | null) => void;
  date?: string;
  onDateChange?: (value: string) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const PRESETS = ["08:00", "09:30", "12:00", "14:00", "16:30", "18:00"];
const DURATIONS = [15, 30, 45, 60, 90, 120];

const pad = (n: number) => String(n).padStart(2, "0");

function shiftKey(key: string, days: number) {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function shortDate(key: string) {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function TimePicker({
  value,
  onChange,
  durationMin,
  onDurationChange,
  date,
  onDateChange,
}: Props) {

  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const [h, m] = useMemo(() => {
    if (!value) return [null, null] as const;
    const [hh, mm] = value.split(":");
    return [Number(hh), Number(mm)] as const;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const endLabel = useMemo(() => {
    if (h === null || m === null) return null;
    const total = h * 60 + m + (durationMin ?? 60);
    return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
  }, [h, m, durationMin]);

  function set(nh: number | null, nm: number | null) {
    const hh = nh ?? h ?? 9;
    const mm = nm ?? (m === null ? 0 : m);
    onChange(`${pad(hh)}:${pad(mm)}`);
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] font-semibold tracking-tight transition",
          "bg-black/10 hover:bg-black/20",
          !value && "font-sans font-medium opacity-60",
        )}
      >
        <Clock className="h-3 w-3" />
        {date && onDateChange && (
          <span className="font-sans font-medium opacity-70">{shortDate(date)}</span>
        )}
        {value ? (
          <span>
            {value}
            {endLabel && <span className="opacity-60"> → {endLabel}</span>}
          </span>
        ) : (
          "Définir l'heure"
        )}

        {value && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Effacer l'heure"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setOpen(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && onChange(null)}
            className="ml-0.5 opacity-50 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-border bg-card p-2 text-foreground shadow-2xl">
          {date && onDateChange && (
            <div className="mb-2 rounded-lg bg-secondary/60 p-1.5">
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> Date (Indian/Réunion)
              </p>
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && onDateChange(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-1.5 py-1 font-mono text-[11px] outline-none"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {[
                  { label: "Aujourd'hui", key: tzTodayKey() },
                  { label: "Demain", key: shiftKey(tzTodayKey(), 1) },
                  { label: "+1 sem.", key: shiftKey(date, 7) },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => onDateChange(o.key)}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] transition",
                      date === o.key ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mb-2 flex flex-wrap gap-1">

            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-mono text-[10px] transition",
                  value === p ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent",
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <div className="h-32 flex-1 overflow-y-auto rounded-lg bg-secondary/60 p-1">
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => set(hour, null)}
                  className={cn(
                    "block w-full rounded px-1 py-0.5 text-center font-mono text-[11px] transition",
                    h === hour ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  {pad(hour)}
                </button>
              ))}
            </div>
            <div className="h-32 flex-1 overflow-y-auto rounded-lg bg-secondary/60 p-1">
              {MINUTES.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => set(null, min)}
                  className={cn(
                    "block w-full rounded px-1 py-0.5 text-center font-mono text-[11px] transition",
                    m === min ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  {pad(min)}
                </button>
              ))}
            </div>
          </div>

          {onDurationChange && (
            <>
              <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">Durée</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onDurationChange(d)}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] transition",
                      (durationMin ?? 60) === d
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-accent",
                    )}
                  >
                    {d < 60 ? `${d} min` : `${d / 60} h`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
