import { supabase } from "@/integrations/supabase/client";

export type Project = {
  id: string;
  user_id: string;
  parent_board_id: string | null;
  title: string;
  board_type: string;
  ref_id: string | null;
  created_at: string;
};

/** Tous les modèles de tableaux disponibles dans l'outil. */
export const BOARD_TYPES = [
  { type: "postit", label: "Post-it", description: "Post-it libres, tâches et agents IA", path: "/postit" },
  { type: "schema", label: "Tableau schéma", description: "Du croquis papier au tableau blanc", path: "/tableau" },
  { type: "probleme", label: "Résoudre un problème", description: "Analyse guidée par l'IA", path: "/probleme" },
  { type: "recrutement", label: "Recrutement", description: "Suivi des candidats", path: "/recrutement" },
  { type: "prospection", label: "Prospection", description: "Pistes commerciales", path: "/prospection" },
  { type: "contenu", label: "Création de contenu", description: "Idées et publications", path: "/contenu" },
  { type: "planification", label: "Planification", description: "Agenda et journée", path: "/planification" },
  { type: "equipes", label: "Équipes IA", description: "Agents qui travaillent ensemble", path: "/equipes" },
  { type: "dossier", label: "Dossier", description: "Page vide pour ranger des sous-tableaux", path: null },
] as const;

export const boardTypeInfo = (type: string) =>
  BOARD_TYPES.find((b) => b.type === type) ?? BOARD_TYPES[BOARD_TYPES.length - 1]!;

/** URL of the tool page for a project; carries `?project=` so the tool loads only this project's data. */
export function boardUrl(p: Project): string | null {
  if (p.board_type === "schema") return p.ref_id ? `/tableau/${p.ref_id}` : "/tableau";
  const path = boardTypeInfo(p.board_type).path;
  return path ? `${path}?project=${p.id}` : null;
}

/** Remonte les parent_board_id jusqu'à la racine. */
export function resolveBreadcrumb(all: Project[], id: string): Project[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  const trail: Project[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    trail.unshift(cur);
    cur = cur.parent_board_id ? byId.get(cur.parent_board_id) : undefined;
  }
  return trail;
}

export async function createProject(userId: string, parentId: string | null, type: string, title: string) {
  let ref_id: string | null = null;
  if (type === "schema") {
    const { data, error } = await supabase
      .from("tep_sketch_boards")
      .insert({ user_id: userId, title })
      .select("id")
      .single();
    if (error) throw error;
    ref_id = data.id;
  }
  const { data, error } = await supabase
    .from("tep_projects")
    .insert({ user_id: userId, parent_board_id: parentId, board_type: type, title, ref_id })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}
