import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AnalyzeInput = z.object({
  imageDataUrl: z.string().min(32),
});

export type SketchAnalysis = {
  title: string;
  summary: string;
  texts: string[];
  elements: string[];
  suggestions: string[];
};

const FALLBACK: SketchAnalysis = {
  title: "Schéma importé",
  summary: "",
  texts: [],
  elements: [],
  suggestions: [],
};

export const analyzeSketch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }): Promise<SketchAnalysis> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Clé IA manquante");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Analyse cette photo de schéma dessiné à la main. Relève TOUT ce qui est écrit (mots, chiffres, labels, flèches annotées) et la structure du schéma. " +
                  "Réponds uniquement en JSON avec ce format exact: " +
                  '{"title": string, "summary": string, "texts": string[], "elements": string[], "suggestions": string[]}. ' +
                  "title = titre court du schéma, summary = 2 phrases max, texts = chaque texte lu tel quel, elements = les blocs/formes et leurs liens, suggestions = 3 pistes pour continuer le schéma. Français.",
              },
              { type: "input_image", image_url: data.imageDataUrl },
            ],
          },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Analyse indisponible (${res.status}) ${detail.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as { type?: string; delta?: string };
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          }
        } catch {
          /* fragment ignoré */
        }
      }
    }

    const match = /\{[\s\S]*\}/.exec(text);
    if (!match) return { ...FALLBACK, summary: text.slice(0, 400) };
    try {
      const parsed = JSON.parse(match[0]) as Partial<SketchAnalysis>;
      return {
        title: typeof parsed.title === "string" && parsed.title ? parsed.title : FALLBACK.title,
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        texts: Array.isArray(parsed.texts) ? parsed.texts.map(String) : [],
        elements: Array.isArray(parsed.elements) ? parsed.elements.map(String) : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
      };
    } catch {
      return { ...FALLBACK, summary: text.slice(0, 400) };
    }
  });
