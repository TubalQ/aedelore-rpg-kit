import { createHash } from "node:crypto";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function generatePkce(): PkcePair {
  const verifier = crypto.randomUUID() + crypto.randomUUID();
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  const computed = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return computed === challenge;
}
