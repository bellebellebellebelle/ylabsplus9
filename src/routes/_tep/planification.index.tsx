import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  Loader2,
  CalendarClock,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tzToday } from "@/tep/lib/planning/timezone";
import { useAuth } from "@/tep/hooks/usePlanningAuth";

import { fetchStickiesBetween, summarize, type Sticky } from "@/tep/lib/planning/stickies";
import { smartReview } from "@/tep/lib/planning/smart.functions";
import {
  DAY_LABELS,
  MONTH_LABELS,
  addDays,
  addMonths,
  monthDays,
  monthGrid,
  isSameDay,
  toKey,
  weekDays,
  startOfWeek,
} from "@/tep/lib/planning/date-utils";

export const Route = createFileRoute("/_tep/planification/")({
  head: () => ({
    meta: [
      { title: "Planification Smart — calendrier tableau intelligent" },
      {
        name: "description",
        content:
          "Organisez votre temps sur un calendrier plein écran en mode tableau : vues jour, semaine, mois, année et post-it intelligents assistés par l'IA.",
      },
      { property: "og:title", content: "Planification Smart — calendrier tableau intelligent" },
      {
        property: "og:description",
        content:
          "Vues jour/semaine/mois/année, tableau infini par journée et post-it Smart propulsés par l'IA.",
      },
    ],
  }),
  component: CalendarPage,
});

type View = "semaine" | "mois" | "annee";

function CalendarPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [view, setView] = useState<View>("mois");
  const [cursor, setCursor] = useState(() => tzToday());
  const [review, setReview] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const reviewFn = useServerFn(smartReview);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const range = useMemo(() => {
    if (view === "semaine") {
      const days = weekDays(cursor);
      return { from: toKey(days[0]!), to: toKey(days[6]!) };
    }
    if (view === "mois") {
      const grid = monthGrid(cursor);
      return { from: toKey(grid[0]!), to: toKey(grid[41]!) };
    }
    return {
      from: `${cursor.getFullYear()}-01-01`,
      to: `${cursor.getFullYear()}-12-31`,
    };
  }, [view, cursor]);

  const { data: stickies = [] } = useQuery({
    queryKey: ["range", range.from, range.to],
    queryFn: () => fetchStickiesBetween(range.from, range.to),
    enabled: !!session,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Sticky[]>();
    for (const s of stickies) {
      const list = map.get(s.day) ?? [];
      list.push(s);
      map.set(s.day, list);
    }
    return map;
  }, [stickies]);

  const openDay = (d: Date) => navigate({ to: "/planification/jour/$date", params: { date: toKey(d) } });

  function shift(dir: number) {
    if (view === "semaine") setCursor((c) => addDays(c, 7 * dir));
    else if (view === "mois") setCursor((c) => addMonths(c, dir));
    else setCursor((c) => new Date(c.getFullYear() + dir, 0, 1));
  }

  async function runReview() {
    setReviewing(true);
    try {
      const data = [...byDay.entries()]
        .map(([day, list]) => `${day}: ${list.map((s) => `${s.kind}:${s.title || "?"}`).join(", ")}`)
        .join("\n");
      const res = await reviewFn({ data: { scope: `${view} ${range.from} → ${range.to}`, data } });
      setReview(res.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'assistant a échoué");
    } finally {
      setReviewing(false);
    }
  }

  const periodLabel =
    view === "annee"
      ? `${cursor.getFullYear()}`
      : view === "mois"
        ? `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`
        : `Semaine du ${startOfWeek(cursor).getDate()} ${MONTH_LABELS[startOfWeek(cursor).getMonth()]}`;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2 text-primary">
          <CalendarRange className="h-5 w-5" />
          <span className="font-display text-sm font-bold text-foreground sm:text-base">
            Planification Smart
          </span>
        </div>

        <div className="ml-2 flex items-center gap-1">
          <button onClick={() => shift(-1)} className="rounded-lg p-1.5 hover:bg-accent" aria-label="Période précédente">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-32 text-center text-sm font-medium capitalize">{periodLabel}</span>
          <button onClick={() => shift(1)} className="rounded-lg p-1.5 hover:bg-accent" aria-label="Période suivante">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(tzToday())}
            className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            Aujourd'hui
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-xl bg-secondary p-1">
          <button
            onClick={() => openDay(tzToday())}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Jour
          </button>
          {(["semaine", "mois", "annee"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "annee" ? "Année" : v}
            </button>
          ))}
        </div>

        <button

          onClick={() => void runReview()}
          disabled={reviewing}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Bilan Smart
        </button>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Se déconnecter"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {review && (
        <div className="flex items-start gap-2 border-b border-border bg-card/60 px-4 py-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="whitespace-pre-line text-muted-foreground">{review}</p>
          <button onClick={() => setReview("")} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Fermer
          </button>
        </div>
      )}

      <section className="flex-1 overflow-auto board-surface p-3">
        {view === "semaine" && <WeekView cursor={cursor} byDay={byDay} onOpen={openDay} />}
        {view === "mois" && <MonthView cursor={cursor} byDay={byDay} onOpen={openDay} />}
        {view === "annee" && <YearView cursor={cursor} byDay={byDay} onOpen={openDay} />}
      </section>
    </main>
  );
}

