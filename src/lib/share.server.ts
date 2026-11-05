import { canAccessShare, type ShareAccess } from "@/lib/share-security";

export async function findValidShare(token: string) {
  if (!/^[a-f0-9]{36}$/.test(token)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("shares")
    .select("permission, expires_at, user_id, files(name, storage_path, size, mime_type, deleted_at, encrypted, user_id)")
    .eq("token", token).maybeSingle();
  const share = data as ShareAccess | null;
  if (error || !canAccessShare(share)) return null;
  return { share, supabaseAdmin };
}