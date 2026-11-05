import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Cloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import mascot from "@/assets/mascot.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sky/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — SKY CLOUD" },
      { name: "description", content: "Créez votre compte SKY CLOUD ou connectez-vous à votre espace de stockage." },
      { property: "og:title", content: "Connexion — SKY CLOUD" },
      { property: "og:description", content: "Accédez à votre espace de stockage sécurisé." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "reset">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      if (error) toast.error("Envoi impossible. Réessayez plus tard.");
      else toast.success("Si ce compte existe, un lien de récupération vous sera envoyé.");
      return;
    }
    const { error } =
      mode === "up"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    nav({ to: "/sky/apps" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="sk-glass grid w-full max-w-4xl overflow-hidden rounded-2xl md:grid-cols-2">
        <div className="hidden flex-col items-center justify-center gap-4 p-8 md:flex">
          <img src={mascot} alt="Assistant Nova" width={768} height={896} className="w-64 animate-float rounded-2xl" />
          <h2 className="text-center text-2xl font-semibold">Votre cloud, sans limite.</h2>
          <p className="text-center text-sm text-muted-foreground">Stockage chiffré, partage contrôlé et assistant IA vocal.</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 p-8">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Cloud className="text-primary" /> SKY CLOUD
          </div>
          <h1 className="text-2xl font-semibold">{mode === "reset" ? "Récupérer mon compte" : mode === "up" ? "Créer un compte" : "Se connecter"}</h1>
          {mode === "up" && (
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom" className="glass-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-ring" />
          )}
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="glass-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-ring" />
          {mode !== "reset" && <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="glass-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-ring" />}
          <Button disabled={busy} className="btn-glow flex items-center justify-center gap-2 rounded-lg py-3 font-semibold text-primary-foreground disabled:opacity-60">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "reset" ? "Envoyer le lien" : mode === "up" ? "Créer mon compte" : "Connexion"}
          </Button>
          {mode === "in" && <Button variant="ghost" type="button" onClick={() => { setPassword(""); setMode("reset"); }}>Mot de passe oublié ?</Button>}
          {mode === "reset" && <p className="text-xs text-muted-foreground">Ce lien ne désactive pas la 2FA et ne récupère pas la phrase secrète des fichiers.</p>}
          <button type="button" onClick={() => setMode(mode === "up" ? "in" : "up")} className="text-sm text-muted-foreground hover:text-foreground">
            {mode === "up" ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S'inscrire"}
          </button>
        </form>
      </div>
    </div>
  );
}
