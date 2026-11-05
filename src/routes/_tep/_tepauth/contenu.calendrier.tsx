import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/tep/components/contenu/AppShell";
import { Button } from "@/tep/components/ui/button";
import { NETWORKS, STATUS_LABELS } from "@/tep/lib/contenu/networks";
import type { NetworkId, Status } from "@/tep/lib/contenu/networks";
import { updateNote } from "@/tep/lib/contenu/data";
import { useWorkspace } from "@/tep/lib/contenu/useWorkspace";

export const Route = createFileRoute("/_tep/_tepauth/contenu/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier éditorial — Nova Studio" },
      {
        name: "description",
        content: "Planifiez vos publications réseau par réseau dans un calendrier éditorial clair.",
      },
      { property: "og:title", content: "Calendrier éditorial — Nova Studio" },
      {
        property: "og:description",
        content: "Visualisez et planifiez toutes vos publications à venir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const shift = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), 1 - shift);
}

function CalendarPage() {
  const { user, notes, patchLocal } = useWorkspace();
  const [month, setMonth] = useState(() => new Date());

  const days = useMemo(() => {
    const start = startOfGrid(month);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const scheduled = notes.filter((n) => n.scheduled_at);

  function move(noteId: string, day: Date) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const prev = note.scheduled_at ? new Date(note.scheduled_at) : new Date();
    const next = new Date(day);
    next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    const iso = next.toISOString();
    patchLocal(noteId, { scheduled_at: iso, status: "scheduled" });
    void updateNote(noteId, { scheduled_at: iso, status: "scheduled" });
  }

  return (
    <AppShell email={user?.email}>
      <div className="h-full overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold capitalize">
              {month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </h1>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Mois précédent"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMonth(new Date())}>
                Aujourd’hui
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Mois suivant"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
            {DAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const items = scheduled.filter((n) => {
                const d = new Date(n.scheduled_at!);
                return d.toDateString() === day.toDateString();
              });
              const dim = day.getMonth() !== month.getMonth();
              const today = day.toDateString() === new Date().toDateString();
              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) move(id, day);
                  }}
                  className={`glass min-h-24 rounded-xl p-1.5 ${dim ? "opacity-40" : ""} ${
                    today ? "ring-1 ring-primary" : ""
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground">{day.getDate()}</span>
                  <div className="mt-1 flex flex-col gap-1">
                    {items.map((n) => {
                      const net = n.network ? NETWORKS[n.network as NetworkId] : null;
                      return (
                        <div
                          key={n.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", n.id)}
                          className="cursor-grab truncate rounded-lg px-1.5 py-1 text-[10px] active:cursor-grabbing"
                          style={{
                            background: `color-mix(in oklab, ${net?.colorVar ?? "var(--primary)"} 20%, transparent)`,
                          }}
                          title={`${STATUS_LABELS[n.status as Status] ?? n.status} — ${n.title || n.caption}`}
                        >
                          {n.title || n.caption || net?.label || "Post"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {scheduled.length === 0 && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Aucun contenu planifié. Ajoutez une date sur un post-it du tableau.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
