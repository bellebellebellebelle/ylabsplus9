import { Blob as NodeBlob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { clearKey, decryptBlob, e2eEnabled, encryptBlob, hasKey, rememberVerifier, unlock } from "@/lib/e2e";

vi.stubGlobal("crypto", webcrypto);
vi.stubGlobal("Blob", NodeBlob);
afterAll(() => vi.unstubAllGlobals());

afterEach(() => { clearKey(); localStorage.clear(); });

describe("Browser end-to-end encryption", () => {
  it("requires encryption even when the old browser preference disables it", () => {
    localStorage.setItem("nova-e2e", "0");
    expect(e2eEnabled()).toBe(true);
  });
  it("rejects a wrong phrase at unlock when the local verifier exists", async () => {
    await unlock("verification-passphrase", "test-user");
    await rememberVerifier("test-user");
    clearKey();
    await expect(unlock("incorrect-passphrase", "test-user")).rejects.toThrow("Phrase secrète incorrecte");
    expect(hasKey()).toBe(false);
  });
  it("rejects malformed encrypted objects", async () => {
    await unlock("verification-passphrase", "test-user");
    await expect(decryptBlob(new Blob(["plain text"]), "text/plain")).rejects.toThrow("Fichier chiffré invalide");
  });
  it("encrypts files and restores their exact content with the same passphrase", async () => {
    await unlock("verification-passphrase", "test-user");
    const encrypted = await encryptBlob(new Blob(["Private document"]));
    expect(await encrypted.text()).not.toBe("Private document");
    expect(await (await decryptBlob(encrypted, "text/plain")).text()).toBe("Private document");
  });

  it("rejects another passphrase instead of returning private file content", async () => {
    await unlock("verification-passphrase", "test-user");
    const encrypted = await encryptBlob(new Blob(["Private document"]));
    await unlock("incorrect-passphrase", "test-user");
    await expect(decryptBlob(encrypted, "text/plain")).rejects.toThrow("Phrase secrète incorrecte");
  });

  it("does not encrypt or decrypt when the vault is locked", async () => {
    clearKey();
    expect(hasKey()).toBe(false);
    await expect(encryptBlob(new Blob(["Private document"]))).rejects.toThrow("Coffre verrouillé");
    await expect(decryptBlob(new Blob([]), "text/plain")).rejects.toThrow("Coffre verrouillé");
  });
});