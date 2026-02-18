import { PlaceHolderImages } from "./placeholder-images";

export type Rarity = 0 | 1 | 2 | 3 | 4 | 5;

export const RARITY_LABELS: Record<Rarity, string> = {
  0: "Common",
  1: "Rare",
  2: "Super Rare",
  3: "Super Super Rare (SSR)",
  4: "Ultra Rare",
  5: "Legend Rare",
};

export const RARITY_COLORS: Record<Rarity, string> = {
  0: "text-slate-400",
  1: "text-blue-400",
  2: "text-purple-400",
  3: "text-pink-400",
  4: "text-yellow-400",
  5: "text-red-500",
};

export interface NFT {
  id: string;
  name: string;
  rarity: Rarity;
  variantType: string;
  image: string;
  hp: number;
  atk: number;
  spd: number;
  baseValue: number;
  actualValue: number;
  lootboxSource: string;
  globalId: number;
  price?: number; // For marketplace
  seller?: string;
}

export interface Lootbox {
  id: string;
  name: string;
  price: number;
  currency: "SUI" | "GYATE";
  image: string;
  description: string;
}

export const MOCK_LOOTBOXES: Lootbox[] = [
  {
    id: "lb-1",
    name: "Classic Box",
    price: 1,
    currency: "SUI",
    image: PlaceHolderImages[1].imageUrl,
    description: "The original GyateGyate experience. High chance of Common and Rare pulls."
  },
  {
    id: "lb-2",
    name: "Gyate Hoard",
    price: 100,
    currency: "GYATE",
    image: PlaceHolderImages[1].imageUrl,
    description: "Spend your earned tokens to grow your collection. Higher SSR rates."
  },
  {
    id: "lb-3",
    name: "Legendary Core",
    price: 5,
    currency: "SUI",
    image: PlaceHolderImages[1].imageUrl,
    description: "Guaranteed Rare or better. Increased Legend Rare probabilities."
  }
];

export const MOCK_USER_NFTS: NFT[] = [
  {
    id: "nft-001",
    name: "Shadow Walker",
    rarity: 2,
    variantType: "Normal",
    image: PlaceHolderImages[2].imageUrl,
    hp: 450,
    atk: 120,
    spd: 85,
    baseValue: 1000,
    actualValue: 1000,
    lootboxSource: "Classic Box",
    globalId: 1024
  },
  {
    id: "nft-002",
    name: "Flame Golem",
    rarity: 1,
    variantType: "Shiny",
    image: PlaceHolderImages[3].imageUrl,
    hp: 800,
    atk: 90,
    spd: 30,
    baseValue: 500,
    actualValue: 750,
    lootboxSource: "Classic Box",
    globalId: 542
  }
];

export const MOCK_MARKETPLACE: NFT[] = [
  {
    id: "nft-003",
    name: "Astra Goddess",
    rarity: 5,
    variantType: "Holographic",
    image: PlaceHolderImages[4].imageUrl,
    hp: 2000,
    atk: 450,
    spd: 300,
    baseValue: 10000,
    actualValue: 20000,
    lootboxSource: "Legendary Core",
    globalId: 7,
    price: 15.5,
    seller: "0x7a...bc9"
  },
  {
    id: "nft-004",
    name: "Stone Guardian",
    rarity: 0,
    variantType: "Normal",
    image: PlaceHolderImages[2].imageUrl,
    hp: 300,
    atk: 40,
    spd: 20,
    baseValue: 100,
    actualValue: 100,
    lootboxSource: "Classic Box",
    globalId: 8821,
    price: 0.05,
    seller: "0x12...f34"
  }
];
