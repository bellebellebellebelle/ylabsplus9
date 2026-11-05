const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export async function callAI(system: string, user: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Service IA indisponible");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (res.status === 429) throw new Error("Trop de requêtes, réessayez dans un instant.");
  if (res.status === 402) throw new Error("Crédits IA épuisés.");
  if (!res.ok) throw new Error("L'assistant n'a pas pu répondre.");

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

export type Suggestion = {
  kind: "appointment" | "task" | "email" | "smart";
  title: string;
  content: string;
  start_time: string | null;
  duration_min: number | null;
};

export function parseSuggestions(raw: string): Suggestion[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as Suggestion[];
    return parsed
      .filter((s) => s && typeof s.title === "string")
      .slice(0, 10)
      .map((s) => ({
        kind: ["appointment", "task", "email", "smart"].includes(s.kind) ? s.kind : "task",
        title: String(s.title).slice(0, 120),
        content: String(s.content ?? "").slice(0, 600),
        start_time: s.start_time ? String(s.start_time).slice(0, 5) : null,
        duration_min:
          typeof s.duration_min === "number" ? Math.min(600, Math.max(5, s.duration_min)) : null,
      }));
  } catch {
    return [];
  }
}
