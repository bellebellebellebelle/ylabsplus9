import { useState } from "react";
import {
  Sparkles,
  Trash2,
  ImagePlus,
  Loader2,
  GripVertical,
  Copy,
  TrendingUp,
  Lightbulb,
  Type,
  Recycle,
  CalendarClock,
  Wand2,
  ChevronDown,
  ChevronUp,
  CopyPlus,
  Globe2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/tep/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NETWORKS, NETWORK_LIST, KIND_LABELS, STATUS_LABELS, STATUSES } from "@/tep/lib/contenu/networks";
import type { NetworkId, NoteKind } from "@/tep/lib/contenu/networks";
import type { Note } from "@/tep/lib/contenu/data";
import { generateText, generateImage } from "@/tep/lib/contenu/ai.functions";
import { SmartSchedule } from "@/tep/components/contenu/SmartSchedule";

const KIND_ICONS: Record<NoteKind, typeof Sparkles> = {
  post: Wand2,
  trends: TrendingUp,
  idea: Lightbulb,
  hooks: Type,
  repurpose: Recycle,
  calendar: CalendarClock,
};

const ACTION_LABEL: Record<NoteKind, string> = {
  post: "Générer la légende",
  trends: "Trouver les tendances",
  idea: "Développer l'idée",
  hooks: "Générer 8 accroches",
  repurpose: "Adapter le contenu",
  calendar: "Proposer un planning",
};

const COLORS: { id: string; value: string }[] = [
  { id: "violet", value: "var(--primary)" },
  { id: "menthe", value: "var(--accent)" },
  { id: "ambre", value: "oklch(0.78 0.16 75)" },
  { id: "rose", value: "oklch(0.7 0.19 15)" },
  { id: "azur", value: "oklch(0.72 0.14 240)" },
];

function buildPrompt(note: Note): { kind: string; prompt: string } {
  const network = note.network ? NETWORKS[note.network as NetworkId] : null;
  const target = network?.label ?? "les réseaux sociaux (multi-plateformes)";
  const brief = note.body || note.title || "Sujet libre lié à la marque";
  switch (note.kind as NoteKind) {
    case "post":
      return {
        kind: "Rédiger un post prêt à publier",
        prompt: `Brief : ${brief}\n\nRédige la légende complète (max ${network?.captionLimit ?? 1000} caractères, ton : ${network?.tone ?? "adapté à la marque"}), puis une ligne vide, puis exactement ${network?.hashtags ?? 5} hashtags pertinents sur une seule ligne.`,
      };
    case "trends":
      return {
        kind: "Trouver des idées de contenu tendance",
        prompt: `Thématique : ${brief}\n\nDonne 6 idées de posts tendance pour ${target}${network ? ` (ton : ${network.tone})` : ""}, format : "• Angle — pourquoi ça marche maintenant". Sois concret et actionnable.`,
      };
    case "idea":
      return {
        kind: "Développer une idée de contenu",
        prompt: `Idée : ${brief}\n\nCible : ${target}.\nDéveloppe-la en un mini-brief : angle, promesse, plan en 3 points, call-to-action.`,
      };
    case "hooks":
      return {
        kind: "Écrire des accroches",
        prompt: `Sujet : ${brief}\n\nÉcris 8 accroches très fortes (une par ligne, numérotées) pour ${target}${network ? ` (ton : ${network.tone})` : ""}.`,
      };
    case "repurpose":
      return {
        kind: "Recycler un contenu vers un autre réseau",
        prompt: `Contenu source :\n${brief}\n\nAdapte-le parfaitement au format et aux codes de ${target}${network ? ` (${network.tone})` : ""}. Donne le contenu final uniquement.`,
      };
    case "calendar":
      return {
        kind: "Planifier une séquence éditoriale",
        prompt: `Objectif : ${brief}\n\nCible : ${target}.\nPropose un planning de 7 publications (jour, réseau, format, angle) cohérent avec la ligne éditoriale.`,
      };
  }
}

