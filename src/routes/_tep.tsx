import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

// Imported TEP app: its look is scoped under .tep-theme (also on <body> so dialogs/popovers match).
export const Route = createFileRoute("/_tep")({ component: TepLayout });

function TepLayout() {
  useEffect(() => {
    document.body.classList.add("tep-theme");
    return () => document.body.classList.remove("tep-theme");
  }, []);
  return (
    <div className="tep-theme min-h-screen">
      <Outlet />
    </div>
  );
}
