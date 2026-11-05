import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Planner, type Note } from "@/components/Planner";
import {
  computeKpis, nextFreeSlot, productivityScore, sameDay, validateSlot, WORK_START, type Appt,
} from "@/lib/scheduling";

export const Route = createFileRoute("/calendsky/planning")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/sky/auth" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Dashboard — Sky Task" },
      { name: "description", content: "Votre planning intelligent et vos KPI de productivité." },
      { property: "og:title", content: "Dashboard — Sky Task" },
      { property: "og:description", content: "Planning sans conflit et KPI en temps réel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const CATS: Record<string, string> = { travail: "Travail", client: "Client", perso: "Perso", focus: "Focus" };
const STATUS: Record<string, string> = { prevu: "Prévu", termine: "Terminé", annule: "Annulé" };
const fmtT = (d: string | Date) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const toLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function Dashboard() {
  const nav = useNavigate();
  const { user } = Route.useRouteContext();
  const [list, setList] = useState<Appt[]>([]);
  const [day, setDay] = useState(() => new Date());
  const [edit, setEdit] = useState<Partial<Appt> | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("appointments").select("*").order("start_at");
    if (error) toast.error(error.message);
    else setList(data as Appt[]);
    const n = await supabase.from("planner_notes").select("*").order("created_at");
    if (!n.error) setNotes(n.data as Note[]);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`appts-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "planner_notes" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const openNew = useCallback(() => {
    const base = sameDay(day, new Date()) ? new Date() : new Date(new Date(day).setHours(WORK_START, 0, 0, 0));
    const s = nextFreeSlot(list, base, 60, 10) ?? base;
    setEdit({ start_at: s.toISOString(), end_at: new Date(s.getTime() + 3600000).toISOString(), buffer_min: 10, category: "travail", status: "prevu" });
  }, [day, list]);

  // Geste : deux doigts glissés de droite à gauche (tactile + trackpad)
  const touch = useRef<number | null>(null);
  const wheelAcc = useRef(0);
  useEffect(() => {
    const ts = (e: TouchEvent) => { touch.current = e.touches.length === 2 ? (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 : null; };
    const te = (e: TouchEvent) => {
      if (touch.current == null || e.changedTouches.length === 0) return;
      const x = e.changedTouches[0]!.clientX;
      if (touch.current - x > 60) openNew();
      touch.current = null;
    };
    let t: ReturnType<typeof setTimeout>;
    const wh = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      wheelAcc.current += e.deltaX;
      clearTimeout(t);
      t = setTimeout(() => (wheelAcc.current = 0), 250);
      if (wheelAcc.current > 120) { wheelAcc.current = 0; openNew(); }
    };
    window.addEventListener("touchstart", ts, { passive: true });
    window.addEventListener("touchend", te);
    window.addEventListener("wheel", wh, { passive: true });
    return () => { window.removeEventListener("touchstart", ts); window.removeEventListener("touchend", te); window.removeEventListener("wheel", wh); };
  }, [openNew]);

  const k = useMemo(() => computeKpis(list, day), [list, day]);
  const score = productivityScore(k);
  const next = list.find((a) => a.status === "prevu" && new Date(a.start_at) > new Date());
  const name = user.email?.split("@")[0] ?? "";
  const NAV = ["Dashboard", "Rendez-vous", "Clients", "Services", "Finance", "Équipe", "Analytics", "Paramètres"];

  return (
    <div className="calendsky flex min-h-screen">
      <aside className="sidebar-glass hidden lg:flex w-60 shrink-0 flex-col p-4 gap-1 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 py-3 mb-4 font-display font-bold tracking-wide">✳ SKY TASK</div>
        {NAV.map((n, i) => (
          <button key={n} onClick={() => i && toast("Bientôt disponible")} className={`text-left px-4 py-2.5 rounded-xl text-sm transition ${i === 0 ? "nav-active font-semibold" : "opacity-75 hover:opacity-100 hover:bg-primary-foreground/10"}`}>{n}</button>
        ))}
        <div className="mt-auto holo-ring rounded-2xl p-4 bg-primary-foreground/10 backdrop-blur">
          <div className="font-semibold text-sm">SkY Intelligence <span className="text-[9px] ml-1 px-1.5 py-0.5 rounded-full bg-lagoon">BETA</span></div>
          <p className="text-xs opacity-75 mt-1">Assistant IA pour booster ta productivité.</p>
          <button onClick={openNew} className="holo w-full mt-3 rounded-xl py-2 text-sm font-semibold text-navy">Créneau libre ✨</button>
        </div>
        <div className="flex items-center gap-3 rounded-2xl p-3 bg-primary-foreground/10 mt-3">
          <div className="w-9 h-9 rounded-full holo grid place-items-center font-bold text-navy uppercase">{name[0]}</div>
          <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{name}</div><div className="text-[11px] opacity-70">Propriétaire</div></div>
          <button onClick={async () => { await supabase.auth.signOut(); nav({ to: "/sky/auth" }); }} className="text-xs opacity-70 hover:opacity-100" aria-label="Déconnexion">⏻</button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-3 sm:p-6 pb-24 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <h1 className="text-2xl sm:text-3xl font-semibold">Bonjour, <span className="sk-holo-text">prêt·e ?</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost lg:hidden" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/sky/auth" }); }}>Déconnexion</button>
            <button onClick={openNew} className="btn-primary holo-ring">+ Rendez-vous</button>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bento-dark p-6 col-span-2 md:row-span-2 flex items-center gap-6 min-h-56 relative overflow-hidden">
            <div className="absolute -right-10 top-1/3 h-40 w-[120%] rotate-[-12deg] holo opacity-30 blur-2xl" />
            <div className="relative shrink-0 w-32 h-32 rounded-full grid place-items-center" style={{ background: `conic-gradient(var(--lagoon) ${score * 3.6}deg, oklch(1 0 0 / 0.12) 0)` }}>
              <div className="w-[108px] h-[108px] rounded-full bg-navy grid place-items-center text-center">
                <div><div className="font-display text-5xl font-semibold leading-none">{score}</div><div className="text-xs opacity-60">/100</div></div>
              </div>
            </div>
            <div className="relative space-y-3">
              <div className="text-sm opacity-70">Score de productivité · semaine</div>
              <div className="font-semibold">{score >= 50 ? "Tu es sur la bonne voie !" : "On accélère ?"}</div>
              <div className="text-sm opacity-80">
                {next ? <>Prochain : <b className="text-lagoon">{next.title}</b> · {new Date(next.start_at).toLocaleDateString("fr-FR", { weekday: "short" })} {fmtT(next.start_at)}</> : "Aucun rendez-vous à venir"}
              </div>
            </div>
          </div>
          <Kpi label="Rendez-vous" value={k.count} hint="cette semaine" />
          <Kpi label="Heures planifiées" value={`${k.hours}h`} hint={`moy. ${k.avgMin} min`} />
          <Kpi label="Occupation" value={`${k.occupancy}%`} hint="cible ~70%" bar={k.occupancy} />
          <Kpi label="Complétion" value={`${k.completion}%`} hint={`${k.cancelRate}% annulés`} bar={k.completion} />
        </section>

        <Planner list={list} notes={notes} userId={user.id} onOpen={(a) => setEdit(a)}
          onCreateAt={(d) => setEdit({ start_at: d.toISOString(), end_at: new Date(d.getTime() + 3600000).toISOString(), buffer_min: 10, category: "travail", status: "prevu" })} />
      </main>
      {edit && <Editor appt={edit} list={list} userId={user.id} onClose={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function Kpi({ label, value, hint, bar }: { label: string; value: string | number; hint: string; bar?: number }) {
  return (
    <div className="sk-glass p-4 flex flex-col justify-between min-h-28">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-3xl font-semibold">{value}</div>
      {bar != null ? (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full holo" style={{ width: `${bar}%` }} /></div>
      ) : <div className="text-[11px] text-muted-foreground">{hint}</div>}
      {bar != null && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Editor({ appt, list, userId, onClose }: { appt: Partial<Appt>; list: Appt[]; userId: string; onClose: () => void }) {
  const [f, setF] = useState({
    title: appt.title ?? "", client: appt.client ?? "", location: appt.location ?? "", notes: appt.notes ?? "",
    category: appt.category ?? "travail", status: appt.status ?? "prevu", buffer_min: appt.buffer_min ?? 10,
    start: toLocal(new Date(appt.start_at!)), end: toLocal(new Date(appt.end_at!)),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === "buffer_min" ? Number(e.target.value) : e.target.value });
  const s = new Date(f.start), e = new Date(f.end);
  const issues = f.status === "annule" ? [] : validateSlot(list, s, e, f.buffer_min, appt.id);
  const blocked = issues.some((i) => i.level === "error") || !f.title.trim();

  function suggest() {
    const dur = Math.max(15, (e.getTime() - s.getTime()) / 60000 || 60);
    const n = nextFreeSlot(list.filter((a) => a.id !== appt.id), s, dur, f.buffer_min);
    if (n) setF({ ...f, start: toLocal(n), end: toLocal(new Date(n.getTime() + dur * 60000)) });
    else toast.error("Aucun créneau libre sur 14 jours");
  }

  async function save() {
    setBusy(true);
    const row = {
      title: f.title.trim(), client: f.client || null, location: f.location || null, notes: f.notes || null,
      category: f.category, status: f.status, buffer_min: f.buffer_min, start_at: s.toISOString(), end_at: e.toISOString(),
    };
    const { error } = appt.id
      ? await supabase.from("appointments").update(row).eq("id", appt.id)
      : await supabase.from("appointments").insert({ ...row, user_id: userId });
    setBusy(false);
    if (error) { toast.error(error.message.replace("CONFLIT: ", "")); return; }
    toast.success(appt.id ? "Rendez-vous mis à jour" : "Rendez-vous ajouté au planning");
    onClose();
  }

  async function remove() {
    const { error } = await supabase.from("appointments").delete().eq("id", appt.id!);
    if (error) { toast.error(error.message); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/20 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in" onClick={onClose}>
      <div onClick={(ev) => ev.stopPropagation()} className="sk-glass holo-ring bg-popover w-full sm:max-w-lg p-5 sm:p-6 space-y-3 max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-b-[var(--radius-2xl)] animate-in slide-in-from-right-10">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{appt.id ? "Modifier" : "Nouveau rendez-vous"}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <input autoFocus className="field" placeholder="Titre *" value={f.title} onChange={set("title")} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">Début<input type="datetime-local" className="field mt-1" value={f.start} onChange={set("start")} /></label>
          <label className="text-xs text-muted-foreground">Fin<input type="datetime-local" className="field mt-1" value={f.end} onChange={set("end")} /></label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select className="field" value={f.category} onChange={set("category")}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="field" value={f.status} onChange={set("status")}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="field" value={f.buffer_min} onChange={set("buffer_min")}>{[0, 5, 10, 15, 30].map((m) => <option key={m} value={m}>Tampon {m}′</option>)}</select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="field" placeholder="Client / participant" value={f.client} onChange={set("client")} />
          <input className="field" placeholder="Lieu / lien visio" value={f.location} onChange={set("location")} />
        </div>
        <textarea className="field min-h-20" placeholder="Notes utiles" value={f.notes} onChange={set("notes")} />
        {issues.length > 0 && (
          <div className="space-y-1">
            {issues.map((i) => (
              <div key={i.msg} className={`text-sm rounded-xl px-3 py-2 ${i.level === "error" ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-foreground"}`}>
                {i.level === "error" ? "⛔" : "⚠️"} {i.msg}
              </div>
            ))}
            {issues.some((i) => i.level === "error") && <button className="btn-ghost" onClick={suggest}>✨ Proposer le prochain créneau libre</button>}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {appt.id && <button className="btn-ghost text-destructive" onClick={remove}>Supprimer</button>}
          <button disabled={blocked || busy} onClick={save} className="btn-primary flex-1">{busy ? "…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}
