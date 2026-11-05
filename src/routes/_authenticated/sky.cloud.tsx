import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, Check, ChevronRight, Clock, CloudUpload, Copy, Download, FileText, Folder, FolderOpen,
  FolderPlus, Home, Link2, Lock, LogOut, MoreVertical, Pencil, Plus, RotateCcw, Search, Share2, Shield,
  Star, Trash2, Users, ScrollText, File as FileIcon, FolderInput, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Assistant } from "@/components/Assistant";
import { transcribeAudio, type AssistantAction } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { AssistantJournal } from "@/components/AssistantJournal";
import { toBase64, type ActionResult } from "@/components/Assistant";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MfaGate, SecurityDialog, UnlockDialog, useMfaFactors } from "@/components/Security";
import { FileThumb, FolderIcon } from "@/components/Visuals";
import { decryptBlob, e2eEnabled, encryptBlob, hasKey } from "@/lib/e2e";
import icUpload from "@/assets/ic-upload.png";
import icFolderPlus from "@/assets/ic-folder-plus.png";
import icLink from "@/assets/ic-link.png";
import icSearch from "@/assets/ic-search.png";

export const Route = createFileRoute("/_authenticated/sky/cloud")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — SKY CLOUD" },
      { name: "description", content: "Gérez vos fichiers, dossiers et partages avec l'assistant IA." },
      { property: "og:title", content: "Tableau de bord — SKY CLOUD" },
      { property: "og:description", content: "Votre espace de stockage intelligent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <MfaGate><Dashboard /></MfaGate>,
});
const DRAG = "application/x-nova-file";

type FileRow = Tables<"files">;
type FolderRow = Tables<"folders">;
type ShareRow = Tables<"shares">;
type View = "accueil" | "fichiers" | "dossiers" | "partages" | "recents" | "favoris" | "corbeille" | "journal";

const NAV: { id: View; label: string; icon: typeof Home }[] = [
  { id: "accueil", label: "Accueil", icon: Home },
  { id: "fichiers", label: "Mes fichiers", icon: FileIcon },
  { id: "dossiers", label: "Dossiers", icon: Folder },
  { id: "partages", label: "Partages", icon: Users },
  { id: "recents", label: "Récents", icon: Clock },
  { id: "favoris", label: "Favoris", icon: Star },
  { id: "corbeille", label: "Corbeille", icon: Trash2 },
  { id: "journal", label: "Journal IA", icon: ScrollText },
];
const FOLDER_COLORS = ["sky", "emerald", "amber", "pink", "violet"] as const;


function fmtSize(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} Ko`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} Mo`;
  return `${(b / 1024 ** 3).toFixed(2)} Go`;
}
function category(m: string) {
  if (m.startsWith("image/")) return "Images";
  if (m.startsWith("video/")) return "Vidéos";
  if (m.includes("pdf") || m.startsWith("text/") || m.includes("document") || m.includes("sheet") || m.includes("presentation") || m.includes("word")) return "Documents";
  return "Autres";
}
const thisMonth = (d: string) => new Date(d) > new Date(Date.now() - 30 * 864e5);
const actionLabel: Record<string, string> = {
  upload: "Téléversé par vous", rename: "Renommé par vous", share: "Partagé par vous", delete: "Mis à la corbeille",
  restore: "Restauré", move: "Déplacé par vous",
};

type PromptState = { title: string; value: string; onOk: (v: string) => void } | null;

