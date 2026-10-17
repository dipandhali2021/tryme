import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/import-link/route";
import { parseGarmentHtml } from "@/lib/stores/link";
import {
  findStoreLink,
  looksLikeStoreLink,
  storeFromHost,
} from "@/lib/stores/link-url";

describe("storeFromHost", () => {
  it("maps amazon, flipkart and myntra hosts", () => {
    expect(storeFromHost("www.amazon.in")).toBe("amazon");
    expect(storeFromHost("amazon.com")).toBe("amazon");
    expect(storeFromHost("www.amazon.co.uk")).toBe("amazon");
    expect(storeFromHost("www.flipkart.com")).toBe("flipkart");
    expect(storeFromHost("m.myntra.com")).toBe("myntra");
  });

  it("maps share-link hosts", () => {
    expect(storeFromHost("amzn.to")).toBe("amazon");
    expect(storeFromHost("fkrt.it")).toBe("flipkart");
    expect(storeFromHost("myntr.it")).toBe("myntra");
  });

  it("rejects unrelated hosts", () => {
    expect(storeFromHost("example.com")).toBeNull();
    expect(storeFromHost("notamazon.com")).toBeNull();
    expect(storeFromHost("amazon.in.evil.com")).toBeNull();
  });
});

describe("findStoreLink", () => {
  it("finds a store URL inside pasted text", () => {
    const url = findStoreLink(
      "look at this https://www.flipkart.com/kurta/p/itm123?pid=XYZ",
    );
    expect(url?.hostname).toBe("www.flipkart.com");
  });

  it("accepts scheme-less links and trims trailing punctuation", () => {
    expect(findStoreLink("myntra.com/dress/123")?.hostname).toBe("myntra.com");
    expect(findStoreLink("(https://amzn.to/4abc).")?.hostname).toBe("amzn.to");
  });

  it("returns null for ordinary searches", () => {
    expect(findStoreLink("black kurta")).toBeNull();
    expect(looksLikeStoreLink("black kurta")).toBe(false);
    expect(looksLikeStoreLink("https://example.com/product/1")).toBe(false);
  });
});

const FLIPKART_PAGE = `<!doctype html><html><head>
<meta property="og:title" content="KALINI Embroidered Kurta" />
<meta property="og:image" content="https://rukminim2.flixcart.com/image/832/832/xif0q/kurta/k/1.jpeg?q=90" />
<script type="application/ld+json">{"@type":"Product","name":"KALINI Kurta","brand":{"@type":"Brand","name":"KALINI"},"image":["https://rukminim2.flixcart.com/image/x.jpeg"],"offers":{"@type":"Offer","price":"1099"}}</script>
</head></html>`;

describe("parseGarmentHtml", () => {
  it("prefers the JSON-LD name and og:image, reads brand/price", () => {
    const garment = parseGarmentHtml(
      FLIPKART_PAGE,
      "flipkart",
      "https://www.flipkart.com/x/p/itm1",
    );
    expect(garment).toMatchObject({
      store: "flipkart",
      title: "KALINI Kurta",
      brand: "KALINI",
      price: 1099,
      imageUrl: "https://rukminim2.flixcart.com/image/832/832/xif0q/kurta/k/1.jpeg?q=90",
      productUrl: "https://www.flipkart.com/x/p/itm1",
    });
  });

  it("falls back to JSON-LD when og tags are missing", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Dress","image":"/img/dress.jpg","offers":{"price":2499}}</script>`;
    const garment = parseGarmentHtml(html, "myntra", "https://www.myntra.com/dress/1");
    expect(garment).toMatchObject({
      imageUrl: "https://www.myntra.com/img/dress.jpg",
      title: "Dress",
      price: 2499,
    });
  });

  it("parses content-before-property meta tags", () => {
    const html = `<meta content="https://cdn.example.com/a.jpeg" property="og:image"/><title>  Blue   Jeans  </title>`;
    const garment = parseGarmentHtml(html, "amazon", "https://www.amazon.in/dp/B0TEST");
    expect(garment?.imageUrl).toBe("https://cdn.example.com/a.jpeg");
    expect(garment?.title).toBe("Blue Jeans");
    expect(garment?.price).toBeUndefined();
  });

  it("reads a numeric meta-only price when JSON-LD is absent", () => {
    const html = `<meta property="og:image" content="https://cdn.example.com/a.jpeg"/><meta property="og:title" content="Saree"/><meta property="og:price:amount" content="1499.00"/>`;
    const garment = parseGarmentHtml(html, "amazon", "https://www.amazon.in/dp/B0TEST");
    expect(garment?.price).toBe(1499);
  });

  it("returns null when there is no usable image", () => {
    expect(
      parseGarmentHtml("<html><title>No image</title></html>", "amazon", "https://www.amazon.in/x"),
    ).toBeNull();
  });
});

describe("GET /api/import-link", () => {
  it("rejects a missing url without any fetch", async () => {
    const res = await GET(new Request("http://localhost/api/import-link"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/paste/i);
  });

  it("rejects a non-store link without any fetch", async () => {
    const res = await GET(
      new Request("http://localhost/api/import-link?url=https%3A%2F%2Fexample.com%2Fp%2F1"),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/amazon, flipkart or myntra/i);
  });
});
