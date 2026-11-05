import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Link2, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { googleAuthUrl, googleDisconnect, googleStatus } from "@/tep/lib/planning/google.functions";

type Props = { enabled?: boolean };

export function GoogleConnect({ enabled = true }: Props) {
  const qc = useQueryClient();
  const statusFn = useServerFn(googleStatus);
  const urlFn = useServerFn(googleAuthUrl);
  const offFn = useServerFn(googleDisconnect);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["planning-google-status"],
    queryFn: () => statusFn({}),
    enabled,
    refetchInterval: 60_000,
  });

  async function connect() {
    setBusy(true);
    try {
      const res = await urlFn({ data: { origin: window.location.origin } });
      window.open(res.url, "_blank", "noopener,width=520,height=680");
      toast.info("Autorisez l'accès Google dans la fenêtre ouverte, puis revenez ici.");
      setTimeout(() => void qc.invalidateQueries({ queryKey: ["planning-google-status"] }), 8000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connexion Google impossible");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await offFn({});
      await qc.invalidateQueries({ queryKey: ["planning-google-status"] });
      toast.success("Compte Google déconnecté");
    } finally {
      setBusy(false);
    }
  }

  const connected = !!data?.connected;

  return (
    <button
      onClick={() => void (connected ? disconnect() : connect())}
      disabled={busy}
      title={connected ? `Connecté : ${data?.email ?? ""}` : "Connecter Gmail, Agenda et Tasks"}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
        connected
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : connected ? (
        <Link2 className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Link2Off className="h-3.5 w-3.5" />
      )}
      <span className="hidden max-w-32 truncate sm:inline">
        {connected ? (data?.email ?? "Google connecté") : "Connecter Google"}
      </span>
    </button>
  );
}
