import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { clearKey } from "@/lib/e2e";
import { VoiceOrb } from "@/components/VoiceOrb";

const SKY = /^\/(sky|calendsky|skydoc|skytab|tasky|sky-journal|tasks|mail|mail-settings|s|reset-password)(\/|$)/;
// SKY pages outside the authenticated lab layout (which already shows the Aura button).
const NEEDS_AURA = /^\/(calendsky|skydoc|skytab|tasky|sky-journal)(\/|$)/;

/** Mounts the imported SKY suite chrome only on SKY pages, so other apps are untouched. */
export function SkyShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const on = SKY.test(path);
  useEffect(() => {
    document.documentElement.classList.toggle("sky-root", on);
  }, [on]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") clearKey();
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!on) return null;
  return (
    <>
      {NEEDS_AURA.test(path) && <VoiceOrb />}
      <Toaster theme="light" />
    </>
  );
}
