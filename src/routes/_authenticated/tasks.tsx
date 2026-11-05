import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  LayoutGrid, KanbanSquare, ListChecks, NotebookPen, LineChart, Settings2, LogOut, Plus, Trash2,
  Bell, Flame, Target, Sparkles, Pin, Check, ChevronRight, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  STAGES, smartFocus, streak, completionRate, weekCompletions, tasksToRemind,
  type Task, type TaskList, type Note, type Settings,
} from "@/lib/sky";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Dashboard — SKY TASK" },
      { name: "description", content: "Votre espace de productivité SKY TASK." },
      { property: "og:title", content: "Dashboard — SKY TASK" },
      { property: "og:description", content: "Votre espace de productivité SKY TASK." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/sky/auth" });
    return { user: data.user };
  },
  component: Dashboard,
});

type View = "home" | "pipeline" | "lists" | "notes" | "insights" | "settings";
const NAV: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: "home", label: "Accueil", icon: LayoutGrid },
  { id: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { id: "lists", label: "Listes", icon: ListChecks },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "insights", label: "Insights", icon: LineChart },
  { id: "settings", label: "Réglages", icon: Settings2 },
];
const ACCENTS = [
  { id: "sage", c: "bg-[oklch(0.66_0.045_130)]" },
  { id: "olive", c: "bg-[oklch(0.6_0.08_115)]" },
  { id: "graphite", c: "bg-[oklch(0.27_0.01_160)]" },
  { id: "aurora", c: "bg-[oklch(0.62_0.09_200)]" },
  { id: "rose", c: "bg-[oklch(0.64_0.09_10)]" },
];
const PRIO_LABEL: Record<string, string> = { low: "Basse", medium: "Moyenne", high: "Haute" };
const input = "w-full rounded-xl border border-input bg-background/70 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";
const btn = "inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90";

