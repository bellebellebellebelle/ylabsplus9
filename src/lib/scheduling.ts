export type Appt = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  buffer_min: number;
  category: string;
  client?: string | null;
  location?: string | null;
  notes?: string | null;
};

export const WORK_START = 8; // heures ouvrées
export const WORK_END = 19;

const ms = (s: string) => new Date(s).getTime();
const active = (a: Appt) => a.status !== "annule";

/** Rendez-vous qui chevauchent [start,end) en tenant compte des temps tampon. */
export function findConflicts(
  list: Appt[],
  start: Date,
  end: Date,
  buffer = 0,
  ignoreId?: string,
): Appt[] {
  const s = start.getTime();
  const e = end.getTime();
  return list.filter(
    (a) =>
      active(a) &&
      a.id !== ignoreId &&
      ms(a.start_at) < e + buffer * 60000 &&
      s < ms(a.end_at) + a.buffer_min * 60000,
  );
}

export type Issue = { level: "error" | "warn"; msg: string };

export function validateSlot(
  list: Appt[],
  start: Date,
  end: Date,
  buffer = 0,
  ignoreId?: string,
  now = new Date(),
): Issue[] {
  const out: Issue[] = [];
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [{ level: "error", msg: "Date invalide" }];
  if (end <= start) out.push({ level: "error", msg: "La fin doit être après le début" });
  const c = findConflicts(list, start, end, buffer, ignoreId);
  if (c.length) out.push({ level: "error", msg: `Chevauche « ${c[0]!.title} »` });
  if (start < now && !ignoreId) out.push({ level: "warn", msg: "Créneau dans le passé" });
  const h = start.getHours() + start.getMinutes() / 60;
  const he = end.getHours() + end.getMinutes() / 60;
  if (h < WORK_START || he > WORK_END || end.getDate() !== start.getDate())
    out.push({ level: "warn", msg: "Hors des heures ouvrées (8h–19h)" });
  if (end.getTime() - start.getTime() > 4 * 3600000) out.push({ level: "warn", msg: "Rendez-vous de plus de 4 h" });
  const day = list.filter((a) => active(a) && a.id !== ignoreId && sameDay(new Date(a.start_at), start));
  if (day.length >= 8) out.push({ level: "warn", msg: "Journée surchargée (8+ rendez-vous)" });
  return out;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Prochain créneau libre de durée `durMin` à partir de `from`, pas de 15 min, heures ouvrées. */
export function nextFreeSlot(list: Appt[], from: Date, durMin: number, buffer = 0): Date | null {
  const t = new Date(from);
  t.setSeconds(0, 0);
  t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15);
  for (let i = 0; i < 4 * 24 * 14; i++) {
    const h = t.getHours() + t.getMinutes() / 60;
    const end = new Date(t.getTime() + durMin * 60000);
    const he = end.getHours() + end.getMinutes() / 60;
    if (h >= WORK_START && he <= WORK_END && sameDay(t, end) && !findConflicts(list, t, end, buffer).length)
      return new Date(t);
    t.setMinutes(t.getMinutes() + 15);
  }
  return null;
}

export function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function computeKpis(list: Appt[], ref: Date, now = new Date()) {
  const ws = weekStart(ref);
  const we = new Date(ws.getTime() + 7 * 86400000);
  const wk = list.filter((a) => ms(a.start_at) >= ws.getTime() && ms(a.start_at) < we.getTime());
  const act = wk.filter(active);
  const minutes = act.reduce((s, a) => s + (ms(a.end_at) - ms(a.start_at)) / 60000, 0);
  const capacity = 5 * (WORK_END - WORK_START) * 60;
  const past = act.filter((a) => ms(a.end_at) < now.getTime());
  const done = past.filter((a) => a.status === "termine").length;
  const cancelled = wk.length - act.length;
  return {
    count: act.length,
    hours: Math.round((minutes / 60) * 10) / 10,
    occupancy: Math.min(100, Math.round((minutes / capacity) * 100)),
    completion: past.length ? Math.round((done / past.length) * 100) : 100,
    cancelRate: wk.length ? Math.round((cancelled / wk.length) * 100) : 0,
    avgMin: act.length ? Math.round(minutes / act.length) : 0,
    perDay: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws.getTime() + i * 86400000);
      return act
        .filter((a) => sameDay(new Date(a.start_at), d))
        .reduce((s, a) => s + (ms(a.end_at) - ms(a.start_at)) / 3600000, 0);
    }),
  };
}

/** Score de productivité 0-100 : occupation saine (~70%), complétion, peu d'annulations. */
export function productivityScore(k: ReturnType<typeof computeKpis>) {
  const occ = 100 - Math.min(100, Math.abs(k.occupancy - 70) * 1.6);
  return Math.round(occ * 0.4 + k.completion * 0.4 + (100 - k.cancelRate) * 0.2);
}
