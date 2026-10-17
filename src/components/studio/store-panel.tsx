"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ExternalLink, Search, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { DropZone } from "@/components/studio/drop-zone";
import { FilterBar } from "@/components/studio/filter-bar";
import { ProductCard } from "@/components/studio/product-card";
import { StoreTabs } from "@/components/studio/store-tabs";
import { fetchSearch, importProductLink } from "@/lib/api";
import { formatINR } from "@/lib/format";
import {
  DEFAULT_FILTERS,
  applyFilters,
  deriveBrands,
  deriveColors,
  type Filters,
} from "@/lib/stores/filter";
import {
  looksLikeStoreLink,
  type ImportedGarment,
} from "@/lib/stores/link-url";
import type { SearchResponse } from "@/lib/stores/search";
import type { Product, StoreId } from "@/lib/stores/types";
import type { ExternalImageSource } from "@/lib/studio/external";

const SUGGESTIONS = ["shirt", "jeans", "dress", "sneakers"];

const STORE_LABEL: Record<StoreId, string> = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  myntra: "Myntra",
};

export type StorePanelProps = {
  onTryOn: (imageUrl: string) => void;
};

type PinnedGarment = {
  label: string;
  /** What the try-on session receives (object URL or remote URL). */
  imageUrl: string;
  /** What the thumbnail renders. */
  previewUrl: string;
};

