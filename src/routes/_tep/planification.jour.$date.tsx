import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Mail,
  Sparkles,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Wand2,
  Locate,
  RefreshCw,

} from "lucide-react";
import { toast } from "sonner";
import { StickyCard } from "@/tep/components/planning/StickyCard";
import { useAuth } from "@/tep/hooks/usePlanningAuth";
import {
  createSticky,
  deleteSticky,
  fetchStickiesForDay,
  updateSticky,
  type Sticky,
  type StickyKind,
} from "@/tep/lib/planning/stickies";
import { smartAsk, smartPlanDay } from "@/tep/lib/planning/smart.functions";
import { skyDeleteSticky, skyPushSticky, skySendStickyEmail } from "@/tep/lib/sky.functions";
import { addDays, fromKey, longDate, toKey } from "@/tep/lib/planning/date-utils";


export const Route = createFileRoute("/_tep/planification/jour/$date")({
  head: () => ({
    meta: [
      { title: "Tableau du jour — Planification Smart" },
      {
        name: "description",
        content:
          "Tableau infini du jour : déplacez vos post-it de rendez-vous, tâches, e-mails et post-it Smart assistés par l'IA.",
      },
      { property: "og:title", content: "Tableau du jour — Planification Smart" },
      {
        property: "og:description",
        content: "Organisez votre journée sur un tableau infini avec des post-it intelligents.",
      },
    ],
  }),
  component: DayBoardPage,
});

const NEW_KINDS: { kind: StickyKind; label: string; icon: typeof Mail }[] = [
  { kind: "appointment", label: "Rendez-vous", icon: CalendarClock },
  { kind: "task", label: "Tâche", icon: CheckCircle2 },
  { kind: "email", label: "E-mail", icon: Mail },
  { kind: "smart", label: "Post-it Smart", icon: Sparkles },
];

