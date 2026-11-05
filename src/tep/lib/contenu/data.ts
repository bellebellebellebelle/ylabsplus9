import { supabase } from "@/integrations/supabase/client";
import { getProjectId, scopeToProject, withProject } from "@/tep/lib/project-scope";
import type { Database } from "@/integrations/supabase/types";

export type Note = Database["public"]["Tables"]["tep_content_notes"]["Row"];
export type Brand = Database["public"]["Tables"]["tep_brands"]["Row"];
export type Board = Database["public"]["Tables"]["tep_content_boards"]["Row"];

export async function ensureWorkspace(userId: string): Promise<{ board: Board; brand: Brand }> {
  const { data: boards } = await scopeToProject(supabase.from("tep_content_boards").select("*"))
    .order("created_at", { ascending: true })
    .limit(1);
  let board = boards?.[0];
  if (!board) {
    const { data, error } = await supabase
      .from("tep_content_boards")
      .insert({ user_id: userId, name: "Tableau principal", project_id: getProjectId() })
      .select()
      .single();
    if (error) throw error;
    board = data;
  }

  const { data: brands } = await scopeToProject(supabase.from("tep_brands").select("*"))
    .order("created_at", { ascending: true })
    .limit(1);
  let brand = brands?.[0];
  if (!brand) {
    const { data, error } = await supabase
      .from("tep_brands")
      .insert({ user_id: userId, project_id: getProjectId() })
      .select()
      .single();
    if (error) throw error;
    brand = data;
  }

  return { board, brand };
}

export function brandContext(brand: Brand | null | undefined): string {
  if (!brand) return "";
  return [
    `Marque : ${brand.name}`,
    brand.description && `Description : ${brand.description}`,
    brand.tone && `Ton de voix : ${brand.tone}`,
    brand.audience && `Audience : ${brand.audience}`,
    brand.pillars && `Piliers de contenu : ${brand.pillars}`,
    brand.hashtags && `Hashtags de marque : ${brand.hashtags}`,
    `Couleurs : ${brand.primary_color} / ${brand.secondary_color}`,
    brand.font && `Typographie : ${brand.font}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function listNotes(boardId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("tep_content_notes")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createNote(input: Partial<Note> & { user_id: string; board_id: string }) {
  const { data, error } = await supabase.from("tep_content_notes").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateNote(id: string, patch: Partial<Note>) {
  const { error } = await supabase.from("tep_content_notes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from("tep_content_notes").delete().eq("id", id);
  if (error) throw error;
}
