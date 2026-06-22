/**
 * NOT real security — this is a local-only demo auth layer. It simply avoids
 * storing the passcode in plaintext. Do not reuse for production credentials.
 */
export async function hashPasscode(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`em.salt.v1:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
