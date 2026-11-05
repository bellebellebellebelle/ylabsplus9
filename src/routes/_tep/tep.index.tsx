import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FolderTree, LogOut, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/tep/components/ui/button";
import { NewBoardDialog } from "@/tep/components/projects/NewBoardDialog";
import { useAuth } from "@/tep/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { boardTypeInfo, createProject, type Project } from "@/tep/lib/projects";

export const Route = createFileRoute("/_tep/tep/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Muraly — Mes projets" },
      { name: "description", content: "Tous vos projets en cours, organisés en tableaux et sous-tableaux imbriqués à l'infini." },
      { property: "og:title", content: "Muraly — Mes projets" },
      { property: "og:description", content: "Créez des tableaux dans des tableaux, comme des pages dans des pages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [all, setAll] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("tep_projects").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const rows = (data ?? []) as Project[];
    setAll(rows);
    setProjects(rows.filter((p) => !p.parent_board_id));
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }

  const countDescendants = (id: string): number =>
    all.filter((p) => p.parent_board_id === id).reduce((n, c) => n + 1 + countDescendants(c.id), 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes projets</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nouveau projet
          </Button>
          <Button variant="outline" aria-label="Déconnexion" onClick={() => void supabase.auth.signOut().then(() => navigate({ to: "/auth" }))}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Aucun projet. Créez votre premier tableau pour commencer.</p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Créer un projet
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary">
              <Link to="/projets/$projectId" params={{ projectId: p.id }} className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.title}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {boardTypeInfo(p.board_type).label} · <FolderTree className="size-3" /> {countDescendants(p.id)} sous-tableaux
                </p>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Supprimer"
                onClick={async () => {
                  if (!confirm("Supprimer ce projet et tous ses sous-tableaux ?")) return;
                  const { error } = await supabase.from("tep_projects").delete().eq("id", p.id);
                  if (error) toast.error(error.message);
                  else void load();
                }}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <NewBoardDialog
        open={open}
        onOpenChange={setOpen}
        title="Nouveau projet — choisissez un type de tableau"
        onCreate={async (type, name) => {
          try {
            const p = await createProject(user!.id, null, type, name);
            setOpen(false);
            void navigate({ to: "/projets/$projectId", params: { projectId: p.id } });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Création impossible");
          }
        }}
      />
    </main>
  );
}
