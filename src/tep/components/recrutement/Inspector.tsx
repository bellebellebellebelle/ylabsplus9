import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Paperclip, Sparkles, Wand2, X } from "lucide-react";
import { Button } from "@/tep/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { analyzeCv, analyzeCvFile, generateJobSpec, matchCandidates, smartAssist } from "@/tep/lib/recrutement/ai.functions";
import type { CandidateProfile } from "@/tep/lib/recrutement/ai.functions";
import { CARD_META, cardSearchText, type Card, type Link } from "@/tep/lib/recrutement/board";
import { useAiModel } from "@/tep/hooks/recrutement/useAiModel";

type Props = {
  card: Card;
  cards: Card[];
  links: Link[];
  onClose: () => void;
  onPatch: (id: string, patch: Partial<Card>, debounce?: number) => void;
  onCreate: (input: Partial<Card>) => Promise<Card>;
  onLink: (source: string, target: string, label?: string) => Promise<unknown>;
};

type Match = { id: string; score: number; verdict: string; reasons: string[]; gaps: string[] };

export function Inspector({ card, cards, links, onClose, onPatch, onCreate, onLink }: Props) {
  const runAnalyzeCv = useServerFn(analyzeCv);
  const runAnalyzeCvFile = useServerFn(analyzeCvFile);
  const runJobSpec = useServerFn(generateJobSpec);
  const runMatch = useServerFn(matchCandidates);
  const runAssist = useServerFn(smartAssist);
  const { model } = useAiModel();

  const [busy, setBusy] = useState<string | null>(null);
  const [cvText, setCvText] = useState("");
  const [poolId, setPoolId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const pools = useMemo(() => cards.filter((c) => c.type === "pool"), [cards]);
  const spec = (card.data as { spec?: Record<string, string[] | string> }).spec;
  const matches = ((card.data as { matches?: Match[] }).matches ?? []) as Match[];
  const profile = (card.data as { profile?: Record<string, unknown> }).profile;
  const assist = (card.data as { assist?: { title: string; items: string[] } }).assist;

  const guard = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message || "Échec de l'action IA");
    } finally {
      setBusy(null);
    }
  };

  async function createFromProfile(profileData: CandidateProfile, fallbackName: string, index = 0) {
    const created = await onCreate({
      type: "candidate",
      title: profileData.name || fallbackName,
      body: profileData.summary,
      color: "amber",
      x: card.x + card.w + 60,
      y: card.y + index * 220,
      w: 280,
      h: 210,
      parent_id: card.type === "pool" ? card.id : null,
      data: { profile: profileData },
    });
    if (card.type === "pool" || card.type === "job") await onLink(card.id, created.id, "candidat");
  }

  async function importCv(text: string, fileName: string, index = 0) {
    const profileData = await runAnalyzeCv({ data: { text, fileName, model } });
    await createFromProfile(profileData, fileName, index);
  }

  async function importCvFile(file: File, index = 0) {
    const isBinary = file.type === "application/pdf" || file.type.startsWith("image/") || /\.pdf$/i.test(file.name);
    if (!isBinary) {
      await importCv(await file.text(), file.name, index);
      return;
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buffer.length; i += 8192) {
      binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
    }
    const profileData = await runAnalyzeCvFile({
      data: {
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        base64: btoa(binary),
        model,
      },
    });
    await createFromProfile(profileData, file.name, index);
  }

  const isTalentHost = card.type === "pool" || card.type === "job";

  return (
    <aside className="glass-panel fixed inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col overflow-y-auto p-5 md:m-3 md:rounded-2xl">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {CARD_META[card.type]?.label}
          </p>
          <h2 className="text-lg font-semibold">Détails du post-it</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="title">Titre</Label>
          <Input id="title" value={card.title} onChange={(e) => onPatch(card.id, { title: e.target.value }, 500)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body">Contenu</Label>
          <Textarea
            id="body"
            rows={4}
            value={card.body}
            onChange={(e) => onPatch(card.id, { body: e.target.value }, 500)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["amber", "sky", "violet", "lime", "rose", "cyan"].map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              onClick={() => onPatch(card.id, { color: c })}
              className={`size-6 rounded-full border border-border bg-note-${c} ${card.color === c ? "ring-2 ring-primary" : ""}`}
            />
          ))}
        </div>
      </div>

      {card.type === "job" && (
        <section className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold">Actions intelligentes</h3>
          <Button
            className="w-full"
            disabled={busy !== null}
            onClick={() =>
              guard("spec", async () => {
                const res = await runJobSpec({ data: { title: card.title, context: card.body, model } });
                onPatch(card.id, { data: { ...card.data, spec: res } });
                toast.success("Fiche de poste générée");
              })
            }
          >
            {busy === "spec" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            Générer la fiche de poste
          </Button>

          <div className="space-y-1.5">
            <Label htmlFor="pool">Analyser un vivier</Label>
            <select
              id="pool"
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choisir un vivier…</option>
              {pools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || "Vivier"}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              className="w-full"
              disabled={!poolId || busy !== null}
              onClick={() =>
                guard("match", async () => {
                  const ids = new Set(
                    links.filter((l) => l.source_id === poolId).map((l) => l.target_id),
                  );
                  const pool = cards.filter(
                    (c) => c.type === "candidate" && (ids.has(c.id) || c.parent_id === poolId),
                  );
                  if (!pool.length) throw new Error("Ce vivier ne contient aucun candidat");
                  const res = await runMatch({
                    data: {
                      job: {
                        title: card.title,
                        description: `${card.body}\n${JSON.stringify(spec ?? {})}`,
                      },
                      candidates: pool.map((c) => ({ id: c.id, name: c.title, profile: cardSearchText(c) })),
                      model,
                    },
                  });
                  onPatch(card.id, { data: { ...card.data, matches: res.matches } });
                  res.matches.forEach((m) => {
                    const target = cards.find((c) => c.id === m.id);
                    if (target) onPatch(m.id, { data: { ...target.data, match_score: m.score } });
                  });
                  toast.success(`${res.matches.length} profils analysés`);
                })
              }
            >
              {busy === "match" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Analyser les meilleurs profils
            </Button>
          </div>

          {matches.length > 0 && (
            <ul className="space-y-2">
              {matches.map((m) => {
                const target = cards.find((c) => c.id === m.id);
                const attached = links.some((l) => l.source_id === card.id && l.target_id === m.id);
                return (
                  <li key={m.id} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{target?.title ?? "Candidat"}</span>
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                        {m.score}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{m.verdict}</p>
                    <Button
                      size="sm"
                      variant={attached ? "ghost" : "secondary"}
                      className="mt-2 w-full"
                      disabled={attached}
                      onClick={() =>
                        guard("attach", async () => {
                          await onLink(card.id, m.id, "retenu");
                          toast.success("Profil accroché au poste");
                        })
                      }
                    >
                      {attached ? "Accroché au poste" : "Accrocher au poste"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {isTalentHost && (
        <section className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold">Importer des CV</h3>
          <p className="text-xs text-muted-foreground">
            Importez des CV en PDF (n'importe quelle mise en page), en image ou en texte, ou collez le contenu : l'IA lit le document et construit le profil du candidat.
          </p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.csv,image/*,application/pdf,text/plain"
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (!files.length) return;
              await guard("cvfile", async () => {
                let i = 0;
                for (const file of files) {
                  await importCvFile(file, i++);
                }
                toast.success(`${files.length} profil(s) créé(s)`);
              });
            }}
          />
          <Button
            variant="secondary"
            className="w-full"
            disabled={busy !== null}
            onClick={() => fileRef.current?.click()}
          >
            {busy === "cvfile" ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            Importer des CV (PDF, image, texte)
          </Button>
          <Textarea
            rows={4}
            placeholder="Ou collez ici le texte d'un CV…"
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
          />
          <Button
            className="w-full"
            disabled={cvText.trim().length < 30 || busy !== null}
            onClick={() =>
              guard("cvtext", async () => {
                await importCv(cvText, "CV collé");
                setCvText("");
                toast.success("Profil candidat créé");
              })
            }
          >
            {busy === "cvtext" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Construire le profil
          </Button>
        </section>
      )}

      {card.type === "candidate" && profile && <ProfileDetails profile={profile as Partial<CandidateProfile>} />}

      <section className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold">Assistant IA</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { k: "interview", l: "Guide d'entretien" },
            { k: "email", l: "Email candidat" },
            { k: "checklist", l: "Checklist" },
            { k: "scorecard", l: "Grille d'éval." },
          ].map((a) => (
            <Button
              key={a.k}
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                guard(a.k, async () => {
                  const res = await runAssist({ data: { model, kind: a.k, context: cardSearchText(card) } });
                  onPatch(card.id, { data: { ...card.data, assist: res } });
                  toast.success(res.title);
                })
              }
            >
              {busy === a.k ? <Loader2 className="size-4 animate-spin" /> : null}
              {a.l}
            </Button>
          ))}
        </div>
        {assist && (
          <div className="rounded-lg border border-border bg-surface-2 p-3">
            <p className="text-sm font-medium">{assist.title}</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {assist.items.map((i) => (
                <li key={i}>• {i}</li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() =>
                onCreate({
                  type: "ai",
                  title: assist.title,
                  body: assist.items.map((i) => `• ${i}`).join("\n"),
                  color: "cyan",
                  x: card.x,
                  y: card.y + card.h + 40,
                  w: 300,
                  h: 240,
                })
              }
            >
              Transformer en post-it
            </Button>
          </div>
        )}
      </section>
    </aside>
  );
}

function Field({ label, value }: { label: string; value?: string | number | undefined }) {
  if (value === undefined || value === null || value === "" || value === 0) return null;
  return (
    <p className="text-xs">
      <span className="text-muted-foreground">{label} : </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function Chips({ label, items }: { label: string; items?: string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((i) => (
          <span key={i} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground">
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProfileDetails({ profile }: { profile: Partial<CandidateProfile> }) {
  return (
    <section className="mt-6 space-y-3">
      <h3 className="text-sm font-semibold">Profil du candidat</h3>
      {profile.headline && <p className="text-xs text-muted-foreground">{profile.headline}</p>}
      <div className="space-y-1 rounded-lg border border-border bg-surface-2 p-3">
        <Field label="Email" value={profile.email} />
        <Field label="Téléphone" value={profile.phone} />
        <Field label="Localisation" value={profile.location} />
        <Field label="Expérience" value={profile.years_experience ? `${profile.years_experience} ans` : undefined} />
      </div>
      {profile.summary && <p className="text-sm">{profile.summary}</p>}
      <Chips label="Compétences" items={profile.skills} />
      <Chips label="Langues" items={profile.languages} />
      <Chips label="Formation" items={profile.education} />
      {profile.experiences?.length ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold">Expériences</p>
          <ul className="space-y-1">
            {profile.experiences.map((e, i) => (
              <li key={`${e.role}-${i}`} className="rounded-md border border-border bg-surface-2 p-2 text-xs">
                <span className="font-medium">{e.role}</span>
                {e.company ? ` — ${e.company}` : ""}
                {e.period ? <span className="text-muted-foreground"> ({e.period})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Chips label="Points forts" items={profile.strengths} />
      <Chips label="Points de vigilance" items={profile.watchouts} />
    </section>
  );
}
