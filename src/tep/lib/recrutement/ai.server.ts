import { DEFAULT_AI_MODEL } from "./ai-models";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function askJson<T>(system: string, user: string, model?: string): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Clé IA manquante");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: model || DEFAULT_AI_MODEL,
      messages: [
        { role: "system", content: `${system}\nRéponds UNIQUEMENT en JSON valide, sans balises markdown.` },
        { role: "user", content: user.slice(0, 24000) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Trop de requêtes IA, réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés. Rechargez votre espace Lovable.");
    throw new Error(`Erreur IA (${res.status}): ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("Réponse IA illisible");
  }
}

type Part =
  | { type: "text"; text: string }
  | { type: "file"; file: { filename: string; file_data: string } }
  | { type: "image_url"; image_url: { url: string } };

async function callGateway(system: string, content: Part[] | string, model?: string) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Clé IA manquante");
  return fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: model || DEFAULT_AI_MODEL,
      messages: [
        { role: "system", content: `${system}\nRéponds UNIQUEMENT en JSON valide, sans balises markdown.` },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* ignore */
      }
    }
    throw new Error("Réponse IA illisible");
  }
}

/** Analyse un document binaire (PDF, image de CV…) en l'envoyant directement au modèle multimodal. */
export async function askJsonFile<T>(
  system: string,
  prompt: string,
  file: { name: string; mimeType: string; base64: string },
  model?: string,
): Promise<T> {
  const dataUrl = `data:${file.mimeType};base64,${file.base64}`;
  const variants: Part[][] = file.mimeType.startsWith("image/")
    ? [[{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }]]
    : [
        [
          { type: "text", text: prompt },
          { type: "file", file: { filename: file.name, file_data: dataUrl } },
        ],
        [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }],
      ];

  let lastError = "";
  for (const parts of variants) {
    const res = await callGateway(system, parts, model);
    if (res.ok) {
      const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return parseJson<T>(payload.choices?.[0]?.message?.content ?? "");
    }
    if (res.status === 429) throw new Error("Trop de requêtes IA, réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés. Rechargez votre espace Lovable.");
    lastError = `${res.status}: ${(await res.text()).slice(0, 200)}`;
  }
  throw new Error(`Erreur IA (${lastError})`);
}
