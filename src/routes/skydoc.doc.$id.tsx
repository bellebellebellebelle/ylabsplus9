import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, Bold, Copy, Download, GripVertical, Image as ImageIcon, Italic, Link2,
  List, ListOrdered, ListTree, Loader2, Menu, Minus, MoreHorizontal, MousePointer2, PanelRight, PenLine, Plus, Redo2, Send,
  Shapes, Sparkles, Table, Trash2, Type, Underline, Undo2, Wand2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { runAssistant } from "@/lib/skydoc-ai.functions";
import { generateDocImage, generateIcons } from "@/lib/skydoc-media.functions";
import { Sidebar, HoverSidebar } from "@/components/SkydocSidebar";
import { toDocHtml } from "@/lib/markdown-to-html";

export const Route = createFileRoute("/skydoc/doc/$id")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/sky/auth" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Espace de travail — Lumen Docs" },
      { name: "description", content: "Éditez votre document avec l'assistant IA." },
      { property: "og:title", content: "Espace de travail — Lumen Docs" },
      { property: "og:description", content: "Éditez votre document avec l'assistant IA." },
    ],
  }),
  component: Workspace,
});

type Msg = { id: string; role: string; content: string };
type GenKind = "image" | "icon";
const SUGGESTIONS = ["Rends les objectifs plus clairs", "Ajoute une analyse SWOT", "Génère une image d'illustration pour l'en-tête", "Crée 4 icônes pour les sections"];
const QUICK = [["Améliorer", "Améliore la rédaction et la clarté de ce bloc"], ["Raccourcir", "Raccourcis ce bloc de moitié en gardant l'essentiel"], ["Développer", "Développe ce bloc avec plus de détails concrets et chiffrés"], ["Corriger", "Corrige l'orthographe et la grammaire sans changer le sens"], ["Anglais", "Traduis ce bloc en anglais"]] as const;
const SWATCHES = ["#001952", "#043775", "#12769E", "#5BC8C9", "#F9C98F"];
const BLOCKS = "header, section, blockquote, table, figure, nav, .doc-iconrow, .doc-stat, .doc-kpi, li, h1, h2, h3, p, img, .doc-stats, .doc-kpis";