function DayBoardPage() {
  const { date } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session, loading } = useAuth();
  const askFn = useServerFn(smartAsk);
  const planFn = useServerFn(smartPlanDay);
  const pushFn = useServerFn(skyPushSticky);
  const sendFn = useServerFn(skySendStickyEmail);
  const deleteRemoteFn = useServerFn(skyDeleteSticky);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [goal, setGoal] = useState("");
  const [planning, setPlanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const day = useMemo(() => fromKey(date), [date]);

  const { data: stickies = [], isLoading } = useQuery({
    queryKey: ["stickies", date],
    queryFn: () => fetchStickiesForDay(date),
    enabled: !!session,
  });

  const googleConnected = !!session; // native SKY apps: always available when signed in

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["stickies"] });
    void qc.invalidateQueries({ queryKey: ["range"] });
  };

  const tzOf = (id: string) => {
    const s = stickies.find((x) => x.id === id);
    const t = (s?.start_time ?? "09:00").slice(0, 5);
    return s ? new Date(`${s.day}T${t}:00`).getTimezoneOffset() : new Date().getTimezoneOffset();
  };
  const pushSoon = (id: string, kind: StickyKind) => {
    if (!googleConnected || kind === "smart") return;
    void pushFn({ data: { stickyId: id, tzOffsetMin: tzOf(id) } })
      .then(() => invalidate())
      .catch(() => undefined);
  };

  const add = useMutation({
    mutationFn: (input: Parameters<typeof createSticky>[0]) => createSticky(input),
    onSuccess: (row) => {
      invalidate();
      if (row.title.trim()) pushSoon(row.id, row.kind);
    },
    onError: () => toast.error("Impossible de créer le post-it"),
  });
  const patch = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Sticky> }) => {
      await updateSticky(id, data);
      return { id, data };
    },
    onSuccess: ({ id, data }) => {
      invalidate();
      const sticky = stickies.find((s) => s.id === id);
      const contentChanged =
        "title" in data ||
        "day" in data ||
        "content" in data ||
        "start_time" in data ||
        "duration_min" in data ||
        "done" in data ||
        "email_to" in data;
      if (sticky && contentChanged) pushSoon(id, sticky.kind);
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const sticky = stickies.find((s) => s.id === id);
      if (googleConnected && sticky && sticky.google_id) {
        await deleteRemoteFn({ data: { stickyId: id } }).catch(() => undefined);
      }
      await deleteSticky(id);
    },
    onSuccess: invalidate,
  });

  async function syncNow(silent = false) {
    setSyncing(true);
    try {
      const targets = stickies.filter((s) => s.kind === "task" || s.kind === "appointment");
      for (const s of targets) await pushFn({ data: { stickyId: s.id, tzOffsetMin: new Date(`${s.day}T${(s.start_time ?? "09:00").slice(0, 5)}:00`).getTimezoneOffset() } });
      invalidate();
      if (!silent) toast.success(`Synchronisé avec SKY — ${targets.length} post-it`);
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : "Synchronisation impossible");
    } finally {
      setSyncing(false);
    }
  }

  async function sendEmail(id: string) {
    try {
      await sendFn({ data: { stickyId: id } });
      invalidate();
      toast.success("E-mail envoyé via Sendy");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible");
    }
  }


  function nextFreeSpot(index: number) {
    const col = index % 4;
    const row = Math.floor(index / 4);
    return { x: 60 + col * 270, y: 60 + row * 250 };
  }

  function addSticky(kind: StickyKind) {
    const spot = nextFreeSpot(stickies.length);
    add.mutate({ day: date, kind, ...spot, title: "", content: "" });
  }

  async function runPlan() {
    if (!goal.trim()) return;
    setPlanning(true);
    try {
      const existing = stickies
        .map((s) => `- ${s.start_time ?? "--:--"} ${s.title || "(sans titre)"}`)
        .join("\n");
      const res = await planFn({ data: { day: date, goal: goal.trim(), existing } });
      if (!res.suggestions.length) {
        toast.error("Aucune suggestion générée");
        return;
      }
      let i = stickies.length;
      for (const s of res.suggestions) {
        const spot = nextFreeSpot(i++);
        await createSticky({ day: date, ...spot, ...s, kind: s.kind });
      }
      invalidate();
      setGoal("");
      toast.success(`${res.suggestions.length} post-it ajoutés`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'assistant a échoué");
    } finally {
      setPlanning(false);
    }
  }

  async function smartRun(prompt: string) {
    const context = stickies
      .map((s) => `- [${s.kind}] ${s.start_time ?? ""} ${s.title}`)
      .join("\n");
    try {
      const res = await askFn({ data: { prompt, context } });
      return res.text;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'assistant a échoué");
      return "";
    }
  }

  function onBoardPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
  }
  function onBoardPointerMove(e: React.PointerEvent) {
    if (!panRef.current) return;
    setPan({
      x: panRef.current.ox + (e.clientX - panRef.current.sx),
      y: panRef.current.oy + (e.clientY - panRef.current.sy),
    });
  }

  const goto = (delta: number) => navigate({ to: "/planification/jour/$date", params: { date: toKey(addDays(day, delta)) } });

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Link
          to="/planification"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Calendrier
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={() => goto(-1)} className="rounded-lg p-1.5 hover:bg-accent" aria-label="Jour précédent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h1 className="font-display text-sm font-bold sm:text-base">{longDate(day)}</h1>
          <button onClick={() => goto(1)} className="rounded-lg p-1.5 hover:bg-accent" aria-label="Jour suivant">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => void syncNow()}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium transition hover:border-ring disabled:opacity-60"
            aria-label="Synchroniser avec SKY"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Synchroniser</span>
          </button>

          {NEW_KINDS.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              onClick={() => addSticky(kind)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium transition hover:border-ring"
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-border bg-card/60 px-3 py-2">
        <Wand2 className="h-4 w-4 shrink-0 text-primary" />
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runPlan()}
          placeholder="Décrivez votre journée idéale : l'IA la découpe en post-it…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={() => void runPlan()}
          disabled={planning}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Planifier
        </button>
      </div>

      <div
        className="relative flex-1 cursor-grab overflow-hidden board-surface active:cursor-grabbing"
        style={{ touchAction: "none", backgroundPosition: `${pan.x}px ${pan.y}px` }}
        onPointerDown={onBoardPointerDown}
        onPointerMove={onBoardPointerMove}
        onPointerUp={() => (panRef.current = null)}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        >
          {stickies.map((s) => (
            <StickyCard
              key={s.id}
              sticky={s}
              scale={scale}
              googleConnected={googleConnected}
              onPatch={(data) => patch.mutate({ id: s.id, data })}
              onDelete={() => remove.mutate(s.id)}
              onSmartRun={smartRun}
              onSendEmail={() => sendEmail(s.id)}
            />
          ))}

        </div>

        {!isLoading && stickies.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              Tableau vide. Ajoutez un post-it depuis la barre d'outils ou laissez l'assistant Smart
              construire votre journée.
            </p>
          </div>
        )}

        <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-xl border border-border bg-card/90 p-1 backdrop-blur">
          <button onClick={() => setScale((s) => Math.max(0.4, +(s - 0.1).toFixed(2)))} className="rounded-lg p-1.5 hover:bg-accent" aria-label="Dézoomer">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(1.8, +(s + 0.1).toFixed(2)))} className="rounded-lg p-1.5 hover:bg-accent" aria-label="Zoomer">
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setScale(1);
            }}
            className="rounded-lg p-1.5 hover:bg-accent"
            aria-label="Recentrer"
          >
            <Locate className="h-4 w-4" />
          </button>
        </div>
      </div>
    </main>
  );
}
