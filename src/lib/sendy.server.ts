/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Native SKY/Sendy mail sending (Mailgun), shared by SENDYME, TEP boards and Aura. */
export async function sendSendyMail(
  db: SupabaseClient<any, any, any>,
  userId: string,
  data: { to: string; cc?: string; subject: string; text: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env["MAILGUN_API_KEY"];
  const domain = process.env["MAILGUN_DOMAIN"];
  const base = (process.env["MAILGUN_API_BASE"] || "https://api.mailgun.net").replace(/\/$/, "");
  if (!apiKey || !domain) return { ok: false, error: "Mailgun n'est pas configuré." };

  const { data: mb } = await db.from("mailboxes").select("local_part, display_name").eq("user_id", userId).maybeSingle();
  if (!mb) return { ok: false, error: "Aucune adresse Sendy réservée. Ouvrez SENDYME pour en créer une." };

  const emailRe = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/;
  const split = (s?: string) => (s ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const to = split(data.to);
  const cc = split(data.cc);
  if (!to.length || [...to, ...cc].some((a) => !emailRe.test(a))) return { ok: false, error: "Adresse destinataire invalide." };

  const form = new FormData();
  form.append("from", `${String(mb.display_name).replace(/["<>]/g, "")} <${mb.local_part}@${domain}>`);
  to.forEach((t) => form.append("to", t));
  cc.forEach((c) => form.append("cc", c));
  form.append("subject", data.subject || "(sans objet)");
  form.append("text", data.text);

  const res = await fetch(`${base}/v3/${domain}/messages`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`api:${apiKey}`) },
    body: form,
  });
  const body = await res.text();
  if (!res.ok) {
    console.error("Mailgun send failed", res.status, body);
    return { ok: false, error: `Mailgun a refusé l'envoi (${res.status}).` };
  }
  let providerId: string | null = null;
  try { providerId = JSON.parse(body).id ?? null; } catch { /* ignore */ }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("mail_messages").insert({
    user_id: userId,
    folder: "sent",
    from_address: `${mb.local_part}@${domain}`,
    from_name: mb.display_name,
    to_addresses: to.join(", "),
    cc_addresses: cc.join(", ") || null,
    subject: data.subject || "(sans objet)",
    body_text: data.text,
    provider_message_id: providerId,
    is_read: true,
  });
  return { ok: true };
}
