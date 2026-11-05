import { useEffect, useState } from "react";
import { KeyRound, Lock, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { clearKey, decryptBlob, hasKey, hasVerifier, rememberVerifier, unlock } from "@/lib/e2e";

type Factor = { id: string; status: string };

export function useMfaFactors() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const reload = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  };
  useEffect(() => { reload(); }, []);
  return { factors, verified: factors.some((f) => f.status === "verified"), reload };
}

/** Blocks the app until the 2FA code is entered when the account has 2FA. */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const [need, setNeed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error || !data) { setFailure(true); setReady(true); return; }
      if (data?.nextLevel === "aal2" && data.currentLevel !== "aal2") {
        const f = await supabase.auth.mfa.listFactors();
        const id = f.data?.totp.find((x) => x.status === "verified")?.id;
        if (f.error || !id) setFailure(true);
        else setNeed(id);
      }
      setReady(true);
    })();
  }, []);
  if (!ready) return null;
  if (failure) return <div className="grid min-h-screen place-items-center p-4"><div className="space-y-4 text-center"><p>Impossible de vérifier la 2FA. L’accès reste bloqué.</p><Button onClick={() => window.location.reload()}>Réessayer</Button><Button variant="ghost" onClick={() => supabase.auth.signOut()}>Se déconnecter</Button></div></div>;
  if (!need) return <>{children}</>;
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: need, code });
          if (error) { toast.error("Code invalide"); return; }
          setNeed(null);
        }}
        className="sk-glass w-full max-w-sm space-y-4 rounded-2xl p-6 text-center"
      >
        <Smartphone className="mx-auto size-10 text-primary" />
        <h1 className="text-lg font-semibold">Authentification à deux facteurs</h1>
        <p className="text-sm text-muted-foreground">Entrez le code à 6 chiffres de votre application d'authentification.</p>
        <input autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="glass-2 w-full rounded-lg px-3 py-2 text-center text-xl tracking-[0.5em] outline-none" />
          <Button type="submit" className="btn-glow w-full rounded-lg py-2 text-primary-foreground">Vérifier</Button>
        <button type="button" onClick={() => supabase.auth.signOut()} className="text-xs text-muted-foreground">Se déconnecter</button>
      </form>
    </div>
  );
}

