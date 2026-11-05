import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { askJson, askJsonFile } from "./ai.server";

// TEP model comes from Laboratoire → Paramètres → Modèles d’IA.
const tepModel = async (ctx: { supabase: unknown; userId: string }) =>
  (await import("@/lib/ai-models.server")).resolveAppAiModel(ctx.supabase, ctx.userId, "tep");

export type CandidateProfile = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  years_experience: number;
  skills: string[];
  languages: string[];
  education: string[];
  experiences: Array<{ role: string; company: string; period: string }>;
  summary: string;
  strengths: string[];
  watchouts: string[];
};

export const analyzeCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; fileName?: string; model?: string }) => {
    if (!input?.text || input.text.trim().length < 30) throw new Error("CV trop court ou illisible");
    return input;
  })
  .handler(async ({ data, context }) => {
    return askJson<CandidateProfile>(
      "Tu es un expert RH. Extrais le profil structuré d'un CV. Schéma JSON: {name, headline, email, phone, location, years_experience (nombre), skills[], languages[], education[], experiences[{role, company, period}], summary (3 phrases), strengths[], watchouts[]}. Écris en français. Utilise \"\" ou [] si l'info manque.",
      `Fichier: ${data.fileName ?? "cv"}\n\nCV:\n${data.text}`,
      await tepModel(context),
    );
  });

const CV_SYSTEM =
  "Tu es un expert RH. Extrais le profil structuré d'un CV, quelle que soit sa mise en page. Schéma JSON: {name, headline, email, phone, location, years_experience (nombre), skills[], languages[], education[], experiences[{role, company, period}], summary (3 phrases), strengths[], watchouts[]}. Écris en français. Utilise \"\" ou [] si l'info manque.";

export const analyzeCvFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string; mimeType: string; base64: string; model?: string }) => {
    if (!input?.base64) throw new Error("Fichier illisible");
    if (input.base64.length > 12_000_000) throw new Error("Fichier trop volumineux (max ~8 Mo)");
    return input;
  })
  .handler(async ({ data, context }) => {
    return askJsonFile<CandidateProfile>(
      CV_SYSTEM,
      `Lis intégralement ce CV (fichier: ${data.fileName}) et renvoie le profil structuré du candidat.`,
      { name: data.fileName, mimeType: data.mimeType || "application/pdf", base64: data.base64 },
      await tepModel(context),
    );
  });

export const generateJobSpec = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; context?: string; model?: string }) => {
    if (!input?.title?.trim()) throw new Error("Titre du poste requis");
    return input;
  })
  .handler(async ({ data, context }) => {
    return askJson<{
      summary: string;
      must_have: string[];
      nice_to_have: string[];
      responsibilities: string[];
      seniority: string;
      salary_hint: string;
      interview_questions: string[];
    }>(
      "Tu es un recruteur senior. Génère une fiche de poste concise et opérationnelle. Schéma JSON: {summary, must_have[], nice_to_have[], responsibilities[], seniority, salary_hint, interview_questions[]}. En français.",
      `Poste: ${data.title}\nContexte: ${data.context ?? "aucun"}`,
      await tepModel(context),
    );
  });

export const matchCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      job: { title: string; description: string };
      candidates: Array<{ id: string; name: string; profile: string }>;
      model?: string;
    }) => {
      if (!input?.candidates?.length) throw new Error("Aucun candidat dans le vivier");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    return askJson<{ matches: Array<{ id: string; score: number; verdict: string; reasons: string[]; gaps: string[] }> }>(
      "Tu es un expert en matching de talents. Note chaque candidat de 0 à 100 pour le poste. Schéma JSON: {matches:[{id, score, verdict (une phrase), reasons[], gaps[]}]} trié par score décroissant. Conserve exactement les id fournis. En français.",
      `POSTE: ${data.job.title}\n${data.job.description}\n\nCANDIDATS:\n${data.candidates
        .map((c) => `id=${c.id} | ${c.name}\n${c.profile}`)
        .join("\n---\n")}`,
      await tepModel(context),
    );
  });

export const smartAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; context: string; model?: string }) => {
    if (!input?.kind) throw new Error("Action inconnue");
    return input;
  })
  .handler(async ({ data, context }) => {
    const prompts: Record<string, string> = {
      interview:
        "Génère un guide d'entretien structuré. Schéma JSON: {title, items[] (questions ciblées avec l'objectif entre parenthèses)}.",
      email:
        "Rédige un email de contact candidat, professionnel et chaleureux. Schéma JSON: {title, items[] (chaque ligne de l'email)}.",
      checklist:
        "Génère une checklist d'actions de recrutement priorisées. Schéma JSON: {title, items[]}.",
      summary: "Résume et synthétise l'information en points clés actionnables. Schéma JSON: {title, items[]}.",
      scorecard:
        "Génère une grille d'évaluation avec critères et pondérations. Schéma JSON: {title, items[]}.",
    };
    return askJson<{ title: string; items: string[] }>(
      `Tu es un assistant recrutement. ${prompts[data.kind] ?? prompts["summary"]} En français, concis.`,
      data.context.slice(0, 12000) || "Aucun contexte fourni.",
      await tepModel(context),
    );
  });
