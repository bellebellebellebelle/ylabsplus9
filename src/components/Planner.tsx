import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sameDay, validateSlot, weekStart, type Appt } from "@/lib/scheduling";

export type Note = { id: string; kind: string; day: string; content: string; color: string; done: boolean };
type View = "day" | "week" | "month" | "year";

const H0 = 7, H1 = 21, PX = 56; // heures visibles, pixels / heure
const SNAP = 15;
const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const EV: Record<string, string> = { travail: "var(--ev-travail)", client: "var(--ev-client)", perso: "var(--ev-perso)", focus: "var(--ev-focus)" };
const fmtT = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

type Drag = { id: string; mode: "move" | "top" | "bottom"; x0: number; y0: number; colW: number; dMin: number; dDay: number };

export function Planner({ list, notes, userId, onOpen, onCreateAt }: {
  list: Appt[]; notes: Note[]; userId: string;
  onOpen: (a: Appt) => void; onCreateAt: (d: Date) => void;
}) {
  const [view, setView] = useState<View>("week");
  const [ref, setRef] = useState(() => new Date());
  const [full, setFull] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [now, setNow] = useState(() => new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const days = useMemo(() => {
    if (view === "day") return [new Date(new Date(ref).setHours(0, 0, 0, 0))];
    const ws = weekStart(ref);
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [view, ref]);

  function shift(dir: number) {
    const d = new Date(ref);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setRef(d);
  }

  const title = view === "year" ? String(ref.getFullYear())
    : view === "day" ? ref.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : ref.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // ---------- Glisser-déposer / étirement ----------
  function preview(a: Appt, d: Drag | null) {
    let s = new Date(a.start_at), e = new Date(a.end_at);
    if (!d || d.id !== a.id) return { s, e };
    const m = d.dMin * 60000;
    if (d.mode === "move") { s = addDays(new Date(s.getTime() + m), d.dDay); e = addDays(new Date(e.getTime() + m), d.dDay); }
    else if (d.mode === "top") s = new Date(Math.min(s.getTime() + m, e.getTime() - SNAP * 60000));
    else e = new Date(Math.max(e.getTime() + m, s.getTime() + SNAP * 60000));
    return { s, e };
  }

  function startDrag(ev: React.PointerEvent, a: Appt, mode: Drag["mode"]) {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    const colW = gridRef.current ? gridRef.current.clientWidth / days.length : 100;
    setDrag({ id: a.id, mode, x0: ev.clientX, y0: ev.clientY, colW, dMin: 0, dDay: 0 });
  }
  function moveDrag(ev: React.PointerEvent) {
    if (!drag) return;
    const dMin = Math.round(((ev.clientY - drag.y0) / PX) * 60 / SNAP) * SNAP;
    const dDay = drag.mode === "move" && days.length > 1 ? Math.round((ev.clientX - drag.x0) / drag.colW) : 0;
    if (dMin !== drag.dMin || dDay !== drag.dDay) setDrag({ ...drag, dMin, dDay });
  }
  async function endDrag(a: Appt) {
    const d = drag;
    setDrag(null);
    if (!d) return;
    if (d.dMin === 0 && d.dDay === 0) { if (d.mode === "move") onOpen(a); return; }
    const { s, e } = preview(a, d);
    const err = validateSlot(list, s, e, a.buffer_min, a.id).find((i) => i.level === "error");
    if (err) { toast.error(err.msg); return; }
    const { error } = await supabase.from("appointments").update({ start_at: s.toISOString(), end_at: e.toISOString() }).eq("id", a.id);
    if (error) toast.error(error.message.replace("CONFLIT: ", ""));
    else toast.success(`${a.title} · ${fmtT(s)}–${fmtT(e)}`);
  }

  // ---------- Notes ----------
  async function addNote(kind: "postit" | "annotation", day: Date) {
    const content = window.prompt(kind === "postit" ? "Texte du post-it de rappel" : `Annotation pour le ${day.toLocaleDateString("fr-FR")}`);
    if (!content?.trim()) return;
    const { error } = await supabase.from("planner_notes").insert({ user_id: userId, kind, day: iso(day), content: content.trim() });
    if (error) toast.error(error.message);
  }
  async function delNote(id: string) {
    const { error } = await supabase.from("planner_notes").delete().eq("id", id);
    if (error) toast.error(error.message);
  }
  async function toggleNote(n: Note) {
    await supabase.from("planner_notes").update({ done: !n.done }).eq("id", n.id);
  }
  const annots = (d: Date) => notes.filter((n) => n.kind === "annotation" && n.day === iso(d));
  const postits = notes.filter((n) => n.kind === "postit");

  return (
    <section className={full ? "fixed inset-0 z-40 bg-background p-3 sm:p-5 flex flex-col gap-3" : "sk-glass p-3 sm:p-5 flex flex-col gap-3"}>
      {/* barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost !px-3" onClick={() => shift(-1)} aria-label="Précédent">←</button>
        <h2 className="font-semibold capitalize min-w-36 text-center">{title}</h2>
        <button className="btn-ghost !px-3" onClick={() => shift(1)} aria-label="Suivant">→</button>
        <button className="btn-ghost" onClick={() => setRef(new Date())}>Aujourd'hui</button>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-full bg-muted p-1">
            {(["day", "week", "month", "year"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${view === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                {{ day: "Jour", week: "Semaine", month: "Mois", year: "Année" }[v]}
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => addNote("postit", ref)} title="Ajouter un post-it">📝 Post-it</button>
          <button className="btn-ghost !px-3" onClick={() => setFull(!full)} aria-label={full ? "Quitter le plein écran" : "Plein écran"}>{full ? "✕" : "⛶"}</button>
        </div>
      </div>

      <div className="flex gap-3 min-h-0 flex-1">
        <div className="flex-1 min-w-0 overflow-auto rounded-2xl">
          {(view === "day" || view === "week") && (
            <div className="min-w-[640px]">
              {/* en-têtes jours */}
              <div className="grid sticky top-0 z-10 bg-card/80 backdrop-blur" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
                <div />
                {days.map((d) => {
                  const today = sameDay(d, now);
                  return (
                    <div key={d.toISOString()} className="px-1 py-2 text-center border-l border-border/60">
                      <div className={`text-[11px] ${today ? "text-lagoon font-semibold" : "text-muted-foreground"}`}>{DOW[(d.getDay() + 6) % 7]}</div>
                      <button onClick={() => { setRef(d); setView("day"); }}
                        className={`font-display text-lg font-semibold mx-auto w-9 h-9 rounded-full grid place-items-center ${today ? "bg-primary text-primary-foreground" : ""}`}>{d.getDate()}</button>
                      <div className="flex flex-col gap-1 mt-1">
                        {annots(d).map((n) => (
                          <span key={n.id} className="group text-[10px] font-medium rounded-md px-1.5 py-0.5 bg-secondary text-secondary-foreground truncate flex items-center gap-1">
                            ✎ <span className="truncate">{n.content}</span>
                            <button onClick={() => delNote(n.id)} className="ml-auto opacity-0 group-hover:opacity-100" aria-label="Supprimer l'annotation">×</button>
                          </span>
                        ))}
                        <button onClick={() => addNote("annotation", d)} className="text-[10px] text-muted-foreground hover:text-foreground">+ annotation</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* grille */}
              <div className="grid relative" style={{ gridTemplateColumns: `52px 1fr` }}>
                <div>
                  {Array.from({ length: H1 - H0 }, (_, i) => (
                    <div key={i} style={{ height: PX }} className="text-[10px] text-muted-foreground pr-2 text-right -translate-y-1.5">{String(H0 + i).padStart(2, "0")}:00</div>
                  ))}
                </div>
                <div ref={gridRef} className="relative grid" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)`, height: (H1 - H0) * PX }}>
                  {days.map((d) => (
                    <div key={d.toISOString()} className="relative border-l border-border/60"
                      onDoubleClick={(e) => {
                        const y = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top;
                        const min = Math.floor((y / PX) * 60 / SNAP) * SNAP;
                        const t = new Date(d); t.setHours(H0, min, 0, 0); onCreateAt(t);
                      }}>
                      {Array.from({ length: H1 - H0 }, (_, i) => <div key={i} style={{ height: PX }} className="border-t border-border/50" />)}
                    </div>
                  ))}
                  {/* ligne maintenant */}
                  {days.some((d) => sameDay(d, now)) && now.getHours() >= H0 && now.getHours() < H1 && (
                    <div className="absolute left-0 right-0 pointer-events-none z-20" style={{ top: (now.getHours() + now.getMinutes() / 60 - H0) * PX }}>
                      <div className="h-px bg-destructive" /><div className="w-2 h-2 rounded-full bg-destructive -mt-1 -ml-1" />
                    </div>
                  )}
                  {/* rendez-vous */}
                  {list.map((a) => {
                    const { s, e } = preview(a, drag);
                    const col = days.findIndex((d) => sameDay(d, s));
                    if (col < 0) return null;
                    const top = (s.getHours() + s.getMinutes() / 60 - H0) * PX;
                    const h = Math.max(24, ((e.getTime() - s.getTime()) / 3600000) * PX);
                    const active = drag?.id === a.id;
                    return (
                      <div key={a.id}
                        onPointerDown={(ev) => startDrag(ev, a, "move")} onPointerMove={moveDrag} onPointerUp={() => endDrag(a)}
                        className={`ev absolute px-2 py-1 overflow-hidden select-none touch-none ${active ? "z-30 ring-2 ring-ring cursor-grabbing scale-[1.02]" : "z-10 cursor-grab hover:brightness-[1.02]"} ${a.status === "annule" ? "opacity-50 line-through" : ""}`}
                        style={{ "--ev": EV[a.category] ?? EV["travail"], top: Math.max(0, top), height: h, left: `calc(${(100 / days.length) * col}% + 4px)`, width: `calc(${100 / days.length}% - 8px)`, transition: active ? "none" : "top .15s, left .15s, height .15s" } as React.CSSProperties}>
                        <div onPointerDown={(ev) => startDrag(ev, a, "top")} onPointerMove={(ev) => { ev.stopPropagation(); moveDrag(ev); }} onPointerUp={(ev) => { ev.stopPropagation(); endDrag(a); }} className="absolute inset-x-0 top-0 h-2 cursor-ns-resize" />
                        <div className="text-[11px] font-semibold opacity-90">{fmtT(s)}{h > 40 ? ` – ${fmtT(e)}` : ""}</div>
                        <div className="text-[13px] font-bold leading-tight truncate">{a.title}</div>
                        {h > 56 && a.client && <div className="text-[11px] opacity-75 truncate">{a.client}</div>}
                        <div onPointerDown={(ev) => startDrag(ev, a, "bottom")} onPointerMove={(ev) => { ev.stopPropagation(); moveDrag(ev); }} onPointerUp={(ev) => { ev.stopPropagation(); endDrag(a); }} className="absolute inset-x-0 bottom-0 h-2.5 cursor-ns-resize flex justify-center">
                          <span className="w-6 h-1 rounded-full mt-0.5 bg-current opacity-30" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Glissez une carte pour la déplacer · tirez son bord haut ou bas pour changer la durée · double-clic sur un créneau vide pour créer.</p>
            </div>
          )}

          {view === "month" && <Month ref_={ref} list={list} notes={notes} now={now} onPick={(d) => { setRef(d); setView("day"); }} onOpen={onOpen} />}

          {view === "year" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 12 }, (_, m) => {
                const first = new Date(ref.getFullYear(), m, 1);
                const lead = (first.getDay() + 6) % 7;
                const n = new Date(ref.getFullYear(), m + 1, 0).getDate();
                return (
                  <button key={m} onClick={() => { setRef(first); setView("month"); }} className="sk-glass p-3 text-left hover:scale-[1.01] transition">
                    <div className="font-semibold capitalize text-sm mb-2">{first.toLocaleDateString("fr-FR", { month: "long" })}</div>
                    <div className="grid grid-cols-7 gap-0.5 text-[9px] text-center">
                      {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                      {Array.from({ length: n }, (_, i) => {
                        const d = new Date(ref.getFullYear(), m, i + 1);
                        const c = list.filter((a) => a.status !== "annule" && sameDay(new Date(a.start_at), d)).length;
                        return <span key={i} className={`rounded aspect-square grid place-items-center ${sameDay(d, now) ? "bg-primary text-primary-foreground" : c ? "bg-lagoon/20 text-foreground font-semibold" : "text-muted-foreground"}`} style={c > 2 ? { background: "var(--lagoon)", color: "var(--pearl)" } : undefined}>{i + 1}</span>;
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* post-it */}
        {postits.length > 0 && (
          <aside className="hidden md:flex w-48 shrink-0 flex-col gap-3 overflow-y-auto pr-1">
            <div className="text-xs font-semibold text-muted-foreground">Rappels</div>
            {postits.map((n, i) => (
              <div key={n.id} className={`postit p-3 text-sm relative ${n.done ? "opacity-50 line-through" : ""}`} style={{ rotate: `${i % 2 ? 1.5 : -1.5}deg` }}>
                <div className="text-[10px] opacity-60 mb-1">{new Date(n.day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>
                <div className="whitespace-pre-wrap break-words">{n.content}</div>
                <div className="flex justify-end gap-2 mt-2 text-xs">
                  <button onClick={() => toggleNote(n)} aria-label="Marquer comme fait">✓</button>
                  <button onClick={() => delNote(n.id)} aria-label="Supprimer le post-it">✕</button>
                </div>
              </div>
            ))}
          </aside>
        )}
      </div>
    </section>
  );
}

function Month({ ref_, list, notes, now, onPick, onOpen }: { ref_: Date; list: Appt[]; notes: Note[]; now: Date; onPick: (d: Date) => void; onOpen: (a: Appt) => void }) {
  const first = new Date(ref_.getFullYear(), ref_.getMonth(), 1);
  const start = weekStart(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div>
      <div className="grid grid-cols-7 text-[11px] text-muted-foreground text-center mb-1">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const items = list.filter((a) => sameDay(new Date(a.start_at), d));
          const ann = notes.filter((n) => n.kind === "annotation" && n.day === iso(d));
          const out = d.getMonth() !== ref_.getMonth();
          return (
            <div key={d.toISOString()} onClick={() => onPick(d)} className={`min-h-24 rounded-xl p-1.5 cursor-pointer border border-border/50 bg-card/50 hover:bg-card transition ${out ? "opacity-40" : ""}`}>
              <div className={`text-xs font-semibold w-6 h-6 grid place-items-center rounded-full ${sameDay(d, now) ? "bg-primary text-primary-foreground" : ""}`}>{d.getDate()}</div>
              {ann.slice(0, 1).map((n) => <div key={n.id} className="text-[9px] truncate bg-secondary rounded px-1 mt-0.5">✎ {n.content}</div>)}
              {items.slice(0, 3).map((a) => (
                <div key={a.id} onClick={(e) => { e.stopPropagation(); onOpen(a); }} className="ev text-[10px] px-1 py-0.5 mt-0.5 truncate !rounded-md" style={{ "--ev": EV[a.category] ?? EV["travail"] } as React.CSSProperties}>
                  {fmtT(new Date(a.start_at))} {a.title}
                </div>
              ))}
              {items.length > 3 && <div className="text-[10px] text-muted-foreground mt-0.5">+{items.length - 3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
