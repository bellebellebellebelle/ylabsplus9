import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const originInput = z.object({ origin: z.string().url().max(300) });
const stickyInput = z.object({ stickyId: z.string().uuid() });
const dayInput = z.object({ day: z.string().min(8).max(10) });

export const googleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnection } = await import("./google.server");
    const conn = await getConnection(context.userId);
    return {
      connected: !!conn,
      email: conn?.google_email ?? null,
      scopes: conn?.scopes ?? "",
    };
  });

export const googleAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => originInput.parse(d))
  .handler(async ({ data, context }) => {
    const { buildAuthUrl } = await import("./google.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const redirectUri = `${data.origin.replace(/\/$/, "")}/api/public/planning-google/callback`;
    const { error } = await supabaseAdmin
      .from("tep_planning_google_oauth_states")
      .insert({ state, user_id: context.userId, redirect_uri: redirectUri });
    if (error) throw error;
    return { url: buildAuthUrl(state, redirectUri), redirectUri };
  });

export const googleDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("tep_planning_google_connections").delete().eq("user_id", context.userId);
    return { ok: true };
  });

async function loadSticky(userId: string, id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tep_stickies")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Post-it introuvable");
  return data as never;
}

export const googlePushSticky = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => stickyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { getConnection } = await import("./google.server");
    if (!(await getConnection(context.userId))) return { skipped: true, googleId: null };
    const { pushSticky } = await import("./google.sync.server");
    const sticky = await loadSticky(context.userId, data.stickyId);
    const googleId = await pushSticky(context.userId, sticky);
    return { skipped: false, googleId };
  });

export const googleSendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => stickyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { sendEmailSticky } = await import("./google.sync.server");
    const sticky = await loadSticky(context.userId, data.stickyId);
    await sendEmailSticky(context.userId, sticky);
    return { ok: true };
  });

export const googleDeleteRemote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => stickyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { getConnection } = await import("./google.server");
    if (!(await getConnection(context.userId))) return { ok: true };
    const { deleteRemote } = await import("./google.sync.server");
    const sticky = await loadSticky(context.userId, data.stickyId);
    await deleteRemote(context.userId, sticky);
    return { ok: true };
  });

export const googleSyncDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dayInput.parse(d))
  .handler(async ({ data, context }) => {
    const { getConnection } = await import("./google.server");
    if (!(await getConnection(context.userId))) {
      return { connected: false, imported: 0, pushed: 0 };
    }
    const { pullDay } = await import("./google.sync.server");
    const res = await pullDay(context.userId, data.day);
    return { connected: true, ...res };
  });
