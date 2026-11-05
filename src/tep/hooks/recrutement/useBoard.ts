import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getProjectId } from "@/tep/lib/project-scope";
import {
  type Card,
  type Link,
  createCard as apiCreate,
  createLink as apiLink,
  deleteCard as apiDelete,
  deleteLink as apiDeleteLink,
  fetchBoard,
  updateCard as apiUpdate,
} from "@/tep/lib/recrutement/board";

export function useBoard() {
  const [cards, setCards] = useState<Card[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let alive = true;
    fetchBoard()
      .then((res) => {
        if (!alive) return;
        setCards(res.cards);
        setLinks(res.links);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));

    const channel = supabase
      .channel("board")
      .on("postgres_changes", { event: "*", schema: "public", table: "tep_cards" }, (payload) => {
        setCards((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((c) => c.id !== (payload.old as Card).id);
          const row = payload.new as Card;
          if (((row as { project_id?: string | null }).project_id ?? null) !== getProjectId()) return prev;
          const idx = prev.findIndex((c) => c.id === row.id);
          if (idx === -1) return [...prev, row];
          const next = [...prev];
          next[idx] = { ...next[idx], ...row };
          return next;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tep_links" }, (payload) => {
        setLinks((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((l) => l.id !== (payload.old as Link).id);
          const row = payload.new as Link;
          if (((row as { project_id?: string | null }).project_id ?? null) !== getProjectId()) return prev;
          return prev.some((l) => l.id === row.id) ? prev : [...prev, row];
        });
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const addCard = useCallback(async (input: Partial<Card>) => {
    const card = await apiCreate(input);
    setCards((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, card]));
    return card;
  }, []);

  /** Optimistic patch, persisted with debounce (geometry) or immediately. */
  const patchCard = useCallback((id: string, patch: Partial<Card>, debounce = 0) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const timers = pending.current;
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    if (debounce === 0) {
      void apiUpdate(id, patch);
      return;
    }
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        void apiUpdate(id, patch);
      }, debounce),
    );
  }, []);

  const removeCard = useCallback(async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setLinks((prev) => prev.filter((l) => l.source_id !== id && l.target_id !== id));
    await apiDelete(id);
  }, []);

  const addLink = useCallback(async (source: string, target: string, label = "") => {
    const link = await apiLink(source, target, label);
    setLinks((prev) => (prev.some((l) => l.id === link.id) ? prev : [...prev, link]));
    return link;
  }, []);

  const removeLink = useCallback(async (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    await apiDeleteLink(id);
  }, []);

  return { cards, links, loading, error, addCard, patchCard, removeCard, addLink, removeLink };
}
