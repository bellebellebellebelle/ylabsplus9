/** Client Odoo léger via JSON-RPC (aucune dépendance externe). */

export type OdooCreds = {
  url: string;
  database: string;
  username: string;
  apiKey: string;
};

type JsonRpcResult<T> = { result?: T; error?: { message?: string; data?: { message?: string } } };

async function rpc<T>(creds: OdooCreds, service: string, method: string, args: unknown[]): Promise<T> {
  const base = creds.url.replace(/\/+$/, "");
  const res = await fetch(`${base}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Date.now(),
    }),
  });
  if (!res.ok) throw new Error(`Odoo injoignable (${res.status}). Vérifiez l'URL.`);
  const json = (await res.json()) as JsonRpcResult<T>;
  if (json.error) {
    throw new Error(json.error.data?.message || json.error.message || "Odoo a refusé la requête.");
  }
  return json.result as T;
}

/** Authentifie et retourne l'uid Odoo. */
export async function odooAuthenticate(creds: OdooCreds): Promise<number> {
  const uid = await rpc<number | false>(creds, "common", "authenticate", [
    creds.database,
    creds.username,
    creds.apiKey,
    {},
  ]);
  if (!uid) throw new Error("Identifiants Odoo refusés (utilisateur ou clé API).");
  return uid;
}

type OdooRow = Record<string, unknown>;

async function searchRead(
  creds: OdooCreds,
  uid: number,
  model: string,
  fields: string[],
  limit: number,
): Promise<OdooRow[]> {
  try {
    return await rpc<OdooRow[]>(creds, "object", "execute_kw", [
      creds.database,
      uid,
      creds.apiKey,
      model,
      "search_read",
      [[]],
      { fields, limit, order: "write_date desc" },
    ]);
  } catch {
    // Module non installé sur cet Odoo : on ignore silencieusement.
    return [];
  }
}

/** Modules Odoo natifs exposés aux agents, avec les modèles lus pour le contexte. */
export const ODOO_MODULE_READS: Record<
  string,
  { label: string; reads: { model: string; fields: string[]; limit: number; title: string }[] }
> = {
  ventes: {
    label: "Ventes",
    reads: [
      { model: "sale.order", fields: ["name", "partner_id", "amount_total", "state", "date_order"], limit: 10, title: "Commandes récentes" },
    ],
  },
  achats: {
    label: "Achats",
    reads: [
      { model: "purchase.order", fields: ["name", "partner_id", "amount_total", "state", "date_order"], limit: 10, title: "Commandes fournisseurs" },
    ],
  },
  crm: {
    label: "CRM",
    reads: [
      { model: "crm.lead", fields: ["name", "partner_id", "expected_revenue", "stage_id", "probability"], limit: 12, title: "Opportunités en cours" },
    ],
  },
  facturation: {
    label: "Facturation",
    reads: [
      { model: "account.move", fields: ["name", "partner_id", "amount_total", "state", "invoice_date"], limit: 10, title: "Factures récentes" },
    ],
  },
  marketing: {
    label: "Marketing",
    reads: [
      { model: "mailing.mailing", fields: ["name", "subject", "state", "sent_date"], limit: 8, title: "Campagnes e-mail" },
    ],
  },
  agenda: {
    label: "Agenda",
    reads: [
      { model: "calendar.event", fields: ["name", "start", "stop", "location"], limit: 10, title: "Événements à venir" },
    ],
  },
  connaissance: {
    label: "Connaissance",
    reads: [
      { model: "knowledge.article", fields: ["name", "write_date"], limit: 10, title: "Articles de connaissance" },
    ],
  },
  employes: {
    label: "Employés",
    reads: [
      { model: "hr.employee", fields: ["name", "job_title", "department_id"], limit: 15, title: "Effectifs" },
    ],
  },
  projets: {
    label: "Projets",
    reads: [
      { model: "project.task", fields: ["name", "stage_id", "user_ids", "date_deadline"], limit: 12, title: "Tâches projet" },
    ],
  },
  stock: {
    label: "Stock",
    reads: [
      { model: "stock.quant", fields: ["product_id", "location_id", "quantity"], limit: 12, title: "Niveaux de stock" },
    ],
  },
};

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return String(v[1] ?? "");
  if (v === false || v === null || v === undefined) return "";
  return String(v);
}

/** Lit les données réelles des modules autorisés et les formate en contexte markdown. */
export async function buildOdooContext(creds: OdooCreds, uid: number, modules: string[]): Promise<string> {
  const sections: string[] = [];
  for (const key of modules) {
    const mod = ODOO_MODULE_READS[key];
    if (!mod) continue;
    for (const read of mod.reads) {
      const rows = await searchRead(creds, uid, read.model, read.fields, read.limit);
      if (rows.length === 0) continue;
      const lines = rows.map((r) =>
        "- " + read.fields.map((f) => `${f}: ${formatValue(r[f])}`).filter((s) => !s.endsWith(": ")).join(" | "),
      );
      sections.push(`### ${mod.label} — ${read.title}\n${lines.join("\n")}`);
    }
  }
  return sections.join("\n\n");
}
