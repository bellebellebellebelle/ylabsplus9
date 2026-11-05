import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-skytab-auth";

export const Route = createFileRoute("/skytab/")({
  head: () => ({
    meta: [
      { title: "Ultra Smart — Le tableur 100% langage naturel" },
      { name: "description", content: "Décrivez votre calcul en français, Ultra Smart l'analyse et l'exécute. Le tableur qui remplace Excel." },
      { property: "og:title", content: "Ultra Smart — Le tableur 100% langage naturel" },
      { property: "og:description", content: "Décrivez votre calcul en français, Ultra Smart l'analyse et l'exécute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <div className="skytab"><AuthPage /></div>,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/skytab/dashboard" });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const res =
      mode === "up"
        ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) setErr(res.error.message);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-md p-8 animate-fade-up">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-logo text-lg font-bold st-shadow-glow">US</div>
          <div>
            <h1 className="text-xl font-semibold">Ultra Smart</h1>
            <p className="text-xs text-muted-foreground">Le tableur qui parle votre langue</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "up" && (
            <input className="panel-inner w-full px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Votre prénom" value={name} onChange={(e) => setName(e.target.value)} required />
          )}
          <input type="email" className="panel-inner w-full px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" minLength={6} className="panel-inner w-full px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full st-gradient-primary py-3 text-sm font-medium text-primary-foreground st-shadow-glow transition hover:brightness-110 disabled:opacity-60">
            <Sparkles className="h-4 w-4" />
            {busy ? "Patientez…" : mode === "up" ? "Créer mon compte" : "Se connecter"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground">
          {mode === "in" ? "Pas encore de compte ? Créer un compte" : "Déjà inscrit ? Se connecter"}
        </button>
      </div>
    </main>
  );
}
