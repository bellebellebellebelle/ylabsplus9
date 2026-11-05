import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, ChevronDown, FileText, Folder, Home, Library, LayoutTemplate, LogOut, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type DocRow = { id: string; title: string; updated_at: string; status: string; version: number };

export function useDocs() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  useEffect(() => {
    const load = () =>
      supabase.from("documents").select("id,title,updated_at,status,version").order("updated_at", { ascending: false }).then(({ data }) => setDocs(data ?? []));
    load();
    const ch = supabase
      .channel(`docs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return docs;
}

export async function createDoc(title = "Nouveau document") {
  const { data, error } = await supabase.from("documents").insert({ title }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

const COLORS = ["bg-primary", "bg-cyan", "bg-primary-glow", "bg-destructive", "bg-accent"];

export function Sidebar({ activeId, onSearch }: { activeId?: string | undefined; onSearch?: ((q: string) => void) | undefined }) {
  const docs = useDocs();
  const nav = useNavigate();
  const [open, setOpen] = useState(true);
  return (
    <aside className="flex h-full w-full flex-col gap-1 p-3">
      <label className="sd-glass-2 mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        <input placeholder="Rechercher" onChange={(e) => onSearch?.(e.target.value)} className="w-full bg-transparent outline-none" />
        <kbd className="text-[10px]">⌘K</kbd>
      </label>
      <Link to="/skydoc/dashboard" className="nav-item"><Home className="h-4 w-4" />Accueil</Link>
      <Link to="/skydoc/dashboard" className="nav-item" activeProps={{ className: "bg-accent text-foreground" }}><Folder className="h-4 w-4" />Projets</Link>
      <Link to="/skydoc/dashboard" search={{ tab: "models" } as never} className="nav-item"><LayoutTemplate className="h-4 w-4" />Modèles</Link>
      <Link to="/skydoc/dashboard" className="nav-item"><Library className="h-4 w-4" />Bibliothèque</Link>
      <button onClick={async () => nav({ to: "/skydoc/doc/$id", params: { id: await createDoc() } })} className="nav-item"><Bot className="h-4 w-4" />IA Agent</button>
      <button onClick={() => setOpen(!open)} className="mt-6 flex items-center justify-between px-2 text-xs text-muted-foreground">
        Projets récents <ChevronDown className={`h-3 w-3 transition ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="mt-1 flex-1 space-y-0.5 overflow-auto">
          {docs.slice(0, 8).map((d, i) => (
            <Link key={d.id} to="/skydoc/doc/$id" params={{ id: d.id }} className={`nav-item truncate ${d.id === activeId ? "bg-accent text-foreground" : ""}`}>
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded ${COLORS[i % COLORS.length]}`}><FileText className="h-2.5 w-2.5" /></span>
              <span className="truncate">{d.title}</span>
            </Link>
          ))}
          <button onClick={async () => nav({ to: "/skydoc/doc/$id", params: { id: await createDoc() } })} className="nav-item w-full"><Plus className="h-4 w-4" />Nouveau projet</button>
        </div>
      )}
      <button onClick={async () => { await supabase.auth.signOut(); nav({ to: "/skydoc" }); }} className="nav-item mt-auto"><LogOut className="h-4 w-4" />Déconnexion</button>
    </aside>
  );
}

export function HoverSidebar({ activeId, onSearch }: { activeId?: string; onSearch?: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div onMouseEnter={() => setOpen(true)} className="fixed inset-y-0 left-0 z-40 hidden w-4 md:block" />
      <div className={`edge-hint left-1 ${open ? "opacity-0" : ""}`} />
      <div
        onMouseLeave={() => setOpen(false)}
        className={`sd-glass sd-holo fixed inset-y-3 left-3 z-50 w-64 rounded-3xl transition-all duration-300 ${open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[110%] opacity-0"}`}
      >
        <Sidebar activeId={activeId} onSearch={onSearch} />
      </div>
    </>
  );
}
