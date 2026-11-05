import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/shared-file/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { findValidShare } = await import("@/lib/share.server");
        const access = await findValidShare(params.token);
        const headers = new Headers({ "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "sandbox; default-src 'none'" });
        if (!access) return new Response("Lien indisponible", { status: 404, headers });
        const { share, supabaseAdmin } = access;
        const { data, error } = await supabaseAdmin.storage.from("files").download(share.files.storage_path);
        if (error || !data) return new Response("Fichier indisponible", { status: 404, headers });
        // Recheck after retrieving the object, in case the link was revoked meanwhile.
        if (!await findValidShare(params.token)) return new Response("Lien indisponible", { status: 404, headers });
        const safeInline = /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm)|audio\/(mpeg|ogg|wav)|application\/pdf)$/.test(share.files.mime_type);
        headers.set("Content-Type", safeInline ? share.files.mime_type : "application/octet-stream");
        headers.set("Content-Disposition", `${share.permission === "download" || !safeInline ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(share.files.name)}`);
        return new Response(data, { headers });
      },
    },
  },
});