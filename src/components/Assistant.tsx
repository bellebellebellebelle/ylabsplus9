import { useEffect, useRef, useState } from "react";
import { ChevronRight, Clock, FileText, FolderTree, Loader2, Mic, Send, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant, speakText, transcribeAudio, type AssistantAction } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { Volume2, VolumeX } from "lucide-react";

export type ActionResult = {
  ok: boolean;
  detail: string;
  content?: { prompt: string; attachment?: { name: string; mime: string; base64: string } };
};

export async function toBase64(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
import mascot from "@/assets/mascot.jpg";

type Msg = { role: "user" | "assistant"; content: string; sources?: string[]; status?: boolean; hidden?: boolean };

const SUGGESTIONS = [
  { icon: Clock, label: "Trouver mes fichiers récents" },
  { icon: FileText, label: "Résumer un document" },
  { icon: FolderTree, label: "Organiser mes dossiers" },
  { icon: Trash2, label: "Libérer de l'espace" },
];

export function Assistant({
  firstName,
  context,
  onAction,
}: {
  firstName: string;
  context: string;
  onAction: (a: AssistantAction) => Promise<ActionResult>;
}) {
  const ask = useServerFn(askAssistant);
  const transcribe = useServerFn(transcribeAudio);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, busy]);

  const speakFn = useServerFn(speakText);
  const [voice, setVoice] = useState(true);
  async function speak(text: string) {
    if (!voice || !text.trim()) return;
    try {
      const { audio, mime } = await speakFn({ data: { text } });
      await new Audio(`data:${mime};base64,${audio}`).play();
    } catch (e) {
      toast.error(`Voix indisponible : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }
  const strip = (h: Msg[]) => h.map((m) => ({ role: m.role, content: m.content }));
  const logIt = (row: { request: string; action_type: string; target?: string | null; value?: string | null; status: string; detail: string; reply: string; sources: string[] }) =>
    supabase.from("assistant_logs").insert(row).then(({ error }) => error && toast.error(`Journal : ${error.message}`));

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    let history: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(history);
    setInput("");
    setBusy(true);
    let spoken = "";
    try {
      const res = await ask({ data: { messages: strip(history), context } });
      history = [...history, { role: "assistant", content: res.reply, sources: res.sources }];
      setMessages(history);
      spoken = res.reply;
      if (res.action.type === "none") {
        await logIt({ request: t, action_type: "réponse", status: "info", detail: "", reply: res.reply, sources: res.sources ?? [] });
      } else {
        let r: ActionResult;
        try { r = await onAction(res.action); } catch (e) { r = { ok: false, detail: `Erreur inattendue : ${e instanceof Error ? e.message : String(e)}` }; }
        const line = `${r.ok ? "✅ Réussite" : "❌ Échec"} : ${r.detail}`;
        history = [...history, { role: "assistant", content: `[Résultat vérifié] ${line}`, status: r.ok }];
        setMessages(history);
        spoken = r.ok ? `C'est fait. ${r.detail}` : `L'action a échoué. ${r.detail}`;
        await logIt({ request: t, action_type: res.action.type, target: res.action.target, value: res.action.value, status: r.ok ? "success" : "failure", detail: r.detail, reply: res.reply, sources: res.sources ?? [] });
        if (r.ok && r.content) {
          const h2: Msg[] = [...history, { role: "user", content: r.content.prompt, hidden: true }];
          const res2 = await ask({ data: { messages: strip(h2), context, attachment: r.content.attachment ?? null } });
          history = [...h2, { role: "assistant", content: res2.reply, sources: res2.sources }];
          setMessages(history);
          spoken = res2.reply;
          await logIt({ request: t, action_type: "analyse_fichier", target: res.action.target, status: "info", detail: "Réponse basée sur le contenu du fichier", reply: res2.reply, sources: res2.sources ?? [] });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur de l'assistant";
      history = [...history, { role: "assistant", content: `[Résultat vérifié] ❌ Échec : ${msg}`, status: false }];
      setMessages(history);
      spoken = `Une erreur est survenue. ${msg}`;
      await logIt({ request: t, action_type: "erreur", status: "failure", detail: msg, reply: "", sources: [] });
    } finally {
      setBusy(false);
    }
    void speak(spoken);
  }

  async function toggleMic() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1000) return;
        setBusy(true);
        try {
          const buf = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          const { text } = await transcribe({ data: { audio: btoa(bin), mime: blob.type } });
          setBusy(false);
          if (text.trim()) await send(text);
        } catch (e) {
          setBusy(false);
          toast.error(e instanceof Error ? e.message : "Transcription impossible");
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      setTimeout(() => rec.state === "recording" && rec.stop(), 60000);
    } catch {
      toast.error("Accès au micro refusé");
    }
  }

  return (
    <aside className="sk-glass flex h-full flex-col rounded-2xl p-5">
      <div className="flex items-center gap-2 pr-10">
        <h2 className="text-sm font-semibold">Assistant IA</h2>
        <button type="button" onClick={() => setVoice((v) => !v)} aria-label={voice ? "Couper la voix" : "Activer la voix"} className="grid size-7 place-items-center rounded-full bg-accent">
          {voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <>
            <p className="text-base font-semibold">Bonjour {firstName} !</p>
            <p className="text-sm text-muted-foreground">Je suis votre assistant IA.<br />Comment puis-je vous aider aujourd'hui ?</p>
            <div className="relative mx-auto my-4 w-full max-w-[260px]">
              <div className="absolute inset-x-6 bottom-2 h-10 rounded-full bg-sky/40 blur-2xl" />
              <img src={mascot} alt="Assistant" width={768} height={896} className="relative animate-float rounded-2xl" />
            </div>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button key={s.label} onClick={() => send(s.label)} className="glass-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition hover:bg-accent">
                  <s.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{s.label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {messages.filter((m) => !m.hidden).map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-6 rounded-xl btn-glow px-3 py-2 text-sm text-primary-foreground" : m.status !== undefined ? `glass-2 rounded-lg px-3 py-2 text-xs ${m.status ? "text-success" : "text-destructive"}` : "text-sm leading-relaxed whitespace-pre-wrap"}>
                {m.content.replace("[Résultat vérifié] ", "")}
                {m.sources && m.sources.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Sources : {m.sources.join(", ")}</p>}
              </div>
            ))}
            {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <div ref={endRef} />
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="glass-2 mt-4 flex items-center gap-2 rounded-xl p-2 pl-3"
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Posez-moi une question..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        <button type="button" onClick={toggleMic} aria-label="Commande vocale" className={`relative grid size-9 place-items-center rounded-full ${recording ? "bg-destructive" : "bg-accent"}`}>
          {recording && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-destructive" />}
          {recording ? <Square className="relative size-4" /> : <Mic className="size-4" />}
        </button>
        <button disabled={busy} aria-label="Envoyer" className="btn-glow grid size-9 place-items-center rounded-full text-primary-foreground disabled:opacity-60">
          <Send className="size-4" />
        </button>
      </form>
    </aside>
  );
}
