import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function mailgunBase() {
  return (process.env["MAILGUN_API_BASE"] || "https://api.mailgun.net").replace(/\/$/, "");
}

export const getMailConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      domain: process.env["MAILGUN_DOMAIN"] ?? "",
      hasApiKey: Boolean(process.env["MAILGUN_API_KEY"]),
      hasSigningKey: Boolean(process.env["MAILGUN_WEBHOOK_SIGNING_KEY"]),
      apiBase: mailgunBase(),
    };
  });

const reserveSchema = z.object({
  localPart: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]([a-z0-9._-]{0,30}[a-z0-9])?$/, "Adresse invalide"),
  displayName: z.string().trim().min(1).max(80),
});

export const reserveAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => reserveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("mailboxes")
      .insert({ user_id: context.userId, local_part: data.localPart, display_name: data.displayName });
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "Cette adresse est déjà prise." };
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

const sendSchema = z.object({
  to: z.string().trim().min(3).max(1000),
  cc: z.string().trim().max(1000).optional(),
  subject: z.string().trim().max(300),
  text: z.string().max(100_000),
  draftId: z.string().uuid().optional(),
});

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { sendSendyMail } = await import("./sendy.server");
    const r = await sendSendyMail(context.supabase, context.userId, data);
    if (!r.ok) return { ok: false as const, error: r.error };
    if (data.draftId) await context.supabase.from("mail_messages").delete().eq("id", data.draftId);
    return { ok: true as const };
  });
