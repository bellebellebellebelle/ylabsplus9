import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, Sparkles, FileText, Table2, Workflow, Clock, Paperclip, Mic, SendHorizontal, Check,
  ChevronDown, Undo2, Redo2, Share2, MoreHorizontal, Copy, Info, Crown, TrendingUp, Tag,
  AlertTriangle, ChevronRight, Maximize2, X, Loader2, Download, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-skytab-auth";
import { runCalculation } from "@/lib/skytab-ai.functions";
import type { HistoryEntry, SheetResult } from "@/lib/skytab-sheet-types";
import { Donut, LineChart, UniversalChart } from "@/components/SkytabCharts";

export const Route = createFileRoute("/skytab/projet/$id")({
  head: () => ({
    meta: [
      { title: "Espace de travail — Ultra Smart" },
      { name: "description", content: "Décrivez votre calcul en langage naturel, Ultra Smart l'exécute." },
      { property: "og:title", content: "Espace de travail — Ultra Smart" },
      { property: "og:description", content: "Le tableur 100% langage naturel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <div className="skytab"><Workspace /></div>,
});

type Project = { id: string; name: string; data_text: string | null; history: HistoryEntry[]; current_index: number };

const STEP_DEFAULT = [
  "Compréhension du besoin",
  "Détection des règles",
  "Sélection des données",
  "Construction du calcul",
  "Vérification & optimisation",
];

function Workspace() {
  const { id } = Route.useParams();
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const run = useServerFn(runCalculation);
  const [project, setProject] = useState<Project | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [natural, setNatural] = useState(false);
  const [full, setFull] = useState<null | "table" | "charts">(null);
  const [showHistory, setShowHistory] = useState(false);
  const [menu, setMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [sel, setSel] = useState<null | { r0: number; c0: number; r1: number; c1: number }>(null);
  const [dragging, setDragging] = useState(false);
  const [askSel, setAskSel] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [pinL, setPinL] = useState(false);
  const [pinR, setPinR] = useState(false);
  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/skytab" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = () =>
      supabase.from("projects").select("*").eq("id", id).single().then(({ data }) => {
        if (data) setProject(data as unknown as Project);
      });
    load();
    const ch = supabase
      .channel(`project-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${id}` }, (p) =>
        setProject(p.new as unknown as Project),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, id]);

  useEffect(() => {
    if (!busy) return;
    setStepIdx(0);
    const t = setInterval(() => setStepIdx((s) => Math.min(s + 1, 4)), 1800);
    return () => clearInterval(t);
  }, [busy]);

  const entry = project && project.current_index >= 0 ? project.history[project.current_index] : null;
  const r: SheetResult | null = entry?.result ?? (project ? blankOf(project.name) : null);

  useEffect(() => {
    if (entry && !prompt) setPrompt(entry.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.at]);

  const toCsv = (cols: string[], rows: string[][]) => [cols.join(";"), ...rows.map((x) => x.join(";"))].join("\n");
  const selRange = sel && {
    r0: Math.min(sel.r0, sel.r1), r1: Math.max(sel.r0, sel.r1),
    c0: Math.min(sel.c0, sel.c1), c1: Math.max(sel.c0, sel.c1),
  };
  const inSel = (ri: number, ci: number) =>
    !!selRange && ri >= selRange.r0 && ri <= selRange.r1 && ci >= selRange.c0 && ci <= selRange.c1;
  const colName = (i: number) => String.fromCharCode(65 + (i % 26));
  const selLabel = selRange ? `${colName(selRange.c0)}${selRange.r0 + 1}:${colName(selRange.c1)}${selRange.r1 + 1}` : "";

  const submit = async (text = prompt) => {
    if (!text.trim() || busy || !project) return;
    setBusy(true);
    try {
      const hasData = r && r.rows.some((row) => row.some((c) => c.trim()));
      const sheet = hasData ? toCsv(r!.columns.map((c) => c.label), r!.rows).slice(0, 60000) : undefined;
      const selection = askSel && selRange && r
        ? toCsv(
            r.columns.slice(selRange.c0, selRange.c1 + 1).map((c) => c.label),
            r.rows.slice(selRange.r0, selRange.r1 + 1).map((row) => row.slice(selRange.c0, selRange.c1 + 1)),
          ).slice(0, 30000)
        : undefined;
      await run({ data: { projectId: project.id, prompt: text.trim(), sheet, selection } });
      const { data } = await supabase.from("projects").select("*").eq("id", id).single();
      if (data) setProject(data as unknown as Project);
      setAskSel(false);
      toast.success("Calcul exécuté avec succès");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const setIndex = async (i: number) => {
    if (!project || i < 0 || i >= project.history.length) return;
    setProject({ ...project, current_index: i });
    setPrompt(project.history[i]?.prompt ?? "");
    await supabase.from("projects").update({ current_index: i }).eq("id", project.id);
  };

  const attach = async (f: File) => {
    if (!project) return;
    const text = (await f.text()).slice(0, 200000);
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const sep = [";", "\t", ","].find((s) => (lines[0] ?? "").includes(s));
    if (sep && lines.length > 1 && !f.name.endsWith(".json")) {
      const split = (l: string) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
      const head = split(lines[0]!);
      const rows = lines.slice(1, 1001).map((l) => {
        const c = split(l);
        return head.map((_, i) => c[i] ?? "");
      });
      const sheet: SheetResult = {
        ...blankOf(f.name.replace(/\.[^.]+$/, "")),
        columns: head.map((h) => ({ label: h || "Colonne", align: "left" as const, kind: "text" as const })),
        rows,
      };
      const history = [...project.history, { prompt: `Import : ${f.name}`, result: sheet, at: new Date().toISOString() }];
      setProject({ ...project, history, current_index: history.length - 1, data_text: null });
      await supabase.from("projects").update({ history: history as never, current_index: history.length - 1, data_text: null }).eq("id", project.id);
      toast.success(`Fichier importé dans le tableur : ${f.name}`);
      return;
    }
    setProject({ ...project, data_text: text });
    await supabase.from("projects").update({ data_text: text }).eq("id", project.id);
    toast.success(`Données jointes : ${f.name}`);
  };

  const saveResult = (next: SheetResult, persist = false) => {
    if (!project) return;
    const history = [...project.history];
    const idx = project.current_index >= 0 ? project.current_index : 0;
    if (history.length === 0) history.push({ prompt: "Tableau manuel", result: next, at: new Date().toISOString() });
    else history[idx] = { ...(history[idx] as HistoryEntry), result: next };
    const p2 = { ...project, history, current_index: idx };
    setProject(p2);
    if (persist) void supabase.from("projects").update({ history: history as never, current_index: idx }).eq("id", project.id);
  };
  const blankSheet = (): SheetResult => ({
    title: project?.name ?? "Feuille", summary: "", formula: "", naturalFormula: "",
    columns: ["A", "B", "C"].map((l) => ({ label: l, align: "left" as const, kind: "text" as const })),
    rows: Array.from({ length: 5 }, () => ["", "", ""]), steps: [], insights: [], suggestions: [], donut: null, line: null, charts: [],
  });
  const editCell = (ri: number, ci: number, v: string) => {
    if (!r) return;
    saveResult({ ...r, rows: r.rows.map((row, i) => (i === ri ? row.map((c, j) => (j === ci ? v : c)) : row)) });
  };
  const editHeader = (ci: number, v: string) => {
    if (!r) return;
    saveResult({ ...r, columns: r.columns.map((c, j) => (j === ci ? { ...c, label: v } : c)) });
  };
  const addRow = () => r && saveResult({ ...r, rows: [...r.rows, r.columns.map(() => "")] }, true);
  const addCol = () => r && saveResult({
    ...r,
    columns: [...r.columns, { label: `Colonne ${r.columns.length + 1}`, align: "left", kind: "text" }],
    rows: r.rows.map((row) => [...row, ""]),
  }, true);
  const delRow = (ri: number) => r && saveResult({ ...r, rows: r.rows.filter((_, i) => i !== ri) }, true);
  const delCol = (ci: number) => r && r.columns.length > 1 && saveResult({
    ...r, columns: r.columns.filter((_, j) => j !== ci), rows: r.rows.map((row) => row.filter((_, j) => j !== ci)),
  }, true);
  const persist = () => r && saveResult(r, true);

  const newProject = async () => {
    const { data } = await supabase.from("projects").insert({ name: "Nouveau projet" }).select("id").single();
    if (data) {
      setPrompt("");
      navigate({ to: "/skytab/projet/$id", params: { id: data.id } });
    }
  };

  const rename = async () => {
    if (!project) return;
    const n = window.prompt("Nouveau nom", project.name);
    if (!n) return;
    setProject({ ...project, name: n });
    await supabase.from("projects").update({ name: n }).eq("id", project.id);
  };

  const exportCsv = () => {
    if (!r) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = [r.columns.map((c) => esc(c.label)).join(";"), ...r.rows.map((row) => row.map(esc).join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = `${project?.name ?? "export"}.csv`;
    a.click();
  };

  const voice = () => {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Dictée vocale non supportée par ce navigateur");
      return;
    }
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.onresult = (e) => setPrompt((p) => (p ? p + " " : "") + e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const firstName = (user?.user_metadata?.["full_name"] as string) || user?.email?.split("@")[0] || "Moi";

  if (!project) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const steps = r?.steps?.length ? r.steps : STEP_DEFAULT.map((t) => ({ title: t, detail: "" }));

  const navItems = [
    { icon: Plus, label: "Nouveau", onClick: newProject, round: true },
    { icon: Sparkles, label: "Assistant", onClick: () => taRef.current?.focus(), active: true },
    { icon: FileText, label: "Feuilles", onClick: () => navigate({ to: "/skytab/dashboard" }) },
    { icon: Table2, label: "Tableaux", onClick: () => (r ? setFull("table") : saveResult(blankSheet(), true)) },
    { icon: Workflow, label: "Automatisations", onClick: () => r?.suggestions[2] && submit(r.suggestions[2]) },
    { icon: Clock, label: "Historique", onClick: () => setShowHistory(true) },
  ];

  const tableEl = r && (
    <div className="overflow-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="w-8 border-b border-border px-2 py-2 text-left font-normal">#</th>
            {r.columns.map((c, i) => (
              <th key={i} className="group border-b border-border px-1 py-1 font-medium">
                <div className="flex items-center gap-1">
                  <input
                    aria-label={`Nom de la colonne ${i + 1}`}
                    value={c.label}
                    onChange={(e) => editHeader(i, e.target.value)}
                    onBlur={persist}
                    className={`w-full min-w-16 rounded bg-transparent px-2 py-1 outline-none focus:bg-accent/60 ${c.align === "right" ? "text-right" : ""}`}
                  />
                  <button onClick={() => delCol(i)} title="Supprimer la colonne" className="opacity-0 transition group-hover:opacity-100 hover:text-destructive">×</button>
                </div>
              </th>
            ))}
            <th className="w-10 border-b border-border px-1">
              <button onClick={addCol} title="Ajouter une colonne" className="rounded px-2 py-1 text-primary hover:bg-accent/60">+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row, ri) => (
            <tr key={ri} className="group transition-colors hover:bg-accent/40">
              <td className="border-b border-border/50 px-2 py-1 text-muted-foreground">
                <button onClick={() => delRow(ri)} title="Supprimer la ligne" className="group-hover:hidden">{ri + 1}</button>
                <button onClick={() => delRow(ri)} title="Supprimer la ligne" className="hidden text-destructive group-hover:inline">×</button>
              </td>
              {r.columns.map((col, ci) => {
                const cell = row[ci] ?? "";
                const pos = col?.kind === "percent" && cell.trim().startsWith("+");
                const neg = col?.kind === "percent" && /^[-−]\s?\d/.test(cell.trim());
                return (
                  <td
                    key={ci}
                    onMouseDown={(e) => {
                      if (e.shiftKey && sel) setSel({ ...sel, r1: ri, c1: ci });
                      else setSel({ r0: ri, c0: ci, r1: ri, c1: ci });
                      setDragging(true);
                    }}
                    onMouseEnter={() => dragging && sel && setSel({ ...sel, r1: ri, c1: ci })}
                    className={`border-b border-border/50 p-0 ${inSel(ri, ci) ? "bg-primary/15 ring-1 ring-inset ring-primary/40" : ""}`}
                  >
                    <input
                      aria-label={`Cellule ligne ${ri + 1} colonne ${ci + 1}`}
                      value={cell}
                      onChange={(e) => editCell(ri, ci, e.target.value)}
                      onBlur={persist}
                      className={`w-full min-w-16 bg-transparent px-3 py-1.5 tabular-nums outline-none focus:bg-accent/60 focus:ring-1 focus:ring-primary ${col?.align === "right" ? "text-right" : ""} ${pos ? "text-success" : neg ? "text-destructive" : ""}`}
                    />
                  </td>
                );
              })}
              <td className="border-b border-border/50" />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 p-2">
        <button onClick={addRow} className="rounded-md px-3 py-1.5 text-xs text-primary hover:bg-accent/60">+ Ajouter une ligne</button>
        <button onClick={addCol} className="rounded-md px-3 py-1.5 text-xs text-primary hover:bg-accent/60">+ Ajouter une colonne</button>
      </div>
    </div>
  );

  const chartsEl = r && (
    <div className="grid gap-4 md:grid-cols-2">
      {r.donut && (
        <div className="panel p-4">
          <h3 className="mb-4 text-sm font-medium">{r.donut.title}</h3>
          <Donut data={r.donut} />
        </div>
      )}
      {r.line && (
        <div className="panel p-4">
          <h3 className="mb-4 text-sm font-medium">{r.line.title}</h3>
          <LineChart data={r.line} />
        </div>
      )}
      {(r.charts ?? []).map((c, i) => (
        <div key={`${entry?.at}-${i}`} className="panel p-4">
          <UniversalChart spec={c} />
        </div>
      ))}
    </div>
  );

  const insightIcon = { crown: Crown, growth: TrendingUp, tag: Tag, alert: AlertTriangle, info: Info } as const;
  const insightColor = { crown: "text-warning", growth: "text-success", tag: "text-violet", alert: "text-destructive", info: "text-azure" } as const;

  return (
    <>
    <div className={`relative h-screen overflow-hidden p-3 transition-[padding] print:hidden ${pinL ? "lg:pl-[312px]" : ""} ${pinR ? "lg:pr-[296px]" : ""}`}>
      {/* Rail (glowing dot, expands on hover) */}
      <div onMouseEnter={() => setNavOpen(true)} onMouseLeave={() => setNavOpen(false)} className="fixed left-0 top-0 z-50 p-2">
        {!navOpen ? (
          <button onClick={() => setNavOpen(true)} aria-label="Menu" className="grid h-6 w-6 place-items-center">
            <span className="h-3 w-3 rounded-full bg-primary st-shadow-glow animate-pulse-glow" />
          </button>
        ) : (
      <nav className="panel flex h-[calc(100vh-16px)] w-[88px] flex-col items-center gap-1 overflow-y-auto p-2 py-4 animate-fade-up">
        <Link to="/skytab/dashboard" className="mb-6 grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-logo text-base font-bold st-shadow-glow">US</Link>
        {navItems.map((n) => (
          <button key={n.label} onClick={n.onClick} className={`relative flex w-full shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-3 text-[11px] transition ${n.active ? "bg-accent/60 text-foreground" : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"}`}>
            <span className={`grid h-7 w-7 place-items-center ${n.round ? "rounded-full border border-border" : ""} ${n.active ? "rounded-lg st-gradient-primary st-shadow-glow" : ""}`}>
              <n.icon className="h-4 w-4" />
            </span>
            {n.label}
          </button>
        ))}
        <div className="mt-auto flex shrink-0 flex-col items-center gap-1">
          <button onClick={() => supabase.auth.signOut()} title="Déconnexion" className="relative grid h-10 w-10 place-items-center rounded-full st-gradient-primary text-sm font-semibold uppercase">
            {firstName[0]}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-success" />
          </button>
          <span className="text-xs">{firstName}</span>
        </div>
      </nav>
        )}
      </div>

      {/* Assistant column (hover drawer) */}
      {!(leftOpen || pinL) && (
        <div onMouseEnter={() => setLeftOpen(true)} onClick={() => setLeftOpen(true)} className="fixed bottom-0 left-0 top-12 z-30 flex w-4 items-center" aria-label="Afficher l'assistant">
          <span className="h-24 w-1 rounded-full bg-primary/40 st-shadow-glow" />
        </div>
      )}
      <div onMouseLeave={() => setLeftOpen(false)} className={`fixed bottom-3 left-3 top-3 z-40 w-[296px] max-w-[85vw] transition-transform duration-300 ${leftOpen || pinL ? "translate-x-0" : "-translate-x-[calc(100%+16px)]"}`}>
      <section className="flex h-full flex-col gap-3 overflow-y-auto">
        <button onClick={() => setPinL(!pinL)} className="panel self-end px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground">{pinL ? "Détacher" : "Épingler"}</button>
        {askSel && selRange && (
          <div className="panel flex items-center gap-2 px-3 py-2 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-azure" /> Question sur la sélection <b>{selLabel}</b>
            <button onClick={() => setAskSel(false)} className="ml-auto" aria-label="Annuler"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <div className="panel p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-azure" /> Assistant Ultra Smart
          </h2>
          <div className="rounded-xl bg-gradient-prompt p-3 st-shadow-glow">
            <textarea
              ref={taRef}
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={6}
              placeholder="Décrivez votre calcul en langage naturel… ex : Calcule le CA total par mois et par région, hors retours, avec une remise de 5% pour les clients Premium."
              className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => fileRef.current?.click()} className="panel-inner flex min-w-0 items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{project.data_text ? "Données jointes ✓" : "Joindre des données"}</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.json" hidden onChange={(e) => e.target.files?.[0] && attach(e.target.files[0])} />
            <button onClick={voice} className={`ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full ${listening ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="Dictée">
              <Mic className="h-4 w-4" />
            </button>
            <button onClick={() => submit()} disabled={busy} className="grid h-9 w-9 shrink-0 place-items-center rounded-full st-gradient-primary st-shadow-glow animate-pulse-glow disabled:opacity-60" aria-label="Envoyer">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="panel flex-1 p-4">
          <h2 className="mb-4 text-sm font-medium">Analyse de la demande</h2>
          <ul className="space-y-4">
            {steps.map((s, i) => {
              const done = busy ? i < stepIdx : !!r;
              const active = busy && i === stepIdx;
              return (
                <li key={i} className="flex gap-3 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${done ? (i === 0 ? "bg-primary" : "bg-success") : "border border-border"}`}>
                    {done ? <Check className="h-3 w-3 text-primary-foreground" /> : active ? <Loader2 className="h-3 w-3 animate-spin text-azure" /> : null}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm">{s.title}</p>
                    {s.detail && !busy && <p className="text-[11px] text-azure/80">{s.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-6">
            <p className="mb-2 flex items-center gap-2 text-xs">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-azure" /> : r ? <Check className="h-3.5 w-3.5 rounded-full bg-success p-0.5 text-primary-foreground" /> : null}
              {busy ? "Analyse en cours…" : r ? "Analyse terminée" : "En attente de votre demande"}
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full progress-bar transition-all duration-700" style={{ width: busy ? `${(stepIdx + 1) * 20}%` : r ? "100%" : "0%" }} />
            </div>
          </div>
        </div>
      </section>
      </div>

      {/* Center */}
      <section className="panel flex h-full min-w-0 flex-col gap-3 overflow-y-auto p-3">
        {selRange && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
            <span>Sélection <b>{selLabel}</b> · {(selRange.r1 - selRange.r0 + 1) * (selRange.c1 - selRange.c0 + 1)} cellule(s)</span>
            <button onClick={() => { setAskSel(true); setLeftOpen(true); setPrompt(""); setTimeout(() => taRef.current?.focus(), 50); }} className="flex items-center gap-1 rounded-full st-gradient-primary px-3 py-1 font-medium st-shadow-glow">
              <Sparkles className="h-3 w-3" /> Interroger la sélection
            </button>
            <button onClick={() => { setSel(null); setAskSel(false); }} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Effacer la sélection"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1">
          <button onClick={rename} className="flex min-w-0 items-center gap-2 text-left">
            <h1 className="truncate text-lg font-semibold">{project.name}</h1>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          <div className="relative flex items-center gap-1">
            {entry && (
              <span className="hidden items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs sm:flex">
                <Check className="h-3 w-3 rounded-full bg-success p-0.5 text-primary-foreground" /> Exécuté avec succès
              </span>
            )}
            <button onClick={() => setIndex(project.current_index - 1)} disabled={project.current_index <= 0} className="rounded p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Annuler"><Undo2 className="h-4 w-4" /></button>
            <button onClick={() => setIndex(project.current_index + 1)} disabled={project.current_index >= project.history.length - 1} className="rounded p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Rétablir"><Redo2 className="h-4 w-4" /></button>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Lien copié"); }} className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs hover:bg-accent">
              <Share2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Partager</span>
            </button>
            <button onClick={() => setMenu(!menu)} className="rounded-lg bg-secondary p-1.5 hover:bg-accent" aria-label="Plus"><MoreHorizontal className="h-4 w-4" /></button>
            {menu && (
              <div className="panel absolute right-0 top-10 z-20 w-48 p-1 text-sm" onMouseLeave={() => setMenu(false)}>
                <button onClick={() => { setMenu(false); setTimeout(() => window.print(), 50); }} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-accent"><FileText className="h-4 w-4" /> Exporter PDF</button>
                <button onClick={() => { exportCsv(); setMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-accent"><Download className="h-4 w-4" /> Exporter CSV</button>
                <button onClick={() => { rename(); setMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-accent"><Pencil className="h-4 w-4" /> Renommer</button>
                <button onClick={async () => { if (confirm("Supprimer ce projet ?")) { await supabase.from("projects").delete().eq("id", project.id); navigate({ to: "/skytab/dashboard" }); } }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-destructive hover:bg-accent"><Trash2 className="h-4 w-4" /> Supprimer</button>
              </div>
            )}
          </div>
        </header>

        {!r ? (
          <div className="grid flex-1 place-items-center p-10 text-center">
            <div className="max-w-sm animate-fade-up">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl st-gradient-primary st-shadow-glow animate-pulse-glow">
                {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
              </div>
              <h2 className="text-lg font-semibold">{busy ? "Ultra Smart calcule…" : "Décrivez ce que vous voulez calculer"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Formules, tableaux croisés, recherches, statistiques, finance, dates… tout ce que fait Excel, en français.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="panel-inner p-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <h2 className="font-medium">Résultat</h2>
                <button onClick={() => setFull("table")} className="flex items-center gap-2 text-xs font-semibold hover:text-azure">
                  <span className="hidden sm:inline">Afficher le tableau en pleine écran</span> <Maximize2 className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[340px] overflow-auto">{tableEl}</div>
            </div>
            {chartsEl}
            {(r.donut || r.line) && (
              <button onClick={() => setFull("charts")} className="ml-auto flex items-center gap-2 text-xs font-semibold hover:text-azure">
                Afficher tout les Graphiques <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </section>

      {/* Right column (hover drawer) */}
      {!(rightOpen || pinR) && (
        <div onMouseEnter={() => setRightOpen(true)} onClick={() => setRightOpen(true)} className="fixed right-0 top-0 z-30 flex h-full w-4 items-center justify-end" aria-label="Afficher les insights">
          <span className="h-24 w-1 rounded-full bg-primary/40 st-shadow-glow" />
        </div>
      )}
      <div onMouseLeave={() => setRightOpen(false)} className={`fixed bottom-3 right-3 top-3 z-40 w-[280px] max-w-[85vw] transition-transform duration-300 ${rightOpen || pinR ? "translate-x-0" : "translate-x-[calc(100%+16px)]"}`}>
      <aside className="flex h-full flex-col gap-3 overflow-y-auto">
        <button onClick={() => setPinR(!pinR)} className="panel self-end px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground">{pinR ? "Détacher" : "Épingler"}</button>
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Formule générée</h2>
            <button disabled={!r} onClick={() => { navigator.clipboard.writeText(natural ? r!.naturalFormula : r!.formula); toast.success("Copié"); }} className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-azure hover:bg-accent disabled:opacity-40">
              <Copy className="h-3 w-3" /> Copier
            </button>
          </div>
          <pre className="panel-inner max-h-56 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed">
            {r ? (natural ? r.naturalFormula : <Formula text={r.formula} />) : <span className="text-muted-foreground">La formule apparaîtra ici.</span>}
          </pre>
          <button onClick={() => setNatural(!natural)} className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Info className="h-3.5 w-3.5" /> {natural ? "Afficher la formule" : "Afficher en langage naturel"}
          </button>
        </div>

        <div className="panel p-4">
          <h2 className="mb-3 flex items-center justify-between font-medium">Insights <ChevronRight className="h-4 w-4 text-azure" /></h2>
          <ul className="space-y-4">
            {(r?.insights ?? []).map((ins, i) => {
              const I = insightIcon[ins.icon] ?? Info;
              return (
                <li key={i} className="flex gap-3 text-xs leading-relaxed animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
                  <I className={`h-4 w-4 shrink-0 ${insightColor[ins.icon] ?? "text-azure"}`} />
                  <span>{ins.text}</span>
                </li>
              );
            })}
            {!r?.insights?.length && <li className="text-xs text-muted-foreground">Les insights apparaîtront après votre premier calcul.</li>}
          </ul>
        </div>

        <div className="panel p-4">
          <h2 className="mb-3 font-medium">Prochaines étapes suggérées</h2>
          <div className="space-y-2">
            {(r?.suggestions ?? []).map((s, i) => (
              <button key={i} disabled={busy} onClick={() => { setPrompt(s); submit(s); }} className="panel-inner flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition hover:bg-accent/50">
                <span className="min-w-0">{s}</span> <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        <div className="panel grid place-items-center p-4">
          <button onClick={() => { setPrompt(""); taRef.current?.focus(); }} className="flex items-center gap-2 rounded-full st-gradient-primary px-8 py-2.5 text-sm font-medium st-shadow-glow transition hover:brightness-110">
            <Sparkles className="h-4 w-4" /> Nouveau calcul
          </button>
        </div>
      </aside>
      </div>

      {/* Fullscreen */}
      {full && r && (
        <div className="fixed inset-0 z-50 overflow-auto bg-background/95 p-4 backdrop-blur animate-fade-up sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{full === "table" ? "Résultat" : "Graphiques"} — {project.name}</h2>
            <button onClick={() => setFull(null)} className="rounded-lg bg-secondary p-2 hover:bg-accent" aria-label="Fermer"><X className="h-5 w-5" /></button>
          </div>
          {full === "table" ? <div className="panel p-4">{tableEl}</div> : chartsEl}
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur" onClick={() => setShowHistory(false)}>
          <div className="panel max-h-[80vh] w-full max-w-lg overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Historique</h2>
              <button onClick={() => setShowHistory(false)} aria-label="Fermer"><X className="h-4 w-4" /></button>
            </div>
            {project.history.length === 0 && <p className="text-sm text-muted-foreground">Aucune version pour l'instant.</p>}
            <ul className="space-y-2">
              {project.history.map((h, i) => (
                <li key={i}>
                  <button onClick={() => { setIndex(i); setShowHistory(false); }} className={`panel-inner w-full p-3 text-left text-xs hover:bg-accent/50 ${i === project.current_index ? "ring-2 ring-ring" : ""}`}>
                    <p className="mb-1 text-muted-foreground">Version {i + 1} · {new Date(h.at).toLocaleString("fr-FR")}</p>
                    <p className="line-clamp-2">{h.prompt}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
    {r && (
      <article className="hidden bg-background text-foreground print:block">
        <header className="mb-6 flex items-end justify-between border-b-2 border-primary pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Rapport d'analyse</p>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {entry && <p className="mt-1 text-xs text-muted-foreground">Demande : {entry.prompt}</p>}
          </div>
          <div className="text-right text-[10px] text-muted-foreground">
            <p className="font-semibold text-foreground">Ultra Smart</p>
            <p>{new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p>{firstName}</p>
          </div>
        </header>
        {r.summary && (
          <section className="mb-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">Synthèse</h2>
            <p className="text-sm leading-relaxed">{r.summary}</p>
          </section>
        )}
        {r.insights.length > 0 && (
          <section className="mb-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Points clés</h2>
            <ul className="grid grid-cols-3 gap-3">
              {r.insights.map((ins, i) => (
                <li key={i} className="rounded-md border border-border p-3 text-xs leading-relaxed">{ins.text}</li>
              ))}
            </ul>
          </section>
        )}
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Données</h2>
          <table className="report-table w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                {r.columns.map((c, i) => (
                  <th key={i} className={`px-2 py-1.5 font-semibold ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.rows.filter((row) => row.some((c) => c.trim())).map((row, ri) => (
                <tr key={ri} className={ri % 2 ? "bg-muted" : ""}>
                  {r.columns.map((c, ci) => (
                    <td key={ci} className={`border-b border-border px-2 py-1 tabular-nums ${c.align === "right" ? "text-right" : ""}`}>{row[ci] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {(r.charts?.length ?? 0) > 0 && (
          <section className="mb-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Graphiques</h2>
            <div className="grid grid-cols-2 gap-4">
              {(r.charts ?? []).map((c, i) => (
                <div key={i} className="report-chart rounded-md border border-border p-3"><UniversalChart spec={c} /></div>
              ))}
            </div>
          </section>
        )}
        {r.formula && (
          <section className="mb-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">Formule Excel</h2>
            <pre className="whitespace-pre-wrap rounded-md border border-border p-3 font-mono text-[10px]">{r.formula}</pre>
            {r.naturalFormula && <p className="mt-2 text-xs text-muted-foreground">{r.naturalFormula}</p>}
          </section>
        )}
        <footer className="mt-8 border-t border-border pt-2 text-[9px] text-muted-foreground">Document généré par Ultra Smart · {new Date().toLocaleString("fr-FR")}</footer>
      </article>
    )}
    </>
  );
}

type SpeechRec = {
  lang: string;
  onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
  onend: () => void;
  start: () => void;
};

function Formula({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]*\]|"[^"]*"|\b[A-ZÉÈ][A-ZÉÈ.]{2,}(?=\())/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[") ? <span key={i} className="text-formula-ref">{p}</span>
        : p.startsWith('"') ? <span key={i} className="text-success">{p}</span>
        : /^[A-ZÉÈ][A-ZÉÈ.]{2,}$/.test(p) ? <span key={i} className="text-foreground">{p}</span>
        : <span key={i} className="text-formula-key">{p}</span>,
      )}
    </>
  );
}

function blankOf(title: string): SheetResult {
  const cols = ["A", "B", "C", "D", "E", "F"];
  return {
    title, summary: "", formula: "", naturalFormula: "",
    columns: cols.map((l) => ({ label: l, align: "left" as const, kind: "text" as const })),
    rows: Array.from({ length: 20 }, () => cols.map(() => "")),
    steps: [], insights: [], suggestions: [], donut: null, line: null, charts: [],
  };
}