export function UnlockDialog({ open, userId, onDone }: { open: boolean; userId: string; onDone: (ok: boolean) => void }) {
  const [p, setP] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [known, setKnown] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setKnown(hasVerifier(userId)); setP(""); setConfirmation(""); } }, [open, userId]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p.length < 8) { toast.error("8 caractères minimum"); return; }
    if (!known && p !== confirmation) { toast.error("Les phrases ne correspondent pas"); return; }
    setBusy(true);
    try {
      await unlock(p, userId);
      if (!known) {
        // Existing vaults must be verified against actual ciphertext before saving a verifier.
        const { data, error } = await supabase.from("files").select("storage_path, mime_type").eq("encrypted", true).limit(1);
        if (error) throw error;
        const file = data?.[0];
        if (file) {
          const downloaded = await supabase.storage.from("files").download(file.storage_path);
          if (downloaded.error || !downloaded.data) throw new Error("Impossible de vérifier le coffre existant.");
          await decryptBlob(downloaded.data, file.mime_type);
        }
        await rememberVerifier(userId);
      }
      setP(""); setConfirmation(""); onDone(true);
    } catch (error) { clearKey(); toast.error(error instanceof Error ? error.message : "Déverrouillage impossible"); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setP(""); setConfirmation(""); onDone(false); } }}>
      <DialogContent className="sk-glass">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="text-primary" /> Coffre chiffré</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Saisissez votre phrase secrète. Elle ne quitte jamais votre appareil : si vous l'oubliez, vos fichiers chiffrés seront irrécupérables.</p>
        {!known && <p className="text-sm text-muted-foreground">Sur un nouvel appareil, utilisez la phrase de votre coffre existant. Pour un nouveau coffre, choisissez une phrase et conservez-la hors ligne. Réinitialiser le mot de passe du compte ne récupère pas cette phrase.</p>}
        <form onSubmit={submit} className="flex flex-col gap-2">
          <input type="password" autoFocus value={p} onChange={(e) => setP(e.target.value)} placeholder="Phrase secrète" className="glass-2 flex-1 rounded-lg px-3 py-2 outline-none" />
          {!known && <input aria-label="Confirmer la phrase secrète" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Confirmer la phrase secrète" className="glass-2 rounded-lg px-3 py-2 outline-none" />}
          <Button type="submit" disabled={busy} className="btn-glow rounded-lg px-4 text-sm text-primary-foreground">{busy ? "Vérification…" : "Déverrouiller"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SecurityDialog({ open, onOpenChange, email, onSignOut, onUnlock }: {
  open: boolean; onOpenChange: (o: boolean) => void; email?: string | undefined; onSignOut: () => void; onUnlock: () => void;
}) {
  const { factors, verified, reload } = useMfaFactors();
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  useEffect(() => { if (open) reload(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    for (const f of factors.filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Nova ${Date.now()}` });
    if (error) { toast.error(error.message); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function confirm() {
    if (!enroll) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
    if (error) { toast.error("Code invalide"); return; }
    toast.success("2FA activée");
    setEnroll(null); setCode(""); reload();
  }
  async function disable() {
    for (const f of factors) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) { toast.error(`Désactivation refusée : ${error.message}`); reload(); return; }
    }
    toast.success("2FA désactivée"); reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sk-glass max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="text-success" /> Paramètres de sécurité</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Compte : <span className="text-foreground">{email}</span></p>

        <div className="glass-2 space-y-3 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="size-4" /> Authentification 2FA</p>
            <span className={`text-xs ${verified ? "text-success" : "text-muted-foreground"}`}>{verified ? "Activée" : "Désactivée"}</span>
          </div>
          {enroll ? (
            <div className="space-y-3 text-center">
              <p className="text-xs text-muted-foreground">Scannez ce QR code avec Google Authenticator, Authy ou 1Password, puis saisissez le code.</p>
              <img src={enroll.qr} alt="QR code 2FA" className="mx-auto size-40 rounded-lg bg-foreground p-2" />
              <p className="break-all text-[10px] text-muted-foreground">{enroll.secret}</p>
              <div className="flex gap-2">
                <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="glass-2 flex-1 rounded-lg px-3 py-2 text-center tracking-widest outline-none" />
                <Button onClick={confirm} className="btn-glow rounded-lg px-4 text-sm text-primary-foreground">Activer</Button>
              </div>
            </div>
          ) : verified ? (
            <Button variant="ghost" onClick={disable} className="glass-2 w-full rounded-lg py-2 text-xs text-destructive">Désactiver la 2FA</Button>
          ) : (
            <Button onClick={start} className="btn-glow w-full rounded-lg py-2 text-sm text-primary-foreground">Activer la 2FA</Button>
          )}
        </div>

        <div className="glass-2 space-y-3 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4" /> Chiffrement de bout en bout</p>
            <span className="text-xs text-success">Obligatoire</span>
          </div>
          <p className="text-xs text-muted-foreground">Chaque nouvel import est chiffré sur votre appareil avant l’envoi. La phrase et la clé ne sont jamais envoyées au serveur. Les anciens fichiers non chiffrés restent inchangés. Les noms et tailles restent visibles au service. Le partage par lien des fichiers chiffrés est interdit.</p>
          <p className="text-xs">{hasKey() ? "🔓 Coffre déverrouillé pour cette session" : <Button variant="ghost" onClick={onUnlock} className="text-primary">Déverrouiller le coffre</Button>}</p>
          <p className="text-xs text-muted-foreground">Conservez votre phrase hors ligne et une sauvegarde de votre application 2FA. La perte de la phrase est irréversible ; la récupération du compte ne contourne pas la 2FA.</p>
        </div>

        <button onClick={onSignOut} className="glass-2 flex items-center justify-center gap-2 rounded-lg py-2 text-sm"><LogOut className="size-4" /> Se déconnecter</button>
      </DialogContent>
    </Dialog>
  );
}
