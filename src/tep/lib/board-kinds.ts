export type BubbleKind =
  | "agent"
  | "decompose"
  | "assumptions"
  | "plan"
  | "critic"
  | "decision"
  | "action"
  | "note";

export const KIND_LABELS: Record<BubbleKind, string> = {
  agent: "Agent IA",
  decompose: "Décomposition",
  assumptions: "Hypothèses à tester",
  plan: "Plan 48h",
  critic: "Avocat du diable",
  decision: "Décision",
  action: "Action",
  note: "Note",
};

export const KIND_HINTS: Record<BubbleKind, string> = {
  agent: "Donnez une mission et un objectif mesurable",
  decompose: "Découpe le problème en sous-problèmes résolubles",
  assumptions: "Liste les croyances risquées et comment les tester",
  plan: "Produit un plan exécutable sous 48 heures",
  critic: "Attaque le raisonnement pour révéler les angles morts",
  decision: "Tranche entre les options avec un critère clair",
  action: "Une étape concrète à cocher quand elle est faite",
  note: "Contexte, contrainte ou information brute",
};

export const AI_KINDS: BubbleKind[] = [
  "agent",
  "decompose",
  "assumptions",
  "plan",
  "critic",
  "decision",
];
