"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatINR } from "@/lib/format";
import type { Product } from "@/lib/stores/types";

export type ProductCardProps = {
  product: Product;
  onTryOn: (product: Product) => void;
};

/**
 * Presentational product tile: a fixed-ratio image (proxied), then a content
 * column that stretches so price + Try on pin to the bottom — every card in a
 * row shares the same image box and button line.
 */
export function ProductCard({ product, onTryOn }: ProductCardProps) {
  const [failed, setFailed] = useState(false);
  const src = `/api/proxy-image?url=${encodeURIComponent(product.imageUrl)}`;
  const showStrike =
    typeof product.mrp === "number" && product.mrp > product.price;

  return (
    <Card className="flex flex-col border border-border p-0">
      <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-v-beige">
        {failed ? (
          <div className="flex h-full items-center justify-center p-s-3 text-center text-v-small text-muted-foreground">
            Image unavailable
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={product.title}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )}

        {typeof product.discountPct === "number" && product.discountPct > 0 ? (
          <Badge variant="pink" className="absolute left-s-2 top-s-2">
            -{product.discountPct}%
          </Badge>
        ) : null}

        <a
          href={product.productUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${product.title} in a new tab`}
          className="absolute right-s-2 top-s-2 rounded-full bg-background/85 p-s-1 text-foreground shadow backdrop-blur transition-colors hover:bg-background"
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>

      <div className="flex flex-1 flex-col gap-s-1 p-s-3">
        {product.brand ? (
          <span className="text-v-meta uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </span>
        ) : null}
        <p className="line-clamp-2 text-v-small font-weight-v-medium">
          {product.title}
        </p>
        <div className="mt-auto flex items-center justify-between gap-s-2 pt-s-2">
          <span className="flex items-baseline gap-s-2">
            <span className="text-v-control font-weight-v-semibold tabular-nums">
              {formatINR(product.price)}
            </span>
            {showStrike ? (
              <span className="text-v-meta text-muted-foreground line-through tabular-nums">
                {formatINR(product.mrp as number)}
              </span>
            ) : null}
          </span>
          <Button size="sm" onClick={() => onTryOn(product)}>
            Try on
          </Button>
        </div>
      </div>
    </Card>
  );
}