function Recap({ list }: { list: Sticky[] }) {
  const s = summarize(list);
  if (!s.total) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
      {s.appointment > 0 && (
        <span className="flex items-center gap-0.5">
          <CalendarClock className="h-3 w-3" />
          {s.appointment}
        </span>
      )}
      {s.task > 0 && (
        <span className="flex items-center gap-0.5">
          <CheckCircle2 className="h-3 w-3" />
          {s.done}/{s.task}
        </span>
      )}
      {s.email > 0 && (
        <span className="flex items-center gap-0.5">
          <Mail className="h-3 w-3" />
          {s.email}
        </span>
      )}
      {s.smart > 0 && (
        <span className="flex items-center gap-0.5 text-smart">
          <Sparkles className="h-3 w-3" />
          {s.smart}
        </span>
      )}
    </div>
  );
}

type ViewProps = {
  cursor: Date;
  byDay: Map<string, Sticky[]>;
  onOpen: (d: Date) => void;
};

function WeekView({ cursor, byDay, onOpen }: ViewProps) {
  const days = weekDays(cursor);
  return (
    <div className="grid h-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d) => {
        const list = byDay.get(toKey(d)) ?? [];
        const today = isSameDay(d, tzToday());
        return (
          <button
            key={toKey(d)}
            onClick={() => onOpen(d)}
            className={`flex min-h-40 flex-col rounded-xl border bg-card p-2.5 text-left transition hover:border-ring ${
              today ? "border-primary" : "border-border"
            }`}
          >
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {DAY_LABELS[(d.getDay() + 6) % 7]}
            </span>
            <span className={`font-display text-xl font-bold ${today ? "text-primary" : ""}`}>
              {d.getDate()}
            </span>
            <ul className="mt-2 space-y-1">
              {list.slice(0, 5).map((s) => (
                <li key={s.id} className="truncate text-xs text-muted-foreground">
                  {s.start_time ? `${s.start_time} · ` : ""}
                  {s.title || "Sans titre"}
                </li>
              ))}
              {list.length > 5 && (
                <li className="text-xs text-muted-foreground">+{list.length - 5} autres</li>
              )}
            </ul>
            <div className="mt-auto">
              <Recap list={list} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MonthView({ cursor, byDay, onOpen }: ViewProps) {
  const grid = monthGrid(cursor);
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 gap-2 pb-2">
        {DAY_LABELS.map((l) => (
          <span key={l} className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">
            {l}
          </span>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 gap-2">
        {grid.map((d) => {
          const list = byDay.get(toKey(d)) ?? [];
          const outside = d.getMonth() !== cursor.getMonth();
          const today = isSameDay(d, tzToday());
          return (
            <button
              key={toKey(d)}
              onClick={() => onOpen(d)}
              className={`flex min-h-24 flex-col rounded-lg border p-1.5 text-left transition hover:border-ring ${
                today ? "border-primary" : "border-border"
              } ${outside ? "bg-card/40 opacity-50" : "bg-card"}`}
            >
              <span className={`text-xs font-semibold ${today ? "text-primary" : ""}`}>{d.getDate()}</span>
              <ul className="mt-1 space-y-0.5">
                {list.slice(0, 2).map((s) => (
                  <li key={s.id} className="truncate text-[11px] text-muted-foreground">
                    {s.title || "Sans titre"}
                  </li>
                ))}
                {list.length > 2 && (
                  <li className="text-[11px] text-muted-foreground">+{list.length - 2}</li>
                )}
              </ul>
              <div className="mt-auto">
                <Recap list={list} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ cursor, byDay, onOpen }: ViewProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {MONTH_LABELS.map((label, m) => (
        <div key={label} className="rounded-xl border border-border bg-card p-2.5">
          <h2 className="mb-2 text-sm font-semibold">{label}</h2>
          <div className="grid grid-cols-7 gap-1">
            {monthDays(cursor.getFullYear(), m).map((d) => {
              const count = (byDay.get(toKey(d)) ?? []).length;
              const today = isSameDay(d, tzToday());
              return (
                <button
                  key={toKey(d)}
                  onClick={() => onOpen(d)}
                  title={`${d.getDate()} ${label} — ${count} élément(s)`}
                  className={`flex h-6 items-center justify-center rounded text-[10px] transition hover:bg-accent ${
                    today ? "ring-1 ring-primary" : ""
                  } ${
                    count === 0
                      ? "bg-secondary text-muted-foreground"
                      : count < 3
                        ? "bg-primary/30 text-foreground"
                        : "bg-primary text-primary-foreground"
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
