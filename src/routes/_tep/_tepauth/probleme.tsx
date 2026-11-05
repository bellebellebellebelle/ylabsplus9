import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Compass,
  Loader2,
  LogOut,
  Plus,
  Sparkles,
  Wand2,
  ChevronDown,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProjectId, scopeToProject } from "@/tep/lib/project-scope";
import { Button } from "@/tep/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BubbleCard, type Bubble } from "@/tep/components/board/BubbleCard";
import { AI_KINDS, KIND_HINTS, KIND_LABELS, type BubbleKind } from "@/tep/lib/board-kinds";
import { useIsMobile } from "@/hooks/use-mobile";
import { getClarification, getNextMove, getSuggestions, runBubble } from "@/tep/lib/problem-ai.functions";

export const Route = createFileRoute("/_tep/_tepauth/probleme")({
  head: () => ({
    meta: [
      { title: "Mon tableau — Résolvo" },
      { name: "description", content: "Votre tableau intelligent de résolution de problèmes." },
      { property: "og:title", content: "Mon tableau — Résolvo" },
      { property: "og:description", content: "Agents IA et bulles intelligentes sur un tableau." },
    ],
  }),
  component: BoardPage,
});

type Board = { id: string; title: string; problem: string; progress: number };

function BoardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);

  const runBubbleFn = useServerFn(runBubble);
  const suggestFn = useServerFn(getSuggestions);
  const nextMoveFn = useServerFn(getNextMove);
  const clarifyFn = useServerFn(getClarification);

  const boardsQuery = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const { data, error } = await scopeToProject(supabase.from("tep_boards").select("id, title, problem, progress"))
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Board[];
    },
  });

  const boards = boardsQuery.data ?? [];
  const activeId = boardId ?? boards[0]?.id ?? null;
  const board = boards.find((b) => b.id === activeId) ?? null;

  const bubblesQuery = useQuery({
    queryKey: ["bubbles", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tep_bubbles")
        .select("*")
        .eq("board_id", activeId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Bubble[];
    },
  });
  const bubbles = useMemo(() => bubblesQuery.data ?? [], [bubblesQuery.data]);

  // Realtime sync
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`board-${activeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tep_bubbles", filter: `board_id=eq.${activeId}` },
        () => qc.invalidateQueries({ queryKey: ["bubbles", activeId] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "tep_boards" }, () =>
        qc.invalidateQueries({ queryKey: ["boards"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, qc]);

  const createBoard = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("tep_boards")
        .insert({ user_id: auth.user!.id, title: "Nouveau problème", problem: "", project_id: getProjectId() })
        .select("id, title, problem, progress")
        .single();
      if (error) throw error;
      return data as Board;
    },
    onSuccess: (b) => {
      setBoardId(b.id);
      qc.invalidateQueries({ queryKey: ["boards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-create first board
  useEffect(() => {
    if (boardsQuery.isSuccess && boards.length === 0 && !createBoard.isPending) {
      createBoard.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardsQuery.isSuccess, boards.length]);

  const updateBoard = useMutation({
    mutationFn: async (patch: Partial<Board>) => {
      const { error } = await supabase.from("tep_boards").update(patch).eq("id", activeId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boards"] }),
  });

  const addBubble = useMutation({
    mutationFn: async (init: Partial<Bubble> & { kind: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const count = bubbles.length;
      const angle = (count % 8) * (Math.PI / 4);
      const { error } = await supabase.from("tep_bubbles").insert({
        board_id: activeId!,
        user_id: auth.user!.id,
        kind: init.kind,
        title: init.title ?? "",
        mission: init.mission ?? "",
        objective: init.objective ?? "",
        content: init.content ?? "",
        x: Math.round(Math.cos(angle) * 380 + (count > 7 ? 120 : 0)),
        y: Math.round(Math.sin(angle) * 260 + (count > 7 ? 90 : 0)),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bubbles", activeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBubble = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Bubble> }) => {
      const { error } = await supabase.from("tep_bubbles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      qc.setQueryData<Bubble[]>(["bubbles", activeId], (old) =>
        (old ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBubble = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tep_bubbles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bubbles", activeId] }),
  });

  const run = useMutation({
    mutationFn: async (id: string) => runBubbleFn({ data: { bubbleId: id } }),
    onMutate: (id) => {
      qc.setQueryData<Bubble[]>(["bubbles", activeId], (old) =>
        (old ?? []).map((b) => (b.id === id ? { ...b, status: "running" } : b)),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["bubbles", activeId] }),
    onError: (e: Error) => toast.error(e.message || "L'agent n'a pas pu répondre."),
  });

  const suggest = useMutation({
    mutationFn: async () => suggestFn({ data: { boardId: activeId! } }),
    onSuccess: async (res) => {
      if (!res.suggestions.length) {
        toast.error("Aucune suggestion pour l'instant.");
        return;
      }
      for (const s of res.suggestions) await addBubble.mutateAsync(s);
      toast.success(`${res.suggestions.length} bulles ajoutées`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nextMove = useMutation({
    mutationFn: async () => nextMoveFn({ data: { boardId: activeId! } }),
    onSuccess: (res) => {
      setInsight(res.content);
      qc.invalidateQueries({ queryKey: ["boards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clarify = useMutation({
    mutationFn: async () => clarifyFn({ data: { boardId: activeId! } }),
    onSuccess: (res) => setInsight(res.content),
    onError: (e: Error) => toast.error(e.message),
  });

  const actions = bubbles.filter((b) => b.kind === "action");
  const doneCount = actions.filter((b) => b.done).length;
  const progress = board?.progress ?? 0;

  if (!board) {
    return (
      <div className="resolvo flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="resolvo flex h-screen flex-col overflow-hidden bg-background text-foreground font-sans">
      {/* Top bar */}
      <header className="glass z-30 flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="max-w-[45vw] truncate font-display">
              <span className="truncate">{board.title}</span>
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {boards.map((b) => (
              <DropdownMenuItem key={b.id} onClick={() => setBoardId(b.id)} className="truncate">
                {b.title}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => createBoard.mutate()}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau problème
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {progress}% · {doneCount}/{actions.length} actions
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => nextMove.mutate()}
            disabled={nextMove.isPending || !board.problem}
          >
            {nextMove.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Compass className="mr-1.5 h-3.5 w-3.5" />
            )}
            Prochaine action
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Se déconnecter"
            onClick={async () => {
              await supabase.auth.signOut();
              qc.clear();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Insight banner */}
      {insight && (
        <div className="glass z-20 shrink-0 border-b border-primary/30 px-4 py-3">
          <div className="mx-auto flex max-w-3xl gap-3">
            <Compass className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm whitespace-pre-wrap text-foreground/90">{insight}</p>
            <button
              onClick={() => setInsight(null)}
              className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="relative flex-1 overflow-auto board-grid">
        {isMobile ? (
          <div className="space-y-3 p-4 pb-32">
            <ProblemCard board={board} onChange={(patch) => updateBoard.mutate(patch)} />
            {bubbles.map((b) => (
              <BubbleCard
                key={b.id}
                bubble={b}
                onUpdate={(patch) => updateBubble.mutate({ id: b.id, patch })}
                onDelete={() => deleteBubble.mutate(b.id)}
                onRun={() => run.mutate(b.id)}
              />
            ))}
          </div>
        ) : (
          <Canvas
            bubbles={bubbles}
            board={board}
            onBoardChange={(patch) => updateBoard.mutate(patch)}
            onUpdate={(id, patch) => updateBubble.mutate({ id, patch })}
            onDelete={(id) => deleteBubble.mutate(id)}
            onRun={(id) => run.mutate(id)}
          />
        )}
      </div>

      {/* Dock */}
      <div className="glass z-30 flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Bulle
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {(["agent", ...AI_KINDS.filter((k) => k !== "agent"), "action", "note"] as BubbleKind[]).map(
              (k) => (
                <DropdownMenuItem
                  key={k}
                  onClick={() => addBubble.mutate({ kind: k })}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium">{KIND_LABELS[k]}</span>
                  <span className="text-xs text-muted-foreground">{KIND_HINTS[k]}</span>
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => suggest.mutate()}
          disabled={suggest.isPending || !board.problem}
        >
          {suggest.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          Suggérer 3 bulles
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clarify.mutate()}
          disabled={clarify.isPending || !board.problem}
        >
          {clarify.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="mr-1.5 h-3.5 w-3.5" />
          )}
          Clarifier le problème
        </Button>
        {!board.problem && (
          <span className="text-xs text-muted-foreground">
            Écrivez d'abord votre problème au centre.
          </span>
        )}
      </div>
    </div>
  );
}

function ProblemCard({
  board,
  onChange,
}: {
  board: Board;
  onChange: (patch: Partial<Board>) => void;
}) {
  const [value, setValue] = useState(board.problem);
  useEffect(() => setValue(board.problem), [board.id, board.problem]);

  return (
    <div className="w-full max-w-md rounded-3xl border-2 border-[var(--problem)]/50 bg-surface p-4 shadow-2xl">
      <span className="text-[11px] font-semibold tracking-wide text-[var(--problem)] uppercase">
        Le problème
      </span>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value === board.problem) return;
          const title = value.split("\n")[0]?.slice(0, 60) || "Nouveau problème";
          onChange({ problem: value, title });
        }}
        placeholder="Décrivez précisément ce qui bloque, ce que vous avez déjà tenté, et ce à quoi ressemblerait une vraie solution."
        className="mt-2 min-h-32 resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

function Canvas({
  bubbles,
  board,
  onBoardChange,
  onUpdate,
  onDelete,
  onRun,
}: {
  bubbles: Bubble[];
  board: Board;
  onBoardChange: (patch: Partial<Board>) => void;
  onUpdate: (id: string, patch: Partial<Bubble>) => void;
  onDelete: (id: string) => void;
  onRun: (id: string) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const origin = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  function startDrag(b: Bubble, e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    origin.current = { px: e.clientX, py: e.clientY, x: b.x, y: b.y };
    setDrag({ id: b.id, x: b.x, y: b.y });
  }

  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || !origin.current) return;
    setDrag({
      id: drag.id,
      x: origin.current.x + (e.clientX - origin.current.px),
      y: origin.current.y + (e.clientY - origin.current.py),
    });
  }

  function endDrag() {
    if (drag) onUpdate(drag.id, { x: Math.round(drag.x), y: Math.round(drag.y) });
    setDrag(null);
    origin.current = null;
  }

  return (
    <div className="relative h-full min-h-[900px] w-full min-w-[1400px]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <ProblemCard board={board} onChange={onBoardChange} />
      </div>

      {bubbles.map((b) => {
        const pos = drag?.id === b.id ? drag : b;
        return (
          <div
            key={b.id}
            className="absolute top-1/2 left-1/2 w-72"
            style={{ transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
          >
            <BubbleCard
              bubble={b}
              dragging={drag?.id === b.id}
              dragHandlers={{
                onPointerDown: (e) => startDrag(b, e),
                onPointerMove: moveDrag,
                onPointerUp: endDrag,
              }}
              onUpdate={(patch) => onUpdate(b.id, patch)}
              onDelete={() => onDelete(b.id)}
              onRun={() => onRun(b.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
