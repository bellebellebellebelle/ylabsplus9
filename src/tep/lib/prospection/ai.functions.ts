import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI, parseJsonArray } from "./ai.server";

export type CompanyResult = {
  name: string;
  sector: string;
  location: string;
  size: string;
  website: string;
  why: string;
};

export const searchCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => input)
  .handler(async ({ data }) => {
    const raw = await callAI([
      {
        role: "system",
        content:
          "Tu es un assistant de prospection B2B. Réponds UNIQUEMENT par un tableau JSON de 8 entreprises réelles au format [{\"name\",\"sector\",\"location\",\"size\",\"website\",\"why\"}]. \"why\" = raison courte de prospecter cette entreprise. Aucun texte hors JSON.",
      },
      { role: "user", content: data.query },
    ]);
    return { companies: parseJsonArray<CompanyResult>(raw) };
  });

export const researchCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; context?: string }) => input)
  .handler(async ({ data }) => {
    const content = await callAI([
      {
        role: "system",
        content:
          "Tu es analyste en intelligence commerciale. Fournis une fiche entreprise complète en markdown, concise et factuelle, sans inventer : activité, produits/services, positionnement, taille et effectif, chiffre d'affaires estimé, dirigeants, actualités récentes, clients/marchés, concurrents, signaux d'achat, points de douleur probables, angle d'approche commercial recommandé et message d'accroche prêt à envoyer. Indique clairement quand une information est incertaine.",
      },
      { role: "user", content: `Entreprise : ${data.name}. ${data.context ?? ""}` },
    ]);
    return { content };
  });

const SMART_PROMPTS: Record<string, string> = {
  email:
    "Tu es copywriter B2B. Rédige un email de prospection court (80-120 mots) en français : objet accrocheur, accroche personnalisée, valeur, appel à l'action clair. Format markdown avec **Objet :** puis le corps.",
  script:
    "Tu es coach en vente téléphonique. Rédige un script d'appel à froid en français : accroche 10 secondes, question de découverte, argument de valeur, traitement de 2 objections courantes, closing pour obtenir un rendez-vous. Markdown structuré et court.",
  qualif:
    "Tu es expert en qualification commerciale. Produis une qualification BANT/MEDDIC synthétique en markdown : budget, décideur, besoin, timing, signaux d'achat, risques, score de priorité sur 10 et prochaine action recommandée.",
  reminder:
    "Tu es assistant commercial. Propose une séquence de relance datée (J+2, J+7, J+15) en markdown, avec le canal et le message court à envoyer à chaque étape.",
};

export const smartNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string; context: string }) => input)
  .handler(async ({ data }) => {
    const content = await callAI([
      { role: "system", content: SMART_PROMPTS[data.kind] ?? SMART_PROMPTS["email"]! },
      { role: "user", content: data.context || "Prospect B2B générique." },
    ]);
    return { content };
  });

export const assistNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { instruction: string; content: string }) => input)
  .handler(async ({ data }) => {
    const content = await callAI([
      {
        role: "system",
        content:
          "Tu es un coach commercial. Réponds en markdown court et actionnable, en français, directement exploitable dans un post-it de prospection.",
      },
      { role: "user", content: `${data.instruction}\n\nContenu du post-it :\n${data.content}` },
    ]);
    return { content };
  });
