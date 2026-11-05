import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cloud, Download, Loader2 } from "lucide-react";
import { resolveShare } from "@/lib/share.functions";

export const Route = createFileRoute("/s/$token")({
  head: () => ({
    meta: [
      { title: "Fichier partagé — SKY CLOUD" },
      { name: "description", content: "Un fichier a été partagé avec vous via SKY CLOUD." },
      { property: "og:title", content: "Fichier partagé — SKY CLOUD" },
      { property: "og:description", content: "Un fichier a été partagé avec vous." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { token } = Route.useParams();
  const q = useQuery({ queryKey: ["share", token], queryFn: () => resolveShare({ data: { token } }) });
  const d = q.data;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="sk-glass w-full max-w-2xl rounded-2xl p-8">
        <div className="mb-6 flex items-center gap-2 font-semibold"><Cloud className="text-primary" /> SKY CLOUD</div>
        {q.isLoading && <Loader2 className="animate-spin" />}
        {q.error && <p className="text-destructive">Lien invalide.</p>}
        {d && !d.ok && <p className="text-muted-foreground">{d.reason}</p>}
        {d && d.ok && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold break-all">{d.name}</h1>
            <p className="text-sm text-muted-foreground">{(d.size / 1024 / 1024).toFixed(2)} Mo · {d.permission === "download" ? "Téléchargement autorisé" : "Consultation (une copie reste possible)"}</p>
            {d.url && d.mime.startsWith("image/") && <img src={d.url} alt={d.name} className="max-h-[60vh] rounded-lg" />}
            {d.url && d.mime.startsWith("video/") && <video src={d.url} controls className="max-h-[60vh] w-full rounded-lg" />}
            {d.url && d.mime === "application/pdf" && <iframe src={d.url} title={d.name} className="h-[60vh] w-full rounded-lg" />}
            {d.url && (
              <a href={d.url} target="_blank" rel="noreferrer" className="btn-glow inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-primary-foreground">
                <Download className="size-4" /> {d.permission === "download" ? "Télécharger" : "Ouvrir"}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
