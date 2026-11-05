import { z } from "zod";
import type { Action } from "./assistant-apps.server";
import { toDocHtml } from "./markdown-to-html";

/* Aura actions for the native SKY suite, Sendy mail and the Planification boards.
 * Each action returns `open` so the matching page is shown to the user. */
const like = (s: string) => `%${s.replace(/[%_,()]/g, " ").trim()}%`;
const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const ok = <T extends object>(data: T, open: string) => ({ ...data, open });

async function findByTitle(db: Parameters<Action["run"]>[0]["db"], table: string, col: string, q: string, cols: string) {
  const { data, error } = await db.from(table).select(cols).ilike(col, like(q)).limit(5);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Record<string, string>[];
  if (!rows.length) throw new Error(`Aucun élément « ${q} » trouvé.`);
  const exact = rows.find((r) => r[col]?.toLowerCase() === q.toLowerCase());
  if (!exact && rows.length > 1) throw new Error(`Plusieurs correspondances : ${rows.map((r) => r[col]).join(", ")}. Précise.`);
  return exact ?? rows[0]!;
}

export const skyActions: Record<string, Record<string, Action>> = {
  sendy: {
    envoyer_email_sendy: {
      description: "Envoyer réellement un e-mail depuis l'adresse Sendy de l'utilisateur. to (virgules si plusieurs), subject, text, cc facultatif.",
      input: z.object({ to: z.string(), subject: z.string(), text: z.string(), cc: z.string().optional() }),
      run: async ({ db, userId }, i) => {
        const { sendSendyMail } = await import("./sendy.server");
        const r = await sendSendyMail(db, userId, i);
        if (!r.ok) return { error: r.error, open: "/mail" };
        return ok({ envoye: true, to: i.to }, "/mail");
      },
    },
    lister_emails: {
      description: "Lister/rechercher les e-mails Sendy. folder = inbox | sent | ... (facultatif), recherche = texte facultatif, non_lus = true pour les non lus.",
      input: z.object({ folder: z.string().optional(), recherche: z.string().optional(), non_lus: z.boolean().optional() }),
      run: async ({ db }, i) => {
        let q = db.from("mail_messages").select("id,folder,from_address,from_name,to_addresses,subject,is_read,created_at").order("created_at", { ascending: false }).limit(20);
        if (i.folder) q = q.eq("folder", i.folder);
        if (i.non_lus) q = q.eq("is_read", false);
        if (i.recherche) { const s = like(i.recherche); q = q.or(`subject.ilike.${s},from_address.ilike.${s},body_text.ilike.${s}`); }
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return ok({ emails: data }, "/mail");
      },
    },
    lire_email: {
      description: "Lire le contenu complet d'un e-mail Sendy par id.",
      input: z.object({ id: z.string() }),
      run: async ({ db }, i) => {
        const { data, error } = await db.from("mail_messages").select("from_address,from_name,to_addresses,subject,body_text,body_html,created_at").eq("id", i.id).maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return { error: "E-mail introuvable" };
        return ok({ ...data, body_text: (data.body_text || strip(data.body_html || "")).slice(0, 4000), body_html: undefined }, "/mail");
      },
    },
  },
  skytask: {
    lister_taches: {
      description: "Lister les tâches SKY TASK. statut = todo | done (facultatif), recherche facultative.",
      input: z.object({ statut: z.string().optional(), recherche: z.string().optional() }),
      run: async ({ db }, i) => {
        let q = db.from("tasks").select("id,title,description,status,priority,due_at").order("due_at", { ascending: true, nullsFirst: false }).limit(40);
        if (i.statut) q = i.statut === "done" ? q.eq("status", "done") : q.neq("status", "done");
        if (i.recherche) { const s = like(i.recherche); q = q.or(`title.ilike.${s},description.ilike.${s}`); }
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return ok({ taches: data }, "/tasks");
      },
    },
    creer_tache: {
      description: "Créer une tâche SKY TASK. priority = low | medium | high, due_at ISO 8601 avec fuseau (facultatif).",
      input: z.object({ title: z.string(), description: z.string().optional(), priority: z.enum(["low", "medium", "high"]).optional(), due_at: z.string().optional() }),
      run: async ({ db, userId }, i) => {
        const { data, error } = await db.from("tasks").insert({ user_id: userId, title: i.title.slice(0, 200), description: i.description ?? null, priority: i.priority ?? "medium", due_at: i.due_at ?? null }).select("id,title,due_at").single();
        if (error) throw new Error(error.message);
        return ok(data, "/tasks");
      },
    },
    terminer_tache: {
      description: "Marquer une tâche SKY TASK comme terminée (titre exact ou partiel).",
      input: z.object({ title: z.string() }),
      run: async ({ db }, i) => {
        const row = await findByTitle(db, "tasks", "title", i.title, "id,title");
        const { error } = await db.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", row.id);
        if (error) throw new Error(error.message);
        return ok({ terminee: row.title }, "/tasks");
      },
    },
    creer_note: {
      description: "Créer une note SKY TASK.",
      input: z.object({ title: z.string(), content: z.string() }),
      run: async ({ db, userId }, i) => {
        const { data, error } = await db.from("notes").insert({ user_id: userId, title: i.title.slice(0, 200), content: i.content }).select("id,title").single();
        if (error) throw new Error(error.message);
        return ok(data, "/tasks");
      },
    },
  },
  calendsky: {
    lire_planning: {
      description: "Lire les rendez-vous CALENDSKY entre from et to (ISO 8601, facultatifs : par défaut les 7 prochains jours).",
      input: z.object({ from: z.string().optional(), to: z.string().optional() }),
      run: async ({ db }, i) => {
        const from = i.from ?? new Date().toISOString();
        const to = i.to ?? new Date(Date.now() + 7 * 864e5).toISOString();
        const { data, error } = await db.from("appointments").select("id,title,start_at,end_at,client,location,status,notes").gte("start_at", from).lte("start_at", to).order("start_at").limit(50);
        if (error) throw new Error(error.message);
        return ok({ rendez_vous: data }, "/calendsky/planning");
      },
    },
    creer_rdv: {
      description: "Créer un rendez-vous CALENDSKY. start_at et end_at en ISO 8601 avec fuseau.",
      input: z.object({ title: z.string(), start_at: z.string(), end_at: z.string(), client: z.string().optional(), location: z.string().optional(), notes: z.string().optional() }),
      run: async ({ db, userId }, i) => {
        const { data, error } = await db.from("appointments").insert({ user_id: userId, title: i.title.slice(0, 200), start_at: i.start_at, end_at: i.end_at, client: i.client ?? null, location: i.location ?? null, notes: i.notes ?? null }).select("id,title,start_at").single();
        if (error) throw new Error(error.message);
        return ok(data, "/calendsky/planning");
      },
    },
    annuler_rdv: {
      description: "Annuler un rendez-vous CALENDSKY (par titre).",
      input: z.object({ title: z.string() }),
      run: async ({ db }, i) => {
        const row = await findByTitle(db, "appointments", "title", i.title, "id,title");
        const { error } = await db.from("appointments").update({ status: "annule" }).eq("id", row.id);
        if (error) throw new Error(error.message);
        return ok({ annule: row.title }, "/calendsky/planning");
      },
    },
  },
  skydoc: {
    lister_documents: {
      description: "Lister/rechercher les documents SKYDOC (recherche facultative).",
      input: z.object({ recherche: z.string().optional() }),
      run: async ({ db }, i) => {
        let q = db.from("documents").select("id,title,status,updated_at").order("updated_at", { ascending: false }).limit(30);
        if (i.recherche) { const s = like(i.recherche); q = q.or(`title.ilike.${s},content.ilike.${s}`); }
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return ok({ documents: data }, "/skydoc/dashboard");
      },
    },
    lire_document: {
      description: "Lire le contenu d'un document SKYDOC (par titre).",
      input: z.object({ title: z.string() }),
      run: async ({ db }, i) => {
        const row = await findByTitle(db, "documents", "title", i.title, "id,title,content");
        return ok({ title: row.title, contenu: strip(row.content || "").slice(0, 5000) }, `/skydoc/doc/${row.id}`);
      },
    },
    creer_document: {
      description: "Créer un document SKYDOC mis en page. content = HTML sémantique (h1, h2, h3, p, ul/ol, <table class=\"doc-table\">) ou Markdown (converti automatiquement). Blocs disponibles : <header class=\"doc-hero\"><h1>…</h1><p class=\"doc-sub\">…</p></header>, <div class=\"doc-grid\"> (colonnes) contenant <section class=\"doc-card\"><h2>…</h2><p>…</p></section> (ajoute doc-accent pour mettre en avant), <div class=\"doc-stats\"><div class=\"doc-stat\"><strong>42%</strong><span>Libellé</span></div></div>, <ul class=\"doc-checks\">, <ol class=\"doc-steps\"><li><b>Étape</b><small>Mois 1</small></li></ol>, <div class=\"doc-kpis\"><div class=\"doc-kpi\"><small>…</small><strong>…</strong><span>…</span></div></div>, <blockquote class=\"doc-callout\">, <mark>. Respecte la mise en page demandée par l'utilisateur.",
      input: z.object({ title: z.string(), content: z.string() }),
      run: async ({ db, userId }, i) => {
        const { data, error } = await db.from("documents").insert({ user_id: userId, title: i.title.slice(0, 200), content: toDocHtml(i.content) }).select("id,title").single();
        if (error) throw new Error(error.message);
        return ok(data, `/skydoc/doc/${data.id}`);
      },
    },
    completer_document: {
      description: "Ajouter du contenu à la fin d'un document SKYDOC existant (par titre).",
      input: z.object({ title: z.string(), content: z.string() }),
      run: async ({ db }, i) => {
        const row = await findByTitle(db, "documents", "title", i.title, "id,title,content");
        const { error } = await db.from("documents").update({ content: `${toDocHtml(row.content || "")}${toDocHtml(i.content).startsWith("<") ? toDocHtml(i.content) : `<p>${i.content}</p>`}`, updated_at: new Date().toISOString() }).eq("id", row.id);
        if (error) throw new Error(error.message);
        return ok({ complete: row.title }, `/skydoc/doc/${row.id}`);
      },
    },
  },
  skytab: {
    lire_tableur: {
      description: "Lire les données d'un tableur SKYTAB (par nom).",
      input: z.object({ name: z.string() }),
      run: async ({ db }, i) => {
        const row = await findByTitle(db, "projects", "name", i.name, "id,name,data_text");
        return ok({ name: row.name, donnees: (row.data_text || "").slice(0, 5000) }, `/skytab/projet/${row.id}`);
      },
    },
    lister_tableurs: {
      description: "Lister les tableurs SKYTAB.",
      input: z.object({}),
      run: async ({ db }) => {
        const { data, error } = await db.from("projects").select("id,name,updated_at").order("updated_at", { ascending: false }).limit(30);
        if (error) throw new Error(error.message);
        return ok({ tableurs: data }, "/skytab/dashboard");
      },
    },
    creer_tableur: {
      description: "Créer un tableur SKYTAB à partir de données CSV (avec en-têtes).",
      input: z.object({ name: z.string(), csv: z.string() }),
      run: async ({ db, userId }, i) => {
        const { data, error } = await db.from("projects").insert({ user_id: userId, name: i.name.slice(0, 200), data_text: i.csv }).select("id,name").single();
        if (error) throw new Error(error.message);
        return ok(data, `/skytab/projet/${data.id}`);
      },
    },
  },
  skycloud: {
    nouveaux_fichiers: {
      description: "Lister les fichiers SKY CLOUD récents d'un dossier (nom), filtrés par type (ex: 'audio', 'pdf', 'image') et ancienneté. Idéal pour détecter les nouveaux fichiers dans une automatisation.",
      input: z.object({ dossier: z.string().optional(), type: z.string().optional(), depuis_minutes: z.number().optional() }),
      run: async ({ db }, i) => {
        let q = db.from("files").select("id,name,mime_type,size,created_at,folder_id").is("deleted_at", null).order("created_at", { ascending: false }).limit(50);
        if (i.dossier) {
          const { data: dirs, error } = await db.from("folders").select("id,name").ilike("name", like(i.dossier)).limit(5);
          if (error) throw new Error(error.message);
          if (!dirs?.length) throw new Error(`Dossier « ${i.dossier} » introuvable dans SKY CLOUD.`);
          q = q.in("folder_id", dirs.map((d: { id: string }) => d.id));
        }
        if (i.type) q = q.ilike("mime_type", like(i.type));
        if (i.depuis_minutes) q = q.gte("created_at", new Date(Date.now() - i.depuis_minutes * 60_000).toISOString());
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return ok({ fichiers: data }, "/sky/cloud");
      },
    },
    chercher_fichiers: {
      description: "Lister/rechercher les fichiers et dossiers SKY CLOUD (recherche facultative).",
      input: z.object({ recherche: z.string().optional() }),
      run: async ({ db }, i) => {
        let f = db.from("files").select("id,name,size,created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(30);
        let d = db.from("folders").select("id,name").limit(30);
        if (i.recherche) { f = f.ilike("name", like(i.recherche)); d = d.ilike("name", like(i.recherche)); }
        const [files, folders] = await Promise.all([f, d]);
        if (files.error || folders.error) throw new Error("Lecture SKY CLOUD impossible.");
        return ok({ fichiers: files.data, dossiers: folders.data }, "/sky/cloud");
      },
    },
    creer_dossier: {
      description: "Créer un dossier SKY CLOUD.",
      input: z.object({ name: z.string() }),
      run: async ({ db, userId }, i) => {
        const { data, error } = await db.from("folders").insert({ user_id: userId, name: i.name.slice(0, 120) }).select("id,name").single();
        if (error) throw new Error(error.message);
        return ok(data, "/sky/cloud");
      },
    },
  },
  planification: {
    consulter_postits: {
      description: "Lire les post-it du tableau d'un jour (day = AAAA-MM-JJ, défaut aujourd'hui).",
      input: z.object({ day: z.string().optional() }),
      run: async ({ db }, i) => {
        const day = i.day ?? new Date().toISOString().slice(0, 10);
        const { data, error } = await db.from("tep_stickies").select("id,kind,title,content,start_time,duration_min,done,email_to,email_sent").eq("day", day).order("created_at");
        if (error) throw new Error(error.message);
        return ok({ day, postits: data }, `/planification/jour/${day}`);
      },
    },
    creer_postit: {
      description: "Poser un post-it sur le tableau d'un jour. kind = task | appointment | email | smart ; day AAAA-MM-JJ ; start_time HH:MM facultatif ; email_to pour un e-mail.",
      input: z.object({ day: z.string(), kind: z.enum(["task", "appointment", "email", "smart"]), title: z.string(), content: z.string().optional(), start_time: z.string().optional(), duration_min: z.number().optional(), email_to: z.string().optional() }),
      run: async ({ db, userId }, i) => {
        const { count } = await db.from("tep_stickies").select("id", { count: "exact", head: true }).eq("day", i.day);
        const n = count ?? 0;
        const { data, error } = await db.from("tep_stickies").insert({
          user_id: userId, day: i.day, kind: i.kind, title: i.title.slice(0, 200), content: i.content ?? "",
          start_time: i.start_time ?? null, duration_min: i.duration_min ?? null, email_to: i.email_to ?? null,
          x: 60 + (n % 4) * 270, y: 60 + Math.floor(n / 4) * 250,
        }).select("id,title,kind").single();
        if (error) throw new Error(error.message);
        return ok(data, `/planification/jour/${i.day}`);
      },
    },
  },
};
