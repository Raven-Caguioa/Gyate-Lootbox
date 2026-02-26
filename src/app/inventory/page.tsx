"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import {
  Search, RefreshCw, ShoppingBag, Loader2, LayoutGrid,
  Tag, ChevronRight, X, Layers, ArrowLeft, Flame, Filter
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, GATEKEEPER_CAP, STATS_REGISTRY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { NFT } from "@/lib/mock-data";
import { Transaction } from "@mysten/sui/transactions";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface NFTWithListed extends NFT { isListed: boolean; }
interface NFTGroup { name: string; rarity: number; baseImage: string; items: NFTWithListed[]; }

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const RARITY_LABELS = ["Common", "Rare", "Super Rare", "SSR", "Ultra Rare", "Legend Rare"];
const RARITY_DOODLE_COLORS = [
  { bg: "#f8f8f8", border: "#94a3b8", text: "#475569", shadow: "#cbd5e1" },
  { bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", shadow: "#bfdbfe" },
  { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", shadow: "#e9d5ff" },
  { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", shadow: "#f0abfc" },
  { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", shadow: "#fde68a" },
  { bg: "#fff1f2", border: "#fb7185", text: "#9f1239", shadow: "#fecdd3" },
];

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const INVENTORY_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  .inv-page {
    min-height: 100vh;
    background: #fafaf8;
    font-family: 'Nunito', sans-serif;
    position: relative;
  }
  .inv-page::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      radial-gradient(circle at 20% 20%, rgba(201,184,255,0.12) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(255,184,217,0.10) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }
  .inv-container { max-width: 1280px; margin: 0 auto; padding: 32px 24px; position: relative; z-index: 1; }

  /* Header */
  .inv-header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 36px; }
  .inv-title { font-family: 'Caveat', cursive; font-size: 44px; font-weight: 700; color: #1a1a1a; line-height: 1; margin-bottom: 4px; }
  .inv-subtitle { font-size: 13px; color: #64748b; font-weight: 600; }
  .inv-actions { display: flex; align-items: center; gap: 10px; }

  /* Doodle search */
  .inv-search-wrap { position: relative; }
  .inv-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 15px; height: 15px; }
  .inv-search {
    padding: 10px 14px 10px 36px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 3px 3px 0px #c9b8ff;
    outline: none;
    width: 220px;
    transition: box-shadow 0.2s ease;
    color: #1a1a1a;
  }
  .inv-search:focus { box-shadow: 5px 5px 0px #c9b8ff; }
  .inv-search::placeholder { color: #94a3b8; }

  /* Doodle button */
  .inv-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 18px;
    border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px;
    border: 2px solid #1a1a1a;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    color: #1a1a1a;
    box-shadow: 3px 3px 0px #c9b8ff;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
  }
  .inv-btn:hover { transform: translateY(-2px); box-shadow: 5px 5px 0px #c9b8ff; }
  .inv-btn:active { transform: translateY(1px); box-shadow: 1px 1px 0px #c9b8ff; }
  .inv-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .inv-btn.primary { background: linear-gradient(135deg, #f3e8ff, #fce7f3); }
  .inv-btn.danger { background: #fff0f0; box-shadow: 3px 3px 0px #fca5a5; }
  .inv-btn.danger:hover { box-shadow: 5px 5px 0px #fca5a5; }
  .inv-btn.accent { background: linear-gradient(135deg, #fce7f3, #f3e8ff); box-shadow: 3px 3px 0px #ffb8d9; }
  .inv-btn.accent:hover { box-shadow: 5px 5px 0px #ffb8d9; }
  .inv-btn.icon-only { padding: 10px 12px; }

  /* Filter pills */
  .filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
  .filter-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; display: flex; align-items: center; gap: 4px; margin-right: 4px; }
  .filter-pill {
    padding: 6px 14px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #e2e8f0;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 800;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .filter-pill:hover { border-color: #c9b8ff; color: #7e22ce; }
  .filter-pill.active {
    background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    border-color: #1a1a1a;
    color: #1a1a1a;
    box-shadow: 2px 2px 0px #c9b8ff;
  }

  /* Group card */
  .group-card {
    background: white;
    border: 2px solid #1a1a1a;
    border-radius: 20px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
    position: relative;
  }
  .group-card:hover { transform: translateY(-4px) rotate(-0.5deg); }
  .group-card-shadow { position: absolute; inset: 0; border-radius: 18px; z-index: -1; background: #c9b8ff; transform: translate(5px, 5px); }
  .group-card img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; transition: transform 0.3s ease; }
  .group-card:hover img { transform: scale(1.05); }
  .group-card-body { padding: 12px 14px; }
  .group-card-name { font-family: 'Caveat', cursive; font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
  .group-card-meta { display: flex; align-items: center; justify-content: space-between; }
  .group-card-count { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 20px; display: flex; align-items: center; gap: 3px; backdrop-filter: blur(4px); }
  .group-card-listed { position: absolute; top: 8px; left: 8px; background: rgba(201,184,255,0.9); color: #5b21b6; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 20px; backdrop-filter: blur(4px); }

  /* Rarity badge */
  .rarity-badge {
    font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em;
    padding: 3px 8px; border-radius: 20px; border: 1.5px solid;
  }

  /* In-wallet count */
  .in-wallet { font-size: 10px; font-weight: 700; color: #64748b; }

  /* Grid */
  .group-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; }

  /* Empty state */
  .inv-empty {
    text-align: center; padding: 80px 24px;
    background: white;
    border: 2px dashed #e2e8f0;
    border-radius: 24px;
  }
  .inv-empty-icon { font-size: 48px; margin-bottom: 16px; }
  .inv-empty-title { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .inv-empty-desc { font-size: 13px; color: #64748b; margin-bottom: 20px; }

  /* Loading */
  .inv-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0; gap: 16px; }
  .inv-loading-text { font-family: 'Caveat', cursive; font-size: 22px; color: #94a3b8; }

  /* Expanded view */
  .expanded-header { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
  .expanded-thumb { width: 52px; height: 52px; border-radius: 12px; border: 2px solid #1a1a1a; overflow: hidden; box-shadow: 3px 3px 0px #c9b8ff; }
  .expanded-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .expanded-title { font-family: 'Caveat', cursive; font-size: 32px; font-weight: 700; color: #1a1a1a; line-height: 1.1; }
  .expanded-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; }

  /* Token row */
  .token-row {
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 16px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: border-color 0.15s ease;
    margin-bottom: 8px;
  }
  .token-row:hover { border-color: #c9b8ff; }
  .token-row.listed { border-color: #e879f9; background: #fdf4ff; }
  .token-thumb { width: 48px; height: 48px; border-radius: 10px; border: 2px solid #e2e8f0; overflow: hidden; flex-shrink: 0; cursor: pointer; }
  .token-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .token-info { flex: 1; min-width: 0; }
  .token-id { font-size: 11px; font-weight: 800; color: #94a3b8; font-family: monospace; }
  .token-stats { font-size: 10px; color: #64748b; font-family: monospace; margin-top: 3px; }
  .token-stats span { color: #1a1a1a; font-weight: 800; }
  .token-badges { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
  .token-badge { font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 20px; border: 1.5px solid; }
  .token-badge.listed-badge { background: #fdf4ff; color: #86198f; border-color: #e879f9; }
  .token-badge.variant-badge { background: #fffbeb; color: #92400e; border-color: #f59e0b; }
  .token-actions { display: flex; gap: 8px; flex-shrink: 0; }

  /* Small action button */
  .tok-btn {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 7px 12px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 800;
    color: #1a1a1a;
    box-shadow: 2px 2px 0px #c9b8ff;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .tok-btn:hover { transform: translateY(-1px); box-shadow: 3px 3px 0px #c9b8ff; }
  .tok-btn:active { transform: translateY(1px); box-shadow: none; }
  .tok-btn.delist { box-shadow: 2px 2px 0px #fca5a5; }
  .tok-btn.delist:hover { box-shadow: 3px 3px 0px #fca5a5; }

  /* List dialog */
  .list-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; }
  .list-dialog {
    background: white;
    border: 2px solid #1a1a1a;
    border-radius: 24px;
    padding: 28px;
    width: 380px;
    max-width: 95vw;
    box-shadow: 8px 8px 0px #c9b8ff;
    position: relative;
    z-index: 101;
  }
  .list-dialog-title { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .list-dialog-desc { font-size: 13px; color: #64748b; margin-bottom: 20px; }
  .price-input-wrap { position: relative; margin-bottom: 12px; }
  .price-input {
    width: 100%;
    padding: 12px 50px 12px 14px;
    border: 2px solid #1a1a1a;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    font-family: 'Nunito', sans-serif;
    font-size: 20px;
    font-weight: 800;
    color: #1a1a1a;
    box-shadow: 3px 3px 0px #c9b8ff;
    outline: none;
    box-sizing: border-box;
  }
  .price-input:focus { box-shadow: 5px 5px 0px #c9b8ff; }
  .price-suffix { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 13px; font-weight: 900; color: #7e22ce; }
  .price-preview { font-size: 11px; color: #64748b; margin-bottom: 20px; }
  .price-preview strong { color: #1a1a1a; font-weight: 800; }
  .dialog-footer { display: flex; gap: 10px; justify-content: flex-end; }

  @media (max-width: 768px) {
    .inv-title { font-size: 32px; }
    .inv-header { flex-direction: column; align-items: flex-start; }
    .inv-search { width: 180px; }
    .group-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
    .token-actions { flex-direction: column; gap: 4px; }
  }
`;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function normalizeSuiId(id: string | any): string {
  if (!id) return "";
  const str = typeof id === "string" ? id : id?.id || id?.objectId || JSON.stringify(id);
  return str.toLowerCase().replace(/^(0x)?/, "0x");
}
function shortenId(id: string): string { return `${id.slice(0, 6)}...${id.slice(-4)}`; }

/**
 * Resolve a player's PlayerStats shared-object ID from the StatsRegistry table.
 *
 * StatsRegistry holds a NESTED Table<address, ID> called stats_by_owner.
 * That inner table has its own object ID (table.fields.id.id).
 * We must fetch the registry first to get the inner table ID, THEN
 * call getDynamicFieldObject on that inner table ID — NOT on STATS_REGISTRY directly.
 *
 * Wrong:  getDynamicFieldObject(STATS_REGISTRY, address)      ← was broken
 * Correct: getDynamicFieldObject(innerTableId,   address)      ← fixed
 */
async function resolveStatsId(suiClient: any, playerAddress: string): Promise<string | null> {
  try {
    // Step 1: get the StatsRegistry object to find the inner table's own ID
    const registryObj = await suiClient.getObject({
      id: STATS_REGISTRY,
      options: { showContent: true },
    });
    const tableId = (registryObj.data?.content as any)?.fields?.stats_by_owner?.fields?.id?.id;
    if (!tableId) {
      console.error("resolveStatsId: could not find inner table ID in StatsRegistry");
      return null;
    }

    // Step 2: query the inner table for this player's entry
    const field = await suiClient.getDynamicFieldObject({
      parentId: tableId,
      name: { type: "address", value: playerAddress },
    });

    // Step 3: the value IS the PlayerStats object ID
    const rawId = (field?.data?.content as any)?.fields?.value;
    if (!rawId) return null;
    return typeof rawId === "string" ? rawId : rawId?.id ?? null;
  } catch (err) {
    console.error("resolveStatsId failed:", err);
    return null;
  }
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function InventoryPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const [userNfts, setUserNfts] = useState<NFTWithListed[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [isBurning, setIsBurning] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listingNft, setListingNft] = useState<NFT | null>(null);
  const [listPriceSui, setListPriceSui] = useState("");

  // ── Fetch NFTs ──────────────────────────────────────────────────────
  const fetchUserNfts = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });
      if (capsRes.data.length === 0) { setUserNfts([]); return; }
      const kioskCapId = capsRes.data[0].data?.objectId!;
      const kioskId = (capsRes.data[0].data?.content as any)?.fields?.for;
      if (!kioskId) { setUserNfts([]); return; }

      let allFields: any[] = [];
      let cursor: string | null | undefined = undefined;
      do {
        const page = await suiClient.getDynamicFields({ parentId: kioskId, cursor: cursor ?? undefined, limit: 50 });
        allFields = [...allFields, ...page.data];
        cursor = page.hasNextPage ? page.nextCursor : null;
      } while (cursor);
      if (allFields.length === 0) { setUserNfts([]); return; }

      const NFT_TYPE = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      const ITEM_TYPE = "0x2::kiosk::Item";
      const LISTING_TYPE = "0x2::kiosk::Listing";
      const itemFields = allFields.filter(f => typeof f.name.type === "string" && f.name.type.startsWith(ITEM_TYPE));
      const listingFields = allFields.filter(f => typeof f.name.type === "string" && f.name.type.startsWith(LISTING_TYPE));
      if (itemFields.length === 0) { setUserNfts([]); return; }

      const realNftIds: string[] = itemFields.map(f => normalizeSuiId((f.name.value as any)?.id || f.name.value)).filter(Boolean);
      const listedNftIds = new Set(listingFields.map(f => normalizeSuiId((f.name.value as any)?.id || f.name.value)));

      const BATCH = 50;
      const nftObjects: any[] = [];
      for (let i = 0; i < realNftIds.length; i += BATCH) {
        const results = await suiClient.multiGetObjects({ ids: realNftIds.slice(i, i + BATCH), options: { showContent: true, showType: true } });
        nftObjects.push(...results);
      }

      const mapped: NFTWithListed[] = nftObjects.map((obj: any) => {
        if (!obj.data) return null;
        const objectId = normalizeSuiId(obj.data.objectId);
        const content = obj.data.content;
        if (content?.type !== NFT_TYPE) return null;
        const f = content?.fields;
        if (!f) return null;
        return {
          id: objectId, name: f.name ?? "Unknown", rarity: Number(f.rarity ?? 0),
          variantType: f.variant_type ?? "Normal",
          image: f.image_url || "https://images.unsplash.com/photo-1743355694962-40376ef681da?q=80&w=400",
          hp: parseInt(f.hp ?? "0"), atk: parseInt(f.atk ?? "0"), spd: parseInt(f.spd ?? "0"),
          baseValue: parseInt(f.base_value ?? "0"), actualValue: parseInt(f.actual_value ?? "0"),
          lootboxSource: f.lootbox_source ?? "", globalId: parseInt(f.global_sequential_id ?? "0"),
          kioskId, kioskCapId, isListed: listedNftIds.has(objectId),
        } as NFTWithListed;
      }).filter((n): n is NFTWithListed => n !== null);

      setUserNfts(mapped);
    } catch (err) {
      console.error("Inventory fetch error:", err);
      toast({ variant: "destructive", title: "Failed to load inventory", description: "Check your connection and try again." });
    } finally {
      setIsLoading(false);
    }
  }, [account, suiClient, toast]);

  useEffect(() => { fetchUserNfts(); }, [fetchUserNfts]);

  const groups = useMemo((): NFTGroup[] => {
    const map = new Map<string, NFTGroup>();
    for (const nft of userNfts) {
      if (!map.has(nft.name)) map.set(nft.name, { name: nft.name, rarity: nft.rarity, baseImage: nft.image, items: [] });
      map.get(nft.name)!.items.push(nft);
    }
    return Array.from(map.values()).sort((a, b) => b.rarity - a.rarity);
  }, [userNfts]);

  const filteredGroups = useMemo(() => groups.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRarity = rarityFilter === null || g.rarity === rarityFilter;
    return matchesSearch && matchesRarity;
  }), [groups, searchTerm, rarityFilter]);

  const expandedItems = useMemo(() => {
    if (!expandedGroup) return [];
    return groups.find(g => g.name === expandedGroup)?.items ?? [];
  }, [expandedGroup, groups]);

  // ── Burn ─────────────────────────────────────────────────────────────
  const handleBurnNft = async (nft: NFT) => {
    if (!account || !nft.kioskId) return;
    // Snapshot signer address immediately — account.address can change mid-async
    // if the user switches wallets, causing a wrong-wallet object in the tx.
    const signerAddress = account.address;
    setIsBurning(true);
    try {
      // ── Re-fetch KioskOwnerCap fresh at burn time ─────────────────────────
      const capsRes = await suiClient.getOwnedObjects({
        owner: signerAddress,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });
      // Match the cap to the specific kiosk this NFT lives in
      const freshCap = capsRes.data.find(
        (c) => (c.data?.content as any)?.fields?.for === nft.kioskId
      );
      if (!freshCap?.data?.objectId) {
        toast({
          variant: "destructive",
          title: "Kiosk cap not found",
          description: "Could not find the KioskOwnerCap for your kiosk. Try refreshing.",
        });
        setIsBurning(false); return;
      }
      const freshCapId = freshCap.data.objectId;

      // ── PlayerStats (SHARED object — resolve via StatsRegistry) ──────────
      const statsId = await resolveStatsId(suiClient, signerAddress);
      if (!statsId) {
        toast({
          variant: "destructive",
          title: "Profile Required",
          description: "Initialize your player profile in the Account / Profile section before burning.",
        });
        setIsBurning(false); return;
      }

      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.BURN_NFT_FOR_GYATE}`,
        arguments: [
          txb.object(nft.kioskId),
          txb.object(freshCapId),  // ← always fresh, always owned by current signer
          txb.object(GATEKEEPER_CAP),
          txb.object(statsId),
          txb.pure.id(nft.id),
        ],
      });
      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Hero Sacrificed 🔥", description: "You received $GYATE tokens." });
          setIsBurning(false); setSelectedNft(null); setTimeout(fetchUserNfts, 3000);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Burn failed", description: err.message });
          setIsBurning(false);
        },
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Burn error", description: err.message });
      setIsBurning(false);
    }
  };

  const openListDialog = (nft: NFT) => { setListingNft(nft); setListPriceSui(""); setListDialogOpen(true); };

  const handleListNft = async () => {
    if (!listingNft || !account || !listingNft.kioskId || !listingNft.kioskCapId) return;
    const signerAddress = account.address; // snapshot before any await
    const priceFloat = parseFloat(listPriceSui);
    if (isNaN(priceFloat) || priceFloat <= 0) { toast({ variant: "destructive", title: "Enter a valid price" }); return; }
    const priceMist = BigInt(Math.round(priceFloat * 1_000_000_000));
    setIsListing(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.LIST_NFT}`,
      arguments: [
        txb.object(listingNft.kioskId),
        txb.object(listingNft.kioskCapId),
        txb.pure.id(listingNft.id),
        txb.pure.u64(priceMist),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Listed! 🏷️", description: `${listingNft.name} listed for ${priceFloat} SUI.` });
        setIsListing(false); setListDialogOpen(false); setListingNft(null); setTimeout(fetchUserNfts, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Listing failed", description: err.message });
        setIsListing(false);
      },
    });
  };

  const handleDelistNft = async (nft: NFT) => {
    if (!account || !nft.kioskId || !nft.kioskCapId) return;
    const signerAddress = account.address; // snapshot before any await
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.DELIST_NFT}`,
      arguments: [txb.object(nft.kioskId), txb.object(nft.kioskCapId), txb.pure.id(nft.id)],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Delisted", description: `${nft.name} removed from marketplace.` });
        setTimeout(fetchUserNfts, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Delist failed", description: err.message });
      },
    });
  };

  return (
    <div className="inv-page">
      <style dangerouslySetInnerHTML={{ __html: INVENTORY_STYLES }} />
      <Navigation />

      <div className="inv-container">
        {/* Header */}
        <div className="inv-header">
          <div>
            <div className="inv-title">My Collection</div>
            <div className="inv-subtitle">
              {userNfts.length} hero{userNfts.length !== 1 ? "es" : ""} across {groups.length} type{groups.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="inv-actions">
            <button className={`inv-btn icon-only ${isLoading ? "disabled" : ""}`} onClick={fetchUserNfts} disabled={isLoading}>
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
            <div className="inv-search-wrap">
              <Search size={15} className="inv-search-icon" />
              <input
                className="inv-search"
                placeholder="Search heroes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {!account ? (
          <div className="inv-empty">
            <div className="inv-empty-icon">👛</div>
            <div className="inv-empty-title">Connect Your Wallet</div>
            <div className="inv-empty-desc">View your hero collection on the Sui network.</div>
          </div>
        ) : isLoading ? (
          <div className="inv-loading">
            <div style={{ fontSize: 40 }}>📦</div>
            <div className="inv-loading-text">Opening your collection...</div>
          </div>
        ) : userNfts.length === 0 ? (
          <div className="inv-empty">
            <div className="inv-empty-icon">🎴</div>
            <div className="inv-empty-title">Collection Empty</div>
            <div className="inv-empty-desc">Visit the shop to summon your first hero!</div>
            <a href="/shop" className="inv-btn primary" style={{ display: "inline-flex", textDecoration: "none" }}>
              Go to Shop →
            </a>
          </div>
        ) : expandedGroup ? (
          <ExpandedGroupView
            group={groups.find(g => g.name === expandedGroup)!}
            items={expandedItems}
            onBack={() => setExpandedGroup(null)}
            onSelectNft={setSelectedNft}
            onList={openListDialog}
            onDelist={handleDelistNft}
          />
        ) : (
          <>
            <div className="filter-row">
              <span className="filter-label"><Filter size={10} /> Rarity</span>
              <button className={`filter-pill ${rarityFilter === null ? "active" : ""}`} onClick={() => setRarityFilter(null)}>All</button>
              {[0, 1, 2, 3, 4, 5].filter(r => groups.some(g => g.rarity === r)).map(r => (
                <button key={r} className={`filter-pill ${rarityFilter === r ? "active" : ""}`} onClick={() => setRarityFilter(rarityFilter === r ? null : r)}>
                  {RARITY_LABELS[r]}
                </button>
              ))}
            </div>

            {filteredGroups.length === 0 ? (
              <div className="inv-empty">
                <div className="inv-empty-icon">🔍</div>
                <div className="inv-empty-title">No Results</div>
                <div className="inv-empty-desc">Try a different search or filter.</div>
                <button className="inv-btn" onClick={() => { setSearchTerm(""); setRarityFilter(null); }}>Clear Filters</button>
              </div>
            ) : (
              <div className="group-grid">
                {filteredGroups.map(group => (
                  <DoodleGroupCard key={group.name} group={group} onClick={() => setExpandedGroup(group.name)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <NFTDetailDialog
        nft={selectedNft} open={!!selectedNft} onOpenChange={open => !open && setSelectedNft(null)}
        isInventory={true} onBurn={() => selectedNft && handleBurnNft(selectedNft)} isBurning={isBurning}
      />

      {listDialogOpen && (
        <div className="list-dialog-overlay" onClick={() => setListDialogOpen(false)}>
          <div className="list-dialog" onClick={e => e.stopPropagation()}>
            <div className="list-dialog-title">List for Sale 🏷️</div>
            <div className="list-dialog-desc">
              Setting price for <strong>{listingNft?.name}</strong>. Buyers pay a 10% fee on top.
            </div>
            <div className="price-input-wrap">
              <input
                type="number" className="price-input" placeholder="0.00"
                min="0" step="0.01" value={listPriceSui}
                onChange={e => setListPriceSui(e.target.value)}
              />
              <span className="price-suffix">SUI</span>
            </div>
            {listPriceSui && !isNaN(parseFloat(listPriceSui)) && (
              <div className="price-preview">
                You receive: <strong>{parseFloat(listPriceSui).toFixed(4)} SUI</strong> &nbsp;·&nbsp;
                Buyer pays: <strong>{(parseFloat(listPriceSui) * 1.1).toFixed(4)} SUI</strong>
              </div>
            )}
            <div className="dialog-footer">
              <button className="inv-btn" onClick={() => setListDialogOpen(false)} disabled={isListing}>Cancel</button>
              <button className="inv-btn accent" onClick={handleListNft} disabled={isListing || !listPriceSui}>
                {isListing ? <Loader2 size={13} className="animate-spin" /> : null}
                Confirm Listing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Doodle Group Card
// ─────────────────────────────────────────────

function DoodleGroupCard({ group, onClick }: { group: NFTGroup; onClick: () => void }) {
  const listedCount = group.items.filter(i => i.isListed).length;
  const unlistedCount = group.items.length - listedCount;
  const color = RARITY_DOODLE_COLORS[group.rarity] ?? RARITY_DOODLE_COLORS[0];

  return (
    <div style={{ position: "relative" }} onClick={onClick}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 20, background: color.shadow, transform: "translate(5px,5px)", zIndex: 0 }} />
      <div className="group-card" style={{ background: color.bg, borderColor: color.border, position: "relative", zIndex: 1 }}>
        <div style={{ position: "relative", overflow: "hidden", aspectRatio: "1" }}>
          <img src={group.baseImage} alt={group.name} />
          <div className="group-card-count"><Layers size={10} /> {group.items.length}</div>
          {listedCount > 0 && <div className="group-card-listed">{listedCount} listed</div>}
        </div>
        <div className="group-card-body">
          <div className="group-card-name">{group.name}</div>
          <div className="group-card-meta">
            <span className="rarity-badge" style={{ background: color.bg, borderColor: color.border, color: color.text }}>
              {RARITY_LABELS[group.rarity]}
            </span>
            <span className="in-wallet">{unlistedCount} in wallet <ChevronRight size={10} /></span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Expanded Group View
// ─────────────────────────────────────────────

function ExpandedGroupView({ group, items, onBack, onSelectNft, onList, onDelist }: {
  group: NFTGroup; items: NFTWithListed[]; onBack: () => void;
  onSelectNft: (nft: NFT) => void; onList: (nft: NFT) => void; onDelist: (nft: NFT) => void;
}) {
  const color = RARITY_DOODLE_COLORS[group.rarity] ?? RARITY_DOODLE_COLORS[0];
  const listedCount = items.filter(i => i.isListed).length;

  return (
    <div>
      <div className="expanded-header">
        <button className="inv-btn" onClick={onBack}><ArrowLeft size={14} /> Back</button>
        <div className="expanded-thumb"><img src={group.baseImage} alt={group.name} /></div>
        <div>
          <div className="expanded-title">{group.name}</div>
          <div className="expanded-meta">
            <span className="rarity-badge" style={{ background: color.bg, borderColor: color.border, color: color.text }}>
              {RARITY_LABELS[group.rarity]}
            </span>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{items.length} owned · {listedCount} listed</span>
          </div>
        </div>
      </div>

      <div>
        {items.map((nft, idx) => (
          <DoodleTokenRow key={nft.id} nft={nft} index={idx + 1}
            onView={() => onSelectNft(nft)} onList={() => onList(nft)} onDelist={() => onDelist(nft)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Token Row
// ─────────────────────────────────────────────

function DoodleTokenRow({ nft, index, onView, onList, onDelist }: {
  nft: NFTWithListed; index: number; onView: () => void; onList: () => void; onDelist: () => void;
}) {
  return (
    <div className={`token-row ${nft.isListed ? "listed" : ""}`}>
      <div className="token-thumb" onClick={onView}>
        <img src={nft.image} alt={nft.name} />
      </div>
      <div className="token-info">
        <div className="token-id">#{String(index).padStart(3, "0")} · {shortenId(nft.id)}</div>
        <div className="token-stats">
          HP <span>{nft.hp}</span> &nbsp; ATK <span>{nft.atk}</span> &nbsp; SPD <span>{nft.spd}</span>
        </div>
        <div className="token-badges">
          {nft.isListed && <span className="token-badge listed-badge">Listed</span>}
          {nft.variantType && nft.variantType !== "Normal" && <span className="token-badge variant-badge">{nft.variantType}</span>}
        </div>
      </div>
      <div className="token-actions">
        <button className="tok-btn" onClick={onView}>View</button>
        {nft.isListed ? (
          <button className="tok-btn delist" onClick={onDelist}><X size={10} /> Delist</button>
        ) : (
          <button className="tok-btn" onClick={onList}><Tag size={10} /> List</button>
        )}
      </div>
    </div>
  );
}