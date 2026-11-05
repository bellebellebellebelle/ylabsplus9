import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** TEP boards sync with native SKY apps: SKY Task (tasks), Calendsky (appointments), Sendy (mail). */

const OFFSET = "+04:00"; // Indian/Reunion, no DST

export const skyPushTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid().nullable().optional(), title: z.string().max(500), due: z.string().nullable().optional(), done: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      title: data.title.trim().slice(0, 500) || "(sans titre)",
      due_at: data.due || null,
      ...(data.done !== undefined ? { status: data.done ? "done" : "todo", completed_at: data.done ? new Date().toISOString() : null } : {}),
    };
    if (data.id) {
      const { data: up } = await context.supabase.from("tasks").update(row).eq("id", data.id).select("id").maybeSingle();
      if (up) return { id: up.id as string };
    }
    const { data: ins, error } = await context.supabase.from("tasks").insert({ ...row, user_id: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const skyPushEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid().nullable().optional(), title: z.string().max(500), start: z.string(), end: z.string().nullable().optional(), notes: z.string().max(5000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const start = new Date(data.start);
    const end = data.end ? new Date(data.end) : new Date(start.getTime() + 3600_000);
    const row = { title: data.title.trim().slice(0, 500) || "(sans titre)", start_at: start.toISOString(), end_at: end.toISOString(), notes: data.notes ?? null };
    if (data.id) {
      const { data: up } = await context.supabase.from("appointments").update(row).eq("id", data.id).select("id").maybeSingle();
      if (up) return { id: up.id as string };
    }
    const { data: ins, error } = await context.supabase.from("appointments").insert({ ...row, user_id: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

/** Push a planning sticky to SKY Task or Calendsky and store the link id. */
export const skyPushSticky = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ stickyId: z.string().uuid(), tzOffsetMin: z.number().int().min(-900).max(900).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: s, error } = await db.from("tep_stickies").select("*").eq("id", data.stickyId).single();
    if (error || !s) throw new Error("Post-it introuvable");
    if (s.kind !== "task" && s.kind !== "appointment") return { id: null };
    const title = (s.title || "").trim() || "(sans titre)";
    const time = s.start_time ? String(s.start_time).slice(0, 5) : "09:00";
    // Heure murale de l'utilisateur : 10:00 sur le post-it = 10:00 dans son calendrier.
    const start = data.tzOffsetMin === undefined
      ? new Date(`${s.day}T${time}:00${OFFSET}`)
      : new Date(new Date(`${s.day}T${time}:00Z`).getTime() + data.tzOffsetMin * 60_000);
    let id: string | null = s.google_id;
    if (s.kind === "task") {
      const row = { title, description: s.content || null, due_at: start.toISOString(), status: s.done ? "done" : "todo", completed_at: s.done ? new Date().toISOString() : null };
      const up = id ? (await db.from("tasks").update(row).eq("id", id).select("id").maybeSingle()).data : null;
      id = up?.id ?? (await db.from("tasks").insert({ ...row, user_id: context.userId }).select("id").single()).data?.id ?? null;
    } else {
      const end = new Date(start.getTime() + (s.duration_min || 60) * 60_000);
      const row = { title, notes: s.content || null, start_at: start.toISOString(), end_at: end.toISOString(), status: s.done ? "termine" : "prevu" };
      const up = id ? (await db.from("appointments").update(row).eq("id", id).select("id").maybeSingle()).data : null;
      id = up?.id ?? (await db.from("appointments").insert({ ...row, user_id: context.userId }).select("id").single()).data?.id ?? null;
    }
    if (!id) throw new Error("Synchronisation SKY impossible");
    await db.from("tep_stickies").update({ google_id: id, synced_at: new Date().toISOString() }).eq("id", s.id);
    return { id };
  });

export const skyDeleteSticky = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ stickyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.from("tep_stickies").select("kind,google_id").eq("id", data.stickyId).maybeSingle();
    if (s?.google_id) {
      const table = s.kind === "task" ? "tasks" : s.kind === "appointment" ? "appointments" : null;
      if (table) await context.supabase.from(table).delete().eq("id", s.google_id);
    }
    return { ok: true };
  });

export const skySendStickyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ stickyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.from("tep_stickies").select("*").eq("id", data.stickyId).single();
    if (!s) throw new Error("Post-it introuvable");
    if (!s.email_to) throw new Error("Indiquez un destinataire.");
    const { sendSendyMail } = await import("@/lib/sendy.server");
    const r = await sendSendyMail(context.supabase, context.userId, { to: s.email_to, subject: s.title || "(sans objet)", text: s.content || "" });
    if (!r.ok) throw new Error(r.error);
    await context.supabase.from("tep_stickies").update({ email_sent: true, synced_at: new Date().toISOString() }).eq("id", s.id);
    return { ok: true };
  });
