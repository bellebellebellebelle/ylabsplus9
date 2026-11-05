import { supabase } from "@/integrations/supabase/client";
import { getProjectId, scopeToProject } from "@/tep/lib/project-scope";

export type StickyKind = "appointment" | "task" | "email" | "smart";

export type Sticky = {
  id: string;
  user_id: string;
  day: string;
  kind: StickyKind;
  title: string;
  content: string;
  start_time: string | null;
  duration_min: number | null;
  color: string;
  x: number;
  y: number;
  done: boolean;
  created_at: string;
  updated_at: string;
  google_id: string | null;
  google_list_id: string | null;
  email_to: string | null;
  email_sent: boolean;
  synced_at: string | null;

};

export const KIND_META: Record<
  StickyKind,
  { label: string; paper: string; icon: string }
> = {
  appointment: { label: "Rendez-vous", paper: "paper-sky", icon: "calendar" },
  task: { label: "Tâche", paper: "paper-amber", icon: "check" },
  email: { label: "E-mail", paper: "paper-mint", icon: "mail" },
  smart: { label: "Smart", paper: "paper-violet", icon: "sparkles" },
};

export async function fetchStickiesBetween(from: string, to: string) {
  const { data, error } = await scopeToProject(supabase.from("tep_stickies").select("*"))
    .gte("day", from)
    .lte("day", to)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Sticky[];
}

export async function fetchStickiesForDay(day: string) {
  const { data, error } = await scopeToProject(supabase.from("tep_stickies").select("*"))
    .eq("day", day)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Sticky[];
}

export async function createSticky(input: Partial<Sticky> & { day: string; kind: StickyKind }) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Non authentifié");
  const { data, error } = await supabase
    .from("tep_stickies")
    .insert({ ...input, user_id: userId, project_id: getProjectId() })
    .select("*")
    .single();
  if (error) throw error;
  return data as Sticky;
}

export async function updateSticky(id: string, patch: Partial<Sticky>) {
  const { error } = await supabase.from("tep_stickies").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSticky(id: string) {
  const { error } = await supabase.from("tep_stickies").delete().eq("id", id);
  if (error) throw error;
}

export function summarize(stickies: Sticky[]) {
  return {
    total: stickies.length,
    appointment: stickies.filter((s) => s.kind === "appointment").length,
    task: stickies.filter((s) => s.kind === "task").length,
    email: stickies.filter((s) => s.kind === "email").length,
    smart: stickies.filter((s) => s.kind === "smart").length,
    done: stickies.filter((s) => s.done).length,
  };
}
