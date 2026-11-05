import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Mail,
  Sparkles,
  Trash2,
  Loader2,
  GripHorizontal,
  Send,
  Cloud,
  CloudOff,
} from "lucide-react";
import { KIND_META, type Sticky } from "@/tep/lib/planning/stickies";
import { cn } from "@/lib/utils";
import { TimePicker } from "@/tep/components/planning/TimePicker";

const ICONS = {
  appointment: CalendarClock,
  task: CheckCircle2,
  email: Mail,
  smart: Sparkles,
} as const;

type Props = {
  sticky: Sticky;
  scale: number;
  googleConnected?: boolean;
  onPatch: (patch: Partial<Sticky>) => void;
  onDelete: () => void;
  onSmartRun: (prompt: string) => Promise<string>;
  onSendEmail?: () => Promise<void>;
};

export function StickyCard({
  sticky,
  scale,
  googleConnected = false,
  onPatch,
  onDelete,
  onSmartRun,
  onSendEmail,
}: Props) {
  const [pos, setPos] = useState({ x: sticky.x, y: sticky.y });
  const [title, setTitle] = useState(sticky.title);
  const [content, setContent] = useState(sticky.content);
  const [emailTo, setEmailTo] = useState(sticky.email_to ?? "");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const Icon = ICONS[sticky.kind];
  const syncable = sticky.kind !== "smart";

  useEffect(() => {
    setPos({ x: sticky.x, y: sticky.y });
  }, [sticky.x, sticky.y]);

  useEffect(() => {
    setEmailTo(sticky.email_to ?? "");
  }, [sticky.email_to]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setPos({
      x: drag.current.ox + (e.clientX - drag.current.sx) / scale,
      y: drag.current.oy + (e.clientY - drag.current.sy) / scale,
    });
  }
  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    onPatch({ x: Math.round(pos.x), y: Math.round(pos.y) });
  }

  async function runSmart() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const answer = await onSmartRun(title.trim());
      setContent(answer);
      onPatch({ content: answer, title: title.trim() });
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!onSendEmail) return;
    setSending(true);
    try {
      await onSendEmail();
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={cn(
        "absolute w-60 rounded-md paper select-none",
        KIND_META[sticky.kind].paper,
        sticky.done && "opacity-60",
      )}
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
    >
      <div
        className="flex cursor-grab items-center gap-2 rounded-t-md px-2 py-1.5 active:cursor-grabbing"
        style={{ background: "oklch(0 0 0 / 0.07)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <GripHorizontal className="h-3.5 w-3.5 opacity-50" />
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
          {KIND_META[sticky.kind].label}
        </span>

        {syncable && (
          <span
            title={
              sticky.google_id
                ? `Synchronisé avec le calendrier${sticky.synced_at ? ` — ${new Date(sticky.synced_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}`
                : googleConnected
                  ? "En attente de synchronisation"
                  : "Synchronisation inactive"
            }
            className="ml-1 flex items-center"
          >
            {sticky.google_id ? (
              <Cloud className="h-3 w-3 text-emerald-700 opacity-80" />
            ) : (
              <CloudOff className="h-3 w-3 opacity-35" />
            )}
          </span>
        )}

        <button
          onClick={onDelete}
          className="ml-auto rounded p-1 opacity-50 transition hover:opacity-100"
          aria-label="Supprimer le post-it"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 p-2.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== sticky.title && onPatch({ title })}
          placeholder={
            sticky.kind === "smart"
              ? "Demandez quelque chose…"
              : sticky.kind === "email"
                ? "Objet du message"
                : "Titre"
          }
          className="w-full bg-transparent text-sm font-semibold outline-none placeholder:opacity-40"
        />

        {sticky.kind === "email" && (
          <input
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            onBlur={() => emailTo !== (sticky.email_to ?? "") && onPatch({ email_to: emailTo || null })}
            placeholder="destinataire@exemple.com"
            className="w-full rounded bg-black/5 px-1.5 py-1 text-xs outline-none placeholder:opacity-40"
          />
        )}

        {sticky.kind !== "smart" && (
          <div className="flex items-center gap-2 text-xs">
            <TimePicker
              value={sticky.start_time}
              onChange={(v) => onPatch({ start_time: v })}
              date={sticky.day}
              onDateChange={(d) => d !== sticky.day && onPatch({ day: d })}
              {...(sticky.kind === "appointment"
                ? {
                    durationMin: sticky.duration_min,
                    onDurationChange: (v: number | null) => onPatch({ duration_min: v }),
                  }
                : {})}
            />

            <button
              onClick={() => onPatch({ done: !sticky.done })}
              className="ml-auto flex items-center gap-1 opacity-70 hover:opacity-100"
            >
              {sticky.done ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              {sticky.done ? "Fait" : "À faire"}
            </button>
          </div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => content !== sticky.content && onPatch({ content })}
          rows={sticky.kind === "smart" ? 5 : 3}
          placeholder={
            sticky.kind === "smart"
              ? "La réponse Smart apparaîtra ici"
              : sticky.kind === "email"
                ? "Corps du message…"
                : "Détails…"
          }
          className="w-full resize-none bg-transparent text-xs leading-relaxed outline-none placeholder:opacity-40"
        />

        {sticky.kind === "email" && (
          <button
            onClick={() => void send()}
            disabled={sending || sticky.email_sent || !emailTo.trim() || !googleConnected}
            className="flex w-full items-center justify-center gap-1.5 rounded bg-black/10 px-2 py-1.5 text-xs font-semibold transition hover:bg-black/20 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sticky.email_sent ? "Envoyé" : googleConnected ? "Envoyer l’e-mail" : "Envoi indisponible"}
          </button>
        )}

        {sticky.kind === "smart" && (
          <button
            onClick={runSmart}
            disabled={busy}
            className="flex w-full items-center justify-center gap-1.5 rounded bg-black/10 px-2 py-1.5 text-xs font-semibold transition hover:bg-black/20 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Générer
          </button>
        )}
      </div>
    </div>
  );
}
