import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sky/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SKY CLOUD — Stockage intelligent illimité" },
      { name: "description", content: "Importez, organisez et partagez vos fichiers en toute sécurité, guidé par un assistant IA vocal." },
      { property: "og:title", content: "SKY CLOUD — Stockage intelligent illimité" },
      { property: "og:description", content: "Stockage cloud sécurisé avec assistant IA vocal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/sky/apps" : "/sky/auth" });
  },
});
