import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProjectId, scopeToProject } from "@/tep/lib/project-scope";

export type Team = {
  id: string;
  user_id: string;
  department: string;
  name: string;
  mission: string | null;
  created_at: string;
};

export type Agent = {
  id: string;
  user_id: string;
  team_id: string | null;
  department: string;
  name: string;
  role: string;
  is_chief: boolean;
  model: string;
  system_prompt: string;
  temperature: number;
  skills: string;
  tone: string;
  color: string;
  pos_x: number;
  pos_y: number;
  status: string;
};

export type Mission = {
  id: string;
  team_id: string;
  objective: string;
  status: string;
  summary: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  team_id: string;
  mission_id: string | null;
  agent_id: string | null;
  title: string;
  brief: string;
  status: string;
  result: string | null;
  created_at: string;
};

export type BoardData = {
  teams: Team[];
  agents: Agent[];
  missions: Mission[];
  tasks: Task[];
};

export const BOARD_KEY = ["board", getProjectId()] as const;

export async function fetchBoard(): Promise<BoardData> {
  const [teams, agents, missions, tasks] = await Promise.all([
    scopeToProject(supabase.from("tep_teams").select("*")).order("created_at"),
    scopeToProject(supabase.from("tep_agents").select("*")).order("created_at"),
    supabase.from("tep_missions").select("*").order("created_at", { ascending: false }),
    supabase.from("tep_tasks").select("*").order("created_at"),
  ]);
  const err = teams.error || agents.error || missions.error || tasks.error;
  if (err) throw new Error(err.message);
  const teamIds = new Set((teams.data ?? []).map((t) => t.id));
  return {
    teams: (teams.data ?? []) as Team[],
    agents: (agents.data ?? []) as Agent[],
    missions: ((missions.data ?? []) as Mission[]).filter((m) => teamIds.has(m.team_id)),
    tasks: ((tasks.data ?? []) as Task[]).filter((t) => teamIds.has(t.team_id)),
  };
}

export function useBoard() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: BOARD_KEY, queryFn: fetchBoard });

  useEffect(() => {
    const channel = supabase
      .channel("board-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tep_agents" }, () =>
        queryClient.invalidateQueries({ queryKey: BOARD_KEY }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "tep_teams" }, () =>
        queryClient.invalidateQueries({ queryKey: BOARD_KEY }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "tep_tasks" }, () =>
        queryClient.invalidateQueries({ queryKey: BOARD_KEY }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "tep_missions" }, () =>
        queryClient.invalidateQueries({ queryKey: BOARD_KEY }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Session expirée.");
  return data.user.id;
}

export async function createTeam(department: string, name: string, mission = "") {
  const user_id = await currentUserId();
  const { data, error } = await supabase
    .from("tep_teams")
    .insert({ user_id, department, name, mission, project_id: getProjectId() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Team;
}

export async function updateTeam(id: string, patch: Partial<Team>) {
  const { error } = await supabase.from("tep_teams").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTeam(id: string) {
  const { error } = await supabase.from("tep_teams").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createAgent(input: Partial<Agent> & { department: string; name: string }) {
  const user_id = await currentUserId();
  const { data, error } = await supabase
    .from("tep_agents")
    .insert({ ...input, user_id, project_id: getProjectId() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Agent;
}

export async function updateAgent(id: string, patch: Partial<Agent>) {
  const { error } = await supabase.from("tep_agents").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAgent(id: string) {
  const { error } = await supabase.from("tep_agents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tep_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type CustomDepartment = {
  id: string;
  key: string;
  label: string;
  blurb: string;
  default_team: string;
};

export type OdooState = {
  connected: boolean;
  url: string;
  database: string;
  username: string;
  modulesByDept: Record<string, string[]>;
};

export async function fetchCustomDepartments(): Promise<CustomDepartment[]> {
  const { data, error } = await scopeToProject(supabase.from("tep_custom_departments").select("id, key, label, blurb, default_team"))
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomDepartment[];
}

export async function createCustomDepartment(label: string): Promise<CustomDepartment> {
  const user_id = await currentUserId();
  const key = `custom_${label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)}_${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("tep_custom_departments")
    .insert({ user_id, key, label, default_team: `Équipe ${label}`, project_id: getProjectId() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CustomDepartment;
}

export async function deleteCustomDepartment(id: string) {
  const { error } = await supabase.from("tep_custom_departments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchOdooState(): Promise<OdooState> {
  const [conn, mods] = await Promise.all([
    supabase
      .from("tep_odoo_connections")
      .select("url, database, username, connected")
      .maybeSingle(),
    supabase.from("tep_department_modules").select("department, modules"),
  ]);
  if (conn.error) throw new Error(conn.error.message);
  if (mods.error) throw new Error(mods.error.message);
  const modulesByDept: Record<string, string[]> = {};
  for (const row of mods.data ?? []) modulesByDept[row.department] = row.modules ?? [];
  return {
    connected: Boolean(conn.data?.connected),
    url: conn.data?.url ?? "",
    database: conn.data?.database ?? "",
    username: conn.data?.username ?? "",
    modulesByDept,
  };
}
