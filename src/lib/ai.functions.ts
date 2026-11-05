import { createServerFn } from "@tanstack/react-start";
import { requireSecureAuth } from "@/lib/security-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev";

type Msg = { role: "user" | "assistant"; content: string };
type Attachment = { name: string; mime: string; base64: string };

export type AssistantAction = {
  type:
    | "none"
    | "search"
    | "create_folder"
    | "navigate"
    | "delete_file"
    | "rename_file"
    | "favorite_file"
    | "share_file"
    | "move_file"
    | "read_file";
  target: string | null;
  value: string | null;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "sources", "action"],
  properties: {
    reply: { type: "string" },
    sources: { type: "array", items: { type: "string" } },
    action: {
      type: "object",
      additionalProperties: false,
      required: ["type", "target", "value"],
      properties: {
        type: {
          type: "string",
          enum: [
            "none",
            "search",
            "create_folder",
            "navigate",
            "delete_file",
            "rename_file",
            "favorite_file",
            "share_file",
            "move_file",
            "read_file",
          ],
        },
        target: { type: ["string", "null"] },
        value: { type: ["string", "null"] },
      },
    },
  },
};

const SYSTEM = `Tu es l'assistant IA de SKY CLOUD, un espace de stockage intelligent. Réponds en français, brièvement (1-3 phrases).
Tu peux déclencher UNE action par réponse via "action":
- search: target=texte à rechercher
- create_folder: value=nom du dossier
- navigate: value parmi accueil|fichiers|dossiers|partages|recents|favoris|corbeille|journal
- delete_file: target=nom du fichier (envoi à la corbeille)
- rename_file: target=nom actuel, value=nouveau nom
- favorite_file: target=nom du fichier
- share_file: target=nom du fichier, value=view|download
- move_file: target=nom du fichier, value=nom du dossier
- read_file: target=nom du fichier, value=ce que l'utilisateur veut savoir (résumé, recherche d'info...). Fonctionne pour textes, PDF, images et audio. Utilise-le dès qu'il faut connaître le CONTENU d'un fichier.
- none: simple réponse
RÈGLES D'HONNÊTETÉ (obligatoires):
- Quand tu déclenches une action, "reply" annonce seulement ce que tu vas faire ("Je déplace…"). Ne dis JAMAIS qu'elle est faite : l'application vérifie et annonce elle-même le résultat réel.
- Les messages "[Résultat vérifié]" dans l'historique sont la vérité : si une action a échoué, ne prétends jamais le contraire.
- N'invente rien. Si tu ne sais pas ou si l'info n'est pas dans le contexte ni dans le fichier fourni, dis-le.
SOURCES: dans "sources", liste toujours les noms exacts des fichiers/dossiers sur lesquels repose ta réponse, ou "Contexte de l'espace (liste des fichiers)" si tu t'appuies sur la liste. Tableau vide seulement pour une simple salutation.
Utilise les noms exacts présents dans le contexte. Si on te fournit le contenu d'un fichier, réponds à partir de lui avec action none et cite-le dans sources.`;

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSecureAuth])
  .inputValidator((input: { messages: Msg[]; context: string; attachment?: Attachment | null }) => {
    if (input.attachment && input.attachment.base64.length > 14_000_000) throw new Error("Fichier trop volumineux pour être lu (max ~10 Mo).");
    return input;
  })
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("Assistant IA non configuré.");
    const input = [
      { role: "system", content: `${SYSTEM}\n\nContexte utilisateur:\n${data.context.slice(0, 12000)}` },
      ...data.messages.slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 30000) })),
    ] as { role: string; content: unknown }[];
    const att = data.attachment;
    if (att) {
      const last = input[input.length - 1];
      const part = att.mime.startsWith("image/")
        ? { type: "input_image", image_url: `data:${att.mime};base64,${att.base64}` }
        : { type: "input_file", filename: att.name, file_data: `data:application/pdf;base64,${att.base64}` };
      if (last) last.content = [{ type: "input_text", text: String(last.content) }, part];
    }
    const res = await fetch(`${GATEWAY}/v1/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "assistant", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      let msg = `Erreur IA (${res.status})`;
      try {
        const j = JSON.parse(t);
        msg = j.error?.message ?? j.message ?? msg;
      } catch {}
      if (res.status === 429) msg = "Trop de requêtes, réessayez dans un instant.";
      if (res.status === 402) msg = "Crédits IA épuisés pour cet espace de travail.";
      throw new Error(msg);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") text += ev.delta;
          if (ev.type === "error" || ev.type === "response.failed")
            throw new Error(ev.error?.message ?? ev.response?.error?.message ?? "Erreur IA");
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected end of JSON input" && !(e instanceof SyntaxError)) throw e;
        }
      }
    }
    try {
      return JSON.parse(text) as { reply: string; sources: string[]; action: AssistantAction };
    } catch {
      return { reply: text || "Je n'ai pas pu répondre.", sources: [] as string[], action: { type: "none", target: null, value: null } as AssistantAction };
    }
  });

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSecureAuth])
  .inputValidator((input: { audio: string; mime: string }) => {
    if (input.audio.length > 14_000_000) throw new Error("Enregistrement trop long.");
    return input;
  })
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("Transcription non configurée.");
    const bin = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
    const mime = data.mime.split(";")[0] || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.append("model", "openai/gpt-transcribe");
    form.append("file", new File([bin], `voice.${ext}`, { type: mime }));
    form.append("response_format", "json");
    form.append("language", "fr");
    const res = await fetch(`${GATEWAY}/v1/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const t = await res.text();
    if (!res.ok) {
      let msg = `Erreur transcription (${res.status})`;
      try {
        const j = JSON.parse(t);
        msg = j.error?.message ?? j.message ?? msg;
      } catch {}
      throw new Error(msg);
    }
    try {
      return { text: (JSON.parse(t).text as string) ?? "" };
    } catch {
      return { text: t };
    }
  });

// Voice of the assistant: Gemini TTS, returns a complete WAV file as base64.
export const speakText = createServerFn({ method: "POST" })
  .middleware([requireSecureAuth])
  .inputValidator((input: { text: string }) => ({ text: input.text.slice(0, 1500) }))
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("Voix non configurée.");
    const res = await fetch(`${GATEWAY}/v1/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-tts-preview",
        contents: [{ role: "user", parts: [{ text: `Dis d'une voix chaleureuse et naturelle, en français : ${data.text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        },
        stream_format: "audio",
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      let msg = `Erreur voix (${res.status})`;
      try { const j = JSON.parse(t); msg = j.error?.message ?? j.message ?? msg; } catch {}
      if (res.status === 402) msg = "Crédits IA épuisés : la voix est indisponible.";
      throw new Error(msg);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { audio: btoa(bin), mime: res.headers.get("content-type") || "audio/wav" };
  });
