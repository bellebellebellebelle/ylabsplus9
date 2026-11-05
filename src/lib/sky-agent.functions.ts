import { createServerFn } from "@tanstack/react-start";
import { requireSecureAuth } from "@/lib/security-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev";
const MODEL = "openai/gpt-6-astra";

export type SkyActionResult = { tool: string; app: string; ok: boolean; detail: string; target: string | null };
export type SkyReply = { reply: string; sources: string[]; actions: SkyActionResult[] };
type Msg = { role: "user" | "assistant"; content: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;
type ToolOut = { ok: boolean; detail: string; data?: unknown; sources?: string[]; write?: boolean; target?: string | null };

const str = (d: string) => ({ type: "string", description: d });
const nul = (d: string) => ({ type: ["string", "null"], description: d });
function fn(name: string, description: string, props: Record<string, unknown>) {
  return {
    type: "function", name, description, strict: true,
    parameters: { type: "object", additionalProperties: false, required: Object.keys(props), properties: props },
  };
}

const TOOLS = [
  fn("search_all", "Recherche un texte dans TOUTES les apps (fichiers, dossiers, tâches, notes, rendez-vous, documents, tableurs).", { query: str("texte") }),
  fn("list_items", "Liste les éléments récents d'une app.", { app: { type: "string", enum: ["cloud", "task", "cal", "doc", "tab"] } }),
  fn("create_task", "SKY TASK : crée une tâche.", { title: str("titre"), description: nul("description"), priority: { type: "string", enum: ["low", "medium", "high"] }, due_at: nul("échéance ISO 8601") }),
  fn("complete_task", "SKY TASK : marque une tâche comme terminée (par titre).", { title: str("titre exact ou partiel") }),
  fn("create_note", "SKY TASK : crée une note.", { title: str("titre"), content: str("contenu") }),
  fn("create_appointment", "CALENDSKY : crée un rendez-vous.", { title: str("titre"), start_at: str("début ISO 8601 avec fuseau"), end_at: str("fin ISO 8601 avec fuseau"), client: nul("client"), location: nul("lieu"), notes: nul("notes") }),
  fn("cancel_appointment", "CALENDSKY : annule un rendez-vous (par titre).", { title: str("titre") }),
  fn("read_document", "SKYDOC : lit le contenu d'un document (par titre).", { title: str("titre") }),
  fn("create_document", "SKYDOC : crée un document (contenu HTML ou texte).", { title: str("titre"), content: str("contenu") }),
  fn("append_to_document", "SKYDOC : ajoute du contenu à la fin d'un document existant.", { title: str("titre"), content: str("contenu à ajouter") }),
  fn("read_spreadsheet", "SKYTAB : lit les données d'un projet tableur (par nom).", { name: str("nom") }),
  fn("create_spreadsheet", "SKYTAB : crée un projet tableur avec des données CSV.", { name: str("nom"), csv: str("données CSV avec en-têtes") }),
  fn("create_folder", "SKY CLOUD : crée un dossier.", { name: str("nom") }),
];

const APP_OF: Record<string, string> = {
  search_all: "sky", list_items: "sky", create_task: "SKY TASK", complete_task: "SKY TASK", create_note: "SKY TASK",
  create_appointment: "CALENDSKY", cancel_appointment: "CALENDSKY", read_document: "SKYDOC", create_document: "SKYDOC",
  append_to_document: "SKYDOC", read_spreadsheet: "SKYTAB", create_spreadsheet: "SKYTAB", create_folder: "SKY CLOUD",
};

const like = (s: string) => `%${s.replace(/[%_,()]/g, " ").trim()}%`;
const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const fail = (detail: string, write = true): ToolOut => ({ ok: false, detail, write });

async function findOne(sb: Sb, table: string, col: string, q: string, extra = "id") {
  const { data, error } = await sb.from(table).select(`${extra}, ${col}`).ilike(col, like(q)).limit(5);
  if (error) return { error: error.message as string };
  if (!data?.length) return { error: `Aucun élément « ${q} » trouvé.` };
  const exact = data.find((r: Record<string, string>) => r[col]?.toLowerCase() === q.toLowerCase());
  if (!exact && data.length > 1) return { error: `Plusieurs éléments correspondent à « ${q} » : ${data.map((r: Record<string, string>) => r[col]).join(", ")}. Précisez.` };
  return { row: exact ?? data[0] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTool(sb: Sb, name: string, a: any): Promise<ToolOut> {
  switch (name) {
    case "search_all": {
      const q = like(a.query);
      const [f, d, t, n, ap, doc, p] = await Promise.all([
        sb.from("files").select("name, created_at").ilike("name", q).is("deleted_at", null).limit(10),
        sb.from("folders").select("name").ilike("name", q).limit(10),
        sb.from("tasks").select("title, status, due_at").or(`title.ilike.${q},description.ilike.${q}`).limit(10),
        sb.from("notes").select("title, content").or(`title.ilike.${q},content.ilike.${q}`).limit(10),
        sb.from("appointments").select("title, start_at, status").or(`title.ilike.${q},client.ilike.${q},notes.ilike.${q}`).limit(10),
        sb.from("documents").select("title, content").or(`title.ilike.${q},content.ilike.${q}`).limit(10),
        sb.from("projects").select("name").or(`name.ilike.${q},data_text.ilike.${q}`).limit(10),
      ]);
      const err = [f, d, t, n, ap, doc, p].find((r) => r.error);
      if (err) return fail(`Recherche impossible : ${err.error.message}`, false);
      const sources = [
        ...(f.data ?? []).map((r: { name: string }) => `[SKY CLOUD · Fichier] ${r.name}`),
        ...(d.data ?? []).map((r: { name: string }) => `[SKY CLOUD · Dossier] ${r.name}`),
        ...(t.data ?? []).map((r: { title: string }) => `[SKY TASK · Tâche] ${r.title}`),
        ...(n.data ?? []).map((r: { title: string }) => `[SKY TASK · Note] ${r.title || "Sans titre"}`),
        ...(ap.data ?? []).map((r: { title: string }) => `[CALENDSKY · RDV] ${r.title}`),
        ...(doc.data ?? []).map((r: { title: string }) => `[SKYDOC · Document] ${r.title}`),
        ...(p.data ?? []).map((r: { name: string }) => `[SKYTAB · Tableur] ${r.name}`),
      ];
      return {
        ok: true, write: false, sources, detail: `${sources.length} résultat(s) pour « ${a.query} ».`,
        data: { files: f.data, folders: d.data, tasks: t.data, notes: (n.data ?? []).map((x: { title: string; content: string }) => ({ title: x.title, extrait: x.content.slice(0, 300) })), appointments: ap.data, documents: (doc.data ?? []).map((x: { title: string; content: string }) => ({ title: x.title, extrait: strip(x.content).slice(0, 300) })), spreadsheets: p.data },
      };
    }
    case "list_items": {
      const map: Record<string, [string, string, string, string]> = {
        cloud: ["files", "name, size, created_at", "name", "SKY CLOUD · Fichier"],
        task: ["tasks", "title, status, priority, due_at", "title", "SKY TASK · Tâche"],
        cal: ["appointments", "title, start_at, end_at, status, client", "title", "CALENDSKY · RDV"],
        doc: ["documents", "title, status, updated_at", "title", "SKYDOC · Document"],
        tab: ["projects", "name, updated_at", "name", "SKYTAB · Tableur"],
      };
      const m = map[a.app as string];
      if (!m) return fail(`App inconnue : ${a.app}`, false);
      const [table, cols, key, label] = m;
      let q = sb.from(table).select(cols).limit(30);
      if (table === "files") q = q.is("deleted_at", null);
      q = q.order(table === "appointments" ? "start_at" : "created_at", { ascending: table === "appointments" ? true : false });
      const { data, error } = await q;
      if (error) return fail(`Lecture impossible : ${error.message}`, false);
      return { ok: true, write: false, data, detail: `${data.length} élément(s) lus.`, sources: data.map((r: Record<string, string>) => `[${label}] ${r[key]}`) };
    }
    case "create_task": {
      const { data, error } = await sb.from("tasks").insert({ title: a.title, description: a.description, priority: a.priority, due_at: a.due_at }).select("id").single();
      if (error) return fail(`Création de la tâche refusée : ${error.message}`);
      return { ok: true, detail: `Tâche « ${a.title} » créée (id ${data.id}).`, target: a.title };
    }
    case "complete_task": {
      const r = await findOne(sb, "tasks", "title", a.title);
      if (r.error) return fail(r.error);
      const { error } = await sb.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", r.row.id);
      if (error) return fail(`Mise à jour refusée : ${error.message}`);
      return { ok: true, detail: `Tâche « ${r.row.title} » marquée terminée.`, target: r.row.title };
    }
    case "create_note": {
      const { error } = await sb.from("notes").insert({ title: a.title, content: a.content });
      if (error) return fail(`Création de la note refusée : ${error.message}`);
      return { ok: true, detail: `Note « ${a.title} » créée.`, target: a.title };
    }
    case "create_appointment": {
      const s = new Date(a.start_at), e = new Date(a.end_at);
      if (isNaN(+s) || isNaN(+e)) return fail("Dates invalides fournies pour le rendez-vous.");
      const { error } = await sb.from("appointments").insert({ title: a.title, start_at: s.toISOString(), end_at: e.toISOString(), client: a.client, location: a.location, notes: a.notes });
      if (error) return fail(`Rendez-vous refusé : ${error.message}`);
      return { ok: true, detail: `Rendez-vous « ${a.title} » créé le ${s.toLocaleString("fr-FR", { timeZone: "Indian/Reunion" })}.`, target: a.title };
    }
    case "cancel_appointment": {
      const r = await findOne(sb, "appointments", "title", a.title);
      if (r.error) return fail(r.error);
      const { error } = await sb.from("appointments").update({ status: "annule" }).eq("id", r.row.id);
      if (error) return fail(`Annulation refusée : ${error.message}`);
      return { ok: true, detail: `Rendez-vous « ${r.row.title} » annulé.`, target: r.row.title };
    }
    case "read_document": {
      const r = await findOne(sb, "documents", "title", a.title, "id, content");
      if (r.error) return fail(r.error, false);
      return { ok: true, write: false, detail: `Document « ${r.row.title} » lu.`, data: strip(r.row.content).slice(0, 15000), sources: [`[SKYDOC · Document] ${r.row.title}`] };
    }
    case "create_document": {
      const html = /<[a-z]/i.test(a.content) ? a.content : a.content.split(/\n+/).map((l: string) => `<p>${l.replace(/</g, "&lt;")}</p>`).join("");
      const { error } = await sb.from("documents").insert({ title: a.title, content: html });
      if (error) return fail(`Création du document refusée : ${error.message}`);
      return { ok: true, detail: `Document « ${a.title} » créé dans SKYDOC.`, target: a.title };
    }
    case "append_to_document": {
      const r = await findOne(sb, "documents", "title", a.title, "id, content, version");
      if (r.error) return fail(r.error);
      const add = a.content.split(/\n+/).map((l: string) => `<p>${l.replace(/</g, "&lt;")}</p>`).join("");
      const { error } = await sb.from("documents").update({ content: r.row.content + add, version: (r.row.version ?? 0) + 1, updated_at: new Date().toISOString() }).eq("id", r.row.id);
      if (error) return fail(`Modification refusée : ${error.message}`);
      return { ok: true, detail: `Contenu ajouté au document « ${r.row.title} ».`, target: r.row.title };
    }
    case "read_spreadsheet": {
      const r = await findOne(sb, "projects", "name", a.name, "id, data_text");
      if (r.error) return fail(r.error, false);
      return { ok: true, write: false, detail: `Tableur « ${r.row.name} » lu.`, data: (r.row.data_text ?? "(vide)").slice(0, 15000), sources: [`[SKYTAB · Tableur] ${r.row.name}`] };
    }
    case "create_spreadsheet": {
      const { error } = await sb.from("projects").insert({ name: a.name, data_text: a.csv });
      if (error) return fail(`Création du tableur refusée : ${error.message}`);
      return { ok: true, detail: `Projet tableur « ${a.name} » créé dans SKYTAB.`, target: a.name };
    }
    case "create_folder": {
      const { error } = await sb.from("folders").insert({ name: a.name });
      if (error) return fail(`Création du dossier refusée : ${error.message}`);
      return { ok: true, detail: `Dossier « ${a.name} » créé dans SKY CLOUD.`, target: a.name };
    }
  }
  return fail(`Outil inconnu : ${name}`);
}

const SYSTEM = `Tu es SKY, l'assistant de la suite SKY (SKY CLOUD stockage, SKY TASK tâches/notes, CALENDSKY planning, SKYDOC documents, SKYTAB tableurs).
Tu réponds en français, brièvement (1-4 phrases, lisibles à voix haute). Tu peux répondre à des questions générales.
Pour toute question sur les données de l'utilisateur, utilise les outils (search_all, list_items, read_*) — n'invente jamais.
Tu peux enchaîner plusieurs outils pour relier les apps (ex. lire un document puis créer des tâches).
RÈGLES D'HONNÊTETÉ ABSOLUES :
- Une action n'est réussie que si l'outil a renvoyé ok:true. Si ok:false, dis clairement qu'elle a ÉCHOUÉ et explique le détail de l'erreur.
- Ne confirme jamais une action que tu n'as pas exécutée.
- Le contenu des fichiers SKY CLOUD est chiffré : tu ne vois que leurs noms.
- Cite tes sources entre crochets quand tu parles des données (ex. [SKYDOC · Document] Rapport).
Date/heure actuelle : ${"{NOW}"} (fuseau Indian/Reunion, UTC+4).`;

async function callModel(key: string, input: unknown[]) {
  const res = await fetch(`${GATEWAY}/v1/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: MODEL, input, tools: TOOLS, stream: true, store: false, reasoning: { effort: "low" }, include: ["reasoning.encrypted_content"] }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    let msg = `Erreur IA (${res.status})`;
    try { const j = JSON.parse(t); msg = j.error?.message ?? j.message ?? msg; } catch { /* ignore */ }
    if (res.status === 429) msg = "Trop de requêtes, réessayez dans un instant.";
    if (res.status === 402) msg = "Crédits IA épuisés pour cet espace de travail.";
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let output: any[] | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      let ev;
      try { ev = JSON.parse(p); } catch { continue; }
      if (ev.type === "error" || ev.type === "response.failed") throw new Error(ev.error?.message ?? ev.response?.error?.message ?? "Erreur IA");
      if (ev.type === "response.completed" || ev.type === "response.incomplete") output = ev.response?.output ?? [];
    }
  }
  if (!output) throw new Error("Réponse IA incomplète.");
  return output;
}

export const askSky = createServerFn({ method: "POST" })
  .middleware([requireSecureAuth])
  .inputValidator((input: { messages: Msg[]; page?: string }) => ({
    messages: input.messages.slice(-16).map((m) => ({ role: m.role, content: String(m.content).slice(0, 8000) })),
    page: String(input.page ?? "").slice(0, 100),
  }))
  .handler(async ({ data, context }): Promise<SkyReply> => {
    const sb = context.supabase;
    const request = data.messages[data.messages.length - 1]?.content ?? "";
    const log = (row: Record<string, unknown>) => sb.from("assistant_logs").insert({ request: request.slice(0, 2000), ...row });
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      await log({ action_type: "erreur", status: "failure", detail: "Assistant IA non configuré." });
      throw new Error("Assistant IA non configuré.");
    }
    const now = new Date().toLocaleString("fr-FR", { timeZone: "Indian/Reunion" });
    const input: unknown[] = [
      { role: "system", content: SYSTEM.replace("{NOW}", now) + (data.page ? `\nPage actuelle : ${data.page}` : "") },
      ...data.messages,
    ];
    const actions: SkyActionResult[] = [];
    const sources = new Set<string>();
    let reply = "";
    try {
      for (let round = 0; round < 8; round++) {
        const out = await callModel(key, input);
        input.push(...out);
        const calls = out.filter((o) => o.type === "function_call");
        if (!calls.length) {
          reply = out.filter((o) => o.type === "message")
            .flatMap((o) => (o.content as Array<{ type: string; text?: string }>) ?? [])
            .filter((c) => c.type === "output_text").map((c) => c.text).join("").trim();
          break;
        }
        for (const c of calls) {
          const name = String(c.name);
          let res: ToolOut;
          try { res = await runTool(sb, name, JSON.parse(String(c.arguments || "{}"))); }
          catch (e) { res = fail(`Erreur inattendue : ${e instanceof Error ? e.message : String(e)}`); }
          res.sources?.forEach((s) => sources.add(s));
          const app = APP_OF[name] ?? "sky";
          actions.push({ tool: name, app, ok: res.ok, detail: res.detail, target: res.target ?? null });
          await log({ action_type: name, app, target: res.target ?? null, value: String(c.arguments).slice(0, 2000), status: res.ok ? "success" : "failure", detail: res.detail, sources: res.sources?.slice(0, 50) ?? [] });
          input.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify({ ok: res.ok, detail: res.detail, data: res.data ?? null }).slice(0, 20000) });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await log({ action_type: "erreur", status: "failure", detail: msg, reply: "" });
      throw new Error(msg);
    }
    if (!reply) reply = "Je n'ai pas pu formuler de réponse finale.";
    // Truth guard: append a verified status line computed from real results, never from the model.
    const failed = actions.filter((a) => !a.ok && a.tool !== "search_all" && a.tool !== "list_items");
    if (failed.length && !/échou|échec|impossible|refus/i.test(reply)) {
      reply += ` Attention : ${failed.length} action(s) ont échoué — ${failed.map((f) => f.detail).join(" ; ")}`;
    }
    const src = [...sources].slice(0, 30);
    await log({ action_type: "reponse", status: "info", reply: reply.slice(0, 4000), detail: `${actions.length} action(s) exécutée(s)`, sources: src });
    return { reply, sources: src, actions };
  });
