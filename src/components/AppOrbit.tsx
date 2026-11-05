import { useNavigate } from "@tanstack/react-router";
import { Cloud, ListChecks, CalendarDays, FileText, Sheet, Mail, Home, Workflow, Users, Bot, ReceiptEuro, Mic, StickyNote, type LucideIcon } from "lucide-react";

export type SkyApp = { id: string; name: string; desc: string; to: string; icon: LucideIcon; color: string };

/** Every app of the lab, shown in the orbit opened by holding the Aura button. */
export const SKY_APPS: SkyApp[] = [
  { id: "home", name: "COCKPIT", desc: "Accueil du laboratoire", to: "/dashboard", icon: Home, color: "#FCF6F3" },
  { id: "mm", name: "MYMACKENZY", desc: "Automatisations", to: "/cockpit", icon: Workflow, color: "#a78bfa" },
  { id: "st", name: "SMART TEAMS", desc: "Équipes d'agents IA", to: "/board", icon: Users, color: "#4ade80" },
  { id: "ock", name: "OCKTAVUS", desc: "Google Workspace", to: "/ocktavus", icon: Bot, color: "#2dd4bf" },
  { id: "angelo", name: "ANGELO", desc: "Factures Odoo", to: "/tableau-de-bord", icon: ReceiptEuro, color: "#fbbf24" },
  { id: "memo", name: "MEMOTRACK", desc: "Mémos de réunion", to: "/memotrack", icon: Mic, color: "#22d3ee" },
  { id: "tep", name: "TEP", desc: "Tableaux & post-it", to: "/tep", icon: StickyNote, color: "#fb7185" },
  { id: "cloud", name: "SKY CLOUD", desc: "Stockage sécurisé", to: "/sky/cloud", icon: Cloud, color: "#38bdf8" },
  { id: "task", name: "SKY TASK", desc: "Tâches & notes", to: "/tasks", icon: ListChecks, color: "#f472b6" },
  { id: "cal", name: "CALENDSKY", desc: "Planning intelligent", to: "/calendsky/planning", icon: CalendarDays, color: "#facc15" },
  { id: "doc", name: "SKYDOC", desc: "Documents IA", to: "/skydoc/dashboard", icon: FileText, color: "#c4b5fd" },
  { id: "tab", name: "SKYTAB", desc: "Tableur IA", to: "/skytab/dashboard", icon: Sheet, color: "#86efac" },
  { id: "mail", name: "SENDYME", desc: "Messagerie", to: "/mail", icon: Mail, color: "#fb923c" },
];

/** Ring of sk-glass sk-glass pods orbiting; each logo also spins on itself. */
export function AppOrbit({ size = 420, onPick, showLabels = true }: { size?: number; onPick?: () => void; showLabels?: boolean }) {
  const nav = useNavigate();
  const pod = Math.round(size * (SKY_APPS.length > 8 ? 0.13 : 0.22));
  const r = size / 2 - pod / 2 - 4;
  return (
    <div className="sky-orbit relative" style={{ width: size, height: size }}>
      <div className="sky-orbit-ring absolute rounded-full" style={{ inset: pod / 2 }} />
      <div className="sky-orbit-ring sky-orbit-ring-2 absolute rounded-full" style={{ inset: pod / 2 + 10 }} />
      <div className="sky-orbit-spin absolute inset-0">
        {SKY_APPS.map((a, i) => {
          const ang = (i / SKY_APPS.length) * Math.PI * 2 - Math.PI / 2;
          const x = size / 2 + r * Math.cos(ang) - pod / 2;
          const y = size / 2 + r * Math.sin(ang) - pod / 2;
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              type="button"
              aria-label={`Ouvrir ${a.name}`}
              title={`${a.name} — ${a.desc}`}
              onClick={() => { onPick?.(); nav({ to: a.to }); }}
              className="sky-orbit-pod group absolute flex flex-col items-center justify-center rounded-[28%]"
              style={{ left: x, top: y, width: pod, height: pod, ["--pod" as string]: a.color }}
            >
              <Icon className="sky-orbit-logo" style={{ width: pod * 0.42, height: pod * 0.42, color: a.color }} />
              {showLabels && (
                <span className="sky-orbit-label pointer-events-none absolute -bottom-7 whitespace-nowrap text-xs font-semibold tracking-wide">
                  {a.name}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
