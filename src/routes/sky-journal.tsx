import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sky-journal")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/sky/auth" });
  },
  head: () => ({
    meta: [
      { title: "Journal de SKY — Traçabilité des actions" },
      { name: "description", content: "Toutes les actions de l'assistant SKY, horodatées en temps réel, avec leurs détails et sources." },
      { property: "og:title", content: "Journal de SKY" },
      { property: "og:description", content: "Traçage complet et horodaté des actions de l'assistant SKY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SkyJournal,
});

const FILTERS = [
  { id: "all", label: "Tout" },
  { id: "success", label: "Réussites" },
  { id: "failure", label: "Échecs" },
  { id: "info", label: "Réponses" },
];

function SkyJournal() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const logs = useQuery({
    queryKey: ["sky_logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assistant_logs").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel(`skylogs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "assistant_logs" }, () => qc.invalidateQueries({ queryKey: ["sky_logs"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  const rows = (logs.data ?? []).filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="sky-hub min-h-screen p-4 md:p-8" style={{ color: "#e0f2fe" }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link to="/sky/apps" className="sky-switch-trigger flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"><ArrowLeft className="size-4" /> Mes apps</Link>
          <h1 className="text-2xl font-bold">Journal de SKY</h1>
        </div>
        <p className="mb-4 text-sm" style={{ color: "#7dd3fc" }}>Chaque action de l'assistant est enregistrée ici, en temps réel, avec son horodatage, son résultat et ses détails.</p>
        <div className="mb-4 flex gap-2">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className="rounded-full px-3 py-1 text-xs" style={{ background: filter === f.id ? "rgba(56,189,248,.35)" : "rgba(14,40,90,.6)", border: "1px solid rgba(125,211,252,.3)" }}>
              {f.label}
            </button>
          ))}
        </div>
        {logs.error && <p className="rounded-xl p-3 text-sm" style={{ background: "rgba(248,113,113,.12)", color: "#fecaca" }}>Impossible de charger le journal : {(logs.error as Error).message}</p>}
        <div className="space-y-2">
          {rows.map((r) => (
            <article key={r.id} className="sky-voice-panel rounded-xl p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span style={{ color: r.status === "success" ? "#4ade80" : r.status === "failure" ? "#f87171" : "#7dd3fc" }}>
                  {r.status === "success" ? "✅ Réussite" : r.status === "failure" ? "❌ Échec" : "💬 Réponse"}
                </span>
                <span className="font-semibold">{r.action_type}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "rgba(56,189,248,.18)" }}>{r.app}</span>
                <time className="ml-auto text-xs" style={{ color: "#7dd3fc" }}>
                  {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}
                </time>
              </div>
              {r.request && <p className="mt-1 text-xs" style={{ color: "#bae6fd" }}>Demande : « {r.request} »</p>}
              {r.target && <p className="text-xs" style={{ color: "#bae6fd" }}>Cible : {r.target}</p>}
              {r.detail && <p className="mt-1">{r.detail}</p>}
              {r.value && <details className="mt-1 text-xs" style={{ color: "#7dd3fc" }}><summary className="cursor-pointer">Paramètres</summary><pre className="whitespace-pre-wrap break-all">{r.value}</pre></details>}
              {r.reply && <p className="mt-1 text-xs" style={{ color: "#bae6fd" }}>Réponse : {r.reply}</p>}
              {r.sources.length > 0 && <p className="mt-1 text-xs" style={{ color: "#7dd3fc" }}>Sources : {r.sources.join(" · ")}</p>}
            </article>
          ))}
          {!logs.isLoading && rows.length === 0 && <p className="py-10 text-center text-sm" style={{ color: "#7dd3fc" }}>Aucune action enregistrée.</p>}
        </div>
      </div>
    </div>
  );
}
