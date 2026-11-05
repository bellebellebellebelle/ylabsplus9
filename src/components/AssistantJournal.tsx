import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AssistantJournal() {
  const qc = useQueryClient();
  const logs = useQuery({
    queryKey: ["assistant_logs"],
    queryFn: async () => (await supabase.from("assistant_logs").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  useEffect(() => {
    const ch = supabase
      .channel(`alogs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assistant_logs" }, () => qc.invalidateQueries({ queryKey: ["assistant_logs"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  const rows = logs.data ?? [];
  return (
    <section className="sk-glass rounded-2xl p-4">
      <h2 className="mb-1 font-semibold">Journal de l'assistant IA</h2>
      <p className="mb-4 text-xs text-muted-foreground">Toutes les actions de l'assistant, horodatées en temps réel.</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <article key={r.id} className="glass-2 rounded-xl p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={r.status === "success" ? "text-success" : r.status === "failure" ? "text-destructive" : "text-muted-foreground"}>
                {r.status === "success" ? "✅ Réussite" : r.status === "failure" ? "❌ Échec" : "ℹ️ Réponse"}
              </span>
              <span className="font-semibold">{r.action_type}</span>
              <time className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")}</time>
            </div>
            {r.request && <p className="mt-1 text-xs text-muted-foreground">Demande : {r.request}</p>}
            {(r.target || r.value) && <p className="text-xs text-muted-foreground">Cible : {r.target ?? "—"} · Valeur : {r.value ?? "—"}</p>}
            {r.detail && <p className="mt-1">{r.detail}</p>}
            {r.reply && <p className="mt-1 text-xs text-muted-foreground">Réponse : {r.reply}</p>}
            {r.sources.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Sources : {r.sources.join(", ")}</p>}
          </article>
        ))}
        {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucune action enregistrée.</p>}
      </div>
    </section>
  );
}
