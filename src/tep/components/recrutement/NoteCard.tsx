import { memo } from "react";
import {
  Briefcase,
  CheckSquare,
  Link2,
  Sparkles,
  StickyNote,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { CARD_META, type Card } from "@/tep/lib/recrutement/board";
import { cn } from "@/lib/utils";

const ICONS = { briefcase: Briefcase, users: Users, user: User, sticky: StickyNote, check: CheckSquare, sparkles: Sparkles };
const BG: Record<string, string> = {
  sky: "bg-note-sky",
  violet: "bg-note-violet",
  amber: "bg-note-amber",
  lime: "bg-note-lime",
  rose: "bg-note-rose",
  cyan: "bg-note-cyan",
};

type Props = {
  card: Card;
  selected: boolean;
  linking: boolean;
  onSelect: (id: string) => void;
  onDragStart: (e: React.PointerEvent, id: string) => void;
  onResizeStart: (e: React.PointerEvent, id: string) => void;
  onLink: (id: string) => void;
  onDelete: (id: string) => void;
};

function NoteCardBase({ card, selected, linking, onSelect, onDragStart, onResizeStart, onLink, onDelete }: Props) {
  const meta = CARD_META[card.type] ?? CARD_META.note;
  const Icon = ICONS[meta.icon as keyof typeof ICONS] ?? StickyNote;
  const score = (card.data as { match_score?: number }).match_score;
  const profile = (card.data as { profile?: { headline?: string; skills?: string[] } }).profile;
  const spec = (card.data as { spec?: { must_have?: string[] } }).spec;

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={() => onSelect(card.id)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(card.id)}
      className={cn(
        "note-shadow absolute flex flex-col overflow-hidden rounded-xl text-ink transition-shadow",
        BG[card.color] ?? BG["amber"],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-canvas",
        linking && "ring-2 ring-accent",
      )}
      style={{ left: card.x, top: card.y, width: card.w, height: card.h }}
    >
      <header
        onPointerDown={(e) => onDragStart(e, card.id)}
        className="flex cursor-grab items-center gap-2 bg-ink/10 px-3 py-2 active:cursor-grabbing"
      >
        <Icon className="size-4 shrink-0 opacity-80" />
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide opacity-70">{meta.label}</span>
        {typeof score === "number" && (
          <span className="ml-auto rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-bold text-note-amber">
            {score}%
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Relier ce post-it"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onLink(card.id)}
            className="rounded p-1 hover:bg-ink/15"
          >
            <Link2 className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Supprimer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(card.id)}
            className="rounded p-1 hover:bg-ink/15"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-3 py-2">
        <h3 className="font-display line-clamp-2 text-[15px] font-semibold leading-tight">
          {card.title || "Sans titre"}
        </h3>
        {profile?.headline && <p className="mt-1 line-clamp-2 text-xs opacity-80">{profile.headline}</p>}
        {card.body && <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs opacity-75">{card.body}</p>}
        {profile?.skills?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.skills.slice(0, 6).map((s) => (
              <span key={s} className="rounded-full bg-ink/12 px-2 py-0.5 text-[10px] font-medium">
                {s}
              </span>
            ))}
          </div>
        ) : null}
        {spec?.must_have?.length ? (
          <ul className="mt-2 space-y-0.5 text-[11px] opacity-80">
            {spec.must_have.slice(0, 4).map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <span
        onPointerDown={(e) => onResizeStart(e, card.id)}
        className="absolute bottom-0 right-0 size-4 cursor-nwse-resize rounded-tl bg-ink/15"
      />
    </div>
  );
}

export const NoteCard = memo(NoteCardBase);
