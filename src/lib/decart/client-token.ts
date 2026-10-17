import { createDecartClient } from "@decartai/sdk";

/** How long a key that just failed is tried last before we trust it again. */
const RETRY_COOLDOWN_MS = 60_000;
const cooldownUntil = new Map<string, number>();

/**
 * Candidate API keys, primary first: `DECART_API_KEY`, then `DECART_API_KEY_2`
 * `_3` … in numeric order, then any extras in `DECART_API_KEYS` (comma or
 * whitespace separated). Duplicates are dropped.
 */
export function decartApiKeys(env: NodeJS.ProcessEnv = process.env): string[] {
  const keys: string[] = [];
  const push = (value: string | undefined) => {
    for (const part of (value ?? "").split(/[\s,;]+/)) {
      const key = part.trim();
      if (key && !keys.includes(key)) keys.push(key);
    }
  };

  push(env.DECART_API_KEY);
  const numbered = Object.keys(env)
    .filter((name) => /^DECART_API_KEY_\d+$/.test(name))
    .sort(
      (a, b) =>
        Number(a.slice("DECART_API_KEY_".length)) -
        Number(b.slice("DECART_API_KEY_".length)),
    );
  for (const name of numbered) push(env[name]);
  push(env.DECART_API_KEYS);
  return keys;
}

/**
 * Mint a short-lived client token server-side so the permanent API key
 * never reaches the browser. Restricted to the VTON model (and the calling
 * origin when known) as defense-in-depth.
 *
 * Tries every configured key in order: an exhausted key (out of credits,
 * revoked, rate-limited) falls through to the next one automatically. A key
 * that just failed is tried last for the next minute, so a dead primary
 * doesn't cost a failed round-trip on every session.
 */
export async function createClientToken(
  origin?: string,
): Promise<{ apiKey: string; expiresAt: number }> {
  const keys = decartApiKeys();
  if (keys.length === 0) {
    throw new Error("DECART_API_KEY is not set");
  }

  const now = Date.now();
  const fresh = keys.filter((key) => (cooldownUntil.get(key) ?? 0) <= now);
  const cooling = keys.filter((key) => (cooldownUntil.get(key) ?? 0) > now);
  const order = [...fresh, ...cooling];

  let lastError: unknown;
  for (const [attempt, apiKey] of order.entries()) {
    try {
      const client = createDecartClient({ apiKey });
      const token = await client.tokens.create({
        expiresIn: 300,
        allowedModels: ["lucy-vton-3.6"],
        // Decart rejects an empty allowedOrigins array — omit it when unknown.
        ...(origin ? { allowedOrigins: [origin] } : {}),
      });
      cooldownUntil.delete(apiKey);
      return {
        apiKey: token.apiKey,
        expiresAt: Date.parse(token.expiresAt),
      };
    } catch (error) {
      lastError = error;
      cooldownUntil.set(apiKey, Date.now() + RETRY_COOLDOWN_MS);
      if (attempt < order.length - 1) {
        console.warn(
          `[decart] key #${keys.indexOf(apiKey) + 1} of ${keys.length} failed — trying the next`,
          error,
        );
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Every Decart API key failed");
}