function AmazonFallback({ url }: { url: string | undefined }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-v-paper p-s-5 text-center">
      <p className="text-v-title font-weight-v-semibold">
        Amazon blocks live search
      </p>
      <p className="mt-s-1 text-v-small text-muted-foreground">
        Amazon does not allow server-side scraping, so TryMe opens it in a new
        tab instead. Drag any product image from that tab onto this panel to
        try it on.
      </p>
      {url ? (
        <Button asChild className="mt-s-4">
          <a href={url} target="_blank" rel="noreferrer">
            Open Amazon search
            <ExternalLink className="ml-s-1 size-4" aria-hidden />
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function StartState({ onPick }: { onPick: (query: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-s-2 py-s-10 text-center">
      <p className="text-v-title font-weight-v-semibold">
        Find something to wear
      </p>
      <p className="max-w-sm text-v-small text-muted-foreground">
        Search Flipkart or Myntra, hit Try on, and watch it land on you. 20
        seconds per try.
      </p>
      <div className="flex flex-wrap justify-center gap-s-2 pt-s-3">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            onClick={() => onPick(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-s-3 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="aspect-[3/4] rounded-2xl" />
      ))}
    </div>
  );
}

/**
 * Right half of the studio: store tabs, search, filters, and the live
 * product grid. Each Try on hands the garment image to the try-on session.
 */
export function StorePanel({ onTryOn }: StorePanelProps) {
  const [store, setStore] = useState<StoreId>("flipkart");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    response: SearchResponse;
  } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [toast, setToast] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [pinned, setPinned] = useState<PinnedGarment | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ImportedGarment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importingRef = useRef(false);

  /** A dropped/pasted/uploaded garment becomes a pinned card + Try it on. */
  const pinSource = useCallback((source: ExternalImageSource) => {
    if (source.kind === "file") {
      const objectUrl = URL.createObjectURL(source.file);
      setPinned({
        label: "From your device",
        imageUrl: objectUrl,
        previewUrl: objectUrl,
      });
    } else {
      setPinned({
        label: "From the web",
        imageUrl: source.url,
        previewUrl: `/api/proxy-image?url=${encodeURIComponent(source.url)}`,
      });
    }
  }, []);

  /** Turn a product link into a garment card. Importing itself is free. */
  const runImport = useCallback((text: string) => {
    if (importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    importProductLink(text)
      .then((garment) => {
        setImported(garment);
        setInput("");
      })
      .catch((err: unknown) => {
        setToast({
          title: "Link trouble",
          message:
            err instanceof Error ? err.message : "Couldn't read that link.",
        });
      })
      .finally(() => {
        importingRef.current = false;
        setImporting(false);
      });
  }, []);

  // The identity of the search currently being asked for.
  const searchKey = useMemo(
    () => (query ? `${store}\u0000${query}\u0000${nonce}` : null),
    [store, query, nonce],
  );
  // Loading is derived (not set in an effect): we are waiting whenever the
  // latest request's key does not match the latest result or error.
  const loading =
    searchKey !== null && result?.key !== searchKey && errorKey !== searchKey;
  const response = result?.response ?? null;

  useEffect(() => {
    if (!searchKey || !query) return;
    let cancelled = false;
    const key = searchKey;
    fetchSearch(store, query)
      .then((res) => {
        if (cancelled) return;
        setErrorKey(null);
        setResult({ key, response: res });
        setFilters((current) => ({ ...current, colors: [], brands: [] }));
        if (res.error) setToast({ title: "Search trouble", message: res.error });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorKey(key);
        setToast({
          title: "Search trouble",
          message: err instanceof Error ? err.message : "Search failed",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [searchKey, store, query]);

  const submit = (value?: string) => {
    const next = (value ?? input).trim();
    if (!next) return;
    if (looksLikeStoreLink(next)) {
      runImport(next);
      return;
    }
    setInput(next);
    setQuery(next);
    setNonce((n) => n + 1);
  };

  const products = useMemo(() => response?.products ?? [], [response]);
  const visible = useMemo(
    () => applyFilters(products, filters),
    [products, filters],
  );
  const brands = useMemo(() => deriveBrands(products), [products]);
  const colors = useMemo(() => deriveColors(products), [products]);

  const blocked = Boolean(response?.blocked);
  const hasSearched = query !== null;

  return (
    <DropZone
      onSource={pinSource}
      onLink={(text) => {
        if (!looksLikeStoreLink(text)) return false;
        runImport(text);
        return true;
      }}
    >
      <section className="flex min-h-0 flex-col bg-v-canvas">
        <div className="flex flex-col gap-s-3 border-b border-border p-s-4">
          <StoreTabs value={store} onValueChange={setStore} />
          <form
            className="flex gap-s-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <Search className="size-4" aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={(event) => {
                  const text = event.clipboardData.getData("text/plain");
                  if (looksLikeStoreLink(text)) {
                    event.preventDefault();
                    runImport(text);
                  }
                }}
                placeholder="Search shirts, jeans… or paste a product link"
                aria-label="Search garments or paste a product link"
              />
            </InputGroup>
            <Button
              type="submit"
              variant="secondary"
              disabled={importing}
              aria-busy={importing}
            >
              {importing ? (
                <>
                  <Spinner className="size-4" aria-hidden />
                  Importing…
                </>
              ) : (
                "Search"
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) pinSource({ kind: "file", file });
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              aria-label="Upload a garment photo"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden />
              Upload
            </Button>
          </form>
          {hasSearched && !blocked ? (
            <FilterBar
              filters={filters}
              onChange={setFilters}
              brands={brands}
              colors={colors}
            />
          ) : null}
        </div>
  
        {/* Native scroll area: the cojeev scrollbar policy styles it slim and
            theme-aware, with no frame paint to glitch against the header. */}
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
          <div className="p-s-4">
              {imported ? (
                <div className="mb-s-3 flex items-center gap-s-3 rounded-2xl border border-border bg-v-paper p-s-2 pr-s-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(imported.imageUrl)}`}
                    alt="Imported garment"
                    className="h-20 w-20 shrink-0 rounded-xl bg-white object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <Badge variant="pink-soft">
                      {STORE_LABEL[imported.store]} link
                    </Badge>
                    <p className="mt-s-1 truncate text-v-small text-muted-foreground">
                      {imported.title}
                      {imported.price ? ` · ${formatINR(imported.price)}` : ""}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => onTryOn(imported.imageUrl)}>
                    Try on
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove imported garment"
                    onClick={() => setImported(null)}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              ) : null}
              {pinned ? (
                <div className="mb-s-3 flex items-center gap-s-3 rounded-2xl border border-border bg-v-paper p-s-2 pr-s-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pinned.previewUrl}
                    alt="Pinned garment"
                    className="h-20 w-20 shrink-0 rounded-xl bg-white object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <Badge variant="pink-soft">{pinned.label}</Badge>
                    <p className="mt-s-1 truncate text-v-small text-muted-foreground">
                      Yours whenever you are — it stays pinned for another round.
                    </p>
                  </div>
                  <Button size="sm" onClick={() => onTryOn(pinned.imageUrl)}>
                    Try it on
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove pinned garment"
                    onClick={() => setPinned(null)}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              ) : null}
              {loading ? (
                <SkeletonGrid />
              ) : blocked ? (
                <AmazonFallback url={response?.fallbackSearchUrl} />
              ) : !hasSearched ? (
                <StartState onPick={submit} />
              ) : visible.length === 0 ? (
                <Empty>
                  <EmptyTitle>No matches</EmptyTitle>
                  <EmptyDescription>
                    Try a different search, or loosen the filters up top.
                  </EmptyDescription>
                </Empty>
              ) : (
                <div className="grid grid-cols-2 gap-s-3 xl:grid-cols-3">
                  {visible.map((product: Product) => (
                    <ProductCard
                      key={`${product.store}:${product.id}`}
                      product={product}
                      onTryOn={(picked) => onTryOn(picked.imageUrl)}
                    />
                  ))}
                </div>
              )}
            </div>
        </div>
  
        <ToastProvider>
          <Toast
            variant="danger"
            open={toast !== null}
            onOpenChange={(open) => {
              if (!open) setToast(null);
            }}
          >
            <ToastTitle>{toast?.title ?? ""}</ToastTitle>
            <ToastDescription>{toast?.message ?? ""}</ToastDescription>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      </section>
    </DropZone>
  );
}
