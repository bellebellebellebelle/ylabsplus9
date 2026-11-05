import { createLovableAiGatewayRunIdFetch } from "./ai-gateway-run-id";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function gatewayMessage(body: string, status: number): string {
  let message = body;
  try {
    message = (JSON.parse(body)?.error?.message as string) ?? body;
  } catch {
    /* keep raw body */
  }
  if (status === 429) message = "Trop de requêtes IA, réessayez dans un instant.";
  if (status === 402) message = message || "Crédits IA épuisés.";
  return message;
}

/** Appelle l'IA via /v1/responses et renvoie la réponse texte complète. */
export async function askAi(system: string, user: string, runId?: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(401, "Clé IA manquante.");

  const gateway = createLovableAiGatewayRunIdFetch(runId);
  const res = await gateway.fetch(GATEWAY, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
      store: false,
      reasoning: { effort: "medium", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiError(res.status, gatewayMessage(body, res.status) || `Lovable AI [${res.status}]`);
  }
  if (!res.body) throw new AiError(502, "Réponse IA vide.");

  const text = await readAiStream(res.body);
  if (!text) throw new AiError(502, "L'agent IA n'a rien renvoyé. Réessayez.");
  return text;
}

/** Consomme le flux SSE et renvoie le texte visible de la réponse. */
async function readAiStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let completed: unknown = null;

  const handle = (raw: string) => {
    for (const line of raw.split("\n")) {
      const trimmed = line.replace(/\r$/, "").trim();
      if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let event: any;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }

      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        answer += event.delta;
      } else if (event.type === "response.completed") {
        completed = event.response;
      } else if (event.type === "response.failed") {
        throw new AiError(502, event.response?.error?.message ?? "L'agent IA a échoué.");
      } else if (event.type === "error") {
        throw new AiError(502, event.error?.message ?? "Erreur IA.");
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      handle(buffer.slice(0, sep));
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) handle(buffer);

  return answer.trim() || textFromResponse(completed);
}

type OutputPart = { type?: string; text?: string };
type OutputItem = { type?: string; content?: OutputPart[] };

function textFromResponse(response: unknown): string {
  const output = (response as { output?: OutputItem[] })?.output ?? [];
  const parts: string[] = [];
  for (const item of output) {
    if (item?.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string") parts.push(part.text);
    }
  }
  return parts.join("\n").trim();
}

export function parseJsonArray<T>(raw: string): T[] {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export const COACH_RULES = `Tu es un copilote de résolution de problèmes, exigeant et orienté action.
Règles absolues:
- Jamais de blabla générique, jamais de remplissage.
- Chaque réponse doit faire AVANCER concrètement la résolution réelle du problème.
- Toujours ancré dans le contexte fourni (problème, bulles existantes, décisions).
- Formulations courtes, verbes d'action, échéances et critères de réussite mesurables.
- Si une information manque et bloque l'avancée, pose UNE question décisive.
- Réponds en français.`;
