// Central AI model catalog shared by the settings tab and the server resolver.
export const CENTRAL_MODELS = [
  { id: "openai/gpt-6-sol", name: "GPT-6 Sol", badge: "Raisonnement & stratégie", hint: "Flux multi-étapes, planification, décisions." },
  { id: "openai/gpt-6-luna", name: "GPT-6 Luna", badge: "Vitesse & réactivité", hint: "Réponses instantanées, synthèses rapides." },
  { id: "openai/gpt-6-astra", name: "GPT-6 Astra", badge: "Création & documents", hint: "Rédaction riche, mise en page, analyses." },
] as const;

// Every lab app with AI features follows the central choice. New apps: add one line here + RECOMMENDED.
export const AI_APPS = [
  { key: "aura", name: "Aura", hint: "Assistant vocal" },
  { key: "memotrack", name: "MemoTrack", hint: "Mémos de réunion" },
  { key: "angelo", name: "ANGELO Billing", hint: "Relances de factures" },
  { key: "ocktavus", name: "OCKTAVUS", hint: "Google Workspace" },
  { key: "mymackenzy", name: "MyMackenzy", hint: "Automatisations & agents" },
  { key: "tep", name: "TEP", hint: "Recrutement, post-it & planning" },
  { key: "smartteams", name: "Smart Teams", hint: "Équipes d'agents IA" },
  { key: "skydoc", name: "SkyDoc", hint: "Rédaction de documents" },
  { key: "skytab", name: "SkyTab", hint: "Tableurs & calculs" },
] as const;

export type AiAppKey = (typeof AI_APPS)[number]["key"];

export const RECOMMENDED: Record<AiAppKey, string> = {
  aura: "openai/gpt-6-luna",
  memotrack: "openai/gpt-6-luna",
  angelo: "openai/gpt-6-astra",
  ocktavus: "openai/gpt-6-luna",
  mymackenzy: "openai/gpt-6-sol",
  tep: "openai/gpt-6-astra",
  smartteams: "openai/gpt-6-sol",
  skydoc: "openai/gpt-6-astra",
  skytab: "openai/gpt-6-luna",
};

export function isCentralModel(id: unknown): id is string {
  return CENTRAL_MODELS.some((m) => m.id === id);
}
