<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep state-driven full-screen assistant visuals in `AuraMotion`, independent of recording and Odoo logic, so visual changes cannot alter voice actions.
- Aura drives the IDEALAB lab by returning a lab page path that the app navigates to directly (no iframes; double-click/double-tap on Aura opens /dashboard); app actions run server-side through the registry in src/lib/assistant-apps.server.ts, so new apps only add registry actions.
- Lab apps share Aura's single Odoo connection row (column `db`, aliased to `db_name` in lab code) so users enter Odoo credentials once.
- Lab styles are scoped under `.lab-theme` so they never restyle Aura's screen.
- Lab pages link back to the Aura home screen for voice, so all voice actions use one registry.
- Task panel geometry is managed by native pointer events and a validated localStorage preference, avoiding additional UI dependencies.
- Assistant text/actions return before a separate authenticated speech request, so voice synthesis never delays task feedback.
- MyMackenzy pages live under the pathless `_authenticated/_mm` layout with `.mm-theme`-scoped styles, so they coexist with the lab's /dashboard and /settings without restyling other apps.
- Smart Teams uses `/board`, isolated `st_` tables and `.st-theme` styles, preserving existing apps and their records; its Odoo actions reuse the shared connection.
- Smart Teams AI helpers stream through SDK providers, preserve imported model choices and output budgets, and stop sequential task execution after an error to avoid repeated blocked requests.
- The imported TEP app lives in src/tep, routes under the pathless `_tep` layout (home `/tep`), `tep_` tables and `.tep-theme` styles (also set on <body> for dialogs), so it never collides with other apps; its Google OAuth callback is /api/public/tep-google/callback.
- Smart Teams agents act in lab apps through the same server action registry as Aura (per-agent `lab_apps` allow-list), so adding a registry action makes it available to both.
- MyMackenzy automations use lab apps by listing registry app keys in an agent's `services`; cron runs call the shared action registry through a user-scoped admin client (`scopedClient`), and Google is only required when a Google service is listed.
- Per-app AI model choice lives in `user_app_models` and is read server-side via `resolveAppAiModel` (src/lib/ai-models.server.ts) with a fallback, so apps never break when no choice is saved.
