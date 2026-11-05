// Client-side end-to-end encryption (AES-256-GCM, key derived from a passphrase with PBKDF2).
// The passphrase and key never leave the browser.
const MAGIC = new TextEncoder().encode("NOVAE2E1");
let key: CryptoKey | null = null;

export const hasKey = () => !!key;
export const clearKey = () => { key = null; };
// Encryption is mandatory for all new imports, not a mutable browser preference.
export const e2eEnabled = () => true;
export const setE2eEnabled = (_on: boolean) => {};

const verifierName = (userId: string) => `nova-vault-verifier:${userId}`;
export const hasVerifier = (userId: string) => !!localStorage.getItem(verifierName(userId));

export async function rememberVerifier(userId: string) {
  const encrypted = new Uint8Array(await (await encryptBlob(new Blob(["Nova vault verification"]))).arrayBuffer());
  localStorage.setItem(verifierName(userId), btoa(String.fromCharCode(...encrypted)));
}

export async function unlock(passphrase: string, userId: string) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new TextEncoder().encode(`nova:${userId}`), iterations: 250_000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(verifierName(userId)) : null;
  if (saved) {
    try {
      const blob = new Blob([Uint8Array.from(atob(saved), (c) => c.charCodeAt(0))]);
      if (await (await decryptBlob(blob, "text/plain")).text() !== "Nova vault verification") throw new Error();
    } catch {
      clearKey();
      throw new Error("Phrase secrète incorrecte ou vérification locale endommagée.");
    }
  }
}

export async function encryptBlob(file: Blob): Promise<Blob> {
  if (!key) throw new Error("Coffre verrouillé");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await file.arrayBuffer());
  return new Blob([MAGIC, iv, ct], { type: "application/octet-stream" });
}

export async function decryptBlob(blob: Blob, mime: string): Promise<Blob> {
  if (!key) throw new Error("Coffre verrouillé");
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.length < MAGIC.length + 12 + 16 || !MAGIC.every((b, i) => buf[i] === b)) throw new Error("Fichier chiffré invalide");
  const iv = buf.slice(MAGIC.length, MAGIC.length + 12);
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, buf.slice(MAGIC.length + 12));
    return new Blob([pt], { type: mime });
  } catch {
    throw new Error("Phrase secrète incorrecte");
  }
}
