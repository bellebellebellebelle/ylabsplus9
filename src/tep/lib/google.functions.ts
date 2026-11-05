// Fonctions Google du tableau Post-it : réutilisent la connexion Google
// chiffrée de la Planification (planning_google_connections).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Crée la tâche dans Google Tasks et renvoie son identifiant. */
export const pushGoogleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string; title: string; due?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { gapi, ensureTaskList } = await import("./planning/google.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const listId = await ensureTaskList(context.userId);
    const body: Record<string, string> = { title: data.title || "Nouvelle tâche" };
    if (data.due) body["due"] = new Date(data.due).toISOString();
    const task = await gapi<{ id: string }>(
      context.userId,
      `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`,
      { method: "POST", body: JSON.stringify(body) },
    );
    await supabaseAdmin
      .from("tep_board_items")
      .update({ google_task_id: task.id })
      .eq("id", data.itemId)
      .eq("user_id", context.userId);
    return { googleTaskId: task.id };
  });

/** Enregistre le rendez-vous dans Google Agenda. */
export const pushGoogleEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { itemId: string; title: string; start: string; end?: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const { gapi } = await import("./planning/google.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const start = new Date(data.start);
    const end = data.end ? new Date(data.end) : new Date(start.getTime() + 60 * 60 * 1000);
    const event = await gapi<{ id: string; htmlLink?: string }>(
      context.userId,
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        body: JSON.stringify({
          summary: data.title || "Rendez-vous",
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        }),
      },
    );
    await supabaseAdmin
      .from("tep_board_items")
      .update({ google_event_id: event.id })
      .eq("id", data.itemId)
      .eq("user_id", context.userId);
    return { googleEventId: event.id };
  });

/** Marque la tâche comme terminée dans Google Tasks. */
export const completeGoogleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { googleTaskId: string; done: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { gapi, ensureTaskList } = await import("./planning/google.server");
    const listId = await ensureTaskList(context.userId);
    await gapi(
      context.userId,
      `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${data.googleTaskId}`,
      { method: "PATCH", body: JSON.stringify({ status: data.done ? "completed" : "needsAction" }) },
    );
    return { ok: true };
  });
