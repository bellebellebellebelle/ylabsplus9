import { Brain } from "lucide-react";
import { AI_MODELS } from "@/tep/lib/recrutement/ai-models";
import { useAiModel } from "@/tep/hooks/recrutement/useAiModel";

/** Sélecteur du modèle Lovable AI utilisé par toutes les fonctionnalités intelligentes. */
export function ModelPicker() {
  const { model, setModel } = useAiModel();
  const current = AI_MODELS.find((m) => m.id === model);

  return (
    <label className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-2 py-1" title={current?.hint}>
      <Brain className="size-4 shrink-0 text-primary" />
      <span className="sr-only">Modèle IA</span>
      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        aria-label="Modèle IA"
        className="max-w-[9rem] bg-transparent text-xs font-medium text-foreground outline-none"
      >
        {AI_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}