function useData(userId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const load = useCallback(async () => {
    const [t, l, n, s] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("task_lists").select("*").order("created_at"),
      supabase.from("notes").select("*").order("pinned", { ascending: false }).order("updated_at", { ascending: false }),
      supabase.from("sky_user_settings").select("*").maybeSingle(),
    ]);
    setTasks(t.data ?? []); setLists(l.data ?? []); setNotes(n.data ?? []);
    if (s.data) setSettings(s.data);
    else {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("sky_user_settings")
        .insert({ display_name: (u.user?.user_metadata?.["display_name"] as string) || null }).select().single();
      setSettings(data);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel(`sky-${userId}-${Math.random().toString(36).slice(2)}`);
    for (const table of ["tasks", "task_lists", "notes"])
      ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }, () => load());
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, userId]);

  return { tasks, lists, notes, settings, setSettings, reload: load };
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const nav = useNavigate();
  const d = useData(user.id);
  const [view, setView] = useState<View>("home");
  const [now, setNow] = useState(Date.now());

  // Reminders: check every 30s, notify 30 min before due time
  useEffect(() => {
    const tick = () => {
      const t = Date.now(); setNow(t);
      if (!d.settings?.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const sent: string[] = JSON.parse(localStorage.getItem("sky-notified") || "[]");
      for (const task of tasksToRemind(d.tasks, t)) {
        const key = `${task.id}-${task.due_at}`;
        if (sent.includes(key)) continue;
        const mins = Math.round((new Date(task.due_at!).getTime() - t) / 60000);
        new Notification("SKY TASK · Rappel", { body: `${task.title} — dans ${mins} min` });
        sent.push(key);
      }
      localStorage.setItem("sky-notified", JSON.stringify(sent.slice(-200)));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [d.tasks, d.settings?.notifications]);

  async function signOut() { await supabase.auth.signOut(); nav({ to: "/tasky" }); }

  const name = d.settings?.display_name || user.email?.split("@")[0];
  const compact = d.settings?.compact;

  const [menu, setMenu] = useState(false);
  const go = (v: View) => { setView(v); setMenu(false); };

  return (
    <div data-accent={d.settings?.accent ?? "sage"} className="sky-task relative min-h-screen overflow-x-hidden">
      <div className="planet-glow" aria-hidden />
      {menu && <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} aria-hidden />}
      <nav className={`sk-glass fixed bottom-20 left-5 z-40 flex w-60 flex-col gap-1 p-4 transition-all duration-300 origin-bottom-left ${menu ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0"}`}>
        <div className="px-2 pb-5 font-display text-lg font-bold">SKY<span className="text-primary">TASK</span></div>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => go(n.id)}
            className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${view === n.id ? "bg-primary/20 text-foreground shadow-[0_0_20px_-4px_var(--primary)] border border-primary/40" : "text-muted-foreground hover:bg-secondary"}`}>
            <n.icon className="h-4 w-4" />{n.label}
          </button>
        ))}
        <div className="mt-4 flex items-center gap-2 px-3 py-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">{name?.[0]}</span>
          <span className="truncate">{name}</span>
        </div>
        <button onClick={signOut} className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary">
          <LogOut className="h-4 w-4" />Déconnexion
        </button>
      </nav>
      <button onClick={() => setMenu((m) => !m)} aria-label="Ouvrir le menu" aria-expanded={menu}
        className="orb fixed bottom-6 left-6 z-40 h-9 w-9 rounded-full" />
      <main className={`relative z-10 w-full px-3 md:px-5 ${compact ? "py-3" : "py-4"} pb-20`}>
        {view === "home" && <Home d={d} now={now} name={name} goto={setView} />}
        {view === "pipeline" && <Pipeline d={d} now={now} />}
        {view === "lists" && <Lists d={d} />}
        {view === "notes" && <Notes d={d} />}
        {view === "insights" && <Insights d={d} now={now} />}
        {view === "settings" && <SettingsView d={d} />}
        <div className="mt-8 flex justify-center">
          <p className="sk-glass flex items-center gap-2 rounded-full px-5 py-2.5 text-sm"><Sparkles className="h-4 w-4 text-primary" /> Chaque petite action t'amène vers de grands résultats.</p>
        </div>
      </main>
    </div>
  );
}

type D = ReturnType<typeof useData>;

function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
      {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
    </header>
  );
}

function fmtDue(iso: string | null, now: number) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  const label = new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return { label, overdue: t < now };
}

async function setStatus(t: Task, status: string) {
  const { error } = await supabase.from("tasks").update({ status, completed_at: status === "done" ? new Date().toISOString() : null }).eq("id", t.id);
  if (error) toast.error(error.message);
}

function TaskForm({ lists, defaultList, onDone }: { lists: TaskList[]; defaultList?: string; onDone?: () => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("medium");
  const [listId, setListId] = useState(defaultList ?? "");
  async function add(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), priority, list_id: listId || null, due_at: due ? new Date(due).toISOString() : null,
    });
    if (error) { toast.error(error.message); return; }
    setTitle(""); setDue(""); toast.success("Tâche planifiée"); onDone?.();
  }
  return (
    <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
      <input className={input} placeholder="Nouvelle tâche…" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={input} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Échéance" />
      <select className={input} value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priorité">
        <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option>
      </select>
      {!defaultList && (
        <select className={input} value={listId} onChange={(e) => setListId(e.target.value)} aria-label="Liste">
          <option value="">Sans liste</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )}
      <button className={btn}><Plus className="h-4 w-4" />Ajouter</button>
    </form>
  );
}

function TaskRow({ t, now }: { t: Task; now: number }) {
  const due = fmtDue(t.due_at, now);
  const done = t.status === "done";
  return (
    <div className="flex items-center gap-3 rounded-xl bg-background/60 px-3 py-2.5">
      <button onClick={() => setStatus(t, done ? "todo" : "done")} aria-label="Terminer"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
        {done && <Check className="h-3 w-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
        {due && <p className={`text-xs ${due.overdue && !done ? "text-destructive" : "text-muted-foreground"}`}>{due.label}</p>}
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.priority === "high" ? "bg-ink text-ink-foreground" : "bg-secondary"}`}>{PRIO_LABEL[t.priority]}</span>
      <button onClick={() => supabase.from("tasks").delete().eq("id", t.id)} aria-label="Supprimer" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function Home({ d, now, name, goto }: { d: D; now: number; name: string | undefined; goto: (v: View) => void }) {
  const focus = smartFocus(d.tasks, now);
  const today = new Date(now).toDateString();
  const doneToday = d.tasks.filter((t) => t.completed_at && new Date(t.completed_at).toDateString() === today).length;
  const goal = d.settings?.daily_goal ?? 5;
  const pct = Math.min(100, Math.round((doneToday / goal) * 100));
  const upcoming = d.tasks.filter((t) => t.status !== "done" && t.due_at && new Date(t.due_at).getTime() > now)
    .sort((a, b) => +new Date(a.due_at!) - +new Date(b.due_at!)).slice(0, 5);
  const hour = new Date(now).getHours();
  const rate = completionRate(d.tasks);
  const st = streak(d.tasks, now);
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-4 [&_header]:mb-0 [&_h1]:text-2xl [&_h1]:md:text-3xl">
        <Header title={`${hour < 18 ? "Bonjour" : "Bonsoir"}, ${name}`} sub={new Date(now).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} />
        <div className="sk-glass flex items-center gap-1 rounded-full p-1.5">
          <button onClick={() => goto("lists")} aria-label="Rechercher" className="rounded-full p-2.5 hover:bg-secondary"><Search className="h-4 w-4" /></button>
          <button onClick={() => goto("settings")} aria-label="Rappels" className="relative rounded-full p-2.5 hover:bg-secondary"><Bell className="h-4 w-4" />{upcoming.length > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />}</button>
          <button onClick={() => goto("insights")} aria-label="Insights" className="rounded-full p-2.5 hover:bg-secondary"><Sparkles className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid gap-3 md:min-h-[calc(100vh-11rem)] md:grid-cols-6 md:grid-rows-[1.3fr_auto_1fr]">
        <section className="bento-pearl pearl-scope p-6 md:col-span-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Focus intelligent</div>
          {focus.length ? <div className="space-y-1 rounded-2xl bg-background/50 p-2">{focus.map((t) => <TaskRow key={t.id} t={t} now={now} />)}</div>
            : <p className="text-sm text-muted-foreground">Rien d'urgent. Planifiez votre prochaine tâche ci-dessous.</p>}
          <div className="mt-5"><TaskForm lists={d.lists} /></div>
        </section>
        <section className="bento-ink relative flex flex-col justify-between overflow-hidden p-6 md:col-span-2">
          <div className="flex items-center gap-2 text-sm"><Target className="h-4 w-4" /> Objectif du jour</div>
          <Sparkles className="absolute right-8 top-1/3 h-14 w-14 text-primary drop-shadow-[0_0_14px_var(--primary)]" />
          <div className="my-6 flex items-end gap-2"><span className="font-display text-7xl font-bold">{doneToday}</span><span className="pb-3 text-muted-foreground">/ {goal}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full sk-holo-bg shadow-[0_0_12px_var(--primary)] transition-all" style={{ width: `${pct}%` }} /></div>
        </section>
        <section className="bento-ink p-6 md:col-span-2">
          <div className="flex items-center gap-2 text-sm"><Flame className="h-4 w-4" /> Série</div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="font-display text-4xl font-bold">{st} <span className="text-xl">jour{st > 1 ? "s" : ""}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Continue comme ça !</p>
            </div>
            <svg viewBox="0 0 90 30" className="h-8 w-24 text-primary" aria-hidden><path d="M0 28 L20 24 L35 26 L50 16 L62 20 L75 8 L90 4 L90 30 L0 30Z" fill="currentColor" opacity=".35" /><path d="M0 28 L20 24 L35 26 L50 16 L62 20 L75 8 L90 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          </div>
        </section>
        <section className="bento-ink p-6 md:col-span-2">
          <div className="text-sm">Taux de complétion</div>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full text-xs font-bold" style={{ background: `conic-gradient(var(--primary) ${rate * 3.6}deg, var(--secondary) 0)` }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background">{rate}</span>
            </div>
            <div><p className="font-display text-2xl font-bold">{rate}%</p><p className="text-xs text-muted-foreground">{rate >= 50 ? "Très bon rythme" : "On accélère !"}</p></div>
          </div>
        </section>
        <button onClick={() => goto("pipeline")} className="bento-ink p-6 text-left md:col-span-2">
          <div className="flex items-center gap-2 text-sm"><KanbanSquare className="h-4 w-4" /> Pipeline</div>
          <div className="mt-3 flex gap-5">
            {STAGES.map((s) => <div key={s.id}><p className="font-display text-2xl font-bold">{d.tasks.filter((t) => t.status === s.id).length}</p><p className="text-[11px] text-muted-foreground">{s.label}</p></div>)}
          </div>
        </button>
        <section className="bento-ink p-6 md:col-span-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4" /> À venir</div>
          {upcoming.length ? <div className="space-y-2">{upcoming.map((t) => <TaskRow key={t.id} t={t} now={now} />)}</div>
            : <p className="text-sm text-muted-foreground">Aucune échéance planifiée.</p>}
        </section>
        <button onClick={() => goto("notes")} className="bento-pearl pearl-scope p-6 text-left md:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><NotebookPen className="h-4 w-4" /> Notes</div>
          <p className="mt-3 font-display text-3xl font-bold">{d.notes.length}</p>
          <p className="flex items-center text-sm">notes <ChevronRight className="h-4 w-4" /></p>
        </button>
      </div>
    </>
  );
}

function Pipeline({ d, now }: { d: D; now: number }) {
  const [drag, setDrag] = useState<string | null>(null);
  return (
    <>
      <Header title="Pipeline" sub="Glissez vos tâches d'une étape à l'autre." />
      <div className="sk-glass mb-4 p-4"><TaskForm lists={d.lists} /></div>
      <div className="grid gap-4 md:grid-cols-4">
        {STAGES.map((s, i) => {
          const items = d.tasks.filter((t) => t.status === s.id);
          return (
            <section key={s.id} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { const t = d.tasks.find((x) => x.id === drag); if (t && t.status !== s.id) setStatus(t, s.id); setDrag(null); }}
              className={`${s.id === "done" ? "bento-ink" : "sk-glass"} min-h-40 p-4`}>
              <div className="mb-3 flex items-center justify-between text-sm font-semibold"><span>{s.label}</span><span className="opacity-60">{items.length}</span></div>
              <div className="space-y-2">
                {items.map((t) => {
                  const due = fmtDue(t.due_at, now);
                  return (
                    <div key={t.id} draggable onDragStart={() => setDrag(t.id)}
                      className="cursor-grab rounded-xl bg-background p-3 text-foreground shadow-sm active:cursor-grabbing">
                      <p className="text-sm font-medium">{t.title}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span className={due?.overdue && s.id !== "done" ? "text-destructive" : ""}>{due?.label ?? PRIO_LABEL[t.priority]}</span>
                        {i < STAGES.length - 1 && <button onClick={() => setStatus(t, STAGES[i + 1]!.id)} aria-label="Étape suivante" className="rounded-full bg-secondary p-1"><ChevronRight className="h-3 w-3" /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Lists({ d }: { d: D }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  async function add(e: React.FormEvent): Promise<void> {
    e.preventDefault(); if (!name.trim()) return;
    const { error } = await supabase.from("task_lists").insert({ name: name.trim() });
    if (error) toast.error(error.message); else setName("");
  }
  return (
    <>
      <Header title="Listes" sub="Regroupez vos tâches par projet ou contexte." />
      <form onSubmit={add} className="sk-glass mb-4 flex gap-2 p-4">
        <input className={input} placeholder="Nom de la liste…" value={name} onChange={(e) => setName(e.target.value)} />
        <button className={btn}><Plus className="h-4 w-4" />Créer</button>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        {d.lists.map((l) => {
          const items = d.tasks.filter((t) => t.list_id === l.id);
          const done = items.filter((t) => t.status === "done").length;
          return (
            <section key={l.id} className="sk-glass p-5">
              <div className="flex items-center justify-between">
                <button onClick={() => setOpen(open === l.id ? null : l.id)} className="text-left">
                  <h3 className="text-lg font-semibold">{l.name}</h3>
                  <p className="text-xs text-muted-foreground">{done}/{items.length} terminées</p>
                </button>
                <button onClick={() => supabase.from("task_lists").delete().eq("id", l.id)} aria-label="Supprimer la liste" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></div>
              {open === l.id && (
                <div className="mt-4 space-y-2">
                  {items.map((t) => <TaskRow key={t.id} t={t} now={Date.now()} />)}
                  <TaskForm lists={d.lists} defaultList={l.id} />
                </div>
              )}
            </section>
          );
        })}
        {!d.lists.length && <p className="text-sm text-muted-foreground">Aucune liste pour l'instant.</p>}
      </div>
    </>
  );
}

function Notes({ d }: { d: D }) {
  const [sel, setSel] = useState<Note | null>(null);
  async function create(): Promise<void> {
    const { data, error } = await supabase.from("notes").insert({ title: "Nouvelle note" }).select().single();
    if (error) { toast.error(error.message); return; }
    setSel(data);
  }
  async function save(n: Note) {
    await supabase.from("notes").update({ title: n.title, content: n.content, pinned: n.pinned, updated_at: new Date().toISOString() }).eq("id", n.id);
  }
  useEffect(() => {
    if (!sel) return;
    const id = setTimeout(() => save(sel), 600);
    return () => clearTimeout(id);
  }, [sel]);
  return (
    <>
      <div className="flex items-start justify-between"><Header title="Notes" sub="Sauvegarde automatique." /><button onClick={create} className={btn}><Plus className="h-4 w-4" />Note</button></div>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {d.notes.map((n) => (
            <button key={n.id} onClick={() => setSel(n)} className={`sk-glass block w-full p-4 text-left ${sel?.id === n.id ? "sk-holo-border" : ""}`}>
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">{n.pinned && <Pin className="h-3 w-3 text-primary" />}{n.title || "Sans titre"}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.content || "…"}</p>
            </button>
          ))}
        </div>
        {sel ? (
          <div className="sk-glass flex min-h-80 flex-col gap-3 p-5">
            <div className="flex gap-2">
              <input className={`${input} font-display text-lg font-semibold`} value={sel.title} onChange={(e) => setSel({ ...sel, title: e.target.value })} />
              <button onClick={() => setSel({ ...sel, pinned: !sel.pinned })} aria-label="Épingler" className={`rounded-xl px-3 ${sel.pinned ? "bg-primary text-primary-foreground" : "bg-secondary"}`}><Pin className="h-4 w-4" /></button>
              <button onClick={async () => { await supabase.from("notes").delete().eq("id", sel.id); setSel(null); }} aria-label="Supprimer la note" className="rounded-xl bg-secondary px-3 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            <textarea className={`${input} flex-1 resize-none`} rows={14} placeholder="Écrivez…" value={sel.content} onChange={(e) => setSel({ ...sel, content: e.target.value })} />
          </div>
        ) : <div className="sk-glass flex min-h-60 items-center justify-center p-6 text-sm text-muted-foreground">Sélectionnez ou créez une note.</div>}
      </div>
    </>
  );
}

function Insights({ d, now }: { d: D; now: number }) {
  const week = useMemo(() => weekCompletions(d.tasks, now), [d.tasks, now]);
  const max = Math.max(1, ...week.map((w) => w.count));
  const total = week.reduce((a, b) => a + b.count, 0);
  const prev = d.tasks.filter((t) => t.completed_at && now - +new Date(t.completed_at) >= 7 * 86400000 && now - +new Date(t.completed_at) < 14 * 86400000).length;
  const delta = total - prev;
  const overdue = d.tasks.filter((t) => t.status !== "done" && t.due_at && +new Date(t.due_at) < now).length;
  const best = week.reduce((a, b) => (b.count > a!.count ? b : a), week[0])!;
  const tip = overdue > 2 ? `${overdue} tâches en retard : replanifiez-les ou découpez-les.`
    : delta >= 0 ? "Belle dynamique ! Gardez le rythme en planifiant demain dès ce soir."
    : "Semaine plus calme : fixez 1 tâche prioritaire par matin.";
  return (
    <>
      <Header title="Insights" sub="Suivez vos progrès et vos améliorations." />
      <div className="grid gap-4 md:grid-cols-6">
        <section className="sk-glass p-6 md:col-span-4">
          <p className="text-sm font-semibold">Tâches terminées · 7 jours</p>
          <div className="mt-6 flex h-44 items-end gap-3">
            {week.map((w) => (
              <div key={w.key} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">{w.count}</span>
                <div className="w-full rounded-lg sk-holo-bg" style={{ height: `${(w.count / max) * 100}%`, minHeight: 4 }} />
                <span className="text-xs capitalize text-muted-foreground">{w.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="bento-ink p-6 md:col-span-2">
          <p className="text-sm opacity-70">vs semaine précédente</p>
          <p className="mt-4 font-display text-5xl font-bold sk-holo-text">{delta >= 0 ? "+" : ""}{delta}</p>
          <p className="mt-2 text-sm opacity-70">{total} cette semaine · {prev} avant</p>
        </section>
        <Stat label="Série actuelle" value={`${streak(d.tasks, now)} j`} />
        <Stat label="En retard" value={String(overdue)} />
        <Stat label="Meilleur jour" value={best.count ? best.label : "—"} />
        <section className="sk-glass sk-holo-border p-6 md:col-span-6">
          <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Conseil smart</div>
          <p className="mt-2 text-muted-foreground">{tip}</p>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <section className="sk-glass p-6 md:col-span-2"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 font-display text-3xl font-bold capitalize">{value}</p></section>;
}

function SettingsView({ d }: { d: D }) {
  const s = d.settings;
  if (!s) return null;
  async function update(patch: Partial<Settings>) {
    d.setSettings({ ...s!, ...patch });
    const { error } = await supabase.from("sky_user_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", s!.user_id);
    if (error) toast.error(error.message);
  }
  async function toggleNotif(): Promise<void> {
    if (!s!.notifications) {
      if (typeof Notification === "undefined") { toast.error("Votre navigateur ne gère pas les notifications."); return; }
      const p = await Notification.requestPermission();
      if (p !== "granted") { toast.error("Notifications refusées par le navigateur."); return; }
      new Notification("SKY TASK", { body: "Rappels activés : 30 min avant chaque échéance." });
    }
    update({ notifications: !s!.notifications });
  }
  return (
    <>
      <Header title="Réglages" sub="Personnalisez SKY TASK à votre image." />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="sk-glass space-y-3 p-6">
          <p className="text-sm font-semibold">Nom affiché</p>
          <input className={input} defaultValue={s.display_name ?? ""} onBlur={(e) => update({ display_name: e.target.value })} />
        </section>
        <section className="sk-glass space-y-3 p-6">
          <p className="text-sm font-semibold">Couleur d'accent</p>
          <div className="flex gap-3">
            {ACCENTS.map((a) => (
              <button key={a.id} onClick={() => update({ accent: a.id })} aria-label={a.id}
                className={`h-9 w-9 rounded-full ${a.c} ${s.accent === a.id ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`} />
            ))}
          </div>
        </section>
        <section className="sk-glass space-y-3 p-6">
          <p className="text-sm font-semibold">Objectif quotidien : {s.daily_goal} tâches</p>
          <input type="range" min={1} max={20} value={s.daily_goal} onChange={(e) => update({ daily_goal: +e.target.value })} className="w-full accent-[var(--primary)]" />
        </section>
        <Toggle label="Rappels navigateur (30 min avant)" on={s.notifications} onClick={toggleNotif} />
        <Toggle label="Affichage compact" on={s.compact} onClick={() => update({ compact: !s.compact })} />
      </div>
    </>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <section className="sk-glass flex items-center justify-between p-6">
      <p className="text-sm font-semibold">{label}</p>
      <button onClick={onClick} role="switch" aria-checked={on} aria-label={label} className={`h-7 w-12 rounded-full p-1 transition ${on ? "bg-primary" : "bg-secondary"}`}>
        <span className={`block h-5 w-5 rounded-full bg-background shadow transition ${on ? "translate-x-5" : ""}`} />
      </button>
    </section>
  );
}
