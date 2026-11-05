import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Copy, X } from "lucide-react";
import { useMailbox, useMailConfig } from "@/components/mail/use-mailbox";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/mail-settings")({
  head: () => ({
    meta: [
      { title: "Configuration Mailgun — Nova Mail" },
      { name: "description", content: "Statut de la configuration Mailgun et URL de réception." },
      { property: "og:title", content: "Configuration Mailgun — Nova Mail" },
      { property: "og:description", content: "Statut de la configuration Mailgun et URL de réception." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <div className="sendyme"><SettingsPage /></div>,
});

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm">
      {ok ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />} {label}
    </div>
  );
}

function SettingsPage() {
  const cfg = useMailConfig();
  const mb = useMailbox();
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/api/public/mailgun/mime` : "";
  const d = cfg.data;
  return (
    <div className="min-h-screen bg-background p-6 font-sans">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/mail" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Retour à la boîte</Link>
        <h1 className="text-3xl font-semibold">Configuration Mailgun</h1>

        <section className="space-y-3 rounded-3xl bg-card p-6 shadow-soft">
          <h2 className="font-semibold">Statut</h2>
          <Row ok={Boolean(d?.domain)} label={`Domaine : ${d?.domain || "non défini"}`} />
          <Row ok={Boolean(d?.hasApiKey)} label="Clé API Mailgun enregistrée" />
          <Row ok={Boolean(d?.hasSigningKey)} label="Clé de signature des webhooks enregistrée" />
          <Row ok={Boolean(mb.data)} label={mb.data ? `Votre adresse : ${mb.data.local_part}@${d?.domain}` : "Aucune adresse réservée"} />
          <p className="text-xs text-muted-foreground">Région API : {d?.apiBase}. Compte européen ? Ajoutez le secret MAILGUN_API_BASE = https://api.eu.mailgun.net.</p>
        </section>

        <section className="space-y-3 rounded-3xl bg-card p-6 shadow-soft">
          <h2 className="font-semibold">URL de réception (webhook)</h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-xl bg-muted px-4 py-3 text-sm">{url}</code>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(url); setCopied(true); }}>
              <Copy className="h-4 w-4" /> {copied ? "Copié" : "Copier"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Utilisez l'URL de l'app publiée (pas celle de l'aperçu) dans Mailgun.</p>
        </section>

        <section className="space-y-2 rounded-3xl bg-card p-6 text-sm shadow-soft">
          <h2 className="font-semibold">Étapes dans Mailgun</h2>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Dans <b>Sending → Domains</b>, vérifiez que <b>{d?.domain || "votre domaine"}</b> est vérifié (enregistrements SPF, DKIM et MX en place).</li>
            <li>Dans <b>Receiving → Create route</b> : type « Catch All » (ou « Match Recipient » <code>.*@{d?.domain}</code>).</li>
            <li>Action <b>Forward</b> vers l'URL ci-dessus (elle se termine par <code>mime</code> : Mailgun envoie alors le message MIME complet avec les pièces jointes).</li>
            <li>Cochez <b>Stop</b> et enregistrez la route.</li>
            <li>La clé de signature se trouve dans <b>Settings → Webhooks → HTTP webhook signing key</b>.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
