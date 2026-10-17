import { createDecartClient } from "@decartai/sdk";

/**
 * Mint a short-lived client token server-side so the permanent API key
 * never reaches the browser. Restricted to the VTON model (and the calling
 * origin when known) as defense-in-depth.
 */
export async function createClientToken(
  origin?: string,
): Promise<{ apiKey: string; expiresAt: number }> {
  const apiKey = process.env.DECART_API_KEY;
  if (!apiKey) {
    throw new Error("DECART_API_KEY is not set");
  }

  const client = createDecartClient({ apiKey });
  const token = await client.tokens.create({
    expiresIn: 300,
    allowedModels: ["lucy-vton-3.6"],
    // Decart rejects an empty allowedOrigins array — omit it when unknown.
    ...(origin ? { allowedOrigins: [origin] } : {}),
  });

  return {
    apiKey: token.apiKey,
    expiresAt: Date.parse(token.expiresAt),
  };
}
