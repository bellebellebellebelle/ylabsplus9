export type ItemKind =
  | "note"
  | "task"
  | "event"
  | "ai"
  | "mail"
  | "plan"
  | "summary"
  | "rewrite"
  | "research";

export type BoardItem = {
  id: string;
  user_id: string;
  kind: string;
  content: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  done: boolean;
  due_at: string | null;
  end_at: string | null;
  google_task_id: string | null;
  google_event_id: string | null;
  ai_result: string | null;
  mail_to: string | null;
  mail_subject: string | null;
  mail_sent_at: string | null;
};

export const NOTE_COLORS = [
  "yellow",
  "pink",
  "mint",
  "sky",
  "lilac",
  "orange",
  "lime",
  "sand",
  "coral",
] as const;

export const COLOR_CLASS: Record<string, string> = {
  yellow: "bg-note-yellow",
  pink: "bg-note-pink",
  mint: "bg-note-mint",
  sky: "bg-note-sky",
  lilac: "bg-note-lilac",
  orange: "bg-note-orange",
  lime: "bg-note-lime",
  sand: "bg-note-sand",
  coral: "bg-note-coral",
};

export const KIND_LABEL: Record<string, string> = {
  note: "Post-it",
  task: "Tâche",
  event: "Rendez-vous",
  ai: "Agent IA",
  mail: "Mail Gmail",
  plan: "Plan d'action",
  summary: "Synthèse",
  rewrite: "Rédaction pro",
  research: "Recherche",
};

/** Post-it intelligents : chaque agent a sa propre logique métier. */
export const AGENT_KINDS: ItemKind[] = ["ai", "plan", "summary", "rewrite", "research"];

export const isAgent = (kind: string) => AGENT_KINDS.includes(kind as ItemKind);
export const CANVAS_SIZE = { w: 4000, h: 3000 };
