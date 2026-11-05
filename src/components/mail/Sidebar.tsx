import { Link } from "@tanstack/react-router";
import {
  Inbox, Star, Clock, Bookmark, Send, FileText, Mails, ShieldAlert, Trash2, Plus, Sparkles, Settings, LogOut, Gem,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type FolderKey = "inbox" | "starred" | "pending" | "important" | "sent" | "drafts" | "all" | "spam" | "trash";

export const FOLDERS: { key: FolderKey; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Boîte de réception", icon: Inbox },
  { key: "starred", label: "Messages suivis", icon: Star },
  { key: "pending", label: "En attente", icon: Clock },
  { key: "important", label: "Important", icon: Bookmark },
  { key: "sent", label: "Messages envoyés", icon: Send },
  { key: "drafts", label: "Brouillons", icon: FileText },
  { key: "all", label: "Tous les messages", icon: Mails },
  { key: "spam", label: "Spam", icon: ShieldAlert },
  { key: "trash", label: "Corbeille", icon: Trash2 },
];

const SPACES = [
  { name: "Produit", c: "bg-chart-1" },
  { name: "Marketing", c: "bg-chart-2" },
  { name: "Design", c: "bg-chart-4" },
  { name: "Direction", c: "bg-chart-3" },
];

export function Sidebar({
  active, counts, onCompose, address, name,
}: {
  active?: FolderKey; counts: Partial<Record<FolderKey, number>>; onCompose?: () => void; address?: string; name?: string;
}) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto rounded-3xl bg-gradient-sidebar p-4 text-white shadow-soft">
      <div className="flex items-center gap-2 px-2 py-2 text-lg font-semibold tracking-wide">
        <Sparkles className="h-6 w-6" /> NOVA MAIL
        <span className="ml-1 rounded-full bg-sidebar-accent px-2 text-xs">AI</span>
      </div>
      <button onClick={onCompose} className="mt-4 flex items-center justify-between rounded-2xl bg-white px-5 py-3.5 font-semibold text-[oklch(0.3_0.12_265)] shadow-soft transition hover:opacity-95">
        Nouveau message <Sparkles className="h-4 w-4 text-amber-400" />
      </button>
      <nav className="mt-6 space-y-0.5">
        {FOLDERS.map((f) => (
          <Link key={f.key} to="/mail" search={{ folder: f.key }}
            className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition text-white hover:bg-white/10",
              active === f.key && "bg-white/15 font-medium")}>
            <f.icon className="h-4 w-4" />
            <span className="flex-1">{f.label}</span>
            {counts[f.key] ? <span className={cn("text-xs", f.key === "inbox" && "rounded-md bg-primary px-1.5 py-0.5")}>{counts[f.key]}</span> : null}
          </Link>
        ))}
      </nav>
      <div className="mt-6 flex items-center justify-between px-3 text-xs uppercase tracking-wider text-white/70">
        Espaces <Plus className="h-4 w-4" />
      </div>
      <div className="mt-2 space-y-0.5">
        {SPACES.map((s) => (
          <div key={s.name} className="flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-white hover:bg-white/10">
            <span className={cn("h-2 w-2 rounded-full", s.c)} /> {s.name}
          </div>
        ))}
      </div>
      <div className="mt-auto space-y-3 pt-4">
        <div className="relative overflow-hidden rounded-2xl bg-sidebar-accent p-4">
          <p className="text-[10px] font-semibold tracking-widest text-white/70">PREMIUM</p>
          <p className="mt-1 text-sm font-medium">Plan Entreprise</p>
          <p className="text-xs text-white/60">Stockage illimité</p>
          <Gem className="absolute -right-1 bottom-2 h-12 w-12 text-white/40" />
        </div>
        <Link to="/mail-settings" className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white hover:bg-white/10")}>
          <Settings className="h-4 w-4" /> Configuration Mailgun
        </Link>
        <div className="flex items-center gap-3 border-t border-sidebar-border px-2 pt-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {(name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name ?? "—"}</p>
            <p className="truncate text-xs text-white/60">{address ?? ""}</p>
          </div>
          <button title="Déconnexion" onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4 opacity-70" /></button>
        </div>
      </div>
    </aside>
  );
}
