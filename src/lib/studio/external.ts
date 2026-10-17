export type ExternalImageSource =
  | { kind: "file"; file: File }
  | { kind: "url"; url: string };

/** DataTransfer-like: covers both drops and clipboard events. */
export type DataTransferLike = {
  files: FileList | null;
  getData(type: string): string;
};

function toHttpUrl(candidate: string): string | null {
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // not a URL at all
  }
  return null;
}

function firstHttpUrlIn(text: string): string | null {
  for (const token of text.split(/\s+/)) {
    const url = toHttpUrl(token);
    if (url) return url;
  }
  return null;
}

/**
 * Decide what a drop or paste carried: a real image file wins, then an
 * http(s) URL from `text/uri-list`, then one inside `text/plain`.
 */
export function extractImageSource(
  data: DataTransferLike,
): ExternalImageSource | null {
  const files = data.files ? Array.from(data.files) : [];
  const image = files.find((file) => file.type.startsWith("image/"));
  if (image) return { kind: "file", file: image };

  const uriList = data.getData("text/uri-list");
  if (uriList) {
    for (const line of uriList.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const url = toHttpUrl(trimmed);
      if (url) return { kind: "url", url };
    }
  }

  const text = data.getData("text/plain");
  if (text) {
    const url = firstHttpUrlIn(text);
    if (url) return { kind: "url", url };
  }

  return null;
}
