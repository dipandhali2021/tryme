import { writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/images/proxy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/images/proxy")>();
  return { ...actual, fetchAndCacheImage: vi.fn() };
});

import { GET } from "@/app/api/proxy-image/route";
import { fetchAndCacheImage } from "@/lib/images/proxy";

const mockedFetch = vi.mocked(fetchAndCacheImage);

const req = (qs: string) =>
  new Request(`http://localhost:3000/api/proxy-image${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/proxy-image", () => {
  it("rejects a missing url", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("rejects a disallowed host", async () => {
    const res = await GET(req("?url=https%3A%2F%2Fevil.com%2Fx.jpg"));
    expect(res.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("streams the cached image with immutable caching", async () => {
    const path = "/tmp/opencode/proxy-route-test.png";
    writeFileSync(path, "png-bytes");
    mockedFetch.mockResolvedValue({ path, contentType: "image/png" });

    const res = await GET(
      req("?url=https%3A%2F%2Frukmini1.flixcart.com%2Fimage%2F512%2F512%2Fx.jpg"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("redirects to the original URL when fetching fails", async () => {
    mockedFetch.mockResolvedValue(null);
    const original = "https://rukmini1.flixcart.com/image/512/512/x.jpg";
    const res = await GET(req(`?url=${encodeURIComponent(original)}`));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(original);
  });
});
