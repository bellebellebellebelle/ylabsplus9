import { useState } from "react";
import { Loader2, Play, Trash2, Check, Pencil } from "lucide-react";
import { Button } from "@/tep/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KIND_LABELS, KIND_HINTS, type BubbleKind } from "@/tep/lib/board-kinds";
import { cn } from "@/lib/utils";

export type Bubble = {
  id: string;
  board_id: string;
  kind: string;
  title: string;
  mission: string;
  objective: string;
  content: string;
  status: string;
  done: boolean;
  x: number;
  y: number;
};

const KIND_COLOR: Record<string, string> = {
  agent: "text-[var(--agent)] border-[var(--agent)]/40",
  action: "text-[var(--action)] border-[var(--action)]/40",
  note: "text-muted-foreground border-border",
};

export function BubbleCard({
  bubble,
  onUpdate,
  onDelete,
  onRun,
  dragHandlers,
  dragging,
}: {
  bubble: Bubble;
  onUpdate: (patch: Partial<Bubble>) => void;
  onDelete: () => void;
  onRun: () => void;
  dragHandlers?: React.HTMLAttributes<HTMLDivElement>;
  dragging?: boolean;
}) {
  const [editing, setEditing] = useState(!bubble.title && bubble.kind !== "note");
  const kind = bubble.kind as BubbleKind;
  const runnable = kind !== "action" && kind !== "note";
  const running = bubble.status === "running";

  return (
    <div
      className={cn(
        "glass w-full rounded-2xl border p-3 shadow-xl transition-shadow",
        KIND_COLOR[kind] ?? "text-[var(--tool)] border-[var(--tool)]/40",
        dragging && "shadow-2xl ring-1 ring-primary/50",
        bubble.done && "opacity-60",
      )}
    >
      <div
        {...dragHandlers}
        className="flex cursor-grab items-center justify-between gap-2 active:cursor-grabbing"
      >
        <span className="text-[11px] font-semibold tracking-wide uppercase">
          {KIND_LABELS[kind] ?? kind}
        </span>
        <div className="flex items-center gap-1">
          {kind === "action" && (
            <button
              type="button"
              aria-label="Marquer comme fait"
              onClick={() => onUpdate({ done: !bubble.done })}
              className={cn(
                "rounded-md border p-1 transition-colors",
                bubble.done ? "bg-[var(--action)] text-background" : "hover:bg-secondary",
              )}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Modifier"
            onClick={() => setEditing((v) => !v)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Supprimer"
            onClick={onDelete}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <Input
            autoFocus
            value={bubble.title}
            placeholder="Titre court"
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="h-8 text-sm text-foreground"
          />
          {kind === "agent" && (
            <>
              <Textarea
                value={bubble.mission}
                placeholder="Mission de l'agent"
                onChange={(e) => onUpdate({ mission: e.target.value })}
                className="min-h-14 text-sm text-foreground"
              />
              <Input
                value={bubble.objective}
                placeholder="Objectif mesurable"
                onChange={(e) => onUpdate({ objective: e.target.value })}
                className="h-8 text-sm text-foreground"
              />
            </>
          )}
          {(kind === "note" || kind === "action") && (
            <Textarea
              value={bubble.content}
              placeholder={KIND_HINTS[kind]}
              onChange={(e) => onUpdate({ content: e.target.value })}
              className="min-h-16 text-sm text-foreground"
            />
          )}
          <Button size="sm" variant="secondary" className="w-full" onClick={() => setEditing(false)}>
            Terminé
          </Button>
        </div>
      ) : (
        <div className="mt-1.5">
          <h3
            className={cn(
              "font-display text-sm font-semibold text-foreground",
              bubble.done && "line-through",
            )}
          >
            {bubble.title || KIND_HINTS[kind]}
          </h3>
          {kind === "agent" && bubble.mission && (
            <p className="mt-1 text-xs text-muted-foreground">🎯 {bubble.mission}</p>
          )}
          {kind === "agent" && bubble.objective && (
            <p className="text-xs text-muted-foreground">✅ {bubble.objective}</p>
          )}
          {bubble.content && (
            <p className="mt-2 max-h-56 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-foreground/85">
              {bubble.content}
            </p>
          )}
        </div>
      )}

      {runnable && !editing && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-2 w-full"
          onClick={onRun}
          disabled={running}
        >
          {running ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-2 h-3.5 w-3.5" />
          )}
          {bubble.content ? "Relancer" : "Lancer"}
        </Button>
      )}
    </div>
  );
}
