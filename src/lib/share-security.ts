export type SharedFile = { name: string; storage_path: string; size: number; mime_type: string; deleted_at: string | null; encrypted: boolean; user_id: string };
export type ShareAccess = { permission: string; expires_at: string | null; user_id: string; files: SharedFile | null };

export function canAccessShare(share: ShareAccess | null, now = Date.now()): share is ShareAccess & { files: SharedFile } {
  if (!share?.files) return false;
  const file = share.files;
  return !file.deleted_at && !file.encrypted && file.user_id === share.user_id
    && file.storage_path.split("/")[0] === share.user_id
    && ["view", "download"].includes(share.permission)
    && (!share.expires_at || (Number.isFinite(Date.parse(share.expires_at)) && Date.parse(share.expires_at) > now));
}