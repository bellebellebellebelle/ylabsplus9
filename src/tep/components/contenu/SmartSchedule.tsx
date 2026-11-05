import { useMemo, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/tep/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  value: string | null;
  onChange: (iso: string | null) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalParts(iso: string | null) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return { date: "", hour: 9, minute: 0 };
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hour: d.getHours(),
    minute: Math.round(d.getMinutes() / 15) * 15 === 60 ? 45 : d.getMinutes(),
  };
}

function compose(date: string, hour: number, minute: number) {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, hour, minute, 0, 0);
  return dt.toISOString();
}

const PRESETS: { label: string; build: () => Date }[] = [
  {
    label: "Aujourd'hui 18h",
    build: () => {
      const d = new Date();
      d.setHours(18, 0, 0, 0);
      return d;
    },
  },
  {
    label: "Demain 9h",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: "Dans 3 jours",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(12, 0, 0, 0);
      return d;
    },
  },
  {
    label: "Lundi prochain 8h",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
      d.setHours(8, 0, 0, 0);
      return d;
    },
  },
];

export function SmartSchedule({ value, onChange }: Props) {
  const parts = useMemo(() => toLocalParts(value), [value]);
  const [open, setOpen] = useState(false);

  const label = value
    ? new Date(value).toLocaleString("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Planifier";

  function set(date: string, hour: number, minute: number) {
    onChange(compose(date, hour, minute));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={value ? "secondary" : "ghost"}
          className="h-7 flex-1 justify-start gap-1.5 px-2 text-[11px]"
        >
          <CalendarClock className="size-3 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant="secondary"
              className="h-7 text-[10px]"
              onClick={() => {
                onChange(p.build().toISOString());
                setOpen(false);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="space-y-1.5">
          <input
            type="date"
            value={parts.date}
            aria-label="Date de publication"
            onChange={(e) => set(e.target.value, parts.hour, parts.minute)}
            className="h-8 w-full rounded-md border border-border bg-secondary/40 px-2 text-xs"
          />
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Heure"
              value={parts.hour}
              onChange={(e) => set(parts.date || toLocalParts(new Date().toISOString()).date, Number(e.target.value), parts.minute)}
              className="h-8 flex-1 rounded-md border border-border bg-secondary/40 px-2 text-xs"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {pad(h)} h
                </option>
              ))}
            </select>
            <select
              aria-label="Minutes"
              value={MINUTES.includes(parts.minute) ? parts.minute : 0}
              onChange={(e) => set(parts.date || toLocalParts(new Date().toISOString()).date, parts.hour, Number(e.target.value))}
              className="h-8 flex-1 rounded-md border border-border bg-secondary/40 px-2 text-xs"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {pad(m)} min
                </option>
              ))}
            </select>
          </div>
        </div>

        {value && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-full text-[11px]"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <X className="size-3" /> Retirer la planification
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
