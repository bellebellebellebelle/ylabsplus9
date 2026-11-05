import { createFileRoute } from "@tanstack/react-router";

function html(message: string, ok: boolean) {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Google</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#14161a;color:#f4f4f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{max-width:420px;padding:28px;border-radius:16px;background:#1d2026;border:1px solid #2c3038;text-align:center}
a{color:#8ab4f8}</style></head>
<body><div class="card"><h1>${ok ? "Compte Google connecté" : "Connexion impossible"}</h1>
<p>${message}</p><p><a href="/planification">Retour au tableau</a></p>
<script>setTimeout(function(){location.href="/?google=${ok ? "ok" : "error"}"},${ok ? 1200 : 4000})</script>
</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/planning-google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        if (error) return html(`Google a renvoyé une erreur : ${error}`, false);
        if (!code || !state) return html("Requête incomplète.", false);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: stateRow } = await supabaseAdmin
            .from("tep_planning_google_oauth_states")
            .select("*")
            .eq("state", state)
            .maybeSingle();
          if (!stateRow) return html("Session d'autorisation expirée, réessayez.", false);
          await supabaseAdmin.from("tep_planning_google_oauth_states").delete().eq("state", state);

          const { exchangeCode, saveConnection, fetchUserEmail, getConnection, decryptToken } =
            await import("@/tep/lib/planning/google.server");
          const row = stateRow as { user_id: string; redirect_uri: string };
          const tokens = await exchangeCode(code, row.redirect_uri);
          const existing = await getConnection(row.user_id);
          const existingRefresh = existing
            ? decryptToken(existing.refresh_token_ciphertext)
            : undefined;
          const email = tokens.access_token ? await fetchUserEmail(tokens.access_token) : null;
          await saveConnection(row.user_id, tokens, email, existingRefresh);
          return html(
            `Gmail, Google Agenda et Google Tasks sont maintenant synchronisés${
              email ? ` avec ${email}` : ""
            }.`,
            true,
          );
        } catch (err) {
          console.error("google callback", err);
          return html(err instanceof Error ? err.message : "Erreur inattendue.", false);
        }
      },
    },
  },
});
