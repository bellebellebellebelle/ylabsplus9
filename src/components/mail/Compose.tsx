import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { sendEmail } from "@/lib/mail.functions";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type ComposeInit = { to?: string; subject?: string; text?: string; draftId?: string };

export function Compose({ open, onOpenChange, init, from }: { open: boolean; onOpenChange: (o: boolean) => void; init: ComposeInit; from: string }) {
  const send = useServerFn(sendEmail);
  const [to, setTo] = useState(init.to ?? "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(init.subject ?? "");
  const [text, setText] = useState(init.text ?? "");
  const [busy, setBusy] = useState(false);

  async function onSend() {
    setBusy(true);
    try {
      const r = await send({ data: { to, cc: cc || undefined, subject, text, draftId: init.draftId } });
      if (!r.ok) toast.error(r.error);
      else { toast.success("Message envoyé"); onOpenChange(false); }
    } catch (e) {
      toast.error("Envoi impossible : vérifiez les adresses.");
    } finally { setBusy(false); }
  }

  async function onDraft() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const row = { user_id: u.user.id, folder: "drafts", from_address: from, to_addresses: to, subject, body_text: text, is_read: true };
    const { error } = init.draftId
      ? await supabase.from("mail_messages").update(row).eq("id", init.draftId)
      : await supabase.from("mail_messages").insert(row);
    if (error) toast.error(error.message); else { toast.success("Brouillon enregistré"); onOpenChange(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader><DialogTitle>Nouveau message</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">De : {from}</p>
        <Input placeholder="À (séparez par des virgules)" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input placeholder="Cc" value={cc} onChange={(e) => setCc(e.target.value)} />
        <Input placeholder="Objet" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Textarea rows={10} placeholder="Votre message…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onDraft}>Enregistrer le brouillon</Button>
          <Button onClick={onSend} disabled={busy || !to}>{busy ? "Envoi…" : "Envoyer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
