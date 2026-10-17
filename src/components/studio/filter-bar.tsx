"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatINR } from "@/lib/format";
import type { Filters } from "@/lib/stores/filter";
import type { Category } from "@/lib/stores/types";

const CATEGORY_OPTIONS: Array<{ value: Category | "all"; label: string }> = [
  { value: "all", label: "All categories" },
  { value: "topwear", label: "Tops & shirts" },
  { value: "bottomwear", label: "Bottoms" },
  { value: "dress", label: "Dresses" },
  { value: "footwear", label: "Footwear" },
  { value: "accessory", label: "Accessories" },
  { value: "other", label: "Other" },
];

const GENDER_OPTIONS: Array<{ value: Filters["gender"]; label: string }> = [
  { value: "all", label: "All" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "unisex", label: "Unisex" },
];

const SORT_OPTIONS: Array<{ value: Filters["sort"]; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "discount_desc", label: "Discount" },
];

export type FilterBarProps = {
  filters: Filters;
  onChange: (next: Filters) => void;
  brands: string[];
  colors: string[];
};

const PRICE_MIN = 0;
const PRICE_MAX = 5000;

export function FilterBar({
  filters,
  onChange,
  brands,
  colors,
}: FilterBarProps) {
  const patch = (part: Partial<Filters>) => onChange({ ...filters, ...part });

  return (
    <div className="flex flex-wrap items-center gap-s-2">
      <Select
        value={filters.category}
        onValueChange={(next) =>
          patch({ category: next as Filters["category"] })
        }
      >
        <SelectTrigger aria-label="Category" className="min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.colors[0] ?? "all"}
        onValueChange={(next) =>
          patch({ colors: next === "all" ? [] : [next] })
        }
      >
        <SelectTrigger aria-label="Color" className="min-w-28">
          <SelectValue placeholder="Color" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All colors</SelectItem>
          {colors.map((color) => (
            <SelectItem key={color} value={color}>
              {color}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.brands[0] ?? "all"}
        onValueChange={(next) =>
          patch({ brands: next === "all" ? [] : [next] })
        }
      >
        <SelectTrigger aria-label="Brand" className="min-w-28">
          <SelectValue placeholder="Brand" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All brands</SelectItem>
          {brands.map((brand) => (
            <SelectItem key={brand} value={brand}>
              {brand}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ToggleGroup
        type="single"
        value={filters.gender}
        onValueChange={(next) => {
          if (next) patch({ gender: next as Filters["gender"] });
        }}
        aria-label="Gender"
      >
        {GENDER_OPTIONS.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Select
        value={filters.sort}
        onValueChange={(next) => patch({ sort: next as Filters["sort"] })}
      >
        <SelectTrigger aria-label="Sort" className="min-w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex min-w-52 flex-1 items-center gap-s-3 px-s-1">
        <span className="whitespace-nowrap text-v-small text-muted-foreground tabular-nums">
          {formatINR(filters.priceMin)} – {formatINR(filters.priceMax)}
        </span>
        <Slider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={100}
          value={[filters.priceMin, filters.priceMax]}
          onValueChange={(value) =>
            patch({ priceMin: value[0], priceMax: value[1] })
          }
          aria-label="Price range"
          className="flex-1"
        />
      </div>
    </div>
  );
}
