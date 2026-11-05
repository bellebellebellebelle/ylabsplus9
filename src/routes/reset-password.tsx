import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Nouveau mot de passe — SKY CLOUD" },
    { name: "description", content: "Récupération sécurisée de votre compte SKY CLOUD." },
    { property: "og:title", content: "Nouveau mot de passe — SKY CLOUD" },
    { property: "og:description", content: "Changez votre mot de passe sans modifier la protection de vos fichiers." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  return <main className="grid min-h-screen place-items-center p-4"><form className="sk-glass w-full max-w-sm space-y-4 rounded-lg p-6" onSubmit={async (e) => {
    e.preventDefault();
    if (password !== confirmation) { toast.error("Les mots de passe ne correspondent pas"); return; }
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Lien expiré ou invalide. Demandez un nouveau lien de récupération.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe modifié. La 2FA et le chiffrement restent inchangés.");
      setPassword(""); setConfirmation("");
      await nav({ to: "/sky/cloud" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Modification impossible"); }
    finally { setBusy(false); }
  }}>
    <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>
    <input required minLength={8} type="password" autoComplete="new-password" aria-label="Nouveau mot de passe" placeholder="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="glass-2 w-full rounded-lg px-3 py-2" />
    <input required minLength={8} type="password" autoComplete="new-password" aria-label="Confirmer le mot de passe" placeholder="Confirmer le mot de passe" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="glass-2 w-full rounded-lg px-3 py-2" />
    <p className="text-xs text-muted-foreground">La phrase du coffre est différente du mot de passe du compte. Elle reste nécessaire pour déchiffrer vos fichiers.</p>
    <Button disabled={busy} className="w-full">Enregistrer</Button>
  </form></main>;
}