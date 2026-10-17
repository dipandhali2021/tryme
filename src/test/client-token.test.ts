import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDecartClient } from "@decartai/sdk";

const tokensCreate = vi.fn();
vi.mock("@decartai/sdk", () => ({
  createDecartClient: vi.fn(() => ({ tokens: { create: tokensCreate } })),
}));

import { POST } from "@/app/api/realtime-token/route";
import { createClientToken, decartApiKeys } from "@/lib/decart/client-token";

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

describe("createClientToken key fallback", () => {
  const clientKeys = () =>
    vi
      .mocked(createDecartClient)
      .mock.calls.map(([options]) => options?.apiKey);

  beforeEach(() => {
    tokensCreate.mockReset();
  });

  it("moves to the next key when one is exhausted", async () => {
    vi.stubEnv("DECART_API_KEY", "sk-fallback-primary");
    vi.stubEnv("DECART_API_KEY_2", "sk-fallback-backup");
    tokensCreate
      .mockRejectedValueOnce(new Error("402: insufficient credits"))
      .mockResolvedValueOnce({
        apiKey: "ek_next",
        expiresAt: "2026-10-16T12:00:00.000Z",
      });

    const token = await createClientToken();
    expect(token.apiKey).toBe("ek_next");
    expect(clientKeys()).toEqual(["sk-fallback-primary", "sk-fallback-backup"]);
  });

  it("tries a key that just failed last until its cooldown expires", async () => {
    vi.stubEnv("DECART_API_KEY", "sk-cooldown-primary");
    vi.stubEnv("DECART_API_KEY_2", "sk-cooldown-backup");
    tokensCreate
      .mockRejectedValueOnce(new Error("401 unauthorized"))
      .mockResolvedValueOnce({
        apiKey: "ek_first",
        expiresAt: "2026-10-16T12:00:00.000Z",
      });
    await createClientToken();
    vi.mocked(createDecartClient).mockClear();

    tokensCreate.mockResolvedValue({
      apiKey: "ek_second",
      expiresAt: "2026-10-16T12:00:00.000Z",
    });
    const token = await createClientToken();
    expect(token.apiKey).toBe("ek_second");
    expect(clientKeys()).toEqual(["sk-cooldown-backup"]);
  });

  it("throws the last error when every key fails", async () => {
    vi.stubEnv("DECART_API_KEY", "sk-allfail-primary");
    vi.stubEnv("DECART_API_KEY_2", "sk-allfail-backup");
    tokensCreate
      .mockRejectedValueOnce(new Error("primary exploded"))
      .mockRejectedValueOnce(new Error("backup exploded"));

    await expect(createClientToken()).rejects.toThrow("backup exploded");
    expect(tokensCreate).toHaveBeenCalledTimes(2);
  });

  it("collects numbered and list keys in order, deduplicated", () => {
    vi.stubEnv("DECART_API_KEY", "one");
    vi.stubEnv("DECART_API_KEY_10", "ten");
    vi.stubEnv("DECART_API_KEY_2", "two");
    vi.stubEnv("DECART_API_KEYS", "three, one");
    expect(decartApiKeys()).toEqual(["one", "two", "ten", "three"]);
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
