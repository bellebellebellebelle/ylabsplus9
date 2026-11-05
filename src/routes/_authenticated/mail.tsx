import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Search, Sparkles, Bell, ArrowLeft, Archive, Trash2, Mail, Clock, Folder, Tag, Star, RefreshCw, Reply,
  MoreHorizontal, Paperclip, Download, SlidersHorizontal, Circle, ArrowRight, ListChecks, PenLine, CalendarClock, LayoutGrid,
} from "lucide-react";
import { format, isToday, isYesterday, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Sidebar, type FolderKey, FOLDERS } from "@/components/mail/Sidebar";
import { AddressPicker } from "@/components/mail/AddressPicker";
import { Compose, type ComposeInit } from "@/components/mail/Compose";
import { useMailbox, useMailConfig } from "@/components/mail/use-mailbox";
import { cn } from "@/lib/utils";

type Msg = Tables<"mail_messages">;
const folderKeys = FOLDERS.map((f) => f.key) as [FolderKey, ...FolderKey[]];

export const Route = createFileRoute("/_authenticated/mail")({
  validateSearch: z.object({ folder: z.enum(folderKeys).optional() }),
  head: () => ({
    meta: [
      { title: "Boîte de réception — Nova Mail" },
      { name: "description", content: "Votre boîte de réception intelligente Nova Mail." },
      { property: "og:title", content: "Boîte de réception — Nova Mail" },
      { property: "og:description", content: "Votre boîte de réception intelligente Nova Mail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <div className="sendyme"><InboxPage /></div>,
});

const isNewsletter = (m: Msg) => /newsletter|digest|hebdo|weekly|noreply|no-reply/i.test(m.from_address + m.subject);
const isPromo = (m: Msg) => /promo|offre|%|soldes|réduction|deal|sale/i.test(m.subject);

function filterFolder(all: Msg[], f: FolderKey) {
  switch (f) {
    case "inbox": return all.filter((m) => m.folder === "inbox");
    case "starred": return all.filter((m) => m.is_starred && m.folder !== "trash");
    case "pending": return all.filter((m) => m.folder === "inbox" && !m.is_read);
    case "important": return all.filter((m) => m.is_priority && m.folder !== "trash");
    case "all": return all.filter((m) => m.folder !== "trash" && m.folder !== "spam");
    default: return all.filter((m) => m.folder === f);
  }
}

function fmtDate(d: string) {
  const dt = new Date(d);
  if (isToday(dt)) return format(dt, "HH:mm");
  if (isYesterday(dt)) return "Hier";
  return format(dt, "d MMM", { locale: fr });
}

function InboxPage() {
  const { folder = "inbox" } = Route.useSearch();
  const mb = useMailbox();
  const cfg = useMailConfig();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [reading, setReading] = useState(false);
  const [compose, setCompose] = useState<{ open: boolean; init: ComposeInit; key: number }>({ open: false, init: {}, key: 0 });
  const searchRef = useRef<HTMLInputElement>(null);

  const msgs = useQuery({
    queryKey: ["mail_messages"],
    enabled: Boolean(mb.data),
    queryFn: async () => {
      const { data, error } = await supabase.from("mail_messages").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!mb.data) return;
    const ch = supabase
      .channel(`messages-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mail_messages" }, () => qc.invalidateQueries({ queryKey: ["mail_messages"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mb.data, qc]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const all = msgs.data ?? [];
  const list = useMemo(() => {
    const base = filterFolder(all, folder);
    if (!q.trim()) return base;
    const s = q.toLowerCase();
    return all.filter((m) => [m.subject, m.from_name, m.from_address, m.body_text, m.to_addresses].some((x) => x?.toLowerCase().includes(s)));
  }, [all, folder, q]);
  const selected = list.find((m) => m.id === selectedId) ?? list[0] ?? null;

  useEffect(() => {
    if (selected && !selected.is_read) supabase.from("mail_messages").update({ is_read: true }).eq("id", selected.id).then();
  }, [selected?.id]);

  if (mb.isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  if (!mb.data) return <AddressPicker domain={cfg.data?.domain ?? ""} />;

  const domain = cfg.data?.domain ?? "";
  const address = `${mb.data.local_part}@${domain}`;
  const inbox = all.filter((m) => m.folder === "inbox");
  const counts: Partial<Record<FolderKey, number>> = {
    inbox: inbox.filter((m) => !m.is_read).length,
    drafts: all.filter((m) => m.folder === "drafts").length,
  };

  const update = async (id: string, patch: Partial<Msg>) => {
    await supabase.from("mail_messages").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["mail_messages"] });
  };
  const openCompose = (init: ComposeInit = {}) => setCompose((c) => ({ open: true, init, key: c.key + 1 }));

  return (
    <div className="flex h-dvh gap-4 bg-background p-2 font-sans md:p-3">
      <div className="hidden md:flex"><Sidebar active={folder} counts={counts} onCompose={() => openCompose()} address={address} name={mb.data.display_name} /></div>
      {menu && (
        <div className="fixed inset-0 z-50 flex bg-foreground/40 md:hidden" onClick={() => setMenu(false)}>
          <div className="h-full p-2" onClick={(e) => { if ((e.target as HTMLElement).closest("a,button")) setMenu(false); e.stopPropagation(); }}>
            <Sidebar active={folder} counts={counts} onCompose={() => openCompose()} address={address} name={mb.data.display_name} />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col gap-3 py-1 md:gap-4 md:py-2">
        <header className="flex items-center gap-2 md:gap-4">
          <button onClick={() => setMenu(true)} className="shrink-0 rounded-2xl bg-card p-2.5 shadow-soft md:hidden" aria-label="Menu"><LayoutGrid className="h-5 w-5" /></button>
          <div className="flex min-w-0 w-full max-w-md items-center gap-3 rounded-2xl bg-card px-4 py-2.5 shadow-soft">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans vos messages…" className="flex-1 bg-transparent text-sm outline-none" />
            <kbd className="hidden rounded-md sm:inline bg-muted px-1.5 text-xs text-muted-foreground">⌘ K</kbd>
          </div>
        </header>

        <div className="hidden sm:block"><SmartCards all={inbox} /></div>

        <div className="flex min-h-0 flex-1 gap-4">
          <section className={cn("w-full shrink-0 flex-col rounded-3xl bg-card shadow-soft md:flex md:w-80", reading ? "hidden" : "flex")}>
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-semibold">{FOLDERS.find((f) => f.key === folder)?.label}</h2>
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
              {list.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun message ici pour l'instant.</p>}
              {list.map((m) => (
                <button key={m.id}
                  onClick={() => m.folder === "drafts" ? openCompose({ to: m.to_addresses, subject: m.subject, text: m.body_text ?? "", draftId: m.id }) : (setSelectedId(m.id), setReading(true))}
                  className={cn("flex w-full gap-3 rounded-2xl p-3 text-left transition hover:bg-muted", selected?.id === m.id && "bg-accent")}>
                  <Avatar name={m.folder === "sent" ? m.to_addresses : (m.from_name || m.from_address)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-sm", !m.is_read ? "font-semibold" : "font-medium")}>
                        {m.folder === "sent" ? `À : ${m.to_addresses}` : (m.from_name || m.from_address)}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(m.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium">{m.subject || "(sans objet)"}</p>
                      {!m.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{m.body_text?.slice(0, 120)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className={cn("min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-card shadow-soft md:flex", reading ? "flex" : "hidden")}>
            <button onClick={() => setReading(false)} className="flex items-center gap-2 border-b px-5 py-3 text-sm font-medium md:hidden"><ArrowLeft className="h-4 w-4" /> Retour</button>
            {selected ? (
              <Reader m={selected} onUpdate={update}
                onReply={() => openCompose({ to: selected.from_address, subject: selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`, text: `\n\n> ${(selected.body_text ?? "").split("\n").join("\n> ")}` })} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                <Mail className="h-10 w-10" />
                <p>Sélectionnez un message.</p>
                <p className="text-xs">Votre adresse : <span className="font-medium text-foreground">{address}</span></p>
              </div>
            )}
          </section>
        </div>
      </main>

      <AssistantPanel all={all} onSelect={setSelectedId} onCompose={() => openCompose()} onSearchUnread={() => setQ("")} />

      <Compose key={compose.key} open={compose.open} onOpenChange={(o) => setCompose((c) => ({ ...c, open: o }))} init={compose.init} from={`${mb.data.display_name} <${address}>`} />
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const n = name || "?";
  const hue = [...n].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
  const cls = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-primary"][hue];
  return <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground", cls)}>{n.slice(0, 1).toUpperCase()}</div>;
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - (v / max) * 30}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" className="h-10 w-24" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SmartCards({ all }: { all: Msg[] }) {
  const series = (pred: (m: Msg) => boolean) =>
    Array.from({ length: 7 }, (_, i) => {
      const day = subDays(new Date(), 6 - i).toDateString();
      return all.filter((m) => pred(m) && new Date(m.created_at).toDateString() === day).length;
    });
  const cards = [
    { label: "Prioritaire", pred: (m: Msg) => m.is_priority, color: "var(--chart-1)", title: "text-primary" },
    { label: "En attente", pred: (m: Msg) => !m.is_read, color: "var(--chart-2)", title: "" },
    { label: "Newsletters", pred: isNewsletter, color: "var(--chart-3)", title: "" },
    { label: "Promotions", pred: isPromo, color: "var(--chart-4)", title: "" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {cards.map((c) => {
        const s = series(c.pred);
        const total = all.filter(c.pred).length;
        const delta = (s[6] ?? 0) - (s[5] ?? 0);
        return (
          <div key={c.label} className="rounded-2xl bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <p className={cn("text-sm font-medium", c.title)}>{c.label}</p>
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-semibold">{total}</p>
                <p className="text-xs text-muted-foreground"><span className={delta >= 0 ? "text-success" : "text-destructive"}>{delta >= 0 ? "+" : ""}{delta}</span> depuis hier</p>
              </div>
              <Spark values={s} color={c.color} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function summarize(text: string) {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim())
    .filter((s) => s.length > 25 && !/^(bonjour|salut|hello|cordialement|bonne journée)/i.test(s)).slice(0, 3);
}

function Reader({ m, onUpdate, onReply }: { m: Msg; onUpdate: (id: string, p: Partial<Msg>) => void; onReply: () => void }) {
  const atts = useQuery({
    queryKey: ["attachments", m.id],
    queryFn: async () => (await supabase.from("mail_attachments").select("*").eq("message_id", m.id)).data ?? [],
  });
  const points = summarize(m.body_text ?? "");
  const download = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("mail-attachments").createSignedUrl(path, 60, { download: name });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  const tool = "rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground";
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-3 md:px-5">
        <button className={tool} title="Archiver" onClick={() => onUpdate(m.id, { folder: "inbox", is_read: true })}><ArrowLeft className="h-4 w-4" /></button>
        <button className={tool} title="Archiver" onClick={() => onUpdate(m.id, { is_read: true })}><Archive className="h-4 w-4" /></button>
        <button className={tool} title="Corbeille" onClick={() => onUpdate(m.id, { folder: "trash" })}><Trash2 className="h-4 w-4" /></button>
        <button className={tool} title="Marquer non lu" onClick={() => onUpdate(m.id, { is_read: false })}><Mail className="h-4 w-4" /></button>
        <button className={tool} title="Spam" onClick={() => onUpdate(m.id, { folder: "spam" })}><Clock className="h-4 w-4" /></button>
        <button className={tool}><Folder className="h-4 w-4" /></button>
        <button className={tool} title="Prioritaire" onClick={() => onUpdate(m.id, { is_priority: !m.is_priority })}><Tag className="h-4 w-4" /></button>
        <div className="flex-1" />
        <button className={tool} onClick={() => onUpdate(m.id, { is_starred: !m.is_starred })}><Star className={cn("h-4 w-4", m.is_starred && "fill-warning text-warning")} /></button>
        <button className={tool}><RefreshCw className="h-4 w-4" /></button>
      </div>
      <div className="space-y-6 p-4 md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{m.subject || "(sans objet)"}</h1>
          {m.is_priority && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">● Prioritaire</span>}
          <Sparkles className="h-4 w-4 text-warning" />
        </div>
        <div className="flex items-center gap-3">
          <Avatar name={m.from_name || m.from_address} />
          <div className="flex-1">
            <p className="text-sm font-semibold">{m.from_name || m.from_address}</p>
            <p className="text-xs text-muted-foreground">{m.from_address} → {m.to_addresses}</p>
          </div>
          <span className="text-sm text-muted-foreground">{format(new Date(m.created_at), "d MMM, HH:mm", { locale: fr })}</span>
          <button className={tool} onClick={onReply}><Reply className="h-4 w-4" /></button>
          <button className={tool}><MoreHorizontal className="h-4 w-4" /></button>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-7">{m.body_text || "(message vide)"}</div>
        {!!atts.data?.length && (
          <div className="flex flex-wrap gap-3">
            {atts.data.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl border bg-muted/50 px-4 py-3">
                <Paperclip className="h-5 w-5 text-primary" />
                <div><p className="text-sm font-medium">{a.filename}</p><p className="text-xs text-muted-foreground">{((a.size_bytes ?? 0) / 1024 / 1024).toFixed(1)} MB</p></div>
                <button className={tool} onClick={() => download(a.storage_path, a.filename)}><Download className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        {points.length > 0 && (
          <div className="rounded-3xl bg-gradient-ai p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> Résumé par IA</p>
            <ul className="mt-3 space-y-2">
              {points.map((p, i) => <li key={i} className="flex gap-2 text-sm"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{p}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantPanel({ all, onSelect, onCompose, onSearchUnread }: { all: Msg[]; onSelect: (id: string) => void; onCompose: () => void; onSearchUnread: () => void }) {
  const unread = all.filter((m) => m.folder === "inbox" && !m.is_read);
  const tasks = [...unread].sort((a, b) => Number(b.is_priority) - Number(a.is_priority)).slice(0, 3);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i).toDateString();
    const dayMsgs = all.filter((m) => m.folder === "inbox" && new Date(m.created_at).toDateString() === d);
    return dayMsgs.length ? dayMsgs.filter((m) => m.is_read).length / dayMsgs.length : 0;
  });
  const recent = all.filter((m) => m.folder === "inbox" && new Date(m.created_at) > subDays(new Date(), 7));
  const pct = recent.length ? Math.round((recent.filter((m) => m.is_read).length / recent.length) * 100) : 100;
  const badge = (i: number, p: boolean) => p || i === 0 ? ["Urgent", "bg-urgent-soft text-destructive"] : i === 1 ? ["Aujourd'hui", "bg-success-soft text-success"] : ["Demain", "bg-muted text-muted-foreground"];
  const actions = [
    { label: "Résumer mes emails non lus", icon: ListChecks, run: onSearchUnread },
    { label: "Rédiger une réponse", icon: PenLine, run: onCompose },
    { label: "Organiser ma boîte de réception", icon: LayoutGrid, run: () => {} },
    { label: "Planifier un créneau", icon: CalendarClock, run: () => {} },
  ];
  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto py-2 xl:flex">
      <div className="flex items-center justify-end gap-3">
        <button className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2 text-sm font-medium shadow-soft"><Sparkles className="h-4 w-4" /> Assistant IA</button>
        <Bell className="h-5 w-5 text-muted-foreground" />
        <div className="h-8 w-8 rounded-full bg-orb" />
      </div>
      <div className="rounded-3xl bg-card p-5 shadow-soft">
        <p className="font-semibold">Assistant IA <span className="ml-1 rounded bg-accent px-1.5 text-[10px] text-accent-foreground">BETA</span></p>
        <div className="mx-auto my-6 h-20 w-20 rounded-full bg-orb shadow-soft" />
        <p className="text-center font-medium">Comment puis-je vous aider aujourd'hui ?</p>
        <div className="mt-4 space-y-1 rounded-2xl bg-muted/50 p-2">
          {actions.map((a) => (
            <button key={a.label} onClick={a.run} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-card hover:text-foreground">
              <a.icon className="h-4 w-4" /> {a.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-3xl bg-card p-5 shadow-soft">
        <p className="font-semibold">Focus</p>
        <p className="text-sm text-muted-foreground">{tasks.length} tâche{tasks.length > 1 ? "s" : ""} importante{tasks.length > 1 ? "s" : ""}</p>
        <div className="mt-3 space-y-3">
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">Tout est à jour 🎉</p>}
          {tasks.map((t, i) => {
            const [l, c] = badge(i, t.is_priority);
            return (
              <button key={t.id} onClick={() => onSelect(t.id)} className="flex w-full items-center gap-3 text-left">
                <Circle className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Répondre à {t.from_name || t.from_address}</p><p className="truncate text-xs text-muted-foreground">{t.subject}</p></div>
                <span className={cn("rounded-md px-2 py-0.5 text-xs", c)}>{l}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 flex items-center gap-1 text-sm text-muted-foreground">Voir toutes mes tâches <ArrowRight className="h-3 w-3" /></p>
      </div>
      <div className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between"><p className="font-semibold">Productivité</p><span className="rounded-lg border px-2 py-1 text-xs">7 derniers jours</span></div>
        <div className="mt-3 flex items-end justify-between">
          <div><p className="text-3xl font-semibold">{pct}%</p><p className="text-xs text-muted-foreground">messages traités</p></div>
          <div className="flex h-12 items-end gap-1.5">
            {days.map((d, i) => <div key={i} className="w-2.5 rounded-sm bg-chart-1/70" style={{ height: `${Math.max(10, d * 100)}%` }} />)}
          </div>
        </div>
      </div>
    </aside>
  );
}
