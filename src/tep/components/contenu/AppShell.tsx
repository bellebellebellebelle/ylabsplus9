import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, CalendarDays, Sparkles, LogOut, Palette } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/tep/components/ui/button";

const NAV = [
  { to: "/contenu", label: "Tableau", icon: LayoutGrid },
  { to: "/contenu/calendrier", label: "Calendrier", icon: CalendarDays },
  { to: "/contenu/marque", label: "Marque", icon: Palette },
] as const;

export function AppShell({ children, email }: { children: ReactNode; email?: string | null | undefined }) {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <header className="glass z-30 flex h-14 shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
        <Link to="/tep" className="flex items-center gap-2" title="Retour aux tableaux">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </span>
          <span className="text-gradient text-base font-semibold tracking-tight">Nova Studio</span>
        </Link>

        <nav className="flex items-center gap-1 rounded-full bg-secondary/60 p-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
              activeProps={{ className: "active" }}
            >
              <item.icon className="size-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground md:inline">
            {email}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Se déconnecter"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <main className="relative min-h-0 flex-1">{children}</main>
    </div>
  );
}
