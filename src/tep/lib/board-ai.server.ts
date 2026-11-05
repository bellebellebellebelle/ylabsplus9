import type { SupabaseClient } from "@supabase/supabase-js";
import { askAi, parseJsonArray, COACH_RULES } from "./ai.server";
import { KIND_LABELS, type BubbleKind } from "./board-kinds";

type Db = SupabaseClient<any, "public", any>;

type BubbleRow = {
  id: string;
  board_id: string;
  kind: string;
  title: string;
  mission: string;
  objective: string;
  content: string;
  done: boolean;
};

export async function loadContext(supabase: Db, boardId: string) {
  const { data: board, error } = await supabase
    .from("tep_boards")
    .select("id, title, problem")
    .eq("id", boardId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!board) throw new Error("Tableau introuvable.");

  const { data: bubbles } = await supabase
    .from("tep_bubbles")
    .select("id, board_id, kind, title, mission, objective, content, done")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });

  return { board, bubbles: (bubbles ?? []) as BubbleRow[] };
}

export function describeContext(
  board: { title: string; problem: string },
  bubbles: BubbleRow[],
  skipId?: string,
) {
  const lines = bubbles
    .filter((b) => b.id !== skipId)
    .map((b) => {
      const label = KIND_LABELS[b.kind as BubbleKind] ?? b.kind;
      const state = b.kind === "action" ? (b.done ? " [FAIT]" : " [À FAIRE]") : "";
      const body = [b.mission, b.objective, b.content].filter(Boolean).join(" — ").slice(0, 700);
      return `- ${label}${state}: ${b.title || "(sans titre)"}${body ? ` :: ${body}` : ""}`;
    })
    .join("\n");

  return `PROBLÈME: ${board.problem || board.title}\n\nÉLÉMENTS DU TABLEAU:\n${lines || "(aucun pour l'instant)"}`;
}

const KIND_PROMPT: Record<string, string> = {
  decompose:
    "Découpe le problème en 3 à 5 sous-problèmes indépendants et résolubles. Pour chacun: nom court, pourquoi il bloque, premier test possible.",
  assumptions:
    "Liste 3 à 5 hypothèses risquées implicites. Pour chacune: pourquoi elle est risquée, et le test le moins cher pour la valider ou l'invalider cette semaine.",
  plan: "Produis un plan exécutable sur 48h: 3 à 6 étapes ordonnées, chacune avec durée estimée, livrable attendu et critère de réussite vérifiable.",
  critic:
    "Joue l'avocat du diable. Attaque le raisonnement actuel: 3 failles majeures, la conséquence concrète de chacune, et le correctif immédiat.",
  decision:
    "Formule la décision à trancher maintenant: options réelles, critère de choix unique, recommandation ferme, et l'action qui la matérialise dans les 24h.",
};

export async function runBubbleAi(supabase: Db, bubbleId: string) {
  const { data: bubble, error } = await supabase
    .from("tep_bubbles")
    .select("id, board_id, kind, title, mission, objective, content, done")
    .eq("id", bubbleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!bubble) throw new Error("Bulle introuvable.");

  const { board, bubbles } = await loadContext(supabase, bubble.board_id as string);
  await supabase.from("tep_bubbles").update({ status: "running" }).eq("id", bubbleId);

  const instruction =
    bubble.kind === "agent"
      ? `Tu es un agent spécialisé nommé "${bubble.title || "Agent"}".\nMISSION: ${bubble.mission || "(non précisée)"}\nOBJECTIF MESURABLE: ${bubble.objective || "(non précisé)"}\nProduis le livrable de ta mission, puis termine par une ligne "PROCHAINE ACTION:" avec une seule action concrète pour l'utilisateur.`
      : (KIND_PROMPT[bubble.kind as string] ?? "Fais avancer la résolution du problème.");

  try {
    const output = await askAi(
      COACH_RULES,
      `${describeContext(board as any, bubbles, bubbleId)}\n\nTÂCHE:\n${instruction}\n\nRéponds en 200 mots maximum, en puces denses.`,
    );
    await supabase
      .from("tep_bubbles")
      .update({ content: output, status: "done" })
      .eq("id", bubbleId);
    return { content: output };
  } catch (e) {
    await supabase.from("tep_bubbles").update({ status: "error" }).eq("id", bubbleId);
    throw e;
  }
}

export type Suggestion = {
  kind: BubbleKind;
  title: string;
  mission: string;
  objective: string;
};

export async function suggestBubbles(supabase: Db, boardId: string) {
  const { board, bubbles } = await loadContext(supabase, boardId);
  const raw = await askAi(
    COACH_RULES,
    `${describeContext(board as any, bubbles)}\n\nTÂCHE: propose les 3 prochaines bulles les plus utiles pour progresser RÉELLEMENT maintenant (pas de doublon avec l'existant).\nRéponds uniquement en JSON: [{"kind":"agent|decompose|assumptions|plan|critic|decision|action","title":"...","mission":"...","objective":"..."}]\n- title: 4 mots max.\n- mission: ce que la bulle doit produire, 1 phrase.\n- objective: critère de réussite mesurable, 1 phrase.`,
  );
  return parseJsonArray<Suggestion>(raw).slice(0, 3);
}

export async function nextMove(supabase: Db, boardId: string) {
  const { board, bubbles } = await loadContext(supabase, boardId);
  const content = await askAi(
    COACH_RULES,
    `${describeContext(board as any, bubbles)}\n\nTÂCHE: en 80 mots maximum, dis où en est réellement la résolution, ce qui bloque vraiment, et LA seule action à faire dans l'heure. Termine par une estimation "Avancement: X%".`,
  );
  const match = content.match(/Avancement\s*:\s*(\d{1,3})/i);
  const progress = match?.[1] ? Math.min(100, parseInt(match[1], 10)) : null;
  if (progress !== null) {
    await supabase.from("tep_boards").update({ progress }).eq("id", boardId);
  }
  return { content, progress };
}

export async function clarifyProblem(supabase: Db, boardId: string) {
  const { board, bubbles } = await loadContext(supabase, boardId);
  const content = await askAi(
    COACH_RULES,
    `${describeContext(board as any, bubbles)}\n\nTÂCHE: reformule le problème réel (souvent différent du problème énoncé) en une phrase précise et actionnable, puis liste 2 questions décisives dont la réponse changerait la suite. 90 mots maximum.`,
  );
  return { content };
}