const SNIPPETS = {
  Titre: `<h2>Nouveau titre</h2>`,
  Paragraphe: `<p>Votre texte ici…</p>`,
  "Bloc carte": `<section class="doc-card"><h2>Titre du bloc</h2><p>Contenu du bloc.</p></section>`,
  Colonnes: `<div class="doc-grid"><section class="doc-card"><h2>Colonne 1</h2><p>Texte.</p></section><section class="doc-card"><h2>Colonne 2</h2><p>Texte.</p></section></div>`,
  Chiffres: `<div class="doc-stats"><div class="doc-stat"><strong>42%</strong><span>Libellé</span></div><div class="doc-stat"><strong>+12</strong><span>Libellé</span></div><div class="doc-stat"><strong>€1M</strong><span>Libellé</span></div></div>`,
  Checklist: `<ul class="doc-checks"><li>Premier objectif</li><li>Deuxième objectif</li></ul>`,
  Étapes: `<ol class="doc-steps"><li><b>Étape 1</b><small>Mois 1</small></li><li><b>Étape 2</b><small>Mois 2</small></li></ol>`,
  KPIs: `<div class="doc-kpis"><div class="doc-kpi"><small>CAC</small><strong>€120</strong><span>Coût d'acquisition</span></div><div class="doc-kpi"><small>LTV</small><strong>€2,400</strong><span>Valeur client</span></div></div>`,
  Encadré: `<blockquote class="doc-callout">Note importante.</blockquote>`,
  Tableau: `<table class="doc-table"><tr><th>Colonne</th><th>Colonne</th></tr><tr><td>—</td><td>—</td></tr></table>`,
} as Record<string, string> & { Paragraphe: string; Tableau: string; "Encadré": string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const VERB = /\b(génère|genere|générer|crée|cree|créer|dessine|ajoute|fais|insère|insere|mets)\b/i;
function detectIntent(t: string): GenKind | null {
  if (/^\/(image|img)\b/i.test(t)) return "image";
  if (/^\/ic[oô]nes?\b/i.test(t)) return "icon";
  if (VERB.test(t) && /\bic[oô]nes?\b/i.test(t)) return "icon";
  if (VERB.test(t) && /\b(image|illustration|photo|visuel|dessin)s?\b/i.test(t)) return "image";
  return null;
}
async function compress(url: string): Promise<string> {
  return new Promise((ok) => {
    const img = new window.Image();
    img.onload = () => {
      const s = Math.min(1, 1200 / img.width);
      const c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => ok(url);
    img.src = url;
  });
}

function Workspace() {
  const { id } = Route.useParams();
  const ask = useServerFn(runAssistant);
  const genImg = useServerFn(generateDocImage);
  const genIco = useServerFn(generateIcons);
  const canvas = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const dragging = useRef<HTMLElement | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Brouillon");
  const [version, setVersion] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sel, setSel] = useState<HTMLElement | null>(null);
  const [tab, setTab] = useState<"Style" | "Eléments" | "Page">("Style");
  const [zoom, setZoom] = useState(100);
  const [mode, setMode] = useState<"select" | "edit">("select");
  const [mobile, setMobile] = useState<null | "chat" | "style" | "nav">(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [gen, setGen] = useState<{ kind: GenKind; text: string } | null>(null);
  const [saved, setSaved] = useState(true);
  const [words, setWords] = useState(0);
  const [empty, setEmpty] = useState(false);
  const [, force] = useState(0);
  const saveT = useRef<number | undefined>(undefined);
  const lastLocal = useRef("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const cleanHtml = () => {
    const c = canvas.current!.cloneNode(true) as HTMLElement;
    c.querySelectorAll(".is-selected,.is-hover,.drop-before,.drop-after").forEach((e) => e.classList.remove("is-selected", "is-hover", "drop-before", "drop-after"));
    c.querySelectorAll("[class='']").forEach((e) => e.removeAttribute("class"));
    return c.innerHTML;
  };
  const measure = () => {
    const t = canvas.current?.innerText.trim() ?? "";
    setWords(t ? t.split(/\s+/).length : 0);
    setEmpty(!canvas.current?.innerHTML.trim());
  };

  const save = useCallback((extra: Record<string, unknown> = {}) => {
    setSaved(false);
    measure();
    clearTimeout(saveT.current);
    saveT.current = window.setTimeout(async () => {
      const content = cleanHtml();
      lastLocal.current = content;
      await supabase.from("documents").update({ content, updated_at: new Date().toISOString(), ...extra }).eq("id", id);
      setSaved(true);
    }, 600);
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: d }, { data: m }] = await Promise.all([
        supabase.from("documents").select("*").eq("id", id).single(),
        supabase.from("sky_messages").select("id,role,content").eq("document_id", id).order("created_at"),
      ]);
      if (!alive || !d) return;
      setTitle(d.title); setStatus(d.status); setVersion(d.version);
      const html = toDocHtml(d.content || "");
      if (canvas.current) canvas.current.innerHTML = html;
      lastLocal.current = html;
      if (html !== d.content) await supabase.from("documents").update({ content: html }).eq("id", id);
      measure();
      setMsgs(m ?? []);
      const init = sessionStorage.getItem(`init-${id}`);
      if (init && !d.content) { sessionStorage.removeItem(`init-${id}`); setChatOpen(true); send(init); }
    })();
    const ch = supabase
      .channel(`doc-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "documents", filter: `id=eq.${id}` }, (p) => {
        const n = p.new as { content: string; title: string; status: string; version: number };
        setVersion(n.version); setStatus(n.status);
        if (n.content !== lastLocal.current && canvas.current && document.activeElement !== canvas.current) {
          canvas.current.innerHTML = n.content; lastLocal.current = n.content; measure();
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sky_messages", filter: `document_id=eq.${id}` }, (p) => {
        const n = p.new as Msg;
        setMsgs((s) => (s.some((x) => x.id === n.id) ? s : [...s, n]));
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const deselect = () => { canvas.current?.querySelectorAll(".is-selected").forEach((x) => x.classList.remove("is-selected")); setSel(null); };
  const insert = (html: string) => {
    if (!canvas.current) return;
    const t = document.createElement("template"); t.innerHTML = html;
    if (sel && canvas.current.contains(sel)) sel.after(t.content); else canvas.current.append(t.content);
    save();
  };
  const log = async (role: string, content: string) => {
    setMsgs((s) => [...s, { id: `${role[0]}${Date.now()}`, role, content }]);
    await supabase.from("sky_messages").insert({ document_id: id, role, content });
  };

  async function generate(kind: GenKind, prompt: string) {
    if (!prompt.trim() || busy) return;
    const target = sel && canvas.current?.contains(sel) ? sel : null;
    setBusy(kind === "image" ? "Génération de l'image…" : "Dessin des icônes…");
    try {
      if (kind === "image") {
        const r = await genImg({ data: { prompt } });
        const url = await compress(r.url);
        insert(`<figure class="doc-figure"><img src="${url}" alt="${esc(prompt)}" /><figcaption>${esc(prompt.replace(/^\/\w+\s*/, ""))}</figcaption></figure>`);
      } else {
        const r = await genIco({ data: { prompt } });
        const icons = r.svgs.map((s) => `<span class="doc-icon" contenteditable="false">${s}</span>`).join("");
        if (target && r.svgs.length === 1 && !target.matches("figure,table,nav")) { target.insertAdjacentHTML("afterbegin", icons); save(); }
        else insert(`<div class="doc-iconrow">${icons}</div>`);
      }
      return true;
    } catch (e) {
      setMsgs((s) => [...s, { id: `e${Date.now()}`, role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Erreur"}` }]);
      return false;
    } finally { setBusy(null); }
  }

  async function send(text: string, opts: { noSel?: boolean } = {}) {
    if (!text.trim() || busy) return;
    setInput("");
    const kind = detectIntent(text);
    if (kind) {
      await log("user", text);
      const ok = await generate(kind, text);
      if (ok) await log("assistant", kind === "image" ? "Image générée et insérée dans le document." : "Icônes créées et insérées dans le document.");
      return;
    }
    setBusy("Analyse de votre demande…");
    const target = opts.noSel ? null : sel;
    await log("user", target ? `✦ [Sélection] ${text}` : text);
    try {
      let selHtml: string | null = null;
      if (target) { target.classList.remove("is-selected"); selHtml = target.outerHTML; }
      const r = await ask({ data: { instruction: text, docHtml: canvas.current ? cleanHtml() : "", selectionHtml: selHtml, history: msgs.slice(-6) } });
      if (r.html && canvas.current) {
        if (target && canvas.current.contains(target)) {
          const t = document.createElement("template"); t.innerHTML = r.html; target.replaceWith(t.content);
          setSel(null);
        } else canvas.current.innerHTML = r.html;
      }
      const nv = version + 1; setVersion(nv);
      const nt = !title || title === "Nouveau document" ? (canvas.current?.querySelector("h1")?.textContent?.slice(0, 80) || title) : title;
      setTitle(nt);
      setStatus("En cours");
      save({ version: nv, title: nt, status: "En cours" });
      await supabase.from("sky_messages").insert({ document_id: id, role: "assistant", content: `${r.reply}\n§v${nv}` });
    } catch (e) {
      setMsgs((s) => [...s, { id: `e${Date.now()}`, role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Erreur"}` }]);
    } finally { setBusy(null); }
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (mode === "edit") return;
    const el = (e.target as HTMLElement).closest(BLOCKS) as HTMLElement | null;
    canvas.current?.querySelectorAll(".is-selected").forEach((x) => x.classList.remove("is-selected"));
    if (el && canvas.current?.contains(el)) { el.classList.add("is-selected"); setSel(el); }
    else setSel(null);
  }

  const exec = (cmd: string, val?: string) => { canvas.current?.focus(); document.execCommand(cmd, false, val); save(); };
  const styleSel = (k: string, v: string) => { if (!sel) return; (sel.style as unknown as Record<string, string>)[k] = v; save(); force((x) => x + 1); };
  const move = (dir: -1 | 1) => {
    if (!sel) return;
    const sib = dir < 0 ? sel.previousElementSibling : sel.nextElementSibling;
    if (!sib) return;
    if (dir < 0) sib.before(sel); else sib.after(sel);
    save(); force((x) => x + 1);
    sel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const duplicate = () => { if (!sel) return; const c = sel.cloneNode(true) as HTMLElement; c.classList.remove("is-selected"); sel.after(c); save(); force((x) => x + 1); };
  const remove = () => { if (!sel) return; sel.remove(); setSel(null); save(); };
  const addImage = () => {
    const i = document.createElement("input"); i.type = "file"; i.accept = "image/*";
    i.onchange = () => {
      const f = i.files?.[0]; if (!f) return;
      const r = new FileReader(); r.onload = async () => insert(`<figure class="doc-figure"><img src="${await compress(String(r.result))}" alt="" /></figure>`); r.readAsDataURL(f);
    };
    i.click();
  };
  const toc = () => {
    const c = canvas.current; if (!c) return;
    c.querySelector(".doc-toc")?.remove();
    const hs = [...c.querySelectorAll("h1,h2")];
    if (!hs.length) return;
    const html = `<nav class="doc-toc"><h3>Sommaire</h3><ol>${hs.map((h) => `<li${h.tagName === "H1" ? "" : ' class="sub"'}>${esc(h.textContent ?? "")}</li>`).join("")}</ol></nav>`;
    const head = c.querySelector(":scope > header");
    if (head) head.insertAdjacentHTML("afterend", html); else c.insertAdjacentHTML("afterbegin", html);
    save();
  };
  const startWriting = () => {
    if (!canvas.current) return;
    canvas.current.innerHTML = `<h1>${esc(title && title !== "Nouveau document" ? title : "Titre du document")}</h1><p><br></p>`;
    setMode("edit"); measure();
    const r = document.createRange(); r.selectNodeContents(canvas.current.lastChild!); r.collapse(true);
    canvas.current.focus(); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
    save();
  };

  const exportPdf = () => {
    if (!canvas.current) return;
    const w = window.open("", "_blank");
    if (!w) { alert("Autorisez les fenêtres pop-up pour exporter le PDF."); return; }
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join("");
    const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title || "Document")}</title><base href="${location.origin}/">${styles}</head><body class="pdf"><div class="pdf-head"><span>${esc(title || "Document")}</span><span>${date}</span></div><div class="doc">${cleanHtml()}</div></body></html>`);
    w.document.close();
    let done = false;
    const go = async () => {
      if (done) return; done = true;
      await Promise.all([...w.document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
      await w.document.fonts?.ready;
      setTimeout(() => { w.focus(); w.print(); }, 250);
    };
    w.addEventListener("load", go);
    setTimeout(go, 1500);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "j") { e.preventDefault(); setChatOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }
      else if (mod && e.key.toLowerCase() === "p") { e.preventDefault(); exportPdf(); }
      else if (mod && e.key.toLowerCase() === "d" && sel) { e.preventDefault(); duplicate(); }
      else if (e.altKey && e.key === "ArrowUp" && sel) { e.preventDefault(); move(-1); }
      else if (e.altKey && e.key === "ArrowDown" && sel) { e.preventDefault(); move(1); }
      else if (e.key === "Escape") { deselect(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // Drag & drop of blocks
  const clearDrop = () => canvas.current?.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
  const dropTarget = (e: React.DragEvent) => {
    const d = dragging.current; if (!d) return null;
    const t = (e.target as HTMLElement).closest(BLOCKS) as HTMLElement | null;
    if (!t || t === d || d.contains(t) || !canvas.current?.contains(t)) return null;
    const r = t.getBoundingClientRect();
    return { t, after: e.clientY > r.top + r.height / 2 };
  };

  const tb = (() => {
    if (!sel || !wrap.current || !canvas.current?.contains(sel)) return null;
    const a = sel.getBoundingClientRect(), b = wrap.current.getBoundingClientRect(), s = zoom / 100;
    return { top: Math.max(0, (a.top - b.top) / s - 46), left: Math.max(0, (a.left - b.left) / s) };
  })();

  const chatPanel = (
    <div className="sd-glass sd-holo flex h-full flex-col rounded-3xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold"><span className="holo-fill grid h-6 w-6 place-items-center rounded-lg"><Wand2 className="h-3.5 w-3.5" /></span>Assistant IA</span>
        <button onClick={() => { setChatOpen(false); setMobile(null); }} title="Fermer" className="icon-btn"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 space-y-3 overflow-auto p-4">
        {!msgs.length && <p className="text-sm text-muted-foreground">Décrivez le document à créer, demandez une image ou des icônes. Cliquez sur un bloc pour le modifier précisément.</p>}
        {msgs.map((m) => {
          const [txt, v] = m.content.split("\n§v");
          return m.role === "user" ? (
            <div key={m.id} className="bg-gradient-primary anim-in ml-auto max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm">{txt}</div>
          ) : (
            <div key={m.id} className="sd-glass-2 anim-in rounded-2xl p-4 text-sm">
              <p>{txt}</p>
              {v && (
                <div className="sd-glass-2 mt-3 flex items-center gap-3 rounded-xl p-3">
                  <div className="holo-fill grid h-12 w-10 place-items-center rounded-md"><Type className="h-4 w-4" /></div>
                  <div className="flex-1"><p className="truncate font-semibold">{title}</p><p className="text-xs text-cyan">Version {v}</p></div>
                </div>
              )}
            </div>
          );
        })}
        {busy && (
          <div className="sd-glass-2 flex items-center gap-2 rounded-full px-3 py-2 text-xs">
            <span className="holo-fill grid h-5 w-5 place-items-center rounded-full"><Loader2 className="h-3 w-3 animate-spin" /></span>
            {busy}<span className="shimmer h-2 flex-1 rounded" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 px-4">
        {SUGGESTIONS.map((s) => <button key={s} disabled={!!busy} onClick={() => send(s, { noSel: true })} className="sd-glass-2 rounded-full px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:text-foreground">{s}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="sd-glass-2 m-4 rounded-2xl p-3">
        {sel && <div className="mb-2 flex items-center justify-between rounded-lg bg-accent px-2 py-1 text-[11px]"><span className="truncate">Modifier : {sel.textContent?.slice(0, 40) || sel.tagName}</span><button type="button" onClick={deselect}><X className="h-3 w-3" /></button></div>}
        <textarea ref={inputRef} rows={2} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder={msgs.length ? "Décrivez vos modifications… (/image, /icône)" : "Décrivez le document à créer…"} className="w-full resize-none bg-transparent text-sm outline-none" />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <button type="button" title="Générer une image" onClick={() => setGen({ kind: "image", text: "" })} className="icon-btn"><Sparkles className="h-4 w-4" /></button>
            <button type="button" title="Générer des icônes" onClick={() => setGen({ kind: "icon", text: "" })} className="icon-btn"><Shapes className="h-4 w-4" /></button>
          </div>
          <button disabled={!!busy} className="icon-btn text-primary-glow"><Send className="h-4 w-4" /></button>
        </div>
      </form>
    </div>
  );

  const stylePanel = (
    <div className="sd-glass flex h-full flex-col overflow-auto rounded-3xl p-4 text-sm">
      <div className="mb-4 flex justify-between border-b pb-2">
        {(["Style", "Eléments", "Page"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`pb-1 ${tab === t ? "border-b-2 border-primary-glow text-foreground" : "text-muted-foreground"}`}>{t}</button>)}
      </div>
      {tab === "Style" && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Style du texte</p>
            <select onChange={(e) => sel ? styleSel("fontFamily", e.target.value) : exec("fontName", e.target.value)} className="sd-glass-2 mb-2 w-full rounded-lg px-2 py-2">
              {["Plus Jakarta Sans", "Georgia", "Inter", "Courier New"].map((f) => <option key={f} className="bg-popover">{f}</option>)}
            </select>
            <div className="flex gap-2">
              <select onChange={(e) => exec("formatBlock", e.target.value)} className="sd-glass-2 flex-1 rounded-lg px-2 py-2">
                <option value="h1" className="bg-popover">Titre 1</option><option value="h2" className="bg-popover">Titre 2</option><option value="h3" className="bg-popover">Titre 3</option><option value="p" className="bg-popover">Texte</option>
              </select>
              <input type="number" placeholder="px" onChange={(e) => styleSel("fontSize", `${e.target.value}px`)} className="sd-glass-2 w-16 rounded-lg px-2 py-2" />
            </div>
            <div className="mt-2 grid grid-cols-6 gap-1">
              <button onClick={() => exec("bold")} className="icon-btn sd-glass-2"><Bold className="h-4 w-4" /></button>
              <button onClick={() => exec("italic")} className="icon-btn sd-glass-2"><Italic className="h-4 w-4" /></button>
              <button onClick={() => exec("underline")} className="icon-btn sd-glass-2"><Underline className="h-4 w-4" /></button>
              <button onClick={() => exec("justifyLeft")} className="icon-btn sd-glass-2"><AlignLeft className="h-4 w-4" /></button>
              <button onClick={() => exec("justifyCenter")} className="icon-btn sd-glass-2"><AlignCenter className="h-4 w-4" /></button>
              <button onClick={() => exec("justifyRight")} className="icon-btn sd-glass-2"><AlignRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Couleurs</p>
            <div className="flex gap-2">
              {SWATCHES.map((c) => <button key={c} onClick={() => sel ? styleSel("color", c) : exec("foreColor", c)} style={{ background: c }} className="h-7 w-7 rounded-full ring-1 ring-border transition hover:scale-110" />)}
              <label className="holo-fill relative h-7 w-7 cursor-pointer overflow-hidden rounded-full"><input type="color" onChange={(e) => sel ? styleSel("color", e.target.value) : exec("foreColor", e.target.value)} className="absolute inset-0 opacity-0" /></label>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Espacement</p>
            <div className="flex gap-1">
              <select onChange={(e) => styleSel("lineHeight", e.target.value)} className="sd-glass-2 rounded-lg px-2 py-1.5">{["1.2", "1.5", "1.8", "2"].map((v) => <option key={v} className="bg-popover">{v}</option>)}</select>
              <button onClick={() => exec("insertUnorderedList")} className="icon-btn sd-glass-2"><List className="h-4 w-4" /></button>
              <button onClick={() => exec("insertOrderedList")} className="icon-btn sd-glass-2"><ListOrdered className="h-4 w-4" /></button>
              <button onClick={() => exec("justifyFull")} className="icon-btn sd-glass-2"><AlignJustify className="h-4 w-4" /></button>
            </div>
          </div>
          <div className={sel ? "" : "pointer-events-none opacity-40"}>
            <p className="mb-2 text-xs text-muted-foreground">Bloc {sel ? "" : "(sélectionnez un élément)"}</p>
            {([["Remplissage", "padding"], ["Rayon", "borderRadius"]] as const).map(([l, k]) => (
              <label key={k} className="mb-2 flex items-center justify-between">{l}<input type="number" defaultValue={k === "padding" ? 24 : 16} onChange={(e) => styleSel(k, `${e.target.value}px`)} className="sd-glass-2 w-16 rounded-lg px-2 py-1" /></label>
            ))}
            <Toggle label="Bordure" on={!!sel?.style.border} set={(v) => styleSel("border", v ? "1px solid var(--primary)" : "")} />
            <Toggle label="Ombre" on={!!sel?.style.boxShadow} set={(v) => styleSel("boxShadow", v ? "0 10px 30px -8px oklch(0.58 0.24 285 / 0.6)" : "")} />
            <label className="flex items-center justify-between">Fond<input type="color" onChange={(e) => styleSel("background", e.target.value)} className="h-7 w-10 rounded bg-transparent" /></label>
          </div>
        </div>
      )}
      {tab === "Eléments" && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setGen({ kind: "image", text: "" })} className="sd-holo sk-bento col-span-2 flex items-center justify-center gap-2 rounded-xl p-3 text-xs"><Sparkles className="h-4 w-4 text-cyan" />Image IA</button>
          <button onClick={() => setGen({ kind: "icon", text: "" })} className="sk-bento flex items-center justify-center gap-1 rounded-xl p-3 text-xs"><Shapes className="h-3.5 w-3.5" />Icônes IA</button>
          <button onClick={toc} className="sk-bento flex items-center justify-center gap-1 rounded-xl p-3 text-xs"><ListTree className="h-3.5 w-3.5" />Sommaire</button>
          {Object.entries(SNIPPETS).map(([k, v]) => <button key={k} onClick={() => insert(v)} className="sk-bento rounded-xl p-3 text-xs">{k}</button>)}
          <button onClick={addImage} className="sk-bento rounded-xl p-3 text-xs">Importer image</button>
          {sel && <button onClick={remove} className="col-span-2 rounded-xl border border-destructive p-2 text-xs text-destructive">Supprimer l'élément</button>}
        </div>
      )}
      {tab === "Page" && (
        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">Titre du projet
            <input value={title} onChange={(e) => { setTitle(e.target.value); save({ title: e.target.value }); }} className="sd-glass-2 mt-1 w-full rounded-lg px-2 py-2 text-sm text-foreground" />
          </label>
          <label className="block text-xs text-muted-foreground">Statut
            <select value={status} onChange={(e) => { setStatus(e.target.value); save({ status: e.target.value }); }} className="sd-glass-2 mt-1 w-full rounded-lg px-2 py-2 text-sm text-foreground">
              {["Brouillon", "En cours", "Terminé"].map((s) => <option key={s} className="bg-popover">{s}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="sk-bento rounded-xl p-3"><p className="text-lg font-bold">{words}</p><p className="text-[10px] text-muted-foreground">mots</p></div>
            <div className="sk-bento rounded-xl p-3"><p className="text-lg font-bold">{Math.max(1, Math.round(words / 220))} min</p><p className="text-[10px] text-muted-foreground">de lecture</p></div>
          </div>
          <button onClick={exportPdf} className="bg-gradient-primary shadow-glow flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold"><Download className="h-4 w-4" />Exporter en PDF</button>
          <p className="text-[11px] text-muted-foreground">Mise en page A4 claire et professionnelle. Choisissez « Enregistrer au format PDF ». Raccourci ⌘P.</p>
          <div className="text-[11px] text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Raccourcis</p>
            <p>⌘J assistant · ⌘D dupliquer · Alt+↑/↓ déplacer · Échap désélectionner</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="skydoc flex h-screen gap-3 overflow-hidden p-3">
      <HoverSidebar activeId={id} />

      {/* Right edge hot-zone for the assistant */}
      {!chatOpen && <div onMouseEnter={() => setChatOpen(true)} className="fixed inset-y-0 right-0 z-40 hidden w-4 lg:block" />}
      {!chatOpen && <div className="edge-hint right-1 hidden lg:block" />}
      <div className={`fixed inset-y-3 right-3 z-50 hidden w-96 transition-all duration-300 lg:block ${chatOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[110%] opacity-0"}`}>{chatPanel}</div>

      <main className="sd-glass sd-holo relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem]">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Link to="/skydoc/dashboard" className="icon-btn"><ArrowLeft className="h-4 w-4" /></Link>
          <span className="flex-1 truncate text-sm font-semibold">{title}</span>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">{words} mots · v{version}</span>
          <button onClick={() => setMobile("nav")} className="icon-btn md:hidden"><Menu className="h-4 w-4" /></button>
          <button onClick={() => { setChatOpen(true); if (window.innerWidth < 1024) setMobile("chat"); }} className="holo-fill flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"><Wand2 className="h-3.5 w-3.5" />Assistant</button>
        </div>
        <div className="flex-1 overflow-auto px-4 pt-6 pb-48 md:px-10">
          <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-2">
            <div className="sd-glass-2 flex flex-wrap items-center gap-0.5 rounded-xl px-2 py-1">
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className="icon-btn"><Bold className="h-3.5 w-3.5" /></button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className="icon-btn"><Italic className="h-3.5 w-3.5" /></button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} className="icon-btn"><Underline className="h-3.5 w-3.5" /></button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyLeft")} className="icon-btn"><AlignLeft className="h-3.5 w-3.5" /></button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className="icon-btn"><List className="h-3.5 w-3.5" /></button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { const u = prompt("Lien URL"); if (u) exec("createLink", u); }} className="icon-btn"><Link2 className="h-3.5 w-3.5" /></button>
              <label className="holo-fill relative mx-1 h-4 w-4 cursor-pointer overflow-hidden rounded-full"><input type="color" onChange={(e) => exec("foreColor", e.target.value)} className="absolute inset-0 opacity-0" /></label>
            </div>
            <div className="flex items-center gap-2">
              {!empty && <button disabled={!!busy} onClick={() => { deselect(); send("Continue le document : ajoute la suite logique (nouvelles sections pertinentes) en conservant tout le contenu existant.", { noSel: true }); }} className="sd-glass-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition hover:shadow-glow"><PenLine className="h-3.5 w-3.5 text-cyan" />Continuer avec l'IA</button>}
              <span className="sd-glass-2 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"><span className={`h-2 w-2 rounded-full ${saved ? "bg-cyan" : "bg-primary pulse-glow"}`} />{status}</span>
            </div>
          </div>
          <div ref={wrap} className="relative mx-auto max-w-4xl origin-top transition-transform" style={{ transform: `scale(${zoom / 100})` }}>
            {tb && (
              <div className="sd-glass anim-in absolute z-20 flex items-center gap-0.5 rounded-xl p-1" style={{ top: tb.top, left: tb.left }}>
                <span draggable title="Glisser pour déplacer" onDragStart={(e) => { dragging.current = sel; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", ""); }} onDragEnd={() => { dragging.current = null; clearDrop(); }} className="icon-btn cursor-grab"><GripVertical className="h-4 w-4" /></span>
                <button title="Monter (Alt+↑)" onClick={() => move(-1)} className="icon-btn"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button title="Descendre (Alt+↓)" onClick={() => move(1)} className="icon-btn"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button title="Dupliquer (⌘D)" onClick={duplicate} className="icon-btn"><Copy className="h-3.5 w-3.5" /></button>
                <span className="mx-1 h-5 w-px bg-border" />
                {QUICK.map(([l, i]) => <button key={l} disabled={!!busy} onClick={() => { setChatOpen(true); send(i); }} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground">{l}</button>)}
                <span className="mx-1 h-5 w-px bg-border" />
                <button title="Supprimer" onClick={remove} className="icon-btn text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            )}
            <div
              ref={canvas}
              className="doc min-h-[60vh]"
              data-placeholder="Commencez à écrire ici, ou demandez à l'assistant de créer le document…"
              contentEditable
              suppressContentEditableWarning
              onInput={() => { save(); if (sel) force((x) => x + 1); }}
              onClick={onCanvasClick}
              onDragOver={(e) => { const d = dropTarget(e); if (!dragging.current) return; e.preventDefault(); clearDrop(); d?.t.classList.add(d.after ? "drop-after" : "drop-before"); }}
              onDrop={(e) => { const d = dropTarget(e); const s = dragging.current; if (!s) return; e.preventDefault(); clearDrop(); if (d) { if (d.after) d.t.after(s); else d.t.before(s); save(); force((x) => x + 1); } dragging.current = null; }}
              onMouseOver={(e) => { if (mode !== "select") return; const el = (e.target as HTMLElement).closest(BLOCKS); canvas.current?.querySelectorAll(".is-hover").forEach((x) => x.classList.remove("is-hover")); el?.classList.add("is-hover"); }}
              onMouseLeave={() => canvas.current?.querySelectorAll(".is-hover").forEach((x) => x.classList.remove("is-hover"))}
            />
            {busy && empty && <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="shimmer sd-glass-2 h-24 rounded-2xl" />)}</div>}
            {empty && !busy && (
              <div className="anim-in mt-6 grid gap-3 sm:grid-cols-3">
                <button onClick={startWriting} className="sk-bento sd-holo rounded-3xl p-5 text-left sm:col-span-2 sm:row-span-2">
                  <PenLine className="mb-3 h-6 w-6 text-cyan" /><p className="text-lg font-bold">Commencer à écrire</p><p className="text-xs text-muted-foreground">Partez d'une page blanche, ajoutez vos blocs, puis laissez l'IA continuer.</p>
                </button>
                <button onClick={() => { setTab("Eléments"); if (window.innerWidth < 1024) setMobile("style"); }} className="sk-bento rounded-3xl p-5 text-left"><Plus className="mb-2 h-5 w-5" /><p className="font-semibold">Ajouter un bloc</p></button>
                <button onClick={() => { setChatOpen(true); if (window.innerWidth < 1024) setMobile("chat"); setTimeout(() => inputRef.current?.focus(), 50); }} className="sk-bento rounded-3xl p-5 text-left"><Wand2 className="mb-2 h-5 w-5 text-primary-glow" /><p className="font-semibold">Demander à l'IA</p></button>
              </div>
            )}
          </div>
        </div>

        <div className="sd-glass sd-holo absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl p-1.5">
          <button title="Assistant (⌘J)" onClick={() => { setChatOpen(true); if (window.innerWidth < 1024) setMobile("chat"); setTimeout(() => inputRef.current?.focus(), 50); }} className="holo-fill shadow-glow grid h-10 w-10 place-items-center rounded-xl"><Wand2 className="h-4 w-4" /></button>
          <button title="Sélection" onClick={() => setMode("select")} className={`icon-btn h-10 w-10 ${mode === "select" ? "bg-accent text-foreground" : ""}`}><MousePointer2 className="h-4 w-4" /></button>
          <button title="Texte" onClick={() => { setMode("edit"); insert(SNIPPETS.Paragraphe); }} className={`icon-btn h-10 w-10 ${mode === "edit" ? "bg-accent text-foreground" : ""}`}><Type className="h-4 w-4" /></button>
          <button title="Image IA" onClick={() => setGen({ kind: "image", text: "" })} className="icon-btn h-10 w-10"><Sparkles className="h-4 w-4" /></button>
          <button title="Icônes IA" onClick={() => setGen({ kind: "icon", text: "" })} className="icon-btn h-10 w-10"><Shapes className="h-4 w-4" /></button>
          <button title="Importer une image" onClick={addImage} className="icon-btn h-10 w-10"><ImageIcon className="h-4 w-4" /></button>
          <button title="Tableau" onClick={() => insert(SNIPPETS.Tableau)} className="icon-btn h-10 w-10"><Table className="h-4 w-4" /></button>
          <button title="Plus de blocs" onClick={() => { setTab("Eléments"); if (window.innerWidth < 1024) setMobile("style"); }} className="icon-btn h-10 w-10"><MoreHorizontal className="h-4 w-4" /></button>
        </div>

        <div className="absolute right-4 bottom-4 hidden items-center gap-1 md:flex">
          <button onClick={() => exec("undo")} className="icon-btn sd-glass"><Undo2 className="h-4 w-4" /></button>
          <button onClick={() => exec("redo")} className="icon-btn sd-glass"><Redo2 className="h-4 w-4" /></button>
          <div className="sd-glass ml-2 flex items-center rounded-lg text-xs">
            <button onClick={() => setZoom((z) => Math.max(50, z - 10))} className="icon-btn"><Minus className="h-3 w-3" /></button>
            <span className="w-10 text-center">{zoom}%</span>
            <button onClick={() => setZoom((z) => Math.min(150, z + 10))} className="icon-btn"><Plus className="h-3 w-3" /></button>
          </div>
          <button onClick={exportPdf} title="Exporter en PDF (⌘P)" className="bg-gradient-primary shadow-glow ml-2 grid h-9 w-9 place-items-center rounded-full"><Download className="h-4 w-4" /></button>
        </div>
        <button onClick={() => setMobile("style")} className="sd-glass icon-btn absolute top-14 right-3 lg:hidden"><PanelRight className="h-4 w-4" /></button>
      </main>

      <div className="hidden w-64 shrink-0 lg:block">{stylePanel}</div>

      {gen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-background/70 p-4 backdrop-blur" onClick={() => setGen(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => { e.preventDefault(); const g = gen; setGen(null); setChatOpen(true); await log("user", `${g.kind === "image" ? "🖼️ Image" : "✦ Icônes"} : ${g.text}`); if (await generate(g.kind, g.text)) await log("assistant", g.kind === "image" ? "Image générée et insérée." : "Icônes créées et insérées."); }} className="sd-glass sd-holo anim-in w-full max-w-md rounded-3xl p-5">
            <p className="mb-1 flex items-center gap-2 font-semibold">{gen.kind === "image" ? <Sparkles className="h-4 w-4 text-cyan" /> : <Shapes className="h-4 w-4 text-cyan" />}{gen.kind === "image" ? "Générer une image" : "Générer des icônes"}</p>
            <p className="mb-3 text-xs text-muted-foreground">{gen.kind === "image" ? "Décrivez l'illustration souhaitée. Elle sera insérée après le bloc sélectionné." : "Ex : « 4 icônes : croissance, équipe, sécurité, cloud ». Une seule icône s'ajoute dans le bloc sélectionné."}</p>
            <textarea autoFocus rows={3} value={gen.text} onChange={(e) => setGen({ ...gen, text: e.target.value })} className="sd-glass-2 w-full resize-none rounded-xl p-3 text-sm outline-none" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setGen(null)} className="rounded-xl px-4 py-2 text-sm text-muted-foreground">Annuler</button>
              <button disabled={!gen.text.trim()} className="bg-gradient-primary shadow-glow rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">Générer</button>
            </div>
          </form>
        </div>
      )}

      {mobile && (
        <div className="fixed inset-0 z-50 flex bg-background/70 p-3 backdrop-blur lg:hidden" onClick={() => setMobile(null)}>
          <div className="anim-in relative h-full w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {mobile === "chat" ? chatPanel : mobile === "style" ? stylePanel : <div className="sd-glass h-full rounded-3xl"><Sidebar activeId={id} /></div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="mb-2 flex items-center justify-between">
      {label}
      <button type="button" onClick={() => set(!on)} className={`relative h-5 w-9 rounded-full transition ${on ? "bg-gradient-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${on ? "left-4.5" : "left-0.5"}`} />
      </button>
    </label>
  );
}
