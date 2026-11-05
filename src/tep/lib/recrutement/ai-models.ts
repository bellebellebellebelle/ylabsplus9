export type AiModelOption = {
  id: string;
  label: string;
  hint: string;
};

/** Modèles Lovable AI proposés pour les fonctionnalités intelligentes. */
export const AI_MODELS: AiModelOption[] = [
  { id: "google/gemini-3.7-flash", label: "Gemini 3.7 Flash", hint: "Équilibré — recommandé" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", hint: "Le plus rapide et économique" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", hint: "Analyse la plus fine" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Raisonnement multimodal avancé" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Rapide, bon compromis" },
];

export const DEFAULT_AI_MODEL = "google/gemini-3.7-flash";

export const AI_MODEL_STORAGE_KEY = "smyle.ai-model";

export function resolveAiModel(model?: string | null): string {
  return AI_MODELS.some((m) => m.id === model) ? (model as string) : DEFAULT_AI_MODEL;
}
