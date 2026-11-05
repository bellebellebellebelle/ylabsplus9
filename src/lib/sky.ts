import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskList = Database["public"]["Tables"]["task_lists"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type Settings = Database["public"]["Tables"]["sky_user_settings"]["Row"];

export const STAGES = [
  { id: "todo", label: "À faire" },
  { id: "in_progress", label: "En cours" },
  { id: "review", label: "Revue" },
  { id: "done", label: "Terminé" },
] as const;

export const PRIORITY_WEIGHT: Record<string, number> = { low: 1, medium: 2, high: 3 };
export const REMINDER_MS = 30 * 60 * 1000;

/** Tasks to remind: not done, due in the next 30 minutes (and not past). */
export function tasksToRemind(tasks: Task[], now: number): Task[] {
  return tasks.filter((t) => {
    if (t.status === "done" || !t.due_at) return false;
    const diff = new Date(t.due_at).getTime() - now;
    return diff > 0 && diff <= REMINDER_MS;
  });
}

/** Smart focus score: priority + urgency (overdue and soon-due rise to the top). */
export function smartScore(t: Task, now: number): number {
  let s = (PRIORITY_WEIGHT[t.priority] ?? 2) * 10;
  if (t.due_at) {
    const h = (new Date(t.due_at).getTime() - now) / 3600000;
    if (h < 0) s += 40;
    else if (h < 24) s += 25 - h;
    else if (h < 72) s += 5;
  }
  if (t.status === "in_progress") s += 5;
  return s;
}

export function smartFocus(tasks: Task[], now: number, n = 3): Task[] {
  return tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => smartScore(b, now) - smartScore(a, now))
    .slice(0, n);
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Completed counts for the last 7 days, oldest first. */
export function weekCompletions(tasks: Task[], now: number) {
  const days: { key: string; label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    days.push({ key: dayKey(d), label: d.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 3), count: 0 });
  }
  for (const t of tasks) {
    if (!t.completed_at) continue;
    const k = dayKey(new Date(t.completed_at));
    const day = days.find((x) => x.key === k);
    if (day) day.count++;
  }
  return days;
}

/** Consecutive days (ending today, or yesterday) with at least one completion. */
export function streak(tasks: Task[], now: number): number {
  const set = new Set(tasks.filter((t) => t.completed_at).map((t) => dayKey(new Date(t.completed_at!))));
  let i = set.has(dayKey(new Date(now))) ? 0 : 1;
  let n = 0;
  while (set.has(dayKey(new Date(now - i * 86400000)))) { n++; i++; }
  return n;
}

export function completionRate(tasks: Task[]): number {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
}
