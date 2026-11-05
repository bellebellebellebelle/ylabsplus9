import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Briefcase,
  CheckSquare,
  LogOut,
  Maximize,
  Minus,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBoard } from "@/tep/hooks/recrutement/useBoard";
import { NoteCard } from "@/tep/components/recrutement/NoteCard";
import { Inspector } from "@/tep/components/recrutement/Inspector";
import { CARD_META, type Card, type CardType } from "@/tep/lib/recrutement/board";
import { Button } from "@/tep/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_tep/_tepauth/recrutement")({
  head: () => ({
    meta: [
      { title: "Tableau Smyle — recrutement piloté par l'IA" },
      {
        name: "description",
        content:
          "Tableau infini pour organiser postes à pourvoir, viviers de talents et profils candidats, avec analyse de CV et matching par IA.",
      },
      { property: "og:title", content: "Tableau Smyle" },
      { property: "og:description", content: "Organisez votre recrutement sur un tableau infini intelligent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardPage,
});

const TOOLS: Array<{ type: CardType; icon: typeof Briefcase; label: string }> = [
  { type: "job", icon: Briefcase, label: "Poste à pourvoir" },
  { type: "pool", icon: Users, label: "Vivier de talents" },
  { type: "note", icon: StickyNote, label: "Note" },
  { type: "task", icon: CheckSquare, label: "Tâche" },
  { type: "ai", icon: Sparkles, label: "Post-it IA" },
];

function BoardPage() {
  const navigate = useNavigate();
  const { cards, links, loading, addCard, patchCard, removeCard, addLink, removeLink } = useBoard();
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | { mode: "pan"; sx: number; sy: number; ox: number; oy: number }
    | { mode: "card" | "resize"; id: string; sx: number; sy: number; ox: number; oy: number }
    | null
  >(null);

  const selected = cards.find((c) => c.id === selectedId) ?? null;

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = surfaceRef.current?.getBoundingClientRect();
      return {
        x: (clientX - (rect?.left ?? 0) - view.x) / view.scale,
        y: (clientY - (rect?.top ?? 0) - view.y) / view.scale,
      };
    },
    [view],
  );

  const spawn = useCallback(
    async (type: CardType) => {
      const rect = surfaceRef.current?.getBoundingClientRect();
      const center = toWorld((rect?.width ?? 800) / 2 + (rect?.left ?? 0), (rect?.height ?? 600) / 2 + (rect?.top ?? 0));
      const meta = CARD_META[type];
      const card = await addCard({
        type,
        title: meta.label,
        color: meta.color,
        x: Math.round(center.x - 140 + Math.random() * 60),
        y: Math.round(center.y - 90 + Math.random() * 60),
        w: type === "job" || type === "pool" ? 300 : 260,
        h: type === "job" ? 240 : 190,
      });
      setSelectedId(card.id);
    },
    [addCard, toWorld],
  );

  // Pointer interactions -----------------------------------------------------
  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    setSelectedId(null);
    drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCardDragStart = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    setSelectedId(id);
    drag.current = { mode: "card", id, sx: e.clientX, sy: e.clientY, ox: card.x, oy: card.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizeStart = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    drag.current = { mode: "resize", id, sx: e.clientX, sy: e.clientY, ox: card.w, oy: card.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / (d.mode === "pan" ? 1 : view.scale);
    const dy = (e.clientY - d.sy) / (d.mode === "pan" ? 1 : view.scale);
    if (d.mode === "pan") {
      setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
    } else if (d.mode === "card") {
      patchCard(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) }, 400);
    } else {
      patchCard(
        d.id,
        { w: Math.max(180, Math.round(d.ox + dx)), h: Math.max(120, Math.round(d.oy + dy)) },
        400,
      );
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        setView((v) => {
          const scale = Math.min(2.5, Math.max(0.2, v.scale * (1 - e.deltaY * 0.0018)));
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          return {
            scale,
            x: cx - ((cx - v.x) / v.scale) * scale,
            y: cy - ((cy - v.y) / v.scale) * scale,
          };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleLinkClick = async (id: string) => {
    if (!linkFrom) {
      setLinkFrom(id);
      toast.info("Sélectionnez le post-it à relier");
      return;
    }
    if (linkFrom === id) {
      setLinkFrom(null);
      return;
    }
    const existing = links.find(
      (l) =>
        (l.source_id === linkFrom && l.target_id === id) || (l.source_id === id && l.target_id === linkFrom),
    );
    if (existing) {
      await removeLink(existing.id);
      toast.success("Lien supprimé");
    } else {
      await addLink(linkFrom, id);
      toast.success("Post-it reliés");
    }
    setLinkFrom(null);
  };

  const matchesQuery = (card: Card) =>
    !query ||
    `${card.title} ${card.body} ${JSON.stringify(card.data)}`.toLowerCase().includes(query.toLowerCase());

  const fit = () => setView({ x: 0, y: 0, scale: 1 });

  return (
    <div className="recrutement relative h-screen w-screen overflow-hidden bg-canvas">
      {/* Canvas infini */}
      <div
        ref={surfaceRef}
        onPointerDown={onSurfacePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget) return;
          void spawn("note");
        }}
        className="canvas-grid absolute inset-0 touch-none"
        style={{
          backgroundSize: `${26 * view.scale}px ${26 * view.scale}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <svg className="pointer-events-none absolute overflow-visible" width="1" height="1">
            {links.map((l) => {
              const a = cards.find((c) => c.id === l.source_id);
              const b = cards.find((c) => c.id === l.target_id);
              if (!a || !b) return null;
              const x1 = a.x + a.w / 2;
              const y1 = a.y + a.h / 2;
              const x2 = b.x + b.w / 2;
              const y2 = b.y + b.h / 2;
              return (
                <path
                  key={l.id}
                  d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                  className="stroke-primary/50"
                  strokeWidth={2}
                  fill="none"
                />
              );
            })}
          </svg>

          {cards.filter(matchesQuery).map((card) => (
            <NoteCard
              key={card.id}
              card={card}
              selected={selectedId === card.id}
              linking={linkFrom === card.id}
              onSelect={setSelectedId}
              onDragStart={onCardDragStart}
              onResizeStart={onResizeStart}
              onLink={handleLinkClick}
              onDelete={(id) => void removeCard(id)}
            />
          ))}
        </div>
      </div>

      {/* Barre supérieure */}
      <header className="glass-panel pointer-events-auto absolute left-3 right-3 top-3 z-20 flex items-center gap-3 rounded-2xl px-4 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        <span className="font-display hidden text-sm font-semibold sm:block">Smyle</span>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un poste, un candidat…"
            className="h-9 pl-9"
          />
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <Button variant="ghost" size="icon" aria-label="Dézoomer" onClick={() => setView((v) => ({ ...v, scale: Math.max(0.2, v.scale - 0.1) }))}>
            <Minus className="size-4" />
          </Button>
          <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(view.scale * 100)}%</span>
          <Button variant="ghost" size="icon" aria-label="Zoomer" onClick={() => setView((v) => ({ ...v, scale: Math.min(2.5, v.scale + 0.1) }))}>
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Recentrer" onClick={fit}>
            <Maximize className="size-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Se déconnecter"
          onClick={async () => {
            await supabase.auth.signOut();
            void navigate({ to: "/auth" });
          }}
        >
          <LogOut className="size-4" />
        </Button>
      </header>

      {/* Barre d'outils */}
      <nav className="glass-panel absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl p-1.5 md:bottom-auto md:left-3 md:top-24 md:translate-x-0 md:flex-col">
        {TOOLS.map((t) => (
          <button
            key={t.type}
            type="button"
            title={t.label}
            aria-label={t.label}
            onClick={() => void spawn(t.type)}
            className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <t.icon className="size-5" />
          </button>
        ))}
      </nav>

      {loading && (
        <p className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">
          Chargement du tableau…
        </p>
      )}

      {!loading && cards.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
          <div>
            <h1 className="font-display text-2xl font-semibold">Votre tableau est infini</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Créez un poste à pourvoir ou un vivier de talents depuis la barre d'outils, importez des CV et laissez
              l'IA construire les profils et le matching.
            </p>
          </div>
        </div>
      )}

      {selected && (
        <Inspector
          card={selected}
          cards={cards}
          links={links}
          onClose={() => setSelectedId(null)}
          onPatch={patchCard}
          onCreate={addCard}
          onLink={addLink}
        />
      )}
    </div>
  );
}
