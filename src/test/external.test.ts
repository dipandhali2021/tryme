import { describe, expect, it } from "vitest";
import { extractImageSource } from "@/lib/studio/external";

function makeDataTransfer(init: {
  files?: File[];
  uriList?: string;
  text?: string;
}) {
  return {
    files: (init.files ?? []) as unknown as FileList,
    getData(type: string) {
      if (type === "text/uri-list") return init.uriList ?? "";
      if (type === "text/plain") return init.text ?? "";
      return "";
    },
  };
}

describe("extractImageSource", () => {
  it("prefers an image file over any URL", () => {
    const file = new File(["x"], "shirt.png", { type: "image/png" });
    const source = extractImageSource(
      makeDataTransfer({ files: [file], uriList: "https://cdn.example/a.jpg" }),
    );
    expect(source).toEqual({ kind: "file", file: expect.any(File) });
    expect((source as { kind: "file"; file: File }).file.name).toBe("shirt.png");
  });

  it("skips non-image files when looking for an image", () => {
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const img = new File(["x"], "pic.jpg", { type: "image/jpeg" });
    const source = extractImageSource(makeDataTransfer({ files: [pdf, img] }));
    expect(source).toEqual({ kind: "file", file: expect.any(File) });
    expect((source as { kind: "file"; file: File }).file.name).toBe("pic.jpg");
  });

  it("reads a URL from text/uri-list", () => {
    const url = "https://rukmini1.flixcart.com/image/512/512/x.jpeg?q=70";
    expect(extractImageSource(makeDataTransfer({ uriList: url }))).toEqual({
      kind: "url",
      url,
    });
  });

  it("ignores uri-list comments and blank lines", () => {
    const url = "https://assets.myntassets.com/p.jpg";
    expect(
      extractImageSource(
        makeDataTransfer({ uriList: `# dragged image\n\n${url}\n` }),
      ),
    ).toEqual({ kind: "url", url });
  });

  it("reads a URL from text/plain", () => {
    const url = "https://shop.example/shirt.jpg";
    expect(extractImageSource(makeDataTransfer({ text: url }))).toEqual({
      kind: "url",
      url,
    });
  });

  it("finds a URL inside surrounding plain text", () => {
    const url = "https://shop.example/shirt.jpg";
    expect(
      extractImageSource(
        makeDataTransfer({ text: `look at this ${url} it is nice` }),
      ),
    ).toEqual({ kind: "url", url });
  });

  it("falls back to a URL when only non-image files are present", () => {
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const url = "https://shop.example/shirt.jpg";
    expect(
      extractImageSource(makeDataTransfer({ files: [pdf], text: url })),
    ).toEqual({ kind: "url", url });
  });

  it("returns null for junk text", () => {
    expect(
      extractImageSource(makeDataTransfer({ text: "hello there" })),
    ).toBeNull();
  });

  it("returns null for non-http URLs", () => {
    expect(
      extractImageSource(makeDataTransfer({ text: "ftp://example.com/a.jpg" })),
    ).toBeNull();
  });

  it("returns null for non-image files with no URL", () => {
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    expect(extractImageSource(makeDataTransfer({ files: [pdf] }))).toBeNull();
  });

  it("returns null when there is no data at all", () => {
    expect(extractImageSource(makeDataTransfer({}))).toBeNull();
  });
});
