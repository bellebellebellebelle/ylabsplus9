import { describe, expect, it } from "vitest";
import { canAccessShare, type ShareAccess } from "@/lib/share-security";

const valid: ShareAccess = { user_id: "owner-b", permission: "view", expires_at: null, files: { name: "private.txt", storage_path: "owner-b/file", size: 10, mime_type: "text/plain", deleted_at: null, encrypted: false, user_id: "owner-b" } };
describe("Share access boundaries", () => {
  it("permits an intentional valid unencrypted share", () => expect(canAccessShare(valid)).toBe(true));
  it("rejects another owner's file", () => expect(canAccessShare({ ...valid, user_id: "owner-a" })).toBe(false));
  it("rejects another owner's storage path", () => expect(canAccessShare({ ...valid, files: { ...valid.files, name: "private.txt", size: 10, mime_type: "text/plain", deleted_at: null, encrypted: false, user_id: "owner-b", storage_path: "owner-a/file" } })).toBe(false));
  it("rejects encrypted files", () => expect(canAccessShare({ ...valid, files: { ...valid.files as NonNullable<ShareAccess["files"]>, encrypted: true } })).toBe(false));
  it("rejects trashed files", () => expect(canAccessShare({ ...valid, files: { ...valid.files as NonNullable<ShareAccess["files"]>, deleted_at: "2026-10-27" } })).toBe(false));
  it("rejects expired links including the exact expiry", () => expect(canAccessShare({ ...valid, expires_at: "2026-10-27T11:34:00Z" }, Date.parse("2026-10-27T11:34:00Z"))).toBe(false));
  it("rejects revoked links", () => expect(canAccessShare(null)).toBe(false));
  it("rejects unsupported permissions", () => expect(canAccessShare({ ...valid, permission: "admin" })).toBe(false));
});