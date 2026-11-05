import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Search,
  StickyNote,
  ListChecks,
  Trash2,
  Sparkles,
  Building2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  LogOut,
  Loader2,
  Mail,
  Phone,
  Target,
  BellRing,
  Link2,
  Palette,
  Pencil,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProjectId, scopeToProject, withProject } from "@/tep/lib/project-scope";
import { searchCompanies, researchCompany, assistNote, smartNote } from "@/tep/lib/prospection/ai.functions";
import type { CompanyResult } from "@/tep/lib/prospection/ai.functions";

export const Route = createFileRoute("/_tep/_tepauth/prospection")({
  head: () => ({
    meta: [
      { title: "Tableau — Smart Prospection" },
      {
        name: "description",
        content:
          "Tableau infini avec post-it intelligents pour rechercher des entreprises, analyser vos prospects et organiser votre prospection.",
      },
      { property: "og:title", content: "Tableau — Smart Prospection" },
      {
        property: "og:description",
        content: "Post-it intelligents, recherche d'entreprises et fiches prospect assistées par IA.",
      },
    ],
  }),
  component: BoardPage,
});

type NoteType = "search" | "company" | "note" | "task" | "email" | "script" | "qualif" | "reminder";

type TaskItem = { text: string; done: boolean };

type NoteData = {
  query?: string;
  results?: CompanyResult[];
  items?: TaskItem[];
  company?: CompanyResult;
  links?: string[];
};

type Note = {
  id: string;
  parent_id: string | null;
  type: NoteType;
  title: string;
  content: string;
  data: NoteData;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  status: string;
};

const PALETTE: { key: string; label: string; className: string }[] = [
  { key: "amber", label: "Ambre", className: "bg-note-amber" },
  { key: "lime", label: "Vert", className: "bg-note-lime" },
  { key: "sky", label: "Bleu", className: "bg-note-sky" },
  { key: "rose", label: "Rose", className: "bg-note-rose" },
  { key: "violet", label: "Violet", className: "bg-note-violet" },
];

const DEFAULT_COLOR: Record<NoteType, string> = {
  search: "sky",
  company: "lime",
  note: "amber",
  task: "violet",
  email: "rose",
  script: "sky",
  qualif: "violet",
  reminder: "amber",
};

const BOARD_COLORS: { key: string; label: string; value: string }[] = [
  { key: "clair", label: "Clair", value: "oklch(0.97 0.005 250)" },
  { key: "sable", label: "Sable", value: "oklch(0.96 0.02 90)" },
  { key: "menthe", label: "Menthe", value: "oklch(0.96 0.03 160)" },
  { key: "ardoise", label: "Ardoise", value: "oklch(0.88 0.015 250)" },
  { key: "nuit", label: "Nuit", value: "oklch(0.32 0.03 260)" },
];

const SMART_TYPES: NoteType[] = ["email", "script", "qualif", "reminder"];

const STATUSES = ["todo", "contacté", "relance", "gagné", "perdu"];

function colorClass(note: Note) {
  const key = PALETTE.find((p) => p.key === note.color)?.className;
  if (key) return key;
  return PALETTE.find((p) => p.key === DEFAULT_COLOR[note.type])?.className ?? "bg-note-amber";
}

/** Rendu markdown minimal (titres, gras, listes) sans dépendance externe. */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 leading-relaxed">
      {lines.map((line, i) => {
        const raw = line.trim();
        if (!raw || raw === "---") return <div key={i} className="h-1" />;
        const heading = /^(#{1,6})\s+(.*)$/.exec(raw);
        const bullet = /^[-*]\s+(.*)$/.exec(raw);
        const body = heading?.[2] ?? bullet?.[1] ?? raw;
        const parts = body.split(/\*\*(.+?)\*\*/g).map((p, j) =>
          j % 2 === 1 ? (
            <strong key={j} className="font-semibold">
              {p}
            </strong>
          ) : (
            <span key={j}>{p.replace(/\*/g, "")}</span>
          ),
        );
        if (heading)
          return (
            <p key={i} className="mt-2 text-[13px] font-bold text-foreground">
              {parts}
            </p>
          );
        if (bullet)
          return (
            <p key={i} className="flex gap-1.5 break-words">
              <span className="opacity-60">•</span>
              <span className="min-w-0 flex-1">{parts}</span>
            </p>
          );
        return (
          <p key={i} className="break-words">
            {parts}
          </p>
        );
      })}
    </div>
  );
}

