import { beforeEach, describe, expect, it, vi } from "vitest";

const tokensCreate = vi.fn();
vi.mock("@decartai/sdk", () => ({
  createDecartClient: vi.fn(() => ({ tokens: { create: tokensCreate } })),
}));

import { POST } from "@/app/api/realtime-token/route";
import { createClientToken } from "@/lib/decart/client-token";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("createClientToken", () => {
  it("mints a short-lived token restricted to the vton model and origin", async () => {
    vi.stubEnv("DECART_API_KEY", "sk-test");
    tokensCreate.mockResolvedValue({
      apiKey: "ek_123",
      expiresAt: "2026-10-16T12:00:00.000Z",
    });

    const token = await createClientToken("http://localhost:3000");
    expect(tokensCreate).toHaveBeenCalledWith({
      expiresIn: 300,
      allowedModels: ["lucy-vton-3.6"],
      allowedOrigins: ["http://localhost:3000"],
    });
    expect(token.apiKey).toBe("ek_123");
    expect(token.expiresAt).toBe(Date.parse("2026-10-16T12:00:00.000Z"));
  });

  it("omits origins entirely when none is provided (API rejects empty arrays)", async () => {
    vi.stubEnv("DECART_API_KEY", "sk-test");
    tokensCreate.mockResolvedValue({
      apiKey: "ek_123",
      expiresAt: "2026-10-16T12:00:00.000Z",
    });

    await createClientToken();
    const payload = tokensCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("allowedOrigins");
  });

  it("rejects without the api key", async () => {
    await expect(createClientToken()).rejects.toThrow(/DECART_API_KEY/);
    expect(tokensCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/realtime-token", () => {
  it("returns a token for a valid origin", async () => {
    vi.stubEnv("DECART_API_KEY", "sk-test");
    tokensCreate.mockResolvedValue({
      apiKey: "ek_123",
      expiresAt: "2026-10-16T12:00:00.000Z",
    });

    const res = await POST(
      new Request("http://localhost:3000/api/realtime-token", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { apiKey: string; expiresAt: number };
    expect(body.apiKey).toBe("ek_123");
    expect(typeof body.expiresAt).toBe("number");
    expect(tokensCreate).toHaveBeenCalledWith(
      expect.objectContaining({ allowedOrigins: ["http://localhost:3000"] }),
    );
  });

  it("returns 500 without leaking details when the key is missing", async () => {
    const res = await POST(
      new Request("http://localhost:3000/api/realtime-token", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string; apiKey?: string };
    expect(body.error).toBeDefined();
    expect(body.apiKey).toBeUndefined();
    expect(tokensCreate).not.toHaveBeenCalled();
  });
});
