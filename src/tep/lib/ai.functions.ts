import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Post-it intelligent : exécute la demande de l'utilisateur via Lovable AI. */
export const runAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string; prompt: string }) => data)
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Clé Lovable AI manquante");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { resolveAppAiModel } = await import("@/lib/ai-models.server");
    const model = await resolveAppAiModel(supabaseAdmin, context.userId, "tep");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Tu es un agent Post-it. Tu exécutes la demande de l'utilisateur (recherche, rédaction, plan d'action, analyse) et tu réponds en français, de façon concise et directement exploitable. Pas de préambule.",
          },
          { role: "user", content: data.prompt },
        ],
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      if (res.status === 429) throw new Error("Trop de requêtes IA, réessayez dans un instant.");
      if (res.status === 402) throw new Error("Crédits IA épuisés pour cet espace de travail.");
      throw new Error(`Lovable AI [${res.status}]: ${text}`);
    }
    const json = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
    const result = json.choices?.[0]?.message?.content ?? "";

    await supabaseAdmin
      .from("tep_board_items")
      .update({ ai_result: result })
      .eq("id", data.itemId)
      .eq("user_id", context.userId);

    return { result };
  });
