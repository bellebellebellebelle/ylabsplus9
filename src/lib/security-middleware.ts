import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// The database checks live enrolled factors, not a potentially stale token list.
export const requireSecureAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { data, error } = await context.supabase.rpc("meets_mfa_requirement");
    if (error || data !== true) throw new Error("Validation 2FA requise avant cette action.");
    return next();
  });