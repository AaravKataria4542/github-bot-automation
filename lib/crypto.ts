/**
 * Web Crypto API AES-256-GCM encryption/decryption utilities.
 *
 * This implementation uses Web Crypto API (globalThis.crypto.subtle) instead of
 * Node.js native 'crypto' module. This ensures 100% compatibility with Vercel's Edge
 * Runtime (which NextAuth middleware runs on), eliminating the "A Node.js module is loaded
 * which is not supported in the Edge Runtime" crash.
 */

// Helper to convert ArrayBuffer to Base64 string safely in any JS environment
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 string to Uint8Array safely in any JS environment
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to derive a 256-bit AES-GCM key from ENCRYPTION_KEY using SHA-256
async function getCryptoKey(): Promise<CryptoKey> {
  const keyText = process.env.ENCRYPTION_KEY;
  if (!keyText) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  const encoder = new TextEncoder();
  const rawKey = encoder.encode(keyText);

  // Hash the variable-length password to get a secure 256-bit key
  const hash = await crypto.subtle.digest("SHA-256", rawKey);

  return await crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: base64(iv + ciphertext)
 */
export async function encrypt(text: string): Promise<string> {
  const key = await getCryptoKey();
  const encoder = new TextEncoder();
  const rawData = encoder.encode(text);

  // Standard 12-byte IV for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    rawData
  );

  // Combine IV and Ciphertext into one array
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypts a base64-encoded AES-256-GCM ciphertext.
 */
export async function decrypt(encryptedText: string): Promise<string> {
  const key = await getCryptoKey();
  const combined = base64ToUint8Array(encryptedText);

  // Extract standard 12-byte IV
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Generates a cryptographically secure random hex string for webhook secrets.
 */
export function generateSecret(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
