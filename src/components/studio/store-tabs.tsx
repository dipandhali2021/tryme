"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StoreId } from "@/lib/stores/types";

const STORES: Array<{ id: StoreId; label: string }> = [
  { id: "flipkart", label: "Flipkart" },
  { id: "myntra", label: "Myntra" },
  { id: "amazon", label: "Amazon" },
];

export type StoreTabsProps = {
  value: StoreId;
  onValueChange: (store: StoreId) => void;
};

export function StoreTabs({ value, onValueChange }: StoreTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as StoreId)}
    >
      <TabsList>
        {STORES.map((store) => (
          <TabsTrigger key={store.id} value={store.id}>
            {store.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
