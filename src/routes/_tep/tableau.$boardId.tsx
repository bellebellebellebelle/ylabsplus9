import { Whiteboard, type Tool } from "@/tep/components/board/Whiteboard";
import { Button } from "@/tep/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/tep/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { analyzeSketch, type SketchAnalysis } from "@/tep/lib/sketch-ai.functions";
import type { BoardEl, Camera } from "@/tep/lib/board-types";
import { fileToDataUrl, vectorizeSketch } from "@/tep/lib/vectorize";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ArrowUpRight,
  Circle,
  Download,
  Eraser,
  Hand,
  ImagePlus,
  MousePointer2,
  Pencil,
  Redo2,
  Square,
  Type,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_tep/tableau/$boardId")({
  head: () => ({
    meta: [
      { title: "Tableau Smart — espace de travail" },
      {
        name: "description",
        content:
          "Dessinez, écrivez et réorganisez votre schéma reconstitué depuis une photo, avec sauvegarde en temps réel.",
      },
      { property: "og:title", content: "Tableau Smart — espace de travail" },
      {
        property: "og:description",
        content: "Votre tableau blanc intelligent : croquis importé, édition libre, sauvegarde automatique.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardPage,
});

const COLORS = ["#1f2933", "#0e7490", "#b45309", "#b91c1c", "#15803d"];

function BoardPage() {
  const { boardId } = Route.useParams();
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [elements, setElements] = useState<BoardEl[]>([]);
  const [analysis, setAnalysis] = useState<SketchAnalysis | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]!);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [camera, setCamera] = useState<Camera>({ x: 40, y: 40, scale: 1 });
  const [panelOpen, setPanelOpen] = useState(false);

  const history = useRef<BoardEl[][]>([]);
  const future = useRef<BoardEl[][]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyze = useServerFn(analyzeSketch);

  useEffect(() => {
    if (!authLoading && !session) void navigate({ to: "/tableau" });
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("tep_sketch_boards")
        .select("title,elements,notes")
        .eq("id", boardId)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        toast.error("Tableau introuvable");
        void navigate({ to: "/tableau" });
        return;
      }
      setTitle(data.title);
      setElements((data.elements as unknown as BoardEl[]) ?? []);
      if (data.notes) {
        try {
          setAnalysis(JSON.parse(data.notes) as SketchAnalysis);
        } catch {
          /* notes libres */
        }
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [boardId, session, navigate]);

  // Sauvegarde automatique (temps réel, anti-rebond)
  useEffect(() => {
    if (!ready) return;
    setSaving(true);
    const t = setTimeout(() => {
      void (async () => {
        const { error } = await supabase
          .from("tep_sketch_boards")
          .update({
            title,
            elements: elements as unknown as never,
            notes: analysis ? JSON.stringify(analysis) : null,
          })
          .eq("id", boardId);
        if (error) toast.error("Sauvegarde impossible");
        setSaving(false);
      })();
    }, 700);
    return () => clearTimeout(t);
  }, [elements, title, analysis, ready, boardId]);

  const update = useCallback((updater: (prev: BoardEl[]) => BoardEl[]) => {
    setElements((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      history.current.push(prev);
      if (history.current.length > 60) history.current.shift();
      future.current = [];
      return next;
    });
  }, []);

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    setElements((cur) => {
      future.current.push(cur);
      return prev;
    });
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    setElements((cur) => {
      history.current.push(cur);
      return next;
    });
  };

  const onImport = async (file: File) => {
    setImporting(true);
    setPanelOpen(true);
    try {
      const origin = { x: 40, y: 40 };
      const { elements: traced } = await vectorizeSketch(file, origin, "#1f2933");
      update((prev) => [...prev, ...traced]);
      setCamera({ x: 40, y: 40, scale: 1 });
      toast.success(`Schéma reconstitué (${traced.length} éléments)`);

      const dataUrl = await fileToDataUrl(file);
      const result = await analyze({ data: { imageDataUrl: dataUrl } });
      setAnalysis(result);
      if (result.title && title.startsWith("Nouveau tableau")) setTitle(result.title);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible");
    } finally {
      setImporting(false);
    }
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${title || "tableau"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (authLoading || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Chargement du tableau…
      </div>
    );
  }

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Sélection" },
    { id: "pen", icon: Pencil, label: "Crayon" },
    { id: "text", icon: Type, label: "Texte" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "ellipse", icon: Circle, label: "Cercle" },
    { id: "arrow", icon: ArrowUpRight, label: "Flèche" },
    { id: "eraser", icon: Eraser, label: "Gomme" },
    { id: "hand", icon: Hand, label: "Déplacer la vue" },
  ];

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Link to="/tableau" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Mes tableaux
        </Link>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8 w-44 sm:w-64"
          aria-label="Titre du tableau"
        />
        <span className="text-xs text-muted-foreground">
          {saving ? "Enregistrement…" : "Enregistré"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            <ImagePlus className="h-4 w-4" />
            <span className="hidden sm:inline">{importing ? "Analyse…" : "Importer une photo"}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={undo} aria-label="Annuler">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={redo} aria-label="Rétablir">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={exportPng} aria-label="Exporter en image">
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant={panelOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setPanelOpen((v) => !v)}
          >
            Lecture IA
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onImport(f);
          }}
        />
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside className="flex flex-col items-center gap-1 border-r border-border bg-card p-2">
          {tools.map((t) => (
            <button
              key={t.id}
              title={t.label}
              aria-label={t.label}
              onClick={() => setTool(t.id)}
              className={`rounded-lg p-2 transition-colors ${
                tool === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
          <div className="my-2 h-px w-6 bg-border" />
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Couleur ${c}`}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-primary" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="range"
            min={1}
            max={12}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            aria-label="Épaisseur du trait"
            className="mt-3 h-24 w-6 accent-primary"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
          />
        </aside>

        <div className="min-w-0 flex-1">
          <Whiteboard
            elements={elements}
            onChange={update}
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            camera={camera}
            onCamera={setCamera}
            canvasRef={canvasRef}
          />
        </div>

        {panelOpen && (
          <aside className="absolute inset-y-0 right-0 z-10 w-full max-w-sm overflow-y-auto border-l border-border bg-card p-4 shadow-soft sm:static sm:w-80">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Lecture du schéma</h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            {importing && <p className="mt-4 text-sm text-muted-foreground">Analyse en cours…</p>}
            {!importing && !analysis && (
              <p className="mt-4 text-sm text-muted-foreground">
                Importez la photo d'un schéma : les traits sont reconstitués sur le tableau et tout
                ce qui est écrit est relu ici.
              </p>
            )}
            {analysis && (
              <div className="mt-4 space-y-5 text-sm">
                {analysis.summary && <p className="text-muted-foreground">{analysis.summary}</p>}
                <Section title="Textes relevés" items={analysis.texts} />
                <Section title="Structure" items={analysis.elements} />
                {analysis.suggestions.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-medium">Pour continuer</h3>
                    <ul className="space-y-2">
                      {analysis.suggestions.map((s, i) => (
                        <li key={i} className="flex gap-2 text-muted-foreground">
                          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 font-medium">{title}</h3>
      <ul className="space-y-1 text-muted-foreground">
        {items.map((t, i) => (
          <li key={i} className="rounded-md bg-secondary px-2 py-1">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
