const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function chat(
  model: string,
  messages: Msg[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Lovable AI n'est pas configuré (clé manquante).");

  const isOpenAI = model.startsWith("openai/");
  const body: Record<string, unknown> = { model, messages };

  if (isOpenAI) {
    if (opts.maxTokens) body["max_completion_tokens"] = opts.maxTokens;
    if (model.includes("gpt-5.6")) body["reasoning_effort"] = "none";
  } else {
    if (opts.maxTokens) body["max_tokens"] = opts.maxTokens;
    if (typeof opts.temperature === "number") body["temperature"] = opts.temperature;
  }

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new Error("Trop de requêtes IA en même temps, réessayez dans un instant.");
    }
    if (res.status === 402) {
      throw new Error("Crédits IA épuisés : ajoutez des crédits pour relancer vos agents.");
    }
    if (res.status === 403) {
      throw new Error("Accès à l'IA bloqué par les réglages de l'espace de travail.");
    }
    throw new Error(`L'IA a refusé la requête (${res.status}). ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Extrait un objet JSON même si le modèle l'entoure de texte ou de balises. */
export function parseJson<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) return null;
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
