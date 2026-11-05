import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/calendsky/")({
  beforeLoad: () => { throw redirect({ to: "/calendsky/planning" }); },
});