type Props = {
  note: Note;
  brand: string;
  scale: number;
  selected: boolean;
  onSelect: () => void;
  onPatch: (patch: Partial<Note>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (e: React.PointerEvent) => void;
};

export function SmartNote({
  note,
  brand,
  scale,
  selected,
  onSelect,
  onPatch,
  onDelete,
  onDuplicate,
  onDragStart,
}: Props) {
  const [busy, setBusy] = useState<null | "text" | "image">(null);
  const kind = note.kind as NoteKind;
  const Icon = KIND_ICONS[kind] ?? Sparkles;
  const network = note.network ? NETWORKS[note.network as NetworkId] : null;
  const custom = COLORS.find((c) => c.id === note.color);
  const accent = network?.colorVar ?? custom?.value ?? "var(--primary)";
  const meta = (note.data ?? {}) as Record<string, unknown>;
  const collapsed = meta["collapsed"] === true;

  function patchMeta(patch: Record<string, unknown>) {
    onPatch({ data: { ...meta, ...patch } as Note["data"] });
  }

  async function runText() {
    setBusy("text");
    try {
      const { kind: task, prompt } = buildPrompt(note);
      const { text } = await generateText({
        data: { kind: task, network: network?.label ?? null, prompt, brand },
      });
      if (kind === "post") {
        const parts = text.trim().split(/\n\s*\n/);
        const tags = (parts.length > 1 ? parts[parts.length - 1] : "") ?? "";
        const caption = parts.length > 1 ? parts.slice(0, -1).join("\n\n") : text;
        onPatch({
          caption,
          hashtags: tags.includes("#") ? tags : note.hashtags,
          status: note.status === "idea" ? "draft" : note.status,
        });
      } else {
        onPatch({ body: text });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Génération impossible");
    } finally {
      setBusy(null);
    }
  }

  async function runImage() {
    if (!network) return;
    setBusy("image");
    try {
      const { image } = await generateImage({
        data: {
          prompt: `Visuel ${network.label} au format ${network.ratio} pour la marque suivante.\n${brand}\n\nSujet : ${note.caption || note.body || note.title}. Style photographique premium, cohérent avec l'identité de marque, sans texte superposé.`,
          size: network.imageSize,
        },
      });
      onPatch({ image_url: image });
      toast.success("Visuel généré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Génération impossible");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      onPointerDown={onSelect}
      onWheel={(e) => {
        // Le scroll molette reste dans le post-it ; Ctrl+molette zoome toujours le tableau
        if (!e.ctrlKey && !e.metaKey) e.stopPropagation();
      }}
      className={`glass absolute flex flex-col overflow-hidden rounded-2xl transition-shadow ${
        selected ? "glow z-20" : "z-10 shadow-lg shadow-black/30"
      }`}
      style={{
        left: note.x,
        top: note.y,
        width: note.width,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div
        onPointerDown={onDragStart}
        className="flex cursor-grab items-center gap-2 px-3 py-2 active:cursor-grabbing"
        style={{ background: `color-mix(in oklab, ${accent} 14%, transparent)` }}
      >
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
        <Icon className="size-3.5 shrink-0" style={{ color: accent }} />
        <span className="truncate text-[11px] font-semibold tracking-wide uppercase">
          {KIND_LABELS[kind]}
        </span>
        <div className="ml-auto flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label={collapsed ? "Déplier le post-it" : "Replier le post-it"}
            onClick={() => patchMeta({ collapsed: !collapsed })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label="Dupliquer le post-it"
            onClick={onDuplicate}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <CopyPlus className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Supprimer le post-it"
            onClick={onDelete}
            className="text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {collapsed ? (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="truncate">{note.title || note.caption || note.body || "Vide"}</span>
          <span className="ml-auto shrink-0">{STATUS_LABELS[note.status as never] ?? ""}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-3">
          <Input
            value={note.title}
            placeholder="Titre du post-it"
            onChange={(e) => onPatch({ title: e.target.value })}
            className="h-8 border-0 bg-transparent px-0 text-sm font-semibold focus-visible:ring-0"
          />

          <div className="flex items-center gap-1.5">
            <Select
              value={note.network ?? "all"}
              onValueChange={(v) => onPatch({ network: v === "all" ? null : v })}
            >
              <SelectTrigger className="h-7 flex-1 text-[11px]">
                <Globe2 className="size-3 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kind !== "post" && (
                  <SelectItem value="all" className="text-xs">
                    Tous réseaux
                  </SelectItem>
                )}
                {NETWORK_LIST.map((n) => (
                  <SelectItem key={n.id} value={n.id} className="text-xs">
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Couleur ${c.id}`}
                  onClick={() => onPatch({ color: c.id })}
                  className={`size-3.5 rounded-full border transition-transform ${
                    note.color === c.id ? "scale-125 border-foreground" : "border-transparent"
                  }`}
                  style={{ background: c.value }}
                />
              ))}
            </div>
          </div>

          <Textarea
            value={note.body}
            placeholder={
              kind === "post"
                ? "Brief : sujet, angle, objectif…"
                : kind === "repurpose"
                  ? "Collez le contenu source à recycler…"
                  : "Notes, idées, contexte…"
            }
            onChange={(e) => onPatch({ body: e.target.value })}
            className="max-h-64 min-h-20 resize-y bg-secondary/40 text-xs"
          />

          {kind === "post" && (
            <>
              {note.image_url && (
                <img
                  src={note.image_url}
                  alt={`Visuel généré pour ${network?.label ?? "le post"}`}
                  loading="lazy"
                  className="w-full rounded-xl border border-border object-cover"
                />
              )}
              {note.caption && (
                <Textarea
                  value={note.caption}
                  onChange={(e) => onPatch({ caption: e.target.value })}
                  className="max-h-72 min-h-24 resize-y bg-secondary/40 text-xs"
                />
              )}
              {note.hashtags && (
                <p className="text-[11px] break-words text-accent">{note.hashtags}</p>
              )}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{network?.ratio}</span>
                <span>
                  {note.caption.length}/{network?.captionLimit} car.
                </span>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" className="h-7 flex-1 text-[11px]" onClick={runText} disabled={!!busy}>
              {busy === "text" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              {ACTION_LABEL[kind]}
            </Button>
            {kind === "post" && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-[11px]"
                onClick={runImage}
                disabled={!!busy}
              >
                {busy === "image" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ImagePlus className="size-3" />
                )}
                Visuel
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              aria-label="Copier le contenu"
              onClick={() => {
                const text = [note.caption || note.body, note.hashtags]
                  .filter(Boolean)
                  .join("\n\n");
                navigator.clipboard.writeText(text);
                toast.success("Contenu copié");
              }}
            >
              <Copy className="size-3" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Select value={note.status} onValueChange={(v) => onPatch({ status: v })}>
              <SelectTrigger className="h-7 flex-1 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SmartSchedule
              value={note.scheduled_at}
              onChange={(iso) =>
                onPatch({
                  scheduled_at: iso,
                  status: iso ? "scheduled" : note.status === "scheduled" ? "ready" : note.status,
                })
              }
            />
          </div>
        </div>
      )}
      <span className="sr-only">{scale}</span>
    </div>
  );
}
