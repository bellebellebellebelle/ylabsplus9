import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUp, FileText, Plus, Trash2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar, HoverSidebar, useDocs, createDoc } from "@/components/SkydocSidebar";

export const Route = createFileRoute("/skydoc/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/sky/auth" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Mes projets — Lumen Docs" },
      { name: "description", content: "Vos documents intelligents." },
      { property: "og:title", content: "Mes projets — Lumen Docs" },
      { property: "og:description", content: "Vos documents intelligents." },
    ],
  }),
  component: Dashboard,
});

const IDEAS = ["Stratégie de lancement SaaS pour PME", "Roadmap produit 2027", "Analyse concurrentielle", "Plan marketing Q3", "Brief créatif de campagne"];

function Dashboard() {
  const docs = useDocs();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [prompt, setPrompt] = useState("");

  async function start(text: string) {
    const id = await createDoc(text.slice(0, 60) || "Nouveau document");
    if (text) sessionStorage.setItem(`init-${id}`, text);
    nav({ to: "/skydoc/doc/$id", params: { id } });
  }

  return (
    <div className="skydoc flex min-h-screen gap-3 p-3">
      <HoverSidebar onSearch={setQ} />
      <details className="md:hidden"><summary className="sd-glass icon-btn">☰</summary><div className="sd-glass fixed inset-y-3 left-3 z-50 w-64 rounded-3xl"><Sidebar onSearch={setQ} /></div></details>
      <main className="sd-glass sd-holo mx-auto w-full max-w-6xl flex-1 rounded-[2rem] p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="anim-in sd-holo-text text-3xl font-extrabold md:text-5xl">Que voulez-vous créer ?</h1>
          <button type="button" onClick={() => start("")} className="bg-gradient-primary shadow-glow flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"><Plus className="h-4 w-4" />Nouveau document</button>
        </div>
        <p className="mt-2 text-muted-foreground">Décrivez votre document en langage naturel, l'IA propose une première version.</p>
        <form onSubmit={(e) => { e.preventDefault(); start(prompt); }} className="sd-glass-2 sd-holo mt-6 flex items-end gap-2 rounded-2xl p-3">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="Ex : Crée une stratégie de lancement pour notre SaaS à destination des PME…" className="flex-1 resize-none bg-transparent text-sm outline-none" />
          <button className="bg-gradient-primary shadow-glow grid h-10 w-10 place-items-center rounded-xl"><ArrowUp className="h-4 w-4" /></button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {IDEAS.map((i) => <button key={i} onClick={() => start(i)} className="sd-glass-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"><Wand2 className="mr-1 inline h-3 w-3" />{i}</button>)}
        </div>
        <h2 className="mt-10 mb-4 text-lg font-bold">Projets</h2>
        <div className="grid auto-rows-[minmax(9rem,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {docs.filter((d) => d.title.toLowerCase().includes(q.toLowerCase())).map((d, i) => (
            <div key={d.id} className={`sk-bento anim-in group relative rounded-3xl p-4 ${i === 0 ? "sm:col-span-2 sm:row-span-2" : ""}`}>
              <Link to="/skydoc/doc/$id" params={{ id: d.id }} className="block">
                <div className="holo-fill mb-3 grid h-24 place-items-center rounded-2xl"><FileText className="h-8 w-8" /></div>
                <p className="truncate font-semibold">{d.title}</p>
                <p className="text-xs text-muted-foreground">Version {d.version} · {new Date(d.updated_at).toLocaleDateString("fr-FR")}</p>
              </Link>
              <button onClick={() => confirm("Supprimer ?") && supabase.from("documents").delete().eq("id", d.id)} className="icon-btn absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {!docs.length && <p className="text-sm text-muted-foreground">Aucun projet pour l'instant.</p>}
        </div>
      </main>
    </div>
  );
}
