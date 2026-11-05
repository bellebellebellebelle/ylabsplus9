import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileSpreadsheet, LogOut, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-skytab-auth";

export const Route = createFileRoute("/skytab/dashboard")({
  head: () => ({
    meta: [
      { title: "Mes projets — Ultra Smart" },
      { name: "description", content: "Retrouvez et créez vos projets de calcul en langage naturel." },
      { property: "og:title", content: "Mes projets — Ultra Smart" },
      { property: "og:description", content: "Vos projets de calcul intelligents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <div className="skytab"><Dashboard /></div>,
});

type P = { id: string; name: string; updated_at: string; current_index: number };

function Dashboard() {
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<P[]>([]);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/skytab" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = () =>
      supabase.from("projects").select("id,name,updated_at,current_index").order("updated_at", { ascending: false }).then(({ data }) => setProjects(data ?? []));
    load();
    const ch = supabase
      .channel(`projects-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const create = async () => {
    const { data, error } = await supabase.from("projects").insert({ name: "Nouveau projet" }).select("id").single();
    if (!error && data) navigate({ to: "/skytab/projet/$id", params: { id: data.id } });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce projet ?")) return;
    await supabase.from("projects").delete().eq("id", id);
    setProjects((p) => p.filter((x) => x.id !== id));
  };

  const firstName = (user?.user_metadata?.["full_name"] as string) || user?.email?.split("@")[0] || "";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-logo font-bold st-shadow-glow">US</div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">Bonjour {firstName}</h1>
            <p className="text-xs text-muted-foreground">Vos projets Ultra Smart</p>
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button onClick={create} className="panel flex min-h-36 flex-col items-center justify-center gap-3 p-6 transition hover:brightness-125 animate-fade-up">
          <span className="grid h-12 w-12 place-items-center rounded-full st-gradient-primary st-shadow-glow"><Plus className="h-5 w-5" /></span>
          <span className="font-medium">Nouveau projet</span>
        </button>
        {projects.map((p, i) => (
          <div key={p.id} className="panel group relative min-h-36 p-6 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <Link to="/skytab/projet/$id" params={{ id: p.id }} className="absolute inset-0" aria-label={p.name} />
            <FileSpreadsheet className="mb-4 h-6 w-6 text-azure" />
            <h2 className="truncate font-medium">{p.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {p.current_index + 1} version(s) · {new Date(p.updated_at).toLocaleDateString("fr-FR")}
            </p>
            <button onClick={() => remove(p.id)} className="absolute right-4 top-4 z-10 rounded p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100" aria-label="Supprimer">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
