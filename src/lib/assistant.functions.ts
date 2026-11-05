import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { odooAuth, runAgent, speak, transcribe } from "./assistant.server";
import { validateAttachments, type AuraAttachment } from "./aura-attachments";

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { audio: string; mime: string }) => {
    if (!d?.audio || d.audio.length > 15_000_000) throw new Error("Audio invalide");
    return d;
  })
  .handler(async ({ data }) => ({ text: await transcribe(data.audio, data.mime) }));

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string; attachments?: AuraAttachment[] }) => {
    const text = String(d?.text || "").trim().slice(0, 4000);
    if (!text) throw new Error("Message vide");
    return { text, attachments: validateAttachments(d.attachments) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: e1 } = await supabase.from("messages").insert({ user_id: userId, role: "user", content: data.text });
    if (e1) throw new Error(e1.message);
    const [{ data: hist }, { data: odoo }] = await Promise.all([
      supabase.from("messages").select("role, content").order("created_at", { ascending: false }).limit(14),
      supabase.from("odoo_connections").select("url, db, username, api_key").maybeSingle(),
    ]);
    const history = (hist || []).reverse().map((m) => ({ role: m.role, content: m.content }));
    const { appsSummary, runAppAction } = await import("./assistant-apps.server");
    // Journal détaillé : chaque action d'Aura (source, cible, résultat, durée).
    const clip = (v: unknown, n = 1500) => { try { const t = typeof v === "string" ? v : JSON.stringify(v); return (t ?? "").slice(0, n); } catch { return ""; } };
    const log = (row: Record<string, unknown>) => supabase.from("assistant_logs").insert({ user_id: userId, request: data.text.slice(0, 2000), app: "aura", ...row }).then(() => undefined, () => undefined);
    const sources = data.attachments.length ? data.attachments.map((a) => `Pièce jointe : ${(a as { name?: string }).name ?? "fichier"}`) : [];
    const { resolveAppAiModel } = await import("./ai-models.server");
    const auraModel = await resolveAppAiModel(supabase, userId, "aura");
    let result: Awaited<ReturnType<typeof runAgent>>;
    try {
      result = await runAgent(history, odoo ?? null, {
        summary: appsSummary(),
        run: async (app, action, input) => {
          const t0 = Date.now();
          try {
            const r = await runAppAction({ db: supabase as never, userId, attachments: data.attachments }, app, action, input);
            const failed = !!r && typeof r === "object" && ("error" in (r as object) || (r as { ok?: boolean }).ok === false);
            await Promise.all([
              supabase.from("lab_activity").insert({ user_id: userId, kind: `aura:${app}.${action}`, app_key: app === "lab" ? null : app, seconds_saved: failed ? 0 : 60 }),
              log({ action_type: `${app}.${action}`, target: app, value: clip(input, 500), status: failed ? "failure" : "success", detail: `Résultat (${Date.now() - t0} ms) : ${clip(r)}`, sources: ["Aura", `App : ${app}`, ...sources] }),
            ]);
            return r;
          } catch (e) {
            await log({ action_type: `${app}.${action}`, target: app, value: clip(input, 500), status: "failure", detail: `Erreur (${Date.now() - t0} ms) : ${e instanceof Error ? e.message : String(e)}`, sources: ["Aura", `App : ${app}`, ...sources] });
            throw e;
          }
        },
      }, data.attachments, auraModel);
    } catch (e) {
      await log({ action_type: "aura.request", status: "failure", detail: e instanceof Error ? e.message : String(e), sources: ["Aura", ...sources] });
      throw e;
    }
    const { reply, board, open } = result;
    await log({ action_type: "aura.reply", target: open ?? null, status: "info", reply: reply.slice(0, 4000), detail: open ? `Page ouverte : ${open}` : "", sources: ["Aura", ...sources] });
    const { error: e2 } = await supabase
      .from("messages")
      .insert({ user_id: userId, role: "assistant", content: reply, board: board as never });
    if (e2) throw new Error(e2.message);
    return { reply, board, open };
  });

// Text and completed actions reach the user before voice synthesis finishes.
export const assistantSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string }) => ({ text: String(data.text || "").trim().slice(0, 8000) }))
  .handler(async ({ data }) => {
    if (!data.text) return { audio: null };
    try { return { audio: await speak(data.text) }; }
    catch { return { audio: null }; }
  });

export const saveOdoo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string; db: string; username: string; api_key: string }) => {
    if (!/^https?:\/\//.test(d.url) || !d.db || !d.username || !d.api_key) throw new Error("Champs invalides");
    return d;
  })
  .handler(async ({ data, context }) => {
    await odooAuth(data);
    const { error } = await context.supabase
      .from("odoo_connections")
      .upsert({ ...data, user_id: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
