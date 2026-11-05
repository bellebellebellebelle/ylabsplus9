import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureWorkspace, listNotes, type Board, type Brand, type Note } from "@/tep/lib/contenu/data";
import { useAuth } from "@/tep/lib/contenu/useAuth";

export function useWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    (async () => {
      try {
        const ws = await ensureWorkspace(user.id);
        const list = await listNotes(ws.board.id);
        if (!active) return;
        setBoard(ws.board);
        setBrand(ws.brand);
        setNotes(list);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Chargement impossible");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  // Realtime sync across tabs/devices
  useEffect(() => {
    if (!board) return;
    const channel = supabase
      .channel(`notes-${board.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tep_content_notes", filter: `board_id=eq.${board.id}` },
        (payload) => {
          setNotes((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Note;
              return prev.some((n) => n.id === row.id) ? prev : [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Note;
              return prev.map((n) => (n.id === row.id ? { ...n, ...row } : n));
            }
            const old = payload.old as { id: string };
            return prev.filter((n) => n.id !== old.id);
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [board]);

  const patchLocal = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  return {
    user,
    board,
    brand,
    setBrand,
    notes,
    setNotes,
    patchLocal,
    loading: authLoading || loading,
  };
}
