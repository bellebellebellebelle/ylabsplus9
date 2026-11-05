import { createServerFn } from "@tanstack/react-start";

// Public capability: no storage URL is exposed; every file request rechecks it.
export const resolveShare = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => {
    if (!/^[a-f0-9]{36}$/.test(input.token)) throw new Error("Lien invalide");
    return input;
  })
  .handler(async ({ data }) => {
    const { findValidShare } = await import("@/lib/share.server");
    const result = await findValidShare(data.token);
    if (!result) return { ok: false as const, reason: "Lien invalide, expiré, révoqué ou fichier non partageable." };
    const { share } = result;
    const file = share.files;
    return {
      ok: true as const,
      name: file.name,
      size: file.size,
      mime: file.mime_type,
      permission: share.permission,
      url: `/api/public/shared-file/${data.token}`,
    };
  });
