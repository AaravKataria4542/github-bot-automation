import crypto from "crypto";

/**
 * Verifies a GitHub webhook signature using HMAC-SHA256.
 *
 * GitHub sends the signature in the X-Hub-Signature-256 header as:
 *   sha256=<hex_digest>
 *
 * Security properties:
 * - Uses crypto.timingSafeEqual to prevent timing attacks
 * - Validates both the prefix and the digest
 *
 * @param rawBody  The raw request body as a string (before JSON parsing)
 * @param signature The value of the X-Hub-Signature-256 header
 * @param secret   The webhook secret configured for this repository
 * @returns true if the signature is valid, false otherwise
 */
export function verifyGitHubSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!signature.startsWith("sha256=")) return false;

  const expectedSig = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")}`;

  // Both buffers must be the same length for timingSafeEqual
  if (expectedSig.length !== signature.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSig, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}
