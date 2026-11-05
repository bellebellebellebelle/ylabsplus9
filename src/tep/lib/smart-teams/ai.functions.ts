import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PlanInput = z.object({ teamId: z.string().uuid(), objective: z.string().min(3) });
const RunInput = z.object({ taskId: z.string().uuid() });
const SuggestInput = z.object({
  department: z.string().min(2),
  focus: z.string().default(""),
});
const DraftInput = z.object({
  department: z.string().min(2),
  role: z.string().min(2),
  name: z.string().default(""),
});

/** Le chef d'équipe découpe l'ordre de mission et l'attribue à ses agents. */
export const planMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanInput.parse(input))
  .handler(async ({ data, context }) => {
    const { chat, parseJson } = await import("@/tep/lib/smart-teams/ai-gateway.server");
    const { supabase, userId } = context;

    const { data: team } = await supabase
      .from("tep_teams")
      .select("*")
      .eq("id", data.teamId)
      .maybeSingle();
    if (!team) throw new Error("Équipe introuvable.");

    const { data: agents } = await supabase
      .from("tep_agents")
      .select("id, name, role, is_chief, skills, department")
      .eq("team_id", data.teamId);

    const members = agents ?? [];
    if (members.length === 0) throw new Error("Ajoutez au moins un agent à cette équipe.");
    const chief = members.find((a) => a.is_chief) ?? members[0]!;
    const workers = members.filter((a) => a.id !== chief.id);
    const assignable = workers.length > 0 ? workers : [chief];

    const roster = assignable
      .map((a) => `- id=${a.id} | ${a.name} | rôle: ${a.role || "polyvalent"} | ${a.skills}`)
      .join("\n");

    const raw = await chat(
      "openai/gpt-5.6-terra",
      [
        {
          role: "system",
          content: `Tu es ${chief.name}, chef de l'équipe "${team.name}" du département ${team.department} d'une entreprise. Tu reçois un ordre de mission de la direction et tu le découpes en tâches concrètes, actionnables et non redondantes, chacune attribuée au membre le plus pertinent. Réponds UNIQUEMENT en JSON.`,
        },
        {
          role: "user",
          content: `Mission: ${data.objective}
Contexte permanent de l'équipe: ${team.mission || "aucun"}
Membres attribuables:
${roster}

Retourne ce JSON exact:
{"plan":"1 phrase de stratégie","tasks":[{"agent_id":"uuid d'un membre","title":"titre court","brief":"consigne détaillée et autonome (contexte, attendu, format de livrable)"}]}
Entre 2 et ${Math.max(2, Math.min(6, assignable.length * 2))} tâches. Uniquement des agent_id de la liste.`,
        },
      ],
      { maxTokens: 2000 },
    );

    const parsed = parseJson<{
      plan?: string;
      tasks?: { agent_id?: string; title?: string; brief?: string }[];
    }>(raw);
    const validIds = new Set(assignable.map((a) => a.id));
    const tasks = (parsed?.tasks ?? [])
      .filter((t) => t.title && validIds.has(t.agent_id ?? ""))
      .slice(0, 8);
    if (tasks.length === 0) throw new Error("Le chef n'a pas réussi à structurer la mission.");

    const { data: mission, error: mErr } = await supabase
      .from("tep_missions")
      .insert({
        user_id: userId,
        team_id: data.teamId,
        objective: data.objective,
        status: "dispatched",
        summary: parsed?.plan ?? "",
      })
      .select()
      .single();
    if (mErr) throw new Error(mErr.message);

    const { error: tErr } = await supabase.from("tep_tasks").insert(
      tasks.map((t) => ({
        user_id: userId,
        team_id: data.teamId,
        mission_id: mission.id,
        agent_id: t.agent_id!,
        title: t.title!.slice(0, 160),
        brief: t.brief ?? "",
        status: "todo",
      })),
    );
    if (tErr) throw new Error(tErr.message);

    return { missionId: mission.id, plan: parsed?.plan ?? "", count: tasks.length };
  });

