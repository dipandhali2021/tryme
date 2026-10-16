export type StoreId = "amazon" | "flipkart" | "myntra";

export type Category =
  | "topwear"
  | "bottomwear"
  | "dress"
  | "footwear"
  | "accessory"
  | "other";

export type Gender = "men" | "women" | "unisex" | "kids" | "unknown";

export type Product = {
  id: string;
  store: StoreId;
  title: string;
  brand?: string;
  price: number;
  mrp?: number;
  discountPct?: number;
  color?: string;
  gender: Gender;
  category: Category;
  imageUrl: string;
  productUrl: string;
  rating?: number;
};
