import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppOrbit } from "@/components/AppOrbit";

export const Route = createFileRoute("/sky/apps")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/sky/auth" });
  },
  head: () => ({
    meta: [
      { title: "Mes applications — SKY" },
      { name: "description", content: "Choisissez votre application : SKY CLOUD, SKY TASK, CALENDSKY, SKYDOC ou SKYTAB." },
      { property: "og:title", content: "Mes applications — SKY" },
      { property: "og:description", content: "Les 5 applications SKY réunies en un seul endroit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppsHub,
});

function AppsHub() {
  const size = typeof window !== "undefined" ? Math.min(460, window.innerWidth - 48) : 420;
  return (
    <div className="sky-hub relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
      <div className="relative">
        <AppOrbit size={size} />
      </div>
      <Link to="/sky-journal" aria-label="Journal des actions SKY" title="Journal des actions SKY"
        className="fixed bottom-5 left-5 flex size-6 items-center justify-center">
        <span className="absolute size-3 animate-ping rounded-full" style={{ background: "#38bdf8", opacity: 0.5 }} />
        <span className="relative size-2.5 rounded-full" style={{ background: "#7dd3fc", boxShadow: "0 0 10px #38bdf8" }} />
      </Link>
    </div>
  );
}
