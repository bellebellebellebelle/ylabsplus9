/**
 * Every tool instance is scoped to one project (sub-board).
 * The project id travels in the URL as `?project=<uuid>`. When a tool page
 * navigates internally inside the project iframe, we fall back to the parent
 * frame's `/projets/<uuid>` path. `null` = the default (standalone) board,
 * which also holds all data created before projects existed.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getProjectId(): string | null {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("project");
  if (fromQuery && UUID.test(fromQuery)) return fromQuery;
  try {
    if (window.parent !== window) {
      const m = window.parent.location.pathname.match(/^\/projets\/([^/]+)/);
      if (m && UUID.test(m[1]!)) return m[1]!;
    }
  } catch {
    /* cross-origin parent: ignore */
  }
  return null;
}

/** Restrict a query to the current project (or to the default board). */
export function scopeToProject<Q extends { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(
  query: Q,
  projectId: string | null = getProjectId(),
): Q {
  return projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
}

/** Appends `?project=` to an in-app path so the context survives navigation. */
export function withProject(path: string, projectId: string | null = getProjectId()): string {
  if (!projectId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}project=${projectId}`;
}
