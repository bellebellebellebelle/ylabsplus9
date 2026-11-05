import { supabase } from "@/integrations/supabase/client";
import { getProjectId, scopeToProject, withProject } from "@/tep/lib/project-scope";

export type CardType = "job" | "candidate" | "pool" | "note" | "task" | "ai";

export type Card = {
  id: string;
  user_id: string;
  type: CardType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Link = {
  id: string;
  user_id: string;
  source_id: string;
  target_id: string;
  label: string;
};

export const CARD_META: Record<CardType, { label: string; color: string; icon: string }> = {
  job: { label: "Poste à pourvoir", color: "sky", icon: "briefcase" },
  pool: { label: "Vivier de talents", color: "violet", icon: "users" },
  candidate: { label: "Candidat", color: "amber", icon: "user" },
  note: { label: "Note", color: "lime", icon: "sticky" },
  task: { label: "Tâche", color: "rose", icon: "check" },
  ai: { label: "Assistant IA", color: "cyan", icon: "sparkles" },
};

export async function fetchBoard() {
  const [cards, links] = await Promise.all([
    scopeToProject(supabase.from("tep_cards").select("*")).order("created_at"),
    scopeToProject(supabase.from("tep_links").select("*")),
  ]);
  if (cards.error) throw cards.error;
  if (links.error) throw links.error;
  return { cards: (cards.data ?? []) as Card[], links: (links.data ?? []) as Link[] };
}

export async function createCard(input: Partial<Card>) {
  const { data, error } = await supabase.from("tep_cards").insert({ ...input, project_id: getProjectId() } as never).select().single();
  if (error) throw error;
  return data as Card;
}

export async function updateCard(id: string, patch: Partial<Card>) {
  const { error } = await supabase.from("tep_cards").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteCard(id: string) {
  const { error } = await supabase.from("tep_cards").delete().eq("id", id);
  if (error) throw error;
}

export async function createLink(source_id: string, target_id: string, label = "") {
  const { data, error } = await supabase
    .from("tep_links")
    .upsert({ source_id, target_id, label, project_id: getProjectId() } as never, { onConflict: "source_id,target_id" })
    .select()
    .single();
  if (error) throw error;
  return data as Link;
}

export async function deleteLink(id: string) {
  const { error } = await supabase.from("tep_links").delete().eq("id", id);
  if (error) throw error;
}

export function cardSearchText(card: Card) {
  return `${card.title}\n${card.body}\n${JSON.stringify(card.data)}`.slice(0, 4000);
}
