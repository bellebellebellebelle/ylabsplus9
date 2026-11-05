import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `Tu es l'assistant de mise en page d'un éditeur de documents professionnel (remplaçant de Google Docs).
Tu produis du HTML sémantique propre (sans <html>, <body>, <style>, <script>, sans attributs style) en utilisant UNIQUEMENT ces classes :
- <header class="doc-hero"><h1>Titre</h1><p class="doc-sub">Sous-titre</p></header>
- <div class="doc-grid"> ... colonnes (2 blocs côte à côte) ... </div>
- <section class="doc-card"><h2>Titre</h2><p>Texte</p></section>  (doc-card doc-accent pour un bloc mis en avant)
- <div class="doc-stats"><div class="doc-stat"><strong>€42.6B</strong><span>Libellé</span></div>...</div>
- <ul class="doc-checks"><li>Objectif</li></ul>
- <ol class="doc-steps"><li><b>Étape</b><small>Mois 1-2</small></li></ol>
- <div class="doc-kpis"><div class="doc-kpi"><small>CAC</small><strong>€120</strong><span>Description</span></div></div>
- <blockquote class="doc-callout">Note</blockquote>
- <table class="doc-table">...</table>
- <mark> pour surligner les mots-clés importants.
Rédige un contenu riche, concret, chiffré et professionnel en français (sauf demande contraire).
Format de réponse OBLIGATOIRE :
Une courte phrase de réponse à l'utilisateur (1-2 phrases), puis une ligne contenant exactement ===HTML=== , puis le HTML.`;

type Input = { instruction: string; docHtml: string; selectionHtml?: string | null; history?: { role: string; content: string }[] };

export const runAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => {
    if (!d || typeof d.instruction !== "string" || !d.instruction.trim()) throw new Error("Instruction vide");
    return {
      instruction: d.instruction.slice(0, 4000),
      docHtml: String(d.docHtml ?? "").slice(0, 60000),
      selectionHtml: d.selectionHtml ? String(d.selectionHtml).slice(0, 20000) : null,
      history: Array.isArray(d.history) ? d.history.slice(-8) : [],
    };
  })
  .handler(async ({ data, context }) => {
    const { resolveAppAiModel } = await import("@/lib/ai-models.server");
    const model = await resolveAppAiModel(context.supabase, context.userId, "skydoc", "openai/gpt-6-luna");
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("Clé IA manquante");
    let task: string;
    if (data.selectionHtml) {
      task = `L'utilisateur a sélectionné cet élément du document :\n${data.selectionHtml}\n\nDemande : ${data.instruction}\n\nRenvoie UNIQUEMENT le HTML de remplacement de cet élément (même type de bloc racine si pertinent).`;
    } else if (!data.docHtml.trim()) {
      task = `Crée la première version complète du document. Demande : ${data.instruction}\nCommence par un doc-hero, utilise des doc-grid pour une mise en page en colonnes.`;
    } else {
      task = `Document actuel :\n${data.docHtml}\n\nDemande : ${data.instruction}\n\nRenvoie le document COMPLET mis à jour.`;
    }
    const input = [
      ...data.history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 1500) })),
      { role: "user", content: task },
    ];
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model,
        instructions: SYSTEM,
        input,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Trop de requêtes, réessayez dans un instant.");
      if (res.status === 402) throw new Error("Crédits IA épuisés.");
      throw new Error(`Erreur IA (${res.status}) ${t.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p);
          if (ev.type === "response.output_text.delta") out += ev.delta;
          if (ev.type === "response.failed" || ev.type === "error") throw new Error(ev.error?.message || "Erreur IA");
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("Erreur")) throw e;
        }
      }
    }
    const [replyPart, ...rest] = out.split("===HTML===");
    let html = rest.join("").trim().replace(/^```html?\s*/i, "").replace(/```\s*$/, "");
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
    return { reply: (replyPart || "C'est fait !").trim(), html };
  });
