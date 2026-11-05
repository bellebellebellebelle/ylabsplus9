import { Button } from "@/tep/components/ui/button";
import { useAuth } from "@/tep/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_tep/tableau/")({
  head: () => ({
    meta: [
      { title: "Tableau Smart — mes schémas" },
      { name: "description", content: "Importez la photo d'un schéma dessiné à la main et retrouvez-le dans un tableau blanc intelligent." },
      { property: "og:title", content: "Tableau Smart — mes schémas" },
      { property: "og:description", content: "Du croquis papier au tableau blanc intelligent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type BoardRow = { id: string; title: string; updated_at: string };

function Page() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);
  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }
  return <Dashboard />;
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("tep_sketch_boards")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setBoards(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("sketch-boards-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "tep_sketch_boards" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const create = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("tep_sketch_boards")
      .insert({ user_id: user.id, title: "Nouveau tableau" })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Création impossible");
      return;
    }
    void navigate({ to: "/tableau/$boardId", params: { boardId: data.id } });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tep_sketch_boards").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setBoards((b) => b.filter((x) => x.id !== id));
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/tep" className="text-sm text-muted-foreground hover:text-foreground">← Accueil</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Mes tableaux schémas</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={create}>
            <Plus className="h-4 w-4" /> Nouveau tableau
          </Button>
          <Button variant="outline" onClick={() => void supabase.auth.signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="mt-10 text-sm text-muted-foreground">Chargement…</p>
      ) : boards.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun tableau pour l'instant. Créez-en un, puis importez la photo de votre schéma.
          </p>
          <Button className="mt-4" onClick={create}>
            <Plus className="h-4 w-4" /> Commencer
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <li
              key={b.id}
              className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary"
            >
              <Link
                to="/tableau/$boardId"
                params={{ boardId: b.id }}
                className="min-w-0 flex-1"
              >
                <p className="truncate font-medium">{b.title}</p>
                <p className="text-xs text-muted-foreground">
                  Modifié le {new Date(b.updated_at).toLocaleString("fr-FR")}
                </p>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Supprimer"
                onClick={() => void remove(b.id)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
