import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stores/search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stores/search")>();
  return { ...actual, searchStore: vi.fn() };
});

import { GET } from "@/app/api/search/route";
import { searchStore } from "@/lib/stores/search";

const mockedSearchStore = vi.mocked(searchStore);

const req = (qs: string) =>
  new Request(`http://localhost:3000/api/search${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/search", () => {
  it("rejects a bad store", async () => {
    const res = await GET(req("?store=nope&q=shirt"));
    expect(res.status).toBe(400);
    expect(mockedSearchStore).not.toHaveBeenCalled();
  });

  it("rejects an empty query", async () => {
    const res = await GET(req("?store=flipkart&q="));
    expect(res.status).toBe(400);
    expect(mockedSearchStore).not.toHaveBeenCalled();
  });

  it("rejects a query longer than 100 chars", async () => {
    const res = await GET(req(`?store=flipkart&q=${"a".repeat(101)}`));
    expect(res.status).toBe(400);
    expect(mockedSearchStore).not.toHaveBeenCalled();
  });

  it("returns the SearchResponse for a valid request", async () => {
    mockedSearchStore.mockResolvedValue({
      store: "flipkart",
      q: "shirt",
      page: 2,
      products: [],
      cached: false,
      fetchedAt: 123,
    });

    const res = await GET(req("?store=flipkart&q=shirt&page=2"));
    expect(res.status).toBe(200);
    expect(mockedSearchStore).toHaveBeenCalledWith("flipkart", "shirt", 2);
    const body = (await res.json()) as { store: string; page: number };
    expect(body.store).toBe("flipkart");
    expect(body.page).toBe(2);
  });
});
