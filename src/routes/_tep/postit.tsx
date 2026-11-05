import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  ListTodo,
  Settings,
  Sparkles,
  StickyNote as StickyIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProjectId, scopeToProject, withProject } from "@/tep/lib/project-scope";
import { CANVAS_SIZE, type BoardItem, type ItemKind } from "@/tep/lib/board";
import { StickyNote } from "@/tep/components/StickyNote";
import { SettingsPanel } from "@/tep/components/SettingsPanel";
import { Button } from "@/tep/components/ui/button";
import { skyPushTask, skyPushEvent } from "@/tep/lib/sky.functions";
import { runAgent } from "@/tep/lib/ai.functions";

export const Route = createFileRoute("/_tep/postit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Muraly — Tableau Post-it" },
      {
        name: "description",
        content:
          "Tableau virtuel plein écran : post-it libres, tâches synchronisées avec SKY Task, rendez-vous dans Calendsky et agents Post-it IA.",
      },
      { property: "og:title", content: "Muraly — Tableau Post-it" },
      {
        property: "og:description",
        content:
          "Post-it, tâches SKY Task, rendez-vous Calendsky et agents IA sur un seul tableau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardPage,
});

const TOOLS: { kind: ItemKind; label: string; icon: typeof StickyIcon; color: string }[] = [
  { kind: "note", label: "Post-it", icon: StickyIcon, color: "yellow" },
  { kind: "task", label: "Tâche", icon: ListTodo, color: "mint" },
  { kind: "event", label: "Rendez-vous", icon: CalendarClock, color: "sky" },
  { kind: "ai", label: "Agent IA", icon: Sparkles, color: "lilac" },
];

function BoardPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<BoardItem[]>([]);
  const [tool, setTool] = useState<ItemKind>("note");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setUserId(session.user.id);
      setEmail(session.user.email ?? "");
      const { data: rows } = await scopeToProject(supabase.from("tep_board_items").select("*")).order("created_at", { ascending: true });
      setItems((rows ?? []) as BoardItem[]);
    });
  }, [navigate]);

  // Persistance temps réel entre onglets et appareils.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("board_items")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tep_board_items" },
        (payload) => {
          setItems((current) => {
            if (payload.eventType === "DELETE") {
              return current.filter((i) => i.id !== (payload.old as BoardItem).id);
            }
            const row = payload.new as BoardItem & { project_id?: string | null };
            if ((row.project_id ?? null) !== getProjectId()) return current;
            const exists = current.some((i) => i.id === row.id);
            return exists ? current.map((i) => (i.id === row.id ? { ...i, ...row } : i)) : [...current, row];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addItem = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!userId) return;
    if ((event.target as HTMLElement).closest("[data-item]")) return;
    const container = event.currentTarget;
    const x = event.clientX - container.getBoundingClientRect().left;
    const y = event.clientY - container.getBoundingClientRect().top;
    const preset = TOOLS.find((t) => t.kind === tool)!;
    const { data, error } = await supabase
      .from("tep_board_items")
      .insert({ user_id: userId, kind: tool, color: preset.color, x, y, project_id: getProjectId() })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((current) =>
      current.some((i) => i.id === data.id) ? current : [...current, data as BoardItem],
    );
  };

  const patchItem = (id: string, patch: Partial<BoardItem>) => {
    setItems((current) => current.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    supabase
      .from("tep_board_items")
      .update(patch)
      .eq("id", id)
      .then(({ error }) => {
        if (error) toast.error(error.message);
      });
  };

  const removeItem = async (id: string) => {
    setItems((current) => current.filter((i) => i.id !== id));
    await supabase.from("tep_board_items").delete().eq("id", id);
  };


  return (
    <div className="fixed inset-0 overflow-auto bg-board">
      <div
        onClick={addItem}
        className="relative"
        style={{
          width: CANVAS_SIZE.w,
          height: CANVAS_SIZE.h,
          backgroundImage:
            "linear-gradient(var(--board-line) 1px, transparent 1px), linear-gradient(90deg, var(--board-line) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        {items.map((item) => (
          <div key={item.id} data-item>
            <StickyNote
              item={item}
              onPatch={(patch) => patchItem(item.id, patch)}
              onDelete={() => removeItem(item.id)}
              onSyncTask={async () => {
                try {
                  const res = await skyPushTask({
                    data: { id: item.google_task_id, title: item.content, due: item.due_at, done: item.done },
                  });
                  patchItem(item.id, { google_task_id: res.id });
                  toast.success("Tâche enregistrée dans SKY Task");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Échec de l'envoi");
                }
              }}
              onSyncEvent={async () => {
                if (!item.due_at) {
                  toast.error("Choisissez une date et une heure.");
                  return;
                }
                try {
                  const res = await skyPushEvent({
                    data: {
                      id: item.google_event_id,
                      title: item.content,
                      start: item.due_at,
                      end: item.end_at,
                    },
                  });
                  patchItem(item.id, { google_event_id: res.id });
                  toast.success("Rendez-vous enregistré dans Calendsky");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Échec de l'enregistrement");
                }
              }}
              onRunAgent={async () => {
                if (!item.content.trim()) {
                  toast.error("Écrivez d'abord votre demande.");
                  return;
                }
                try {
                  const res = await runAgent({ data: { itemId: item.id, prompt: item.content } });
                  patchItem(item.id, { ai_result: res.result });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "L'agent a échoué");
                }
              }}
              onToggleDone={async () => {
                const done = !item.done;
                patchItem(item.id, { done });
                if (item.google_task_id) {
                  try {
                    await skyPushTask({ data: { id: item.google_task_id, title: item.content, due: item.due_at, done } });
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "SKY Task a refusé");
                  }
                }
              }}
            />
          </div>
        ))}
      </div>

      <div className="fixed left-1/2 bottom-4 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur">
        {TOOLS.map(({ kind, label, icon: Icon }) => (
          <Button
            key={kind}
            variant={tool === kind ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => setTool(kind)}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
        <span className="mx-1 hidden text-xs text-muted-foreground sm:inline">
          Cliquez sur le tableau
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Paramètres"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="size-4" />
        </Button>
      </div>

      {userId && (
        <SettingsPanel
          open={settingsOpen}
          onOpenChange={(open) => {
            setSettingsOpen(open);
          }}
          userId={userId}
          email={email}
        />
      )}
    </div>
  );
}
