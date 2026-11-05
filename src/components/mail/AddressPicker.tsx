import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { reserveAddress } from "@/lib/mail.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RE = /^[a-z0-9]([a-z0-9._-]{0,30}[a-z0-9])?$/;

export function AddressPicker({ domain }: { domain: string }) {
  const qc = useQueryClient();
  const reserve = useServerFn(reserveAddress);
  const [name, setName] = useState("");
  const [local, setLocal] = useState("");
  const [avail, setAvail] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const clean = local.trim().toLowerCase();
  const valid = RE.test(clean);

  useEffect(() => {
    setAvail(null);
    if (!valid) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("is_address_available", { _local: clean });
      setAvail(Boolean(data));
    }, 350);
    return () => clearTimeout(t);
  }, [clean, valid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const r = await reserve({ data: { localPart: clean, displayName: name } });
    if (!r.ok) { setErr(r.error); setAvail(false); return; }
    qc.invalidateQueries({ queryKey: ["mailbox"] });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl bg-card p-8 shadow-soft">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-sidebar text-sidebar-foreground"><Sparkles /></div>
        <div>
          <h1 className="text-2xl font-semibold">Choisissez votre adresse</h1>
          <p className="mt-1 text-sm text-muted-foreground">Elle sera unique et vous servira à envoyer et recevoir vos e-mails.</p>
        </div>
        <div className="space-y-2"><Label htmlFor="n">Nom affiché</Label><Input id="n" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alexandre Martin" /></div>
        <div className="space-y-2">
          <Label htmlFor="l">Adresse</Label>
          <div className="flex items-center rounded-md border border-input bg-background pr-3 focus-within:ring-2 focus-within:ring-ring">
            <input id="l" required value={local} onChange={(e) => setLocal(e.target.value)} placeholder="alex" className="flex-1 bg-transparent px-3 py-2 text-sm outline-none" />
            <span className="text-sm text-muted-foreground">@{domain || "votre-domaine"}</span>
          </div>
          <p className="h-5 text-xs">
            {local && !valid && <span className="text-destructive">Lettres minuscules, chiffres, . _ - (2 à 32 caractères)</span>}
            {valid && avail === true && <span className="flex items-center gap-1 text-success"><Check className="h-3 w-3" /> Disponible</span>}
            {valid && avail === false && <span className="flex items-center gap-1 text-destructive"><X className="h-3 w-3" /> Déjà prise</span>}
          </p>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={!valid || avail !== true || !name.trim()}>Réserver cette adresse</Button>
      </form>
    </div>
  );
}
