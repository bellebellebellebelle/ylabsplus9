import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/skydoc/")({
  beforeLoad: () => { throw redirect({ to: "/skydoc/dashboard" }); },
});
