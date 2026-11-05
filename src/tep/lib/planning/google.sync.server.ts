import { encodeRawEmail, ensureTaskList, eventTimes, gapi } from "./google.server";
import { APP_TZ_OFFSET, isoToTzTime } from "./timezone";

type StickyRow = {
  id: string;
  user_id: string;
  day: string;
  kind: "appointment" | "task" | "email" | "smart";
  title: string;
  content: string;
  start_time: string | null;
  duration_min: number | null;
  done: boolean;
  google_id: string | null;
  google_list_id: string | null;
  email_to: string | null;
  email_sent: boolean;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TASKS = "https://tasks.googleapis.com/tasks/v1/lists";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Pousse un post-it vers l'app Google correspondante. Retourne l'id Google. */
export async function pushSticky(userId: string, sticky: StickyRow) {
  const supabase = await db();
  const patch: {
    synced_at: string;
    google_id?: string;
    google_list_id?: string;
  } = { synced_at: new Date().toISOString() };

  if (sticky.kind === "appointment") {
    const body = {
      summary: sticky.title || "(sans titre)",
      description: sticky.content,
      ...eventTimes(sticky.day, sticky.start_time, sticky.duration_min),
    };
    const res = await gapi<{ id: string }>(
      userId,
      sticky.google_id ? `${CAL}/${encodeURIComponent(sticky.google_id)}` : CAL,
      { method: sticky.google_id ? "PATCH" : "POST", body: JSON.stringify(body) },
    );
    patch["google_id"] = res.id;
  } else if (sticky.kind === "task") {
    const listId = sticky.google_list_id ?? (await ensureTaskList(userId));
    const body = {
      title: sticky.title || "(sans titre)",
      notes: sticky.content,
      due: `${sticky.day}T00:00:00.000Z`,
      status: sticky.done ? "completed" : "needsAction",
      ...(sticky.done ? {} : { completed: null }),
    };
    const res = await gapi<{ id: string }>(
      userId,
      sticky.google_id
        ? `${TASKS}/${listId}/tasks/${encodeURIComponent(sticky.google_id)}`
        : `${TASKS}/${listId}/tasks`,
      { method: sticky.google_id ? "PATCH" : "POST", body: JSON.stringify(body) },
    );
    patch["google_id"] = res.id;
    patch["google_list_id"] = listId;
  } else if (sticky.kind === "email") {
    if (sticky.email_sent) return sticky.google_id;
    const raw = encodeRawEmail(sticky.email_to ?? "", sticky.title, sticky.content);
    const body = { message: { raw } };
    const res = await gapi<{ id: string }>(
      userId,
      sticky.google_id ? `${GMAIL}/drafts/${sticky.google_id}` : `${GMAIL}/drafts`,
      { method: sticky.google_id ? "PUT" : "POST", body: JSON.stringify(body) },
    );
    patch["google_id"] = res.id;
  } else {
    return null;
  }

  await supabase.from("tep_stickies").update(patch).eq("id", sticky.id).eq("user_id", userId);
  return patch["google_id"] as string;
}

export async function sendEmailSticky(userId: string, sticky: StickyRow) {
  if (!sticky.email_to) throw new Error("Destinataire manquant");
  const supabase = await db();
  // On reconstruit toujours le message avec le contenu actuel du post-it :
  // un brouillon créé plus tôt pouvait être vide.
  const raw = encodeRawEmail(sticky.email_to, sticky.title, sticky.content);
  if (sticky.google_id) {
    try {
      await gapi(userId, `${GMAIL}/drafts/${sticky.google_id}`, {
        method: "PUT",
        body: JSON.stringify({ id: sticky.google_id, message: { raw } }),
      });
      await gapi(userId, `${GMAIL}/drafts/send`, {
        method: "POST",
        body: JSON.stringify({ id: sticky.google_id }),
      });
    } catch {
      await gapi(userId, `${GMAIL}/messages/send`, {
        method: "POST",
        body: JSON.stringify({ raw }),
      });
    }
  } else {
    await gapi(userId, `${GMAIL}/messages/send`, {
      method: "POST",
      body: JSON.stringify({ raw }),
    });
  }
  await supabase
    .from("tep_stickies")
    .update({ email_sent: true, synced_at: new Date().toISOString() })
    .eq("id", sticky.id)
    .eq("user_id", userId);
}


export async function deleteRemote(userId: string, sticky: StickyRow) {
  if (!sticky.google_id) return;
  try {
    if (sticky.kind === "appointment") {
      await gapi(userId, `${CAL}/${encodeURIComponent(sticky.google_id)}`, { method: "DELETE" });
    } else if (sticky.kind === "task" && sticky.google_list_id) {
      await gapi(
        userId,
        `${TASKS}/${sticky.google_list_id}/tasks/${encodeURIComponent(sticky.google_id)}`,
        { method: "DELETE" },
      );
    } else if (sticky.kind === "email" && !sticky.email_sent) {
      await gapi(userId, `${GMAIL}/drafts/${sticky.google_id}`, { method: "DELETE" });
    }
  } catch (err) {
    console.error("deleteRemote", err);
  }
}

type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

type GTask = {
  id: string;
  title?: string;
  notes?: string;
  status?: string;
  due?: string;
  deleted?: boolean;
};

function hhmm(iso?: string) {
  return isoToTzTime(iso ?? null);
}


/** Importe les événements Agenda et les tâches Google du jour dans le tableau. */
export async function pullDay(userId: string, day: string) {
  const supabase = await db();
  const { data: existing } = await supabase
    .from("tep_stickies")
    .select("*")
    .eq("user_id", userId)
    .eq("day", day);
  const rows = (existing ?? []) as StickyRow[];
  const byGoogleId = new Map(rows.filter((r) => r.google_id).map((r) => [r.google_id!, r]));
  let imported = 0;
  const spot = (i: number) => ({ x: 60 + (i % 4) * 270, y: 60 + Math.floor(i / 4) * 250 });
  let index = rows.length;

  // Google Agenda
  const events = await gapi<{ items?: CalendarEvent[] }>(
    userId,
    `${CAL}?timeMin=${day}T00:00:00${APP_TZ_OFFSET}&timeMax=${day}T23:59:59${APP_TZ_OFFSET}&singleEvents=true&maxResults=50&orderBy=startTime`,
  );
  for (const ev of events.items ?? []) {
    if (ev.status === "cancelled") continue;
    const start = hhmm(ev.start?.dateTime);
    const durMin =
      ev.start?.dateTime && ev.end?.dateTime
        ? Math.round(
            (new Date(ev.end.dateTime).getTime() - new Date(ev.start.dateTime).getTime()) / 60000,
          )
        : null;
    const known = byGoogleId.get(ev.id);
    if (known) {
      await supabase
        .from("tep_stickies")
        .update({
          title: ev.summary ?? known.title,
          content: ev.description ?? known.content,
          start_time: start,
          duration_min: durMin,
          synced_at: new Date().toISOString(),
        })
        .eq("id", known.id);
    } else {
      await supabase.from("tep_stickies").insert({
        user_id: userId,
        day,
        kind: "appointment",
        title: ev.summary ?? "(sans titre)",
        content: ev.description ?? "",
        start_time: start,
        duration_min: durMin,
        google_id: ev.id,
        synced_at: new Date().toISOString(),
        ...spot(index++),
      });
      imported++;
    }
  }

  // Google Tasks
  const listId = await ensureTaskList(userId);
  const tasks = await gapi<{ items?: GTask[] }>(
    userId,
    `${TASKS}/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100&dueMin=${day}T00:00:00.000Z&dueMax=${day}T23:59:59.000Z`,
  );
  for (const t of tasks.items ?? []) {
    if (t.deleted) continue;
    const known = byGoogleId.get(t.id);
    if (known) {
      await supabase
        .from("tep_stickies")
        .update({
          title: t.title ?? known.title,
          content: t.notes ?? known.content,
          done: t.status === "completed",
          synced_at: new Date().toISOString(),
        })
        .eq("id", known.id);
    } else {
      await supabase.from("tep_stickies").insert({
        user_id: userId,
        day,
        kind: "task",
        title: t.title ?? "(sans titre)",
        content: t.notes ?? "",
        done: t.status === "completed",
        google_id: t.id,
        google_list_id: listId,
        synced_at: new Date().toISOString(),
        ...spot(index++),
      });
      imported++;
    }
  }

  // Pousse les post-it locaux jamais synchronisés
  let pushed = 0;
  for (const row of rows) {
    if (row.google_id || row.kind === "smart") continue;
    if (row.kind === "email" && !row.email_to) continue;
    if (!row.title.trim()) continue;
    try {
      await pushSticky(userId, row);
      pushed++;
    } catch (err) {
      console.error("push during pull", err);
    }
  }

  return { imported, pushed };
}
