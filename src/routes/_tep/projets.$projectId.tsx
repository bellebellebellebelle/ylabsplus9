import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/tep/components/ui/button";
import { NewBoardDialog } from "@/tep/components/projects/NewBoardDialog";
import { ProjectSidebar } from "@/tep/components/projects/ProjectSidebar";
import { useAuth } from "@/tep/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { boardTypeInfo, boardUrl, createProject, resolveBreadcrumb, type Project } from "@/tep/lib/projects";

export const Route = createFileRoute("/_tep/projets/$projectId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Muraly — Projet" },
      { name: "description", content: "Un tableau de projet avec ses sous-tableaux imbriqués." },
      { property: "og:title", content: "Muraly — Projet" },
      { property: "og:description", content: "Tableaux et sous-tableaux imbriqués à l'infini." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: all } = useQuery({
    queryKey: ["projects"],
    enabled: !!session,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("tep_projects").select("*").order("created_at");
      if (error) toast.error(error.message);
      return (data ?? []) as Project[];
    },
  });
  const load = () => qc.invalidateQueries({ queryKey: ["projects"] });
  // Garde en vie les derniers tableaux ouverts : revenir dessus est instantané.
  const [alive, setAlive] = useState<{ id: string; url: string; title: string }[]>([]);
  const project0 = all?.find((p) => p.id === projectId);
  const url0 = project0 ? boardUrl(project0) : null;
  const lastRef = useRef<string | null>(null);
  useEffect(() => {
    if (!project0 || !url0 || lastRef.current === project0.id) return;
    lastRef.current = project0.id;
    setAlive((prev) => [{ id: project0.id, url: url0, title: project0.title }, ...prev.filter((a) => a.id !== project0.id)].slice(0, 6));
  }, [project0, url0]);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  if (!all) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  const project = all.find((p) => p.id === projectId);
  if (!project)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Ce tableau n'existe pas.</p>
        <Link to="/tep" className="text-primary underline">Retour aux projets</Link>
      </div>
    );

  const trail = resolveBreadcrumb(all, project.id);
  const children = all.filter((p) => p.parent_board_id === project.id);
  const url = boardUrl(project);

  return (
    <div className="fixed inset-0 bg-background">
      <ProjectSidebar trail={trail} children={children} onNewChild={() => setOpen(true)} />
      {alive.map((a) => (
        <iframe
          key={a.id}
          src={a.url}
          title={a.title}
          className="absolute inset-0 size-full border-0 pl-8"
          style={{ visibility: a.id === project.id && url ? "visible" : "hidden" }}
        />
      ))}
      {url ? null : (
        <main className="mx-auto max-w-4xl px-12 py-10">
          <h1 className="text-2xl font-semibold">{project.title}</h1>
          <p className="text-sm text-muted-foreground">{boardTypeInfo(project.board_type).label}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((c) => (
              <li key={c.id}>
                <Link
                  to="/projets/$projectId"
                  params={{ projectId: c.id }}
                  className="block rounded-xl border border-border bg-card p-4 hover:border-primary"
                >
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{boardTypeInfo(c.board_type).label}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Button className="mt-6" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nouveau sous-tableau
          </Button>
        </main>
      )}
      <NewBoardDialog
        open={open}
        onOpenChange={setOpen}
        title={`Nouveau sous-tableau dans « ${project.title} »`}
        onCreate={async (type, name) => {
          try {
            const p = await createProject(user!.id, project.id, type, name);
            setOpen(false);
            await load();
            void navigate({ to: "/projets/$projectId", params: { projectId: p.id } });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Création impossible");
          }
        }}
      />
    </div>
  );
}
