import { useCallback, useEffect, useState } from "react";
import { AI_MODEL_STORAGE_KEY, DEFAULT_AI_MODEL, resolveAiModel } from "@/tep/lib/recrutement/ai-models";

/** Modèle Lovable AI choisi par l'utilisateur, persisté localement. */
export function useAiModel() {
  const [model, setModelState] = useState<string>(DEFAULT_AI_MODEL);

  useEffect(() => {
    setModelState(resolveAiModel(window.localStorage.getItem(AI_MODEL_STORAGE_KEY)));
    const onStorage = (e: StorageEvent) => {
      if (e.key === AI_MODEL_STORAGE_KEY) setModelState(resolveAiModel(e.newValue));
    };
    const onLocal = (e: Event) => setModelState(resolveAiModel((e as CustomEvent<string>).detail));
    window.addEventListener("storage", onStorage);
    window.addEventListener("smyle:ai-model", onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("smyle:ai-model", onLocal);
    };
  }, []);

  const setModel = useCallback((next: string) => {
    const value = resolveAiModel(next);
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent("smyle:ai-model", { detail: value }));
    setModelState(value);
  }, []);

  return { model, setModel };
}