function BoardPage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [boardColor, setBoardColor] = useState<string>(BOARD_COLORS[0]!.value);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);
  const drag = useRef<{ id: string; px: number; py: number; nx: number; ny: number } | null>(null);
  const resize = useRef<{ id: string; px: number; py: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("board-color");
    if (saved) setBoardColor(saved);
  }, []);

  const load = useCallback(async () => {
    const { data } = await scopeToProject(supabase.from("tep_notes").select("*")).order("created_at");
    if (data) setNotes(data as unknown as Note[]);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("notes-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "tep_notes" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const patch = useCallback(async (id: string, values: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...values } : n)));
    await supabase.from("tep_notes").update(values).eq("id", id);
  }, []);

  const remove = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id && n.parent_id !== id));
    await supabase.from("tep_notes").delete().eq("id", id);
  }, []);

  const create = useCallback(
    async (type: NoteType, extra: Partial<Note> = {}) => {
      const { data: session } = await supabase.auth.getUser();
      if (!session.user) return;
      const rect = boardRef.current?.getBoundingClientRect();
      const cx = ((rect ? rect.width / 2 : 400) - view.x) / view.scale - 140;
      const cy = ((rect ? rect.height / 2 : 300) - view.y) / view.scale - 100;
      const large = type === "company" || type === "search";
      const base = {
        user_id: session.user.id,
        project_id: getProjectId(),
        type,
        x: Math.round(cx),
        y: Math.round(cy),
        w: large ? 340 : 300,
        h: large ? 360 : 260,
        color: DEFAULT_COLOR[type],
        title:
          type === "search"
            ? "Recherche entreprises"
            : type === "task"
              ? "Liste de tâches"
              : type === "note"
                ? "Note"
                : type === "email"
                  ? "Email d'approche"
                  : type === "script"
                    ? "Script d'appel"
                    : type === "qualif"
                      ? "Qualification"
                      : type === "reminder"
                        ? "Plan de relance"
                        : "Entreprise",
        ...extra,
      };
      const { data } = await supabase.from("tep_notes").insert(base).select().single();
      if (data) setNotes((prev) => [...prev, data as unknown as Note]);
    },
    [view],
  );

  const duplicate = useCallback(
    (note: Note) => {
      void create(note.type, {
        title: `${note.title} (copie)`,
        content: note.content,
        data: { ...note.data, links: [] },
        color: note.color,
        x: Math.round(note.x + 32),
        y: Math.round(note.y + 32),
        w: Math.round(note.w),
        h: Math.round(note.h),
      });
    },
    [create],
  );

  const toggleLink = useCallback(
    (id: string) => {
      if (!linkFrom) {
        setLinkFrom(id);
        return;
      }
      if (linkFrom === id) {
        setLinkFrom(null);
        return;
      }
      const source = notes.find((n) => n.id === linkFrom);
      if (source) {
        const links = source.data.links ?? [];
        const next = links.includes(id) ? links.filter((l) => l !== id) : [...links, id];
        void patch(source.id, { data: { ...source.data, links: next } });
      }
      setLinkFrom(null);
    },
    [linkFrom, notes, patch],
  );

  // Pan (le zoom molette/trackpad est volontairement désactivé)
  function onBoardPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return;
    pan.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pan.current) {
      setView((v) => ({
        ...v,
        x: pan.current!.vx + (e.clientX - pan.current!.px),
        y: pan.current!.vy + (e.clientY - pan.current!.py),
      }));
    } else if (drag.current) {
      const d = drag.current;
      const nx = d.nx + (e.clientX - d.px) / view.scale;
      const ny = d.ny + (e.clientY - d.py) / view.scale;
      setNotes((prev) => prev.map((n) => (n.id === d.id ? { ...n, x: nx, y: ny } : n)));
    } else if (resize.current) {
      const r = resize.current;
      const w = Math.max(240, r.w + (e.clientX - r.px) / view.scale);
      const h = Math.max(160, r.h + (e.clientY - r.py) / view.scale);
      setNotes((prev) => prev.map((n) => (n.id === r.id ? { ...n, w, h } : n)));
    }
  }

  function onPointerUp() {
    if (drag.current) {
      const n = notes.find((x) => x.id === drag.current!.id);
      if (n) void patch(n.id, { x: Math.round(n.x), y: Math.round(n.y) });
    }
    if (resize.current) {
      const n = notes.find((x) => x.id === resize.current!.id);
      if (n) void patch(n.id, { w: Math.round(n.w), h: Math.round(n.h) });
    }
    pan.current = null;
    drag.current = null;
    resize.current = null;
  }

  function zoom(factor: number) {
    setView((v) => ({ ...v, scale: Math.min(2.5, Math.max(0.25, v.scale * factor)) }));
  }

  function pickBoardColor(value: string) {
    setBoardColor(value);
    localStorage.setItem("board-color", value);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const links = notes.flatMap((n) =>
    (n.data.links ?? [])
      .map((targetId) => {
        const t = notes.find((x) => x.id === targetId);
        return t ? { id: `${n.id}-${targetId}`, from: n, to: t } : null;
      })
      .filter(Boolean as unknown as (v: unknown) => v is { id: string; from: Note; to: Note }),
  );

  return (
    <main className="prospection flex h-screen w-full flex-col overflow-hidden">
      <header className="z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <span className="mr-2 flex items-center gap-2 text-sm font-semibold text-card-foreground">
          <Sparkles className="h-4 w-4" /> Smart Prospection
        </span>
        <ToolButton icon={Search} label="Recherche" onClick={() => void create("search")} />
        <ToolButton icon={Building2} label="Entreprise" onClick={() => void create("company")} />
        <ToolButton icon={StickyNote} label="Note" onClick={() => void create("note")} />
        <ToolButton
          icon={ListChecks}
          label="Tâches"
          onClick={() => void create("task", { data: { items: [] } })}
        />
        <ToolButton icon={Mail} label="Email IA" onClick={() => void create("email")} />
        <ToolButton icon={Phone} label="Script d'appel" onClick={() => void create("script")} />
        <ToolButton icon={Target} label="Qualification" onClick={() => void create("qualif")} />
        <ToolButton icon={BellRing} label="Relance" onClick={() => void create("reminder")} />
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1" title="Couleur du tableau">
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            {BOARD_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                title={c.label}
                onClick={() => pickBoardColor(c.value)}
                style={{ background: c.value }}
                className={`h-4 w-4 rounded-full border ${boardColor === c.value ? "border-foreground" : "border-border"}`}
              />
            ))}
          </span>
          <ToolButton icon={ZoomOut} label="" onClick={() => zoom(0.9)} />
          <span className="w-10 text-center text-xs text-muted-foreground">
            {Math.round(view.scale * 100)}%
          </span>
          <ToolButton icon={ZoomIn} label="" onClick={() => zoom(1.1)} />
          <ToolButton icon={Crosshair} label="" onClick={() => setView({ x: 0, y: 0, scale: 1 })} />
          <ToolButton icon={LogOut} label="" onClick={() => void signOut()} />
        </div>
      </header>

      {linkFrom && (
        <div className="z-10 bg-primary px-3 py-1 text-center text-xs text-primary-foreground">
          Mode liaison : cliquez sur l'icône lien d'un autre post-it pour le connecter.
        </div>
      )}

      <div
        ref={boardRef}
        onPointerDown={onBoardPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative flex-1 overflow-hidden"
        style={{
          backgroundColor: boardColor,
          backgroundImage: "radial-gradient(var(--canvas-grid) 1px, transparent 1px)",
          backgroundSize: `${24 * view.scale}px ${24 * view.scale}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
          cursor: "grab",
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <svg className="pointer-events-none absolute left-0 top-0 h-0 w-0 overflow-visible">
            {links.map((l) => (
              <line
                key={l.id}
                x1={l.from.x + l.from.w / 2}
                y1={l.from.y + l.from.h / 2}
                x2={l.to.x + l.to.w / 2}
                y2={l.to.y + l.to.h / 2}
                stroke="var(--color-primary)"
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={0.5}
              />
            ))}
          </svg>
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              linking={linkFrom === note.id}
              onDragStart={(e) => {
                drag.current = {
                  id: note.id,
                  px: e.clientX,
                  py: e.clientY,
                  nx: note.x,
                  ny: note.y,
                };
              }}
              onResizeStart={(e) => {
                resize.current = {
                  id: note.id,
                  px: e.clientX,
                  py: e.clientY,
                  w: note.w,
                  h: note.h,
                };
              }}
              onPatch={patch}
              onRemove={remove}
              onDuplicate={() => duplicate(note)}
              onToggleLink={() => toggleLink(note.id)}
              onCreateChild={(company) =>
                void create("company", {
                  parent_id: note.id,
                  title: company.name,
                  x: Math.round(note.x + note.w + 32),
                  y: Math.round(note.y + Math.random() * 120),
                  w: 360,
                  h: 420,
                  data: { company },
                })
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Icon className="h-4 w-4" />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

function NoteCard({
  note,
  linking,
  onDragStart,
  onResizeStart,
  onPatch,
  onRemove,
  onDuplicate,
  onToggleLink,
  onCreateChild,
}: {
  note: Note;
  linking: boolean;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onPatch: (id: string, values: Partial<Note>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onDuplicate: () => void;
  onToggleLink: () => void;
  onCreateChild: (company: CompanyResult) => void;
}) {
  const runSearch = useServerFn(searchCompanies);
  const runResearch = useServerFn(researchCompany);
  const runAssist = useServerFn(assistNote);
  const runSmart = useServerFn(smartNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(note.data.query ?? "");
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [editing, setEditing] = useState(false);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => setContent(note.content), [note.content]);
  const [taskText, setTaskText] = useState("");

  async function doSearch() {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await runSearch({ data: { query } });
      await onPatch(note.id, { data: { ...note.data, query, results: res.companies } });
    } catch {
      setError("Recherche impossible pour le moment.");
    }
    setBusy(false);
  }

  async function doResearch() {
    setBusy(true);
    setError(null);
    try {
      const res = await runResearch({
        data: {
          name: note.title,
          context: note.data.company
            ? `Secteur : ${note.data.company.sector}, lieu : ${note.data.company.location}`
            : "",
        },
      });
      await onPatch(note.id, { content: res.content });
    } catch {
      setError("Analyse impossible pour le moment.");
    }
    setBusy(false);
  }

  async function doAssist() {
    setBusy(true);
    setError(null);
    try {
      const res = await runAssist({
        data: {
          instruction: "Propose un plan d'action de prospection concret à partir de ce contenu.",
          content: note.content || note.title,
        },
      });
      await onPatch(note.id, { content: `${note.content}\n\n${res.content}`.trim() });
    } catch {
      setError("Assistance IA indisponible.");
    }
    setBusy(false);
  }

  async function doSmart() {
    setBusy(true);
    setError(null);
    try {
      const res = await runSmart({
        data: { kind: note.type, context: note.content || note.title },
      });
      await onPatch(note.id, { content: res.content });
    } catch {
      setError("Génération IA indisponible.");
    }
    setBusy(false);
  }

  const items = note.data.items ?? [];
  const isSmart = SMART_TYPES.includes(note.type);
  const linkCount = (note.data.links ?? []).length;

  const richBody = (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {editing ? (
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (content !== note.content) void onPatch(note.id, { content });
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="min-h-0 flex-1 w-full resize-none rounded border border-border/50 bg-background/60 p-2 outline-none"
        />
      ) : (
        <div
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="min-h-0 flex-1 overflow-auto rounded bg-background/50 p-2"
        >
          {note.content ? (
            <Markdown text={note.content} />
          ) : (
            <p className="text-muted-foreground">Aucun contenu pour l'instant.</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`absolute flex flex-col rounded-lg border shadow-md ${colorClass(note)} ${
        linking ? "border-primary ring-2 ring-primary" : "border-border/60"
      }`}
      style={{ left: note.x, top: note.y, width: note.w, height: note.h }}
    >
      <div
        onPointerDown={onDragStart}
        className="flex cursor-grab items-center gap-1.5 rounded-t-lg border-b border-border/40 px-2 py-1.5"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== note.title && void onPatch(note.id, { title })}
          onPointerDown={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
        />
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/70" />}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setShowColors((v) => !v)}
          title="Couleur"
          className="text-foreground/60 hover:text-foreground"
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleLink}
          title="Lier à un autre post-it"
          className={`hover:text-foreground ${linkCount ? "text-primary" : "text-foreground/60"}`}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDuplicate}
          title="Dupliquer"
          className="text-foreground/60 hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => void onRemove(note.id)}
          title="Supprimer"
          className="text-foreground/60 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {showColors && (
        <div className="flex items-center gap-1.5 border-b border-border/40 px-2 py-1.5">
          {PALETTE.map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.label}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                setShowColors(false);
                void onPatch(note.id, { color: p.key });
              }}
              className={`h-4 w-4 rounded-full border border-border/60 ${p.className}`}
            />
          ))}
        </div>
      )}

      <div
        onWheel={(e) => e.stopPropagation()}
        className="flex min-h-0 flex-1 flex-col overflow-auto p-2 text-xs text-foreground"
      >
        {note.type === "search" && (
          <div className="space-y-2">
            <div className="flex gap-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void doSearch()}
                placeholder="Ex : agences web à Lyon, 10-50 salariés"
                className="min-w-0 flex-1 rounded border border-border/60 bg-background/70 px-2 py-1 outline-none"
              />
              <button
                type="button"
                onClick={() => void doSearch()}
                disabled={busy}
                className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-60"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            </div>
            {(note.data.results ?? []).map((c, i) => (
              <div key={i} className="rounded border border-border/50 bg-background/60 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-muted-foreground">
                      {c.sector} · {c.location} · {c.size}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreateChild(c)}
                    title="Créer un sous-post-it"
                    className="rounded bg-primary px-1.5 py-1 text-primary-foreground"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <p className="mt-1">{c.why}</p>
              </div>
            ))}
          </div>
        )}

        {note.type === "company" && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <select
                value={note.status}
                onChange={(e) => void onPatch(note.id, { status: e.target.value })}
                className="rounded border border-border/60 bg-background/70 px-1.5 py-1"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void doResearch()}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-60"
              >
                <Sparkles className="h-3 w-3" /> Recherche complète
              </button>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center gap-1 rounded border border-border/60 bg-background/70 px-2 py-1"
              >
                <Pencil className="h-3 w-3" /> {editing ? "Aperçu" : "Éditer"}
              </button>
            </div>
            {note.data.company?.website && (
              <p className="truncate text-muted-foreground">{note.data.company.website}</p>
            )}
            {richBody}
          </div>
        )}

        {note.type === "note" && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={() => content !== note.content && void onPatch(note.id, { content })}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Vos notes de prospection..."
              className="min-h-0 flex-1 resize-none bg-transparent outline-none"
            />
            <button
              type="button"
              onClick={() => void doAssist()}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-60"
            >
              <Sparkles className="h-3 w-3" /> Plan d'action IA
            </button>
          </div>
        )}

        {isSmart && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => void doSmart()}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-60"
              >
                <Sparkles className="h-3 w-3" /> Générer
              </button>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center gap-1 rounded border border-border/60 bg-background/70 px-2 py-1"
              >
                <Pencil className="h-3 w-3" /> {editing ? "Aperçu" : "Éditer"}
              </button>
              {note.content && (
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(note.content)}
                  className="inline-flex items-center gap-1 rounded border border-border/60 bg-background/70 px-2 py-1"
                >
                  <Copy className="h-3 w-3" /> Copier
                </button>
              )}
            </div>
            {richBody}
          </div>
        )}

        {note.type === "task" && (
          <div className="space-y-1">
            {items.map((it, i) => (
              <label key={i} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={it.done}
                  onChange={() => {
                    const next = items.map((x, j) => (j === i ? { ...x, done: !x.done } : x));
                    void onPatch(note.id, { data: { ...note.data, items: next } });
                  }}
                />
                <span className={it.done ? "line-through opacity-60" : ""}>{it.text}</span>
              </label>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!taskText.trim()) return;
                void onPatch(note.id, {
                  data: { ...note.data, items: [...items, { text: taskText, done: false }] },
                });
                setTaskText("");
              }}
            >
              <input
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Ajouter une tâche..."
                className="mt-1 w-full rounded border border-border/60 bg-background/70 px-2 py-1 outline-none"
              />
            </form>
          </div>
        )}

        {error && <p className="mt-1 text-destructive">{error}</p>}
      </div>

      <div
        onPointerDown={onResizeStart}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-br-lg border-b-2 border-r-2 border-foreground/30"
      />
    </div>
  );
}
