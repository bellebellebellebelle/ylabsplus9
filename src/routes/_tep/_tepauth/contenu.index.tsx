import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { Plus, Loader2, Crosshair, Minus, Plus as PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/tep/components/contenu/AppShell";
import { SmartNote } from "@/tep/components/contenu/SmartNote";
import { Button } from "@/tep/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KIND_LABELS, NETWORK_LIST } from "@/tep/lib/contenu/networks";
import type { NoteKind } from "@/tep/lib/contenu/networks";
import { brandContext, createNote, deleteNote, updateNote, type Note } from "@/tep/lib/contenu/data";
import { useWorkspace } from "@/tep/lib/contenu/useWorkspace";

export const Route = createFileRoute("/_tep/_tepauth/contenu/")({
  head: () => ({
    meta: [
      { title: "Tableau créatif — Nova Studio" },
      {
        name: "description",
        content:
          "Un tableau infini de post-it intelligents pour organiser et générer vos contenus sociaux.",
      },
      { property: "og:title", content: "Tableau créatif — Nova Studio" },
      {
        property: "og:description",
        content: "Organisez vos idées et générez vos posts sur un canvas infini.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardPage,
});

const OTHER_KINDS: NoteKind[] = ["trends", "idea", "hooks", "repurpose", "calendar"];

function BoardPage() {
  const { user, board, brand, notes, setNotes, patchLocal, loading } = useWorkspace();
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; nx: number; ny: number } | null>(null);

  const savePatch = useCallback(
    (id: string, patch: Partial<Note>) => {
      patchLocal(id, patch);
      void updateNote(id, patch).catch((e) =>
        toast.error(e instanceof Error ? e.message : "Sauvegarde impossible"),
      );
    },
    [patchLocal],
  );

  async function addNote(kind: NoteKind, network: string | null) {
    if (!user || !board) return;
    const cx = (window.innerWidth / 2 - view.x) / view.scale - 140;
    const cy = (window.innerHeight / 2 - view.y) / view.scale - 100;
    try {
      const created = await createNote({
        user_id: user.id,
        board_id: board.id,
        kind,
        network,
        x: Math.round(cx + (Math.random() * 60 - 30)),
        y: Math.round(cy + (Math.random() * 60 - 30)),
      });
      setNotes((prev) => (prev.some((n) => n.id === created.id) ? prev : [...prev, created]));
      setSelected(created.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Création impossible");
    }
  }

  async function duplicateNote(note: Note) {
    if (!user || !board) return;
    try {
      const created = await createNote({
        user_id: user.id,
        board_id: board.id,
        kind: note.kind,
        network: note.network,
        x: note.x + 32,
        y: note.y + 32,
        width: note.width,
        color: note.color,
        title: note.title ? `${note.title} (copie)` : "",
        body: note.body,
        caption: note.caption,
        hashtags: note.hashtags,
        status: note.status,
      });
      setNotes((prev) => (prev.some((n) => n.id === created.id) ? prev : [...prev, created]));
      setSelected(created.id);
      toast.success("Post-it dupliqué");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplication impossible");
    }
  }

  function zoomBy(factor: number) {
    setView((v) => {
      const scale = Math.min(2, Math.max(0.3, v.scale * factor));
      const k = scale / v.scale;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      return { scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }

  function onCanvasPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return;
    setSelected(null);
    pan.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag.current) {
      const d = drag.current;
      const nx = d.nx + (e.clientX - d.x) / view.scale;
      const ny = d.ny + (e.clientY - d.y) / view.scale;
      patchLocal(d.id, { x: nx, y: ny });
      return;
    }
    if (pan.current) {
      const p = pan.current;
      setView((v) => ({ ...v, x: p.vx + (e.clientX - p.x), y: p.vy + (e.clientY - p.y) }));
    }
  }

  function onPointerUp() {
    if (drag.current) {
      const note = notes.find((n) => n.id === drag.current!.id);
      if (note) void updateNote(note.id, { x: note.x, y: note.y });
      drag.current = null;
    }
    pan.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) {
      setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      return;
    }
    setView((v) => {
      const scale = Math.min(2, Math.max(0.3, v.scale * (e.deltaY < 0 ? 1.08 : 0.93)));
      const k = scale / v.scale;
      return {
        scale,
        x: e.clientX - (e.clientX - v.x) * k,
        y: e.clientY - (e.clientY - v.y) * k,
      };
    });
  }

  return (
    <AppShell email={user?.email}>
      <div
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        className="grid-bg absolute inset-0 touch-none overflow-hidden"
        style={{
          backgroundSize: `${26 * view.scale}px ${26 * view.scale}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {notes.map((note) => (
            <SmartNote
              key={note.id}
              note={note}
              brand={brandContext(brand)}
              scale={view.scale}
              selected={selected === note.id}
              onSelect={() => setSelected(note.id)}
              onPatch={(patch) => savePatch(note.id, patch)}
              onDelete={() => {
                setNotes((prev) => prev.filter((n) => n.id !== note.id));
                void deleteNote(note.id);
              }}
              onDuplicate={() => void duplicateNote(note)}
              onDragStart={(e) => {
                e.stopPropagation();
                setSelected(note.id);
                drag.current = { id: note.id, x: e.clientX, y: e.clientY, nx: note.x, ny: note.y };
              }}
            />
          ))}
        </div>
      </div>

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3">
        <div className="glass pointer-events-auto flex items-center gap-1.5 rounded-full p-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 rounded-full px-4 text-xs">
                <Plus className="size-4" /> Nouveau post-it
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-56">
              <DropdownMenuLabel className="text-xs">Studio réseau</DropdownMenuLabel>
              {NETWORK_LIST.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className="text-xs"
                  onSelect={() => void addNote("post", n.id)}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: n.colorVar }}
                    aria-hidden
                  />
                  {n.label}
                  <span className="ml-auto text-[10px] text-muted-foreground">{n.ratio}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Outils créatifs</DropdownMenuLabel>
              {OTHER_KINDS.map((k) => (
                <DropdownMenuItem
                  key={k}
                  className="text-xs"
                  onSelect={() => void addNote(k, null)}
                >
                  {KIND_LABELS[k]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="icon"
            variant="ghost"
            className="size-9 rounded-full"
            aria-label="Dézoomer"
            onClick={() => zoomBy(1 / 1.15)}
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-11 text-center text-[11px] text-muted-foreground tabular-nums">
            {Math.round(view.scale * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-9 rounded-full"
            aria-label="Zoomer"
            onClick={() => zoomBy(1.15)}
          >
            <PlusIcon className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-9 rounded-full"
            aria-label="Recentrer le tableau"
            onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          >
            <Crosshair className="size-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
