import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AI_APPS, CENTRAL_MODELS, RECOMMENDED, type AiAppKey } from "@/lib/ai-models";

export function AiModelsPanel({ userId }: { userId: string }) {
  const [map, setMap] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase.from("user_app_models").select("app_key, model_id").eq("user_id", userId).then(({ data }) => {
      setMap(Object.fromEntries((data ?? []).map((r) => [r.app_key, r.model_id])));
    });
  }, [userId]);

  async function save(entries: [string, string][]) {
    setError("");
    const prev = map;
    setMap({ ...map, ...Object.fromEntries(entries) });
    const { error } = await supabase.from("user_app_models").upsert(
      entries.map(([app_key, model_id]) => ({ user_id: userId, app_key, model_id })),
      { onConflict: "user_id,app_key" },
    );
    if (error) { setMap(prev); setError("Enregistrement impossible. Réessayez."); }
  }

  const current = (k: AiAppKey) => map[k] ?? RECOMMENDED[k];

  return (
    <div className="idea-list">
      <p className="text-xs text-muted-foreground">Choisissez le modèle qui propulse chaque application. Une application utilise un seul modèle à la fois.</p>
      {CENTRAL_MODELS.map((m) => (
        <section key={m.id} className="panel idea-card">
          <h3>{m.name} <span className="text-xs text-muted-foreground">· {m.badge}</span></h3>
          <p>{m.hint}</p>
          <div className="flex flex-wrap gap-2">
            {AI_APPS.map((a) => {
              const on = current(a.key) === m.id;
              return (
                <Button key={a.key} variant={on ? "default" : "outline"} size="sm" aria-pressed={on} disabled={on} onClick={() => void save([[a.key, m.id]])}>
                  {a.name}
                </Button>
              );
            })}
          </div>
        </section>
      ))}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div><Button variant="outline" size="sm" onClick={() => void save(Object.entries(RECOMMENDED))}>Rétablir la configuration recommandée</Button></div>
    </div>
  );
}
