import { Link } from "@tanstack/react-router";
import { ChevronRight, Home, Plus } from "lucide-react";
import { useState } from "react";
import { boardTypeInfo, type Project } from "@/tep/lib/projects";

/** Barre latérale repliée en point lumineux, dépliée au survol. */
export function ProjectSidebar({
  trail,
  children,
  onNewChild,
}: {
  trail: Project[];
  children: Project[];
  onNewChild: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="fixed left-0 top-0 z-40 h-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {!open && (
        <button
          aria-label="Ouvrir la navigation"
          onClick={() => setOpen(true)}
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-pulse rounded-full bg-primary shadow-[0_0_16px_4px_var(--primary)]"
        />
      )}
      {!open && <div className="h-full w-8" />}
      {open && (
        <nav className="flex h-full w-72 flex-col gap-4 overflow-y-auto border-r border-border bg-card/95 p-4 shadow-xl backdrop-blur">
          <Link to="/tep" className="flex items-center gap-2 text-sm font-medium hover:text-primary">
            <Home className="size-4" /> Mes projets
          </Link>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Fil d'Ariane</p>
            <ol className="space-y-0.5">
              {trail.map((p, i) => (
                <li key={p.id} style={{ paddingLeft: i * 10 }} className="flex items-center gap-1 text-sm">
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  {i === trail.length - 1 ? (
                    <span className="truncate font-semibold">{p.title}</span>
                  ) : (
                    <Link
                      to="/projets/$projectId"
                      params={{ projectId: p.id }}
                      className="truncate hover:text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Sous-tableaux</p>
            <ul className="space-y-0.5">
              {children.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/projets/$projectId"
                    params={{ projectId: c.id }}
                    className="block truncate rounded px-2 py-1 text-sm hover:bg-accent"
                  >
                    {c.title}{" "}
                    <span className="text-xs text-muted-foreground">· {boardTypeInfo(c.board_type).label}</span>
                  </Link>
                </li>
              ))}
              {children.length === 0 && <li className="text-xs text-muted-foreground">Aucun pour l'instant</li>}
            </ul>
            <button
              onClick={onNewChild}
              className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="size-4" /> Nouveau sous-tableau
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
