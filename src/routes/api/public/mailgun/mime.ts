import { createFileRoute } from "@tanstack/react-router";
import PostalMime from "postal-mime";

async function verifySignature(key: string, timestamp: string, token: string, signature: string) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(timestamp + token)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function addresses(s: string) {
  return (s.match(/[^\s<>,;"]+@[^\s<>,;"]+/g) ?? []).map((a) => a.toLowerCase());
}

export const Route = createFileRoute("/api/public/mailgun/mime")({
  server: {
    handlers: {
      GET: async () => new Response("Nova Mail inbound endpoint OK"),
      POST: async ({ request }) => {
        const signingKey = process.env["MAILGUN_WEBHOOK_SIGNING_KEY"];
        const domain = (process.env["MAILGUN_DOMAIN"] ?? "").toLowerCase();
        if (!signingKey || !domain) return new Response("Not configured", { status: 500 });

        const form = await request.formData();
        const ts = String(form.get("timestamp") ?? "");
        const token = String(form.get("token") ?? "");
        const sig = String(form.get("signature") ?? "");
        if (!ts || !token || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 900)
          return new Response("Invalid signature", { status: 401 });
        if (!(await verifySignature(signingKey, ts, token, sig)))
          return new Response("Invalid signature", { status: 401 });

        const rawMime = form.get("body-mime");
        const raw = typeof rawMime === "string" ? rawMime : null;
        const parsed = raw ? await PostalMime.parse(raw) : null;

        const recipients = addresses(String(form.get("recipient") ?? form.get("To") ?? ""))
          .filter((a) => a.endsWith("@" + domain));
        const locals = [...new Set(recipients.map((a) => a.split("@")[0] ?? ""))];
        if (!locals.length) return new Response("No local recipient", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: boxes } = await supabaseAdmin.from("mailboxes").select("user_id, local_part").in("local_part", locals);
        if (!boxes?.length) return new Response("Unknown recipient", { status: 406 });

        const fromHeader = String(form.get("from") ?? form.get("From") ?? form.get("sender") ?? "");
        const fromAddr = parsed?.from?.address ?? addresses(fromHeader)[0] ?? "";
        const fromName = parsed?.from?.name || fromHeader.replace(/<.*>/, "").replace(/"/g, "").trim() || fromAddr;
        const subject = parsed?.subject ?? String(form.get("subject") ?? "");
        const text = parsed?.text ?? String(form.get("body-plain") ?? form.get("stripped-text") ?? "");
        const html = parsed?.html ?? (form.get("body-html") ? String(form.get("body-html")) : null);
        const to = String(form.get("To") ?? form.get("recipient") ?? "");
        const cc = form.get("Cc") ? String(form.get("Cc")) : null;
        const isPriority = /urgent|important|asap|priorit/i.test(subject) ||
          String(form.get("X-Priority") ?? "").startsWith("1");

        // collect attachments from MIME or multipart fields
        const files: { name: string; type: string; data: Uint8Array }[] = [];
        if (parsed) {
          for (const a of parsed.attachments) {
            const d = typeof a.content === "string" ? new TextEncoder().encode(a.content) : new Uint8Array(a.content as ArrayBuffer);
            files.push({ name: a.filename || "piece-jointe", type: a.mimeType, data: d });
          }
        } else {
          for (const [k, v] of form.entries()) {
            if (k.startsWith("attachment") && v instanceof File)
              files.push({ name: v.name, type: v.type, data: new Uint8Array(await v.arrayBuffer()) });
          }
        }

        for (const box of boxes) {
          const { data: msg, error } = await supabaseAdmin.from("mail_messages").insert({
            user_id: box.user_id,
            folder: "inbox",
            from_address: fromAddr,
            from_name: fromName,
            to_addresses: to,
            cc_addresses: cc,
            subject,
            body_text: text,
            body_html: html,
            raw_mime: raw,
            provider_message_id: parsed?.messageId ?? String(form.get("Message-Id") ?? ""),
            is_priority: isPriority,
          }).select("id").single();
          if (error || !msg) { console.error("insert failed", error); return new Response("DB error", { status: 500 }); }
          for (const f of files) {
            const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
            const path = `${box.user_id}/${msg.id}/${crypto.randomUUID()}-${safe}`;
            const up = await supabaseAdmin.storage.from("mail-attachments").upload(path, f.data, { contentType: f.type || "application/octet-stream" });
            if (up.error) { console.error("upload failed", up.error); continue; }
            await supabaseAdmin.from("mail_attachments").insert({
              message_id: msg.id, user_id: box.user_id, filename: f.name, content_type: f.type, size_bytes: f.data.byteLength, storage_path: path,
            });
          }
        }
        return new Response("OK");
      },
    },
  },
});
