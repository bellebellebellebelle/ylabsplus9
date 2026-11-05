import { useRef, useState } from "react";
import { Check, Loader2, Sparkles, Trash2, CalendarPlus, ListPlus } from "lucide-react";
import { COLOR_CLASS, KIND_LABEL, NOTE_COLORS, type BoardItem } from "@/tep/lib/board";
import { Button } from "@/tep/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  item: BoardItem;
  onPatch: (patch: Partial<BoardItem>) => void;
  onDelete: () => void;
  onSyncTask: () => Promise<void>;
  onSyncEvent: () => Promise<void>;
  onRunAgent: () => Promise<void>;
  onToggleDone: () => Promise<void>;
};

export function StickyNote({
  item,
  onPatch,
  onDelete,
  onSyncTask,
  onSyncEvent,
  onRunAgent,
  onToggleDone,
}: Props) {
  const [pos, setPos] = useState({ x: item.x, y: item.y });
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: Math.max(0, e.clientX - dragRef.current.dx),
      y: Math.max(0, e.clientY - dragRef.current.dy),
    });
  };
  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    onPatch({ x: pos.x, y: pos.y });
  };

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const localDate = (value: string | null) =>
    value ? new Date(value).toISOString().slice(0, 16) : "";

  return (
    <div
      onPointerDown={startDrag}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      className={`absolute flex touch-none flex-col gap-2 rounded-sm p-3 text-note-foreground shadow-note transition-shadow hover:shadow-note-lifted ${COLOR_CLASS[item.color] ?? COLOR_CLASS["yellow"]}`}
      style={{ left: pos.x, top: pos.y, width: item.w, minHeight: item.h }}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-widest opacity-60">
        <span>{KIND_LABEL[item.kind] ?? "Post-it"}</span>
        <span className="flex items-center gap-1" data-no-drag>
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Couleur ${c}`}
              onClick={() => onPatch({ color: c })}
              className={`size-3 rounded-full border border-note-foreground/20 ${COLOR_CLASS[c]}`}
            />
          ))}
          <button aria-label="Supprimer" onClick={onDelete} className="ml-1 opacity-70">
            <Trash2 className="size-3.5" />
          </button>
        </span>
      </div>

      <textarea
        data-no-drag
        value={item.content}
        onChange={(e) => onPatch({ content: e.target.value })}
        placeholder={item.kind === "ai" ? "Demandez quelque chose à l'agent…" : "Écrivez ici…"}
        className={`min-h-20 flex-1 resize-none bg-transparent font-hand text-lg leading-snug outline-none placeholder:opacity-40 ${item.done ? "line-through opacity-60" : ""}`}
      />

      {item.kind === "event" && (
        <div className="flex flex-col gap-1" data-no-drag>
          <Input
            type="datetime-local"
            value={localDate(item.due_at)}
            onChange={(e) =>
              onPatch({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
            className="h-8 border-note-foreground/20 bg-white/40 text-xs"
          />
        </div>
      )}

      {item.kind === "task" && (
        <div data-no-drag>
          <Input
            type="datetime-local"
            value={localDate(item.due_at)}
            onChange={(e) =>
              onPatch({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
            className="h-8 border-note-foreground/20 bg-white/40 text-xs"
          />
        </div>
      )}

      {item.ai_result && (
        <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-sm bg-white/50 p-2 text-xs leading-relaxed">
          {item.ai_result}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1" data-no-drag>
        {item.kind === "task" && (
          <>
            <Button
              variant="note"
              size="note"
              onClick={() => withBusy(onToggleDone)}
              disabled={busy}
            >
              <Check className="size-3.5" /> {item.done ? "Rouvrir" : "Terminer"}
            </Button>
            <Button variant="note" size="note" onClick={() => withBusy(onSyncTask)} disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ListPlus className="size-3.5" />}
              {item.google_task_id ? "Dans SKY Task" : "SKY Task"}
            </Button>
          </>
        )}
        {item.kind === "event" && (
          <Button variant="note" size="note" onClick={() => withBusy(onSyncEvent)} disabled={busy}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CalendarPlus className="size-3.5" />
            )}
            {item.google_event_id ? "Dans Calendsky" : "Calendsky"}
          </Button>
        )}
        {item.kind === "ai" && (
          <Button variant="note" size="note" onClick={() => withBusy(onRunAgent)} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Lancer l'agent
          </Button>
        )}
      </div>
    </div>
  );
}