/** Un agent exécute réellement sa tâche avec sa configuration propre. */
export const runTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RunInput.parse(input))
  .handler(async ({ data, context }) => {
    const { chat } = await import("@/tep/lib/smart-teams/ai-gateway.server");
    const { supabase } = context;

    const { data: task } = await supabase
      .from("tep_tasks")
      .select("*")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task) throw new Error("Tâche introuvable.");

    const { data: agent } = await supabase
      .from("tep_agents")
      .select("*")
      .eq("id", task.agent_id ?? "")
      .maybeSingle();
    if (!agent) throw new Error("Aucun agent n'est assigné à cette tâche.");

    await supabase.from("tep_tasks").update({ status: "running" }).eq("id", task.id);
    await supabase.from("tep_agents").update({ status: "working" }).eq("id", agent.id);

    // Contexte Odoo réel si la base est connectée et le département y a accès.
    let odooContext = "";
    try {
      const { data: conn } = await supabase
        .from("tep_odoo_connections")
        .select("url, database, username, api_key, uid, connected")
        .maybeSingle();
      if (conn?.connected && conn.uid) {
        const { data: dm } = await supabase
          .from("tep_department_modules")
          .select("modules")
          .eq("department", agent.department)
          .maybeSingle();
        const modules = dm?.modules ?? [];
        if (modules.length > 0) {
          const { buildOdooContext } = await import("@/tep/lib/smart-teams/odoo.server");
          odooContext = await buildOdooContext(
            { url: conn.url, database: conn.database, username: conn.username, apiKey: conn.api_key },
            conn.uid,
            modules,
          );
        }
      }
    } catch {
      // Odoo indisponible : l'agent travaille sans contexte externe.
    }

    try {
      const result = await chat(
        agent.model,
        [
          {
            role: "system",
            content: `Tu es ${agent.name}, ${agent.role || "agent"} du département ${agent.department}.
Expertises: ${agent.skills || "généraliste"}.
Ton: ${agent.tone || "professionnel, direct"}.
Instructions du dirigeant: ${agent.system_prompt || "Livre un travail exploitable immédiatement."}
Tu produis un livrable finalisé, structuré en markdown, sans demander de précisions. Pas de bavardage.${odooContext ? "\nTu disposes de données réelles de l'ERP Odoo de l'entreprise (ci-dessous). Appuie-toi dessus, cite les chiffres exacts." : ""}`,
          },
          {
            role: "user",
            content: `Tâche: ${task.title}\n\nConsigne: ${task.brief}${odooContext ? `\n\nDonnées Odoo en temps réel:\n${odooContext}` : ""}`,
          },
        ],
        { temperature: Number(agent.temperature) || 0.6, maxTokens: 3000 },
      );

      await supabase
        .from("tep_tasks")
        .update({ status: "done", result })
        .eq("id", task.id);
      await supabase.from("tep_agents").update({ status: "done" }).eq("id", agent.id);
      return { result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Échec de l'exécution.";
      await supabase.from("tep_tasks").update({ status: "error", result: message }).eq("id", task.id);
      await supabase.from("tep_agents").update({ status: "error" }).eq("id", agent.id);
      throw new Error(message);
    }
  });

/** Propose une composition d'équipe complète pour un département. */
export const suggestTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SuggestInput.parse(input))
  .handler(async ({ data }) => {
    const { chat, parseJson } = await import("@/tep/lib/smart-teams/ai-gateway.server");
    const raw = await chat(
      "openai/gpt-5.6-terra",
      [
        {
          role: "system",
          content:
            "Tu conçois des équipes d'agents IA qui remplacent une extension d'un département d'entreprise. Réponds UNIQUEMENT en JSON.",
        },
        {
          role: "user",
          content: `Département: ${data.department}. Priorité: ${data.focus || "efficacité générale"}.
Retourne:
{"team_name":"nom court","members":[{"name":"prénom + nom","role":"rôle","is_chief":true|false,"skills":"3 à 5 expertises séparées par des virgules","system_prompt":"instructions de travail précises (3 phrases max)"}]}
Exactement 1 chef et 3 à 4 agents.`,
        },
      ],
      { maxTokens: 1600 },
    );
    const parsed = parseJson<{
      team_name?: string;
      members?: {
        name?: string;
        role?: string;
        is_chief?: boolean;
        skills?: string;
        system_prompt?: string;
      }[];
    }>(raw);
    if (!parsed?.members?.length) throw new Error("Suggestion indisponible, réessayez.");
    return {
      teamName: parsed.team_name ?? `Équipe ${data.department}`,
      members: parsed.members.slice(0, 5).map((m, i) => ({
        name: m.name ?? `Agent ${i + 1}`,
        role: m.role ?? "Agent",
        is_chief: Boolean(m.is_chief) && i === 0,
        skills: m.skills ?? "",
        system_prompt: m.system_prompt ?? "",
      })),
    };
  });

/** Génère les instructions détaillées d'un agent (bouton "affiner par IA"). */
export const draftAgentPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data }) => {
    const { chat } = await import("@/tep/lib/smart-teams/ai-gateway.server");
    const text = await chat(
      "openai/gpt-5.6-luna",
      [
        {
          role: "system",
          content:
            "Tu rédiges le prompt système d'un agent IA employé d'entreprise. Style: impératif, opérationnel, 4 à 6 lignes, sans titre ni markdown.",
        },
        {
          role: "user",
          content: `Département: ${data.department}. Rôle: ${data.role}. Nom: ${data.name || "agent"}. Rédige ses instructions de travail, ses méthodes et son format de livrable attendu.`,
        },
      ],
      { maxTokens: 700 },
    );
    return { prompt: text };
  });
