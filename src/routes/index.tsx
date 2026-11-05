import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { AudioLines, Square, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuraTaskPanel, type BoardItem } from "@/components/aura-task-panel";
import { supabase } from "@/integrations/supabase/client";
import { askAssistant, assistantSpeech, transcribeAudio } from "@/lib/assistant.functions";
import bgUrl from "@/assets/interface.jpg";
import { AuraMotion } from "@/components/aura-motion";
import { AuraAttachments } from "@/components/aura-attachments";
import type { AuraAttachment } from "@/lib/aura-attachments";
const bg = { url: bgUrl };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({ voice: search["voice"] === true || search["voice"] === "true" }),
  head: () => ({
    meta: [
      { title: "Aura — Votre assistant vocal Odoo" },
      { name: "description", content: "Parlez à Aura : e-mails, relances, rendez-vous, CRM, ventes et achats exécutés dans Odoo." },
      { property: "og:title", content: "Aura — Votre assistant vocal Odoo" },
      { property: "og:description", content: "Un assistant vocal qui agit réellement dans votre Odoo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { voice } = Route.useSearch();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <main className={`aura-bg relative h-screen w-full overflow-hidden text-foreground ${voice ? "aura-voice-surface" : ""}`} style={voice ? undefined : { backgroundImage: `url(${bg.url})` }}>
      {session === undefined ? null : session ? <Assistant userId={session.user.id} compact={voice} /> : <AuthCard />}
    </main>
  );
}

function AuthCard() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } =
      mode === "up"
        ? await supabase.auth.signUp({ email, password: pw })
        : await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  };
  return (
    <div className="absolute inset-0 flex items-end justify-center pb-10 sm:items-center sm:justify-end sm:pb-0 sm:pr-16">
      <form onSubmit={submit} className="aura-glass w-[min(92vw,360px)] space-y-3 rounded-3xl p-7">
        <h1 className="text-2xl font-light tracking-wide">Aura</h1>
        <p className="text-sm text-muted-foreground">{mode === "up" ? "Créez votre compte pour rencontrer votre assistant." : "Bon retour."}</p>
        <input className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" type="password" required minLength={6} placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="text-xs text-destructive-foreground">{err}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
          {busy ? "…" : mode === "up" ? "Créer mon compte" : "Se connecter"}
        </button>
        <button type="button" onClick={() => setMode(mode === "up" ? "in" : "up")} className="w-full text-xs text-muted-foreground hover:text-foreground">
          {mode === "up" ? "Déjà un compte ? Se connecter" : "Pas de compte ? Créer un compte"}
        </button>
      </form>
    </div>
  );
}

type State = "idle" | "listening" | "thinking" | "speaking";

function Assistant({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const [state, setState] = useState<State>("idle");
  const [caption, setCaption] = useState("");
  const [board, setBoard] = useState<BoardItem[] | null>(null);
  const navigate = useNavigate();
  const lab = false;
  const [files, setFiles] = useState<AuraAttachment[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcribe = useServerFn(transcribeAudio);
  const ask = useServerFn(askAssistant);
  const speech = useServerFn(assistantSpeech);
  const requestRef = useRef(0);

  useEffect(() => {
    // Realtime sync: latest assistant message (e.g. from another device) updates the board.
    const ch = supabase
      .channel("msgs-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${userId}` }, (p) => {
        const m = p.new as { role: string; board: BoardItem[] | null };
        if (m.role === "assistant" && m.board?.length) setBoard(m.board);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  useEffect(() => {
    if (compact) return;
    const blocked = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest("button, input, form, aside, section, a");
    const go = () => void navigate({ to: "/dashboard" });
    const dbl = (e: MouseEvent) => { if (!blocked(e.target)) go(); };
    let last = 0;
    const tap = (e: TouchEvent) => {
      if (blocked(e.target)) return;
      const now = Date.now();
      if (now - last < 300) { last = 0; go(); } else last = now;
    };
    document.addEventListener("dblclick", dbl); document.addEventListener("touchend", tap);
    return () => { document.removeEventListener("dblclick", dbl); document.removeEventListener("touchend", tap); };
  }, [compact, navigate]);

  const handle = async (text: string) => {
    const request = ++requestRef.current;
    const sent = files;
    setCaption("« " + text + " »" + (sent.length ? ` · ${sent.length} fichier(s)` : ""));
    setState("thinking");
    setBoard([{ kind: "step", text: sent.length ? "Je lis vos fichiers…" : "J'analyse votre demande…" }]);
    try {
      const r = await ask({ data: { text, attachments: sent } });
      setFiles([]);
      setBoard(r.board.length ? r.board : [{ kind: "result", title: "Réponse", lines: [r.reply] }]);
      setCaption(r.reply);
      if (r.open && r.open !== "close") void navigate({ to: r.open as string });
      setState("idle");
      const { audio } = await speech({ data: { text: r.reply } }).catch(() => ({ audio: null }));
      if (request !== requestRef.current) return;
      const done = () => { setState("idle"); if (request === requestRef.current) setCaption(""); };
      if (audio) {
        const a = new Audio(`data:audio/wav;base64,${audio}`);
        audioRef.current = a;
        setState("speaking");
        a.onended = done;
        await a.play().catch(done);
      } else setTimeout(done, 6000);
    } catch (e) {
      setCaption((e as Error).message);
      setState("idle");
    }
  };

  const toggle = async () => {
    if (state === "speaking") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }
    if (state === "thinking") return;
    if (state === "listening") {
      recRef.current?.stop();
      return;
    }
    requestRef.current += 1;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType });
        if (blob.size < 2000) {
          setState("idle");
          setCaption("Je n'ai rien entendu.");
          return;
        }
        setState("thinking");
        setCaption("Transcription…");
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = "";
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        try {
          const { text } = await transcribe({ data: { audio: btoa(s), mime: rec.mimeType } });
          if (!text) {
            setState("idle");
            setCaption("Je n'ai pas compris, réessayez.");
          } else await handle(text);
        } catch (e) {
          setCaption((e as Error).message);
          setState("idle");
        }
      };
      recRef.current = rec;
      rec.start();
      setState("listening");
      setCaption("Je vous écoute… touchez à nouveau pour envoyer");
    } catch {
      setCaption("Autorisez le micro pour parler à Aura.");
    }
  };

  return (
    <>
      {!lab && !compact && <AuraMotion state={state} />}
      <Button variant="ghost" aria-label="Parler à l'assistant" data-state={state} data-lab={lab || compact ? "1" : undefined} data-dot={lab && !compact ? "1" : undefined} onClick={toggle} className={`aura-orb z-40 cursor-pointer outline-none ${lab || compact ? "aura-floating" : ""}`}>
        {compact && !lab && (state === 'thinking' ? <LoaderCircle className="animate-spin"/> : state === 'listening' || state === 'speaking' ? <Square/> : <AudioLines/>)}
      </Button>
      <AuraAttachments files={files} onChange={setFiles} busy={state === "thinking"} floating />
      {caption && <p className={`aura-caption ${lab || compact ? "aura-caption-floating" : ""}`} role="status">{caption}</p>}
      {board && <AuraTaskPanel items={board} onClose={() => setBoard(null)} />}
    </>
  );
}
