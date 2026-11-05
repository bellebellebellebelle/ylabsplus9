import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APP_TZ, tzNowTime, tzTodayKey } from "@/tep/lib/planning/timezone";

const planInput = z.object({
  day: z.string().min(4).max(10),
  goal: z.string().min(1).max(600),
  existing: z.string().max(3000).default(""),
});

const askInput = z.object({
  prompt: z.string().min(1).max(1000),
  context: z.string().max(3000).default(""),
});

const reviewInput = z.object({
  scope: z.string().min(1).max(60),
  data: z.string().max(6000),
});

export const smartPlanDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planInput.parse(d))
  .handler(async ({ data }) => {
    const { callAI, parseSuggestions } = await import("./smart.server");
    const raw = await callAI(
      "Tu es un assistant de planification francophone. Tu réponds UNIQUEMENT par un tableau JSON d'objets " +
        '{"kind":"appointment"|"task"|"email","title":string,"content":string,"start_time":"HH:MM"|null,"duration_min":number|null}. ' +
        "Maximum 6 éléments, ordonnés chronologiquement, réalistes et concrets. " +
        `Toutes les heures sont exprimées en heure locale du fuseau ${APP_TZ}. ` +
        `Nous sommes le ${tzTodayKey()} et il est ${tzNowTime()} dans ce fuseau : interprète « aujourd'hui », « demain », « ce soir » par rapport à cette date réelle.`,
      `Jour: ${data.day}\nObjectif de l'utilisateur: ${data.goal}\nDéjà planifié:\n${data.existing || "(rien)"}`,
    );
    return { suggestions: parseSuggestions(raw) };
  });

export const smartAsk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => askInput.parse(d))
  .handler(async ({ data }) => {
    const { callAI } = await import("./smart.server");
    const text = await callAI(
      "Tu es un copilote d'organisation francophone. Réponses courtes, structurées, actionnables (max 120 mots). " +
        "Pas de markdown lourd, utilise des tirets simples. " +
        `Fuseau horaire de l'utilisateur : ${APP_TZ}. Date et heure actuelles : ${tzTodayKey()} ${tzNowTime()}.`,
      `Contexte du jour:\n${data.context || "(vide)"}\n\nDemande: ${data.prompt}`,
    );
    return { text };
  });

export const smartReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reviewInput.parse(d))
  .handler(async ({ data }) => {
    const { callAI } = await import("./smart.server");
    const text = await callAI(
      "Tu es un coach d'organisation francophone. Analyse la charge de la période, repère les surcharges, " +
        "les jours vides et propose 3 ajustements concrets. Max 130 mots, tirets simples. " +
        `Fuseau horaire : ${APP_TZ}. Aujourd'hui : ${tzTodayKey()}.`,
      `Période: ${data.scope}\nContenu:\n${data.data || "(vide)"}`,
    );
    return { text };
  });
