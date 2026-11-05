import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, KanbanSquare, Bell, LineChart, NotebookPen, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/tasky/")({
  head: () => ({
    meta: [
      { title: "SKY TASK — Gestion de tâches ultra smart" },
      { name: "description", content: "Tâches, listes, notes, pipeline intelligent, rappels et suivi de productivité." },
      { property: "og:title", content: "SKY TASK — Gestion de tâches ultra smart" },
      { property: "og:description", content: "Tâches, listes, notes, pipeline intelligent, rappels et suivi de productivité." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: KanbanSquare, t: "Pipeline smart", d: "Glissez vos tâches à travers 4 étapes." },
  { icon: Bell, t: "Rappels 30 min", d: "Notifications navigateur avant chaque échéance." },
  { icon: LineChart, t: "Insights", d: "Séries, taux de complétion, progression." },
  { icon: NotebookPen, t: "Notes", d: "Capturez vos idées, épinglez l'essentiel." },
  { icon: SlidersHorizontal, t: "Personnalisation", d: "Accent, objectif quotidien, densité." },
];

function Index() {
  return (
    <div className="sky-task min-h-screen"><main className="mx-auto max-w-6xl px-5 py-8">
      <nav className="flex items-center justify-between">
        <span className="font-display text-lg font-bold">SKY<span className="sk-holo-text">TASK</span></span>
        <Link to="/tasks" className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-ink-foreground">Se connecter</Link>
      </nav>
      <section className="grid gap-4 pt-14 md:grid-cols-6">
        <div className="sk-glass sk-holo-border p-8 md:col-span-4 md:p-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium"><Sparkles className="h-3.5 w-3.5" /> Intelligence de productivité</span>
          <h1 className="mt-6 text-4xl font-bold leading-tight md:text-6xl">Vos tâches,<br /><span className="sk-holo-text">pensées plus loin.</span></h1>
          <p className="mt-5 max-w-md text-muted-foreground">Planifiez, priorisez et suivez vos progrès dans un espace calme et intelligent.</p>
          <Link to="/tasks" className="mt-8 inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground">Créer mon compte</Link>
        </div>
        <div className="bento-ink flex flex-col justify-between p-8 md:col-span-2">
          <p className="text-sm opacity-70">Focus du jour</p>
          <div>
            <p className="font-display text-6xl font-bold sk-holo-text">87%</p>
            <p className="mt-2 text-sm opacity-70">de tâches terminées cette semaine</p>
          </div>
        </div>
        {features.map((f) => (
          <div key={f.t} className="sk-glass p-6 md:col-span-2 last:md:col-span-2">
            <f.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-4 font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
        <div className="sk-holo-bg rounded-[calc(var(--radius)+8px)] p-6 md:col-span-2">
          <p className="font-display text-xl font-semibold text-ink">Gratuit. Instantané. Synchronisé en temps réel.</p>
        </div>
      </section>
    </main></div>
  );
}
