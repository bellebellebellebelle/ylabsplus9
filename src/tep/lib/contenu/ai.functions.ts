import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type TextInput = {
  kind: string;
  network?: string | null;
  prompt: string;
  brand?: string;
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function gatewayError(status: number, text: string): Error {
  if (status === 429) return new Error("Trop de requêtes IA, réessayez dans un instant.");
  if (status === 402) return new Error("Crédits IA épuisés. Ajoutez des crédits pour continuer.");
  return new Error(`Erreur IA (${status}) : ${text.slice(0, 200)}`);
}

export const generateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TextInput) => input)
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Clé IA manquante.");

    const system = [
      "Tu es un directeur de création social media senior.",
      "Tu réponds en français, sans markdown lourd, prêt à publier.",
      data.brand ? `Contexte de marque et ligne éditoriale :\n${data.brand}` : "",
      data.network ? `Réseau ciblé : ${data.network}.` : "",
      `Tâche : ${data.kind}.`,
    ]
      .filter(Boolean)
      .join("\n");

    const { askAi } = await import("@/tep/lib/ai.server");
    return { text: await askAi(system, data.prompt) };
  });

export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string; size: string }) => input)
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Clé IA manquante.");

    const res = await fetch(`${GATEWAY}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt: data.prompt,
        size: data.size,
        quality: "low",
      }),
    });

    if (!res.ok) throw gatewayError(res.status, await res.text());
    const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    const url = json.data?.[0]?.url;
    if (!b64 && !url) throw new Error("Aucune image générée.");
    return { image: b64 ? `data:image/png;base64,${b64}` : url! };
  });
