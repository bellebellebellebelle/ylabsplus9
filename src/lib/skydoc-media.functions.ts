import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GW = "https://ai.gateway.lovable.dev/v1";

function key() {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new Error("Clé IA manquante");
  return k;
}

async function fail(res: Response): Promise<never> {
  const t = await res.text().catch(() => "");
  if (res.status === 429) throw new Error("Trop de requêtes, réessayez dans un instant.");
  if (res.status === 402) throw new Error("Crédits IA épuisés.");
  let msg = t.slice(0, 200);
  try { msg = JSON.parse(t)?.error?.message || JSON.parse(t)?.message || msg; } catch { /* ignore */ }
  throw new Error(`Erreur IA (${res.status}) ${msg}`);
}

const validate = (d: { prompt: string }) => {
  if (!d || typeof d.prompt !== "string" || !d.prompt.trim()) throw new Error("Description vide");
  return { prompt: d.prompt.slice(0, 1500) };
};

export const generateDocImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const res = await fetch(`${GW}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model: "openai/gpt-image-2.5-sunburst",
        prompt: `Illustration professionnelle, élégante et moderne pour un document d'entreprise. ${data.prompt}`,
      }),
    });
    if (!res.ok) await fail(res);
    const j = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const img = j.data?.[0];
    const url = img?.b64_json ? `data:image/png;base64,${img.b64_json}` : img?.url;
    if (!url) throw new Error("Aucune image générée.");
    return { url };
  });

export const generateIcons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const res = await fetch(`${GW}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        store: false,
        instructions:
          "Tu dessines des icônes SVG minimalistes style ligne (comme Lucide). Chaque icône : <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\">…</svg>. Pas de texte, pas de script, pas de style. Par défaut 1 icône, ou le nombre demandé (max 8). Réponds UNIQUEMENT avec les balises <svg> à la suite.",
        input: [{ role: "user", content: data.prompt }],
      }),
    });
    if (!res.ok) await fail(res);
    const j = (await res.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[] };
    const text = (j.output ?? []).flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("");
    const svgs = (text.match(/<svg[\s\S]*?<\/svg>/gi) ?? [])
      .slice(0, 8)
      .map((s) => s.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, ""));
    if (!svgs.length) throw new Error("Aucune icône générée.");
    return { svgs };
  });
