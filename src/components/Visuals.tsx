import { useEffect, useState } from "react";
import { FileText, FileVideo, Lock, Music, File as FileIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { decryptBlob, hasKey } from "@/lib/e2e";
import type { Tables } from "@/integrations/supabase/types";

/** Glossy 3D folder, tinted with a theme color token (sky, emerald, amber, pink, violet). */
export function FolderIcon({ color = "sky", className = "size-12" }: { color?: string; className?: string }) {
  const c = `var(--${color})`;
  const id = `f-${color}`;
  return (
    <svg viewBox="0 0 64 52" className={`folder-visual ${className}`} style={{ filter: `drop-shadow(0 6px 10px color-mix(in oklab, ${c} 55%, transparent))` }}>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`color-mix(in oklab, ${c} 75%, black)`} />
          <stop offset="1" stopColor={`color-mix(in oklab, ${c} 50%, black)`} />
        </linearGradient>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={`color-mix(in oklab, ${c} 70%, white)`} />
          <stop offset="0.45" stopColor={c} />
          <stop offset="1" stopColor={`color-mix(in oklab, ${c} 70%, black)`} />
        </linearGradient>
      </defs>
      <path d="M4 8a5 5 0 0 1 5-5h14l6 6h26a5 5 0 0 1 5 5v30a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill={`url(#${id}-b)`} />
      <rect x="9" y="12" width="46" height="20" rx="2" fill="oklch(0.97 0 0 / 0.85)" />
      <path d="M2 20a5 5 0 0 1 5-5h50a5 5 0 0 1 5 5l-2 24a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill={`url(#${id}-f)`} />
      <path d="M7 17h50a4 4 0 0 1 4 3" stroke="oklch(1 0 0 / 0.6)" strokeWidth="1.2" fill="none" />
      <ellipse cx="22" cy="24" rx="14" ry="3" fill="oklch(1 0 0 / 0.18)" />
    </svg>
  );
}

const cache = new Map<string, string>();

/** Shows a real preview of the file content (image, video, text) instead of a generic icon. */
export function FileThumb({ f, className = "" }: { f: Tables<"files">; className?: string }) {
  const [url, setUrl] = useState<string | null>(cache.get(f.id) ?? null);
  const [text, setText] = useState<string | null>(null);
  const isImg = f.mime_type.startsWith("image/");
  const isVid = f.mime_type.startsWith("video/");
  const isTxt = f.mime_type.startsWith("text/") || /json|csv|xml|markdown/.test(f.mime_type);
  const locked = f.encrypted && !hasKey();

  useEffect(() => {
    let off = false;
    (async () => {
      if (locked || url) return;
      if (f.encrypted) {
        if (!(isImg || isTxt) || f.size > 15_000_000) return;
        const { data } = await supabase.storage.from("files").download(f.storage_path);
        if (!data || off) return;
        const b = await decryptBlob(data, f.mime_type).catch(() => null);
        if (!b || off) return;
        if (isTxt) return setText((await b.text()).slice(0, 400));
        const u = URL.createObjectURL(b); cache.set(f.id, u); setUrl(u);
        return;
      }
      if (isTxt && f.size < 200_000) {
        const { data } = await supabase.storage.from("files").download(f.storage_path);
        if (data && !off) setText((await data.text()).slice(0, 400));
        return;
      }
      if (isImg || isVid || f.mime_type.includes("pdf")) {
        const { data } = await supabase.storage.from("files").createSignedUrl(f.storage_path, 3600);
        if (data && !off) { cache.set(f.id, data.signedUrl); setUrl(data.signedUrl); }
      }
    })();
    return () => { off = true; };
  }, [f.id, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = `relative overflow-hidden rounded-lg bg-muted ${className}`;
  if (locked) return <div className={`${base} grid place-items-center`}><Lock className="size-6 text-primary" /></div>;
  if (url && isImg) return <div className={base}><img src={url} alt={f.name} loading="lazy" className="size-full object-cover" /></div>;
  if (url && isVid) return <div className={base}><video src={`${url}#t=1`} muted preload="metadata" className="size-full object-cover" /><FileVideo className="absolute bottom-1 right-1 size-4 text-foreground" /></div>;
  if (url && f.mime_type.includes("pdf")) return <div className={`${base} bg-foreground`}><iframe title={f.name} src={`${url}#toolbar=0&view=FitH`} className="pointer-events-none h-[300%] w-[300%] origin-top-left scale-[0.334]" loading="lazy" /></div>;
  if (text !== null) return <div className={`${base} p-2`}><pre className="whitespace-pre-wrap text-[8px] leading-tight text-muted-foreground">{text}</pre></div>;
  const I = f.mime_type.startsWith("audio/") ? Music : f.mime_type.includes("pdf") || f.mime_type.includes("word") ? FileText : FileIcon;
  return <div className={`${base} grid place-items-center`}><I className="size-7 text-violet" /></div>;
}