function Dashboard() {
  const transcribe = useServerFn(transcribeAudio);
  const nav = useNavigate();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("accueil");
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [shareFor, setShareFor] = useState<FileRow | "pick" | null>(null);
  const [moveFor, setMoveFor] = useState<FileRow | null>(null);
  const [secOpen, setSecOpen] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [, force] = useState(0);
  const [encryptionOn, setEncryptionOn] = useState(false);
  useEffect(() => { setEncryptionOn(e2eEnabled()); }, []);
  const unlockWait = useRef<((ok: boolean) => void) | null>(null);
  const mfa = useMfaFactors();
  const fileInput = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const requireKey = () =>
    hasKey() ? Promise.resolve(true) : new Promise<boolean>((r) => { unlockWait.current = r; setUnlockOpen(true); });

  const user = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user });
  const files = useQuery({
    queryKey: ["files"],
    queryFn: async () => (await supabase.from("files").select("*").order("updated_at", { ascending: false })).data ?? [],
  });
  const folders = useQuery({
    queryKey: ["folders"],
    queryFn: async () => (await supabase.from("folders").select("*").order("created_at")).data ?? [],
  });
  const shares = useQuery({
    queryKey: ["shares"],
    queryFn: async () => (await supabase.from("shares").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const activities = useQuery({
    queryKey: ["activities"],
    queryFn: async () => (await supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(6)).data ?? [],
  });

  useEffect(() => {
    const ch = supabase
      .channel(`sync-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "files" }, () => qc.invalidateQueries({ queryKey: ["files"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "folders" }, () => qc.invalidateQueries({ queryKey: ["folders"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, () => qc.invalidateQueries({ queryKey: ["activities"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const uid = user.data?.id;
  const firstName = (user.data?.user_metadata?.['full_name'] as string) || user.data?.email?.split("@")[0] || "";
  const all = files.data ?? [];
  const live = all.filter((f) => !f.deleted_at);
  const trash = all.filter((f) => f.deleted_at);
  const fl = folders.data ?? [];
  const used = live.reduce((s, f) => s + f.size, 0);

  const refresh = () => ["files", "folders", "shares", "activities"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const log = (file_name: string, action: string) => supabase.from("activities").insert({ file_name, action });
  const findFile = (n: string | null) => {
    const t = (n ?? "").toLowerCase();
    return live.find((f) => f.name.toLowerCase() === t) ?? live.find((f) => f.name.toLowerCase().includes(t));
  };
  const findFolder = (n: string | null) => {
    const t = (n ?? "").toLowerCase();
    return fl.find((f) => f.name.toLowerCase() === t) ?? fl.find((f) => f.name.toLowerCase().includes(t));
  };

  // Folders marked "Agents & IA" store files unencrypted so server automations can read them.
  const [aiFolders, setAiFolders] = useState<string[]>([]);
  useEffect(() => { if (uid) try { setAiFolders(JSON.parse(localStorage.getItem(`sky-ai-folders:${uid}`) ?? "[]")); } catch { setAiFolders([]); } }, [uid]);
  const toggleAiFolder = (id: string) => {
    const next = aiFolders.includes(id) ? aiFolders.filter((x) => x !== id) : [...aiFolders, id];
    setAiFolders(next);
    if (uid) localStorage.setItem(`sky-ai-folders:${uid}`, JSON.stringify(next));
    toast.success(next.includes(id) ? "Dossier compatible Agents & IA : les nouveaux fichiers ne seront pas chiffrés." : "Dossier chiffré de bout en bout.");
  };
  async function decryptForAi(f: FileRow) {
    if (!(await requireKey())) return;
    const { data, error } = await supabase.storage.from("files").download(f.storage_path);
    if (error || !data) { toast.error(error?.message ?? "Téléchargement impossible"); return; }
    try {
      const plain = await decryptBlob(data, f.mime_type);
      const up = await supabase.storage.from("files").upload(f.storage_path, plain, { upsert: true, contentType: f.mime_type || "application/octet-stream" });
      if (up.error) throw up.error;
      const r = await supabase.from("files").update({ encrypted: false }).eq("id", f.id);
      if (r.error) throw r.error;
      toast.success(`« ${f.name} » est maintenant lisible par les agents.`);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function upload(list: FileList | File[] | null, folderId: string | null = folderFilter) {
    if (!list || !uid) return;
    const arr = Array.from(list);
    if (!arr.length) return;
    // Uploads are stored unencrypted (account-protected) so agents can read them; existing encrypted files stay readable with the passphrase.
    const enc = false;
    if (enc && !(await requireKey())) { toast.error("Import annulé : coffre verrouillé"); return; }
    let failures = 0;
    setUploading((n) => n + arr.length);
    await Promise.all(
      arr.map(async (f) => {
        const path = `${uid}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, "_")}${enc ? ".enc" : ""}`;
        try {
          const body = enc ? await encryptBlob(f) : f;
          const { error } = await supabase.storage.from("files").upload(path, body, { contentType: enc ? "application/octet-stream" : f.type || "application/octet-stream" });
          if (error) throw error;
          const saved = await supabase.from("files").insert({ name: f.name, storage_path: path, size: f.size, mime_type: f.type || "application/octet-stream", folder_id: folderId, encrypted: enc }).select("id").single();
          if (saved.error || !saved.data) {
            await supabase.storage.from("files").remove([path]);
            throw new Error(saved.error?.message ?? "Fichier non enregistré");
          }
          await log(f.name, "upload");
        } catch (error) { failures++; toast.error(`${f.name} : ${error instanceof Error ? error.message : "Import impossible"}`); }
        finally { setUploading((n) => n - 1); }
      }),
    );
    if (failures) toast.error(`${arr.length - failures} import(s) réussi(s), ${failures} échec(s).`);
    else toast.success(enc ? "Import chiffré terminé" : "Import terminé (dossier Agents & IA)");
    refresh();
  }

  // Each helper returns an error message, or null on verified success.
  const affected = (r: { error: { message: string } | null; data: unknown[] | null }, what: string) =>
    r.error ? r.error.message : !r.data?.length ? `${what} : aucune modification enregistrée (élément introuvable ou accès refusé).` : null;
  async function createFolder(name: string): Promise<string | null> {
    if (!name.trim()) return "Nom de dossier vide.";
    if (fl.some((d) => d.name.toLowerCase() === name.trim().toLowerCase())) { toast.error("Ce dossier existe déjà"); return `Un dossier « ${name.trim()} » existe déjà.`; }
    const color: string = FOLDER_COLORS[fl.length % FOLDER_COLORS.length] ?? "sky";
    const err = affected(await supabase.from("folders").insert({ name: name.trim(), color }).select(), "Création du dossier");
    if (err) toast.error(err);
    else toast.success(`Dossier « ${name} » créé`);
    refresh();
    return err;
  }
  async function renameFile(f: FileRow, name: string): Promise<string | null> {
    if (!name.trim()) return "Nouveau nom vide.";
    const err = affected(await supabase.from("files").update({ name: name.trim(), updated_at: new Date().toISOString() }).eq("id", f.id).select(), "Renommage");
    if (err) { toast.error(err); return err; }
    await log(name, "rename");
    refresh();
    return null;
  }
  async function trashFile(f: FileRow): Promise<string | null> {
    const err = affected(await supabase.from("files").update({ deleted_at: new Date().toISOString() }).eq("id", f.id).select(), "Suppression");
    if (err) { toast.error(err); return err; }
    await log(f.name, "delete");
    toast.success("Déplacé dans la corbeille");
    refresh();
    return null;
  }
  async function restoreFile(f: FileRow) {
    await supabase.from("files").update({ deleted_at: null }).eq("id", f.id);
    await log(f.name, "restore");
    refresh();
  }
  async function destroyFile(f: FileRow) {
    await supabase.storage.from("files").remove([f.storage_path]);
    await supabase.from("files").delete().eq("id", f.id);
    refresh();
  }
  async function toggleFav(f: FileRow): Promise<string | null> {
    const err = affected(await supabase.from("files").update({ favorite: !f.favorite }).eq("id", f.id).select(), "Favori");
    if (err) toast.error(err);
    refresh();
    return err;
  }
  async function moveFile(f: FileRow, folderId: string | null): Promise<string | null> {
    if (f.folder_id === folderId) return "Le fichier est déjà dans ce dossier.";
    const err = affected(await supabase.from("files").update({ folder_id: folderId, updated_at: new Date().toISOString() }).eq("id", f.id).select(), "Déplacement");
    if (err) { toast.error(err); return err; }
    await log(f.name, "move");
    toast.success(`« ${f.name} » déplacé vers ${fl.find((d) => d.id === folderId)?.name ?? "la racine"}`);
    refresh();
    return null;
  }
  async function openFile(f: FileRow, download = false) {
    if (f.encrypted) {
      if (!(await requireKey())) return;
      const { data, error } = await supabase.storage.from("files").download(f.storage_path);
      if (error || !data) { toast.error(error?.message ?? "Erreur"); return; }
      try {
        const u = URL.createObjectURL(await decryptBlob(data, f.mime_type));
        if (download) { const a = document.createElement("a"); a.href = u; a.download = f.name; a.click(); }
        else window.open(u, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(u), 60_000);
      } catch (e) { toast.error((e as Error).message); }
      return;
    }
    const { data, error } = await supabase.storage.from("files").download(f.storage_path);
    if (error || !data) { toast.error(error?.message ?? "Téléchargement impossible"); return; }
    const url = URL.createObjectURL(data);
    if (download) { const a = document.createElement("a"); a.href = url; a.download = f.name; a.click(); }
    else window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  const dropZone = (folderId: string | null, key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(DRAG) || e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropTarget(key); }
    },
    onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation(); setDropTarget(null); setDragDepth(0);
      const id = e.dataTransfer.getData(DRAG);
      const f = live.find((x) => x.id === id);
      if (f) moveFile(f, folderId);
      else if (e.dataTransfer.files.length) upload(e.dataTransfer.files, folderId);
    },
  });
  const ring = (key: string) => (dropTarget === key ? "ring-2 ring-primary scale-[1.03]" : "");

  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  useEffect(() => {
    const isFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") && !e.dataTransfer.types.includes(DRAG);
    const enter = (e: DragEvent) => isFiles(e) && setDragDepth((d) => d + 1);
    const leave = (e: DragEvent) => isFiles(e) && setDragDepth((d) => Math.max(0, d - 1));
    const over = (e: DragEvent) => {
      if (isFiles(e)) e.preventDefault();
      if (e.clientX < 18) setLeftOpen(true);
    };
    const drop = (e: DragEvent) => {
      if (!isFiles(e)) return;
      e.preventDefault(); setDragDepth(0);
      if (e.dataTransfer?.files.length) uploadRef.current(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter); window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over); window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter); window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over); window.removeEventListener("drop", drop);
    };
  }, []);
  async function createShare(f: FileRow, permission: string, days: number | null, onError?: (m: string) => void) {
    if (f.encrypted) { const m = "Les fichiers chiffrés de bout en bout ne peuvent pas être partagés par lien."; toast.error(m); onError?.(m); return undefined; }
    const { data, error } = await supabase
      .from("shares")
      .insert({ file_id: f.id, permission, expires_at: days ? new Date(Date.now() + days * 864e5).toISOString() : null })
      .select()
      .single();
    if (error) { toast.error(error.message); onError?.(error.message); return undefined; }
    await log(f.name, "share");
    const url = `${window.location.origin}/s/${data.token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Lien copié dans le presse-papiers");
    refresh();
    return url;
  }
  async function renameFolder(f: FolderRow, name: string) {
    if (!name.trim()) return;
    await supabase.from("folders").update({ name: name.trim() }).eq("id", f.id);
    refresh();
  }
  async function deleteFolder(f: FolderRow) {
    await supabase.from("folders").delete().eq("id", f.id);
    toast.success("Dossier supprimé (les fichiers sont conservés)");
    refresh();
  }

  async function readFileContent(f: FileRow, question: string): Promise<ActionResult> {
    const fail = (detail: string): ActionResult => ({ ok: false, detail });
    if (!window.confirm(`Analyser « ${f.name} » avec l’IA ? Son contenu lisible sera envoyé au service IA, mais jamais votre phrase secrète ni votre clé.`)) return fail("Analyse annulée : aucun contenu envoyé à l’IA.");
    if (f.size > 10_000_000) return fail(`« ${f.name} » fait ${fmtSize(f.size)} : la lecture est limitée à 10 Mo.`);
    if (f.encrypted && !(await requireKey())) return fail(`« ${f.name} » est chiffré et le coffre est verrouillé.`);
    const { data, error } = await supabase.storage.from("files").download(f.storage_path);
    if (error || !data) return fail(`Téléchargement de « ${f.name} » impossible : ${error?.message ?? "fichier vide"}.`);
    let blob: Blob = data;
    if (f.encrypted) { try { blob = await decryptBlob(data, f.mime_type); } catch (e) { return fail(`Déchiffrement impossible : ${(e as Error).message}`); } }
    const m = f.mime_type, n = f.name.toLowerCase();
    const isText = m.startsWith("text/") || /json|csv|xml|markdown|javascript|yaml/.test(m) || /\.(txt|md|csv|json|xml|html|log|ya?ml|js|ts)$/.test(n);
    const prompt = `Contenu du fichier "${f.name}" fourni ci-dessous. Demande : ${question || "résume-le"}. Réponds à partir de ce contenu et cite "${f.name}" dans sources.`;
    if (isText) return { ok: true, detail: `Fichier « ${f.name} » lu (texte).`, content: { prompt: `${prompt}\n\n${(await blob.text()).slice(0, 25000)}` } };
    const base64 = await toBase64(blob);
    if (m.startsWith("image/") || m === "application/pdf" || n.endsWith(".pdf")) {
      return { ok: true, detail: `Fichier « ${f.name} » lu (${m.startsWith("image/") ? "image" : "PDF"}).`, content: { prompt, attachment: { name: f.name, mime: m.startsWith("image/") ? m : "application/pdf", base64 } } };
    }
    if (m.startsWith("audio/")) {
      try {
        const { text } = await transcribe({ data: { audio: base64, mime: m } });
        if (!text.trim()) return fail(`Aucune parole détectée dans « ${f.name} ».`);
        return { ok: true, detail: `Audio « ${f.name} » transcrit.`, content: { prompt: `${prompt}\n\nTranscription :\n${text.slice(0, 25000)}` } };
      } catch (e) { return fail(`Transcription de « ${f.name} » impossible : ${(e as Error).message}`); }
    }
    return fail(`Le format de « ${f.name} » (${m}) ne peut pas encore être lu. Formats lisibles : textes, PDF, images et audio.`);
  }

  async function runAction(a: AssistantAction): Promise<ActionResult> {
    const f = findFile(a.target);
    const done = (err: string | null, okMsg: string): ActionResult => (err ? { ok: false, detail: err } : { ok: true, detail: okMsg });
    const noFile = (): ActionResult => ({ ok: false, detail: `Fichier « ${a.target ?? "?"} » introuvable dans votre espace (hors corbeille).` });
    switch (a.type) {
      case "search": {
        setQuery(a.target ?? ""); setFolderFilter(null); setView("fichiers");
        const t = (a.target ?? "").toLowerCase();
        const hits = live.filter((x) => x.name.toLowerCase().includes(t));
        return { ok: true, detail: `Recherche « ${a.target ?? ""} » : ${hits.length} résultat(s)${hits.length ? " — " + hits.slice(0, 5).map((x) => x.name).join(", ") : ""}.` };
      }
      case "create_folder": {
        const name = (a.value ?? "Nouveau dossier").trim();
        return done(await createFolder(name), `Dossier « ${name} » créé.`);
      }
      case "navigate":
        if (a.value && NAV.some((n) => n.id === a.value)) { setView(a.value as View); return { ok: true, detail: `Page « ${NAV.find((n) => n.id === a.value)?.label} » ouverte.` }; }
        return { ok: false, detail: `Page « ${a.value ?? "?"} » inconnue.` };
      case "delete_file":
        return f ? done(await trashFile(f), `« ${f.name} » déplacé dans la corbeille.`) : noFile();
      case "rename_file":
        if (!f) return noFile();
        if (!a.value) return { ok: false, detail: "Aucun nouveau nom fourni." };
        return done(await renameFile(f, a.value), `« ${f.name} » renommé en « ${a.value} ».`);
      case "favorite_file":
        return f ? done(await toggleFav(f), f.favorite ? `« ${f.name} » retiré des favoris.` : `« ${f.name} » ajouté aux favoris.`) : noFile();
      case "share_file": {
        if (!f) return noFile();
        let err = "Création du lien impossible.";
        const url = await createShare(f, a.value === "download" ? "download" : "view", null, (m) => { err = m; });
        return url ? { ok: true, detail: `Lien de partage créé pour « ${f.name} » (${a.value === "download" ? "téléchargement" : "lecture"}) et copié : ${url}` } : { ok: false, detail: err };
      }
      case "move_file": {
        if (!f) return noFile();
        const d = findFolder(a.value);
        if (!d) return { ok: false, detail: `Dossier « ${a.value ?? "?"} » introuvable.` };
        return done(await moveFile(f, d.id), `« ${f.name} » déplacé vers « ${d.name} ».`);
      }
      case "read_file":
        return f ? readFileContent(f, a.value ?? "") : noFile();
      default:
        return { ok: false, detail: `Action « ${a.type} » non prise en charge.` };
    }
  }

  const context = useMemo(() => {
    const fname = (id: string | null) => fl.find((d) => d.id === id)?.name ?? "racine";
    return [
      `Prénom: ${firstName}. Espace utilisé: ${fmtSize(used)}. Corbeille: ${trash.length} fichiers (${fmtSize(trash.reduce((s, f) => s + f.size, 0))}).`,
      `Dossiers: ${fl.map((d) => d.name).join(", ") || "aucun"}`,
      "Fichiers (nom | taille | dossier | modifié | favori):",
      ...live.slice(0, 150).map((f) => `${f.name} | ${fmtSize(f.size)} | ${fname(f.folder_id)} | ${f.updated_at.slice(0, 10)} | ${f.favorite ? "oui" : "non"}`),
    ].join("\n");
  }, [live, fl, trash, firstName, used]);

  const listFor = (): FileRow[] => {
    let l: FileRow[] = view === "corbeille" ? trash : live;
    if (view === "favoris") l = l.filter((f) => f.favorite);
    if (view === "recents") l = l.slice(0, 30);
    if (view === "fichiers" && folderFilter) l = l.filter((f) => f.folder_id === folderFilter);
    if (query) l = l.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
    return l;
  };

  const byCat = ["Documents", "Images", "Vidéos", "Autres"].map((c) => ({ c, s: live.filter((f) => category(f.mime_type) === c).reduce((a, f) => a + f.size, 0) }));
  const catColor: Record<string, string> = { Documents: "var(--sky)", Images: "var(--violet)", Vidéos: "var(--pink)", Autres: "var(--emerald)" };
  let acc = 0;
  const conic = used
    ? byCat.map(({ c, s }) => { const a = acc; acc += (s / used) * 360; return `${catColor[c]} ${a}deg ${acc}deg`; }).join(",")
    : "var(--muted) 0deg 360deg";

  const fileMenu = (f: FileRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded p-1 hover:bg-accent" aria-label="Actions"><MoreVertical className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {f.deleted_at ? (
          <>
            <DropdownMenuItem onClick={() => restoreFile(f)}><RotateCcw className="size-4" /> Restaurer</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => destroyFile(f)}><Trash2 className="size-4" /> Supprimer définitivement</DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => openFile(f)}><FolderOpen className="size-4" /> Ouvrir</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFile(f, true)}><Download className="size-4" /> Télécharger</DropdownMenuItem>
            {f.encrypted && <DropdownMenuItem onClick={() => decryptForAi(f)}>⚡ Rendre lisible par les agents</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => setPrompt({ title: "Renommer le fichier", value: f.name, onOk: (v) => renameFile(f, v) })}><Pencil className="size-4" /> Renommer</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMoveFor(f)}><FolderInput className="size-4" /> Déplacer</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleFav(f)}><Star className="size-4" /> {f.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareFor(f)}><Share2 className="size-4" /> Partager</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => trashFile(f)}><Trash2 className="size-4" /> Corbeille</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const stats = [
    { label: "Fichiers", value: live.length, delta: live.filter((f) => thisMonth(f.created_at)).length, icon: FileIcon, cls: "sk-glass" },
    { label: "Dossiers", value: fl.length, delta: fl.filter((f) => thisMonth(f.created_at)).length, icon: Folder, cls: "stat-emerald" },
    { label: "Partagés", value: shares.data?.length ?? 0, delta: (shares.data ?? []).filter((s) => thisMonth(s.created_at)).length, icon: Users, cls: "sk-glass" },
  ];
  const quick = [
    { t: "Importer des fichiers", s: "PDF, images, vidéos, docs...", image: icUpload, cls: "tile-violet", c: "text-violet", on: () => fileInput.current?.click() },
    { t: "Nouveau dossier", s: "Organiser vos fichiers", image: icFolderPlus, cls: "tile-sky", c: "text-sky", on: () => setPrompt({ title: "Nouveau dossier", value: "", onOk: createFolder }) },
    { t: "Partager un fichier", s: "Créer un lien de partage", image: icLink, cls: "tile-emerald", c: "text-emerald", on: () => setShareFor("pick") },
    { t: "Rechercher", s: "Retrouver rapidement", image: icSearch, cls: "tile-amber", c: "text-amber", on: () => { setView("fichiers"); setTimeout(() => searchRef.current?.focus(), 50); } },
  ];

  const fileCard = (f: FileRow) => (
    <article key={f.id} data-file-id={f.id} draggable={!f.deleted_at}
      onDragStart={(e) => { e.dataTransfer.setData(DRAG, f.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={() => { setDropTarget(null); setDragDepth(0); }}
      className="glass-2 min-w-0 overflow-hidden rounded-lg transition hover:border-primary">
      <Button variant="ghost" disabled={!!f.deleted_at} onClick={() => openFile(f)} aria-label={`Ouvrir ${f.name}`} className="block h-auto w-full rounded-none p-0">
        <FileThumb f={f} className="aspect-[4/3] w-full rounded-none" />
      </Button>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <p title={f.name} className="min-w-0 flex-1 truncate text-sm font-semibold">{f.name}</p>
          {f.encrypted && <Lock aria-label="Fichier chiffré" className="size-3 shrink-0 text-success" />}
          {f.favorite && <Star className="size-3 shrink-0 text-amber" fill="currentColor" />}
          {fileMenu(f)}
        </div>
        <div className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
          <span>{fmtSize(f.size)}</span><span>{new Date(f.updated_at).toLocaleDateString("fr-FR")}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{fl.find((d) => d.id === f.folder_id)?.name ?? "Racine"}</p>
      </div>
    </article>
  );

  return (
    <div className="flex h-dvh gap-4 p-4">
      <Button variant="ghost" aria-label="Ouvrir la navigation" onMouseEnter={() => setLeftOpen(true)} onFocus={() => setLeftOpen(true)} onClick={() => setLeftOpen(true)} className="edge-trigger left-0" />
      <Button variant="ghost" aria-label="Ouvrir l’assistant IA" onMouseEnter={() => setRightOpen(true)} onFocus={() => setRightOpen(true)} onClick={() => setRightOpen(true)} className="edge-trigger right-0" />
      {dragDepth > 0 && <div className="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-xl border-2 border-dashed border-primary bg-background/80"><CloudUpload className="size-20 animate-float text-primary" /></div>}
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />

      {/* Sidebar */}
      <nav aria-label="Navigation principale" aria-hidden={!leftOpen} inert={!leftOpen} onMouseLeave={() => setLeftOpen(false)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setLeftOpen(false); }} className={`slide-panel slide-panel-left ${leftOpen ? "is-open" : ""} flex flex-col rounded-r-2xl p-3`}>
        <div className="mb-4 flex items-center justify-between"><span className="font-semibold">SKY CLOUD</span><Button variant="ghost" size="icon" aria-label="Fermer la navigation" onClick={() => setLeftOpen(false)}><X /></Button></div>
        <div className="space-y-1">
          {NAV.map((n) => (
            <Button variant="ghost" key={n.id} {...(n.id === "fichiers" ? dropZone(null, "nav-root") : {})} onClick={() => { setView(n.id); setFolderFilter(null); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${view === n.id ? "nav-active" : "border border-transparent hover:bg-accent"}`}>
              <n.icon className="size-4" /> {n.label}
            </Button>
          ))}
        </div>
        <div className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {fl.map((d) => <Button variant="ghost" key={d.id} {...dropZone(d.id, `nav-${d.id}`)} onClick={() => { setFolderFilter(d.id); setView("fichiers"); }} className={`h-auto w-full justify-start px-3 py-2 ${ring(`nav-${d.id}`)}`}><FolderIcon color={d.color} className="size-7 shrink-0" /><span className="truncate">{d.name}</span></Button>)}
        </div>
        <Button variant="ghost" onClick={() => setSecOpen(true)} className="mb-2 w-full justify-start"><Shield className="size-4" /> Sécurité</Button>
        <div className="relative mt-auto overflow-hidden rounded-xl glass-2 p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full btn-glow"><Check className="size-4 text-primary-foreground" /></span>
            <div className="text-sm"><p className="font-semibold">Synchronisation</p><p className="text-xs text-muted-foreground">{uploading ? `Import (${uploading})…` : "À jour"}</p></div>
          </div>
          <svg viewBox="0 0 400 40" className="pointer-events-none absolute -bottom-1 left-0 h-8 w-[200%] animate-wave text-primary opacity-50" preserveAspectRatio="none">
            <path d="M0 20 Q50 0 100 20 T200 20 T300 20 T400 20" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <Button variant="ghost" onClick={() => supabase.auth.signOut().then(() => nav({ to: "/sky/auth" }))} className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
          <LogOut className="size-4" /> Déconnexion
        </Button>
      </nav>

      {/* Main */}
      <main className="min-w-0 flex-1 overflow-y-auto pr-1">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Bienvenue, {firstName}</h1>
            <p className="text-sm text-muted-foreground">Voici un aperçu de votre espace de stockage</p>
          </div>
          <div className="glass-2 flex items-center gap-2 rounded-xl px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input ref={searchRef} value={query} onChange={(e) => { setQuery(e.target.value); if (view === "accueil") setView("fichiers"); }} placeholder="Rechercher un fichier…" className="w-48 bg-transparent text-sm outline-none" />
          </div>
        </header>

        {view === "accueil" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <div className="stat-primary animate-rise rounded-2xl p-4">
                <p className="text-sm">Espace utilisé</p>
                <p className="mt-1 text-3xl font-semibold">{fmtSize(used)} <span className="text-xs text-muted-foreground">/ Illimité</span></p>
                <div className="mt-3 h-2 rounded-full bg-muted"><div className="bar-gradient h-2 rounded-full" style={{ width: `${Math.min(100, 8 + Math.log10(used + 1) * 8)}%` }} /></div>
              </div>
              {stats.map((s, i) => (
                <div key={s.label} className={`${s.cls} animate-rise flex items-center justify-between rounded-2xl p-4`} style={{ animationDelay: `${(i + 1) * 80}ms` }}>
                  <div><p className="text-sm">{s.label}</p><p className="mt-1 text-3xl font-semibold">{s.value}</p><p className="text-xs text-muted-foreground">+{s.delta} ce mois-ci</p></div>
                  <span className="glass-2 grid size-10 place-items-center rounded-xl"><s.icon className="size-5" /></span>
                </div>
              ))}
            </div>

            <section className="sk-glass rounded-2xl p-4">
              <h2 className="mb-3 font-semibold">Actions rapides</h2>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {quick.map((q) => (
                  <Button variant="ghost" key={q.t} onClick={q.on} className={`${q.cls} group relative block h-auto whitespace-normal rounded-xl p-4 text-left transition hover:-translate-y-1`}>
                    <Plus className="absolute right-3 top-3 size-4 opacity-70" />
                    <img src={q.image} alt="" width={64} height={64} className="size-14 object-contain transition group-hover:scale-110" />
                    <p className="mt-3 font-semibold">{q.t}</p>
                    <p className="text-xs text-muted-foreground">{q.s}</p>
                  </Button>
                ))}
              </div>
            </section>

            <section className="sk-glass rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Dossiers</h2>
                <Button variant="ghost" onClick={() => setView("dossiers")} className="text-sm text-primary">Tout voir</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {fl.slice(0, 4).map((d) => (
                  <Button variant="ghost" key={d.id} data-folder-id={d.id} {...dropZone(d.id, d.id)} onClick={() => { setFolderFilter(d.id); setView("fichiers"); }} className={`glass-2 h-auto justify-start flex items-center gap-3 rounded-xl p-3 text-left transition hover:bg-accent ${ring(d.id)}`}>
                    <FolderIcon color={d.color} className="h-12 w-14 shrink-0" />
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{d.name}</p><p className="text-xs text-muted-foreground">{live.filter((f) => f.folder_id === d.id).length} fichiers</p></div>
                  </Button>
                ))}
                {fl.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Aucun dossier. Créez-en un avec « Nouveau dossier ».</p>}
              </div>
            </section>

            <section className="sk-glass rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Fichiers récents</h2><Button variant="link" onClick={() => setView("fichiers")}>Tout voir</Button></div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{live.slice(0, 5).map(fileCard)}</div>
              {!live.length && <p className="text-sm text-muted-foreground">Aucun fichier.</p>}
            </section>
            <div className="grid gap-4 xl:grid-cols-3">
              <section className="sk-glass rounded-2xl p-4">
                <h2 className="mb-3 font-semibold">Activité récente</h2>
                <div className="space-y-3">
                  {(activities.data ?? []).map((a) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className="glass-2 grid size-8 place-items-center rounded-lg"><FileText className="size-4 text-sky" /></span>
                      <div className="min-w-0"><p className="truncate text-xs font-semibold">{a.file_name}</p><p className="text-xs text-muted-foreground">{actionLabel[a.action] ?? a.action}</p></div>
                    </div>
                  ))}
                  {!activities.data?.length && <p className="text-sm text-muted-foreground">Aucune activité.</p>}
                </div>
              </section>
              <section className="sk-glass rounded-2xl p-4">
                <h2 className="mb-3 font-semibold">Stockage</h2>
                <div className="flex items-center gap-4">
                  <div className="relative size-28 shrink-0 [perspective:400px]">
                    <div className="size-full animate-spin-slow rounded-full [transform:rotateX(55deg)]" style={{ background: `conic-gradient(${conic})`, boxShadow: "0 0 30px -5px var(--violet)" }}>
                      <div className="absolute inset-[28%] rounded-full bg-background" />
                    </div>
                  </div>
                  <ul className="flex-1 space-y-2 text-xs">
                    {byCat.map(({ c, s }) => (
                      <li key={c} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: catColor[c] }} /><span className="flex-1">{c}</span><span className="text-muted-foreground">{fmtSize(s)}</span></li>
                    ))}
                  </ul>
                </div>
                <Button variant="ghost" onClick={() => setView("fichiers")} className="glass-2 mx-auto mt-4 block rounded-lg px-3 py-1.5 text-xs">Gérer mon stockage</Button>
              </section>
              <section className="sk-glass rounded-2xl p-4">
                <h2 className="mb-3 font-semibold">Sécurité & Protection</h2>
                <div className="flex items-center gap-3">
                  <Shield className="size-16 shrink-0 animate-float text-violet" />
                  <ul className="flex-1 space-y-2 text-xs">
                    {[{ label: "Authentification 2FA", active: mfa.verified }, { label: "Chiffrement de bout en bout", active: encryptionOn }, { label: "Comptes privés", active: true }, { label: "Contrôle d’accès", active: true }].map((s) => (
                      <li key={s.label} className="flex items-center gap-2"><Check className={`size-3 shrink-0 ${s.active ? "text-success" : "text-muted-foreground"}`} /><span className="flex-1">{s.label}</span><span className={s.active ? "text-success" : "text-muted-foreground"}>{s.active ? "Actif" : "Désactivé"}</span></li>
                    ))}
                  </ul>
                </div>
                <Button variant="ghost" onClick={() => setSecOpen(true)} className="glass-2 mt-4 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs">Voir les paramètres de sécurité <ChevronRight className="size-4" /></Button>
              </section>
            </div>
          </div>
        ) : view === "dossiers" ? (
          <section className="sk-glass rounded-2xl p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Dossiers</h2>
              <Button variant="ghost" onClick={() => setPrompt({ title: "Nouveau dossier", value: "", onOk: createFolder })} className="btn-glow flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-primary-foreground"><FolderPlus className="size-4" /> Nouveau</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {fl.map((d) => (
                <div key={d.id} data-folder-id={d.id} {...dropZone(d.id, d.id)} className={`glass-2 flex items-center gap-3 rounded-xl p-3 transition ${ring(d.id)}`}>
                  <Button variant="ghost" onClick={() => { setFolderFilter(d.id); setView("fichiers"); }} className="h-auto justify-start flex min-w-0 flex-1 items-center gap-3 p-0 text-left">
                    <FolderIcon color={d.color} className="h-12 w-14 shrink-0" />
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{d.name}</p><p className="text-xs text-muted-foreground">{live.filter((f) => f.folder_id === d.id).length} fichiers · {aiFolders.includes(d.id) ? "⚡ Agents & IA" : "🔒 Chiffré"}</p></div>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded p-1 hover:bg-accent" aria-label="Actions"><MoreVertical className="size-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPrompt({ title: "Renommer le dossier", value: d.name, onOk: (v) => renameFolder(d, v) })}><Pencil className="size-4" /> Renommer</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleAiFolder(d.id)}>{aiFolders.includes(d.id) ? "🔒 Activer le chiffrement" : "⚡ Rendre compatible Agents & IA"}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteFolder(d)}><Trash2 className="size-4" /> Supprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              {fl.length === 0 && <p className="text-sm text-muted-foreground">Aucun dossier.</p>}
            </div>
          </section>
        ) : view === "journal" ? (
          <AssistantJournal />
        ) : view === "partages" ? (
          <SharesView shares={shares.data ?? []} files={all} onRevoke={async (id) => { await supabase.from("shares").delete().eq("id", id); refresh(); }} />
        ) : (
          <section className="sk-glass rounded-2xl p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                {NAV.find((n) => n.id === view)?.label}
                {folderFilter && ` · ${fl.find((d) => d.id === folderFilter)?.name ?? ""}`}
                {query && ` · « ${query} »`}
              </h2>
              <div className="flex gap-2">
                {(folderFilter || query) && <Button variant="ghost" onClick={() => { setFolderFilter(null); setQuery(""); }} className="glass-2 rounded-lg px-3 py-1.5 text-xs">Réinitialiser</Button>}
                {view !== "corbeille" && <Button variant="ghost" onClick={() => fileInput.current?.click()} className="btn-glow flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-primary-foreground"><CloudUpload className="size-4" /> Importer</Button>}
              </div>
            </div>
            {view !== "corbeille" && <div className="mb-4 flex flex-wrap gap-2">
              <Button variant="outline" {...dropZone(null, "root")} onClick={() => setFolderFilter(null)} className={ring("root")}><FolderOpen /> Racine</Button>
              {fl.map((d) => <Button variant="outline" key={d.id} data-folder-id={d.id} {...dropZone(d.id, d.id)} onClick={() => setFolderFilter(d.id)} className={ring(d.id)}><FolderIcon color={d.color} className="size-6" /><span className="max-w-40 truncate">{d.name}</span></Button>)}
            </div>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{listFor().map(fileCard)}</div>
            {listFor().length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucun fichier ici.</p>}
          </section>
        )}
      </main>

      <div aria-label="Panneau assistant IA" aria-hidden={!rightOpen} inert={!rightOpen} className={`slide-panel slide-panel-right ${rightOpen ? "is-open" : ""}`} >
        <Button variant="ghost" size="icon" aria-label="Fermer l’assistant IA" onClick={() => setRightOpen(false)} className="absolute right-3 top-3 z-10"><X /></Button>
        <Assistant firstName={firstName} context={context} onAction={runAction} />
      </div>

      <Dialog open={!!prompt} onOpenChange={(o) => !o && setPrompt(null)}>
        <DialogContent className="sk-glass">
          <DialogHeader><DialogTitle>{prompt?.title}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); prompt?.onOk(prompt.value); setPrompt(null); }} className="flex gap-2">
            <input autoFocus value={prompt?.value ?? ""} onChange={(e) => prompt && setPrompt({ ...prompt, value: e.target.value })} className="glass-2 flex-1 rounded-lg px-3 py-2 outline-none" />
            <Button type="submit" variant="ghost" className="btn-glow rounded-lg px-4 text-sm text-primary-foreground">Valider</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveFor} onOpenChange={(o) => !o && setMoveFor(null)}>
        <DialogContent className="sk-glass">
          <DialogHeader><DialogTitle>Déplacer « {moveFor?.name} »</DialogTitle></DialogHeader>
          <div className="space-y-1">
            {[{ id: null as string | null, name: "Racine" }, ...fl].map((d) => (
              <Button variant="ghost" key={d.id ?? "root"} onClick={() => { if (moveFor) moveFile(moveFor, d.id); setMoveFor(null); }} className="glass-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"><Folder className="size-4" /> {d.name}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ShareDialog target={shareFor} files={live} onClose={() => setShareFor(null)} onCreate={createShare} />

      <SecurityDialog open={secOpen} onOpenChange={(open) => { setSecOpen(open); setEncryptionOn(e2eEnabled()); mfa.reload(); }} email={user.data?.email} onSignOut={() => supabase.auth.signOut().then(() => nav({ to: "/sky/auth" }))} onUnlock={() => setUnlockOpen(true)} />
      {uid && <UnlockDialog open={unlockOpen} userId={uid} onDone={(ok) => { setUnlockOpen(false); unlockWait.current?.(ok); unlockWait.current = null; force((n) => n + 1); setEncryptionOn(e2eEnabled()); }} />}
    </div>
  );
}

function ShareDialog({ target, files, onClose, onCreate }: {
  target: FileRow | "pick" | null;
  files: FileRow[];
  onClose: () => void;
  onCreate: (f: FileRow, p: string, days: number | null) => Promise<string | undefined>;
}) {
  const [fileId, setFileId] = useState("");
  const [perm, setPerm] = useState("view");
  const [days, setDays] = useState("0");
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(""); setFileId(target && target !== "pick" ? target.id : files[0]?.id ?? ""); }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = files.find((x) => x.id === fileId);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sk-glass">
        <DialogHeader><DialogTitle>Partager un fichier</DialogTitle></DialogHeader>
        {files.length === 0 ? <p className="text-sm text-muted-foreground">Importez d'abord un fichier.</p> : (
          <div className="space-y-3 text-sm">
            <select value={fileId} onChange={(e) => setFileId(e.target.value)} className="glass-2 w-full rounded-lg px-3 py-2">
              {files.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={perm} onChange={(e) => setPerm(e.target.value)} className="glass-2 flex-1 rounded-lg px-3 py-2">
                <option value="view">Consultation (copie possible)</option><option value="download">Téléchargement</option>
              </select>
              <select value={days} onChange={(e) => setDays(e.target.value)} className="glass-2 flex-1 rounded-lg px-3 py-2">
                <option value="0">Sans expiration</option><option value="1">Expire dans 1 jour</option><option value="7">Expire dans 7 jours</option><option value="30">Expire dans 30 jours</option>
              </select>
            </div>
            {url ? (
              <div className="glass-2 flex items-center gap-2 rounded-lg px-3 py-2"><span className="flex-1 truncate">{url}</span><Button variant="ghost" onClick={() => navigator.clipboard.writeText(url)} aria-label="Copier"><Copy className="size-4" /></Button></div>
            ) : (
              <Button variant="ghost" disabled={!f} onClick={async () => f && setUrl((await onCreate(f, perm, Number(days) || null)) ?? "")} className="btn-glow w-full rounded-lg py-2 text-primary-foreground">Créer le lien</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SharesView({ shares, files, onRevoke }: { shares: ShareRow[]; files: FileRow[]; onRevoke: (id: string) => void }) {
  return (
    <section className="sk-glass rounded-2xl p-4">
      <h2 className="mb-4 font-semibold">Liens de partage</h2>
      <div className="divide-y divide-border">
        {shares.map((s) => {
          const url = typeof window !== "undefined" ? `${window.location.origin}/s/${s.token}` : "";
          const expired = s.expires_at && new Date(s.expires_at) < new Date();
          return (
            <div key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
              <Link2 className="size-4 text-emerald" />
              <span className="min-w-0 flex-1 truncate">{files.find((f) => f.id === s.file_id)?.name ?? "Fichier"}</span>
              <span className="text-xs text-muted-foreground">{s.permission === "download" ? "Téléchargement" : "Lecture"}</span>
              <span className={`hidden text-xs sm:block ${expired ? "text-destructive" : "text-muted-foreground"}`}>{s.expires_at ? (expired ? "Expiré" : `Jusqu'au ${new Date(s.expires_at).toLocaleDateString("fr-FR")}`) : "Permanent"}</span>
              <Button variant="ghost" onClick={() => { navigator.clipboard.writeText(url); toast.success("Lien copié"); }} aria-label="Copier" className="rounded p-1 hover:bg-accent"><Copy className="size-4" /></Button>
              <Button variant="ghost" onClick={() => onRevoke(s.id)} aria-label="Révoquer" className="rounded p-1 text-destructive hover:bg-accent"><Trash2 className="size-4" /></Button>
            </div>
          );
        })}
        {shares.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucun lien de partage.</p>}
      </div>
    </section>
  );
}
