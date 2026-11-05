import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tep-google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const back = (ok: string) =>
          new Response(null, { status: 302, headers: { location: `/?google=${ok}` } });

        if (!code || !state) return back("erreur");

        try {
          const { exchangeCode } = await import("@/tep/lib/google.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: row } = await supabaseAdmin
            .from("tep_google_oauth_states")
            .select("user_id")
            .eq("state", state)
            .maybeSingle();
          if (!row) return back("erreur");
          await supabaseAdmin.from("tep_google_oauth_states").delete().eq("state", state);

          const token = await exchangeCode(code, url.origin);
          if (!token.refresh_token) return back("erreur");

          const { error } = await supabaseAdmin.from("tep_google_connections").upsert(
            {
              user_id: row.user_id,
              refresh_token: token.refresh_token,
              scope: token.scope ?? "",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
          if (error) throw error;
          return back("ok");
        } catch (error) {
          console.error("Google OAuth callback", error);
          return back("erreur");
        }
      },
    },
  },
});
