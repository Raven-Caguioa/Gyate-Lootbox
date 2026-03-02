"use client";

import { Navigation } from "@/components/navigation";
import {
  Search, RefreshCw, Loader2, Filter, BookOpen,
  Eye, EyeOff, Sparkles, Lock, CheckCircle2, ChevronDown, ChevronUp, Layers
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface OwnedNFT {
  id: string;
  name: string;
  rarity: number;
  variantType: string;
  image: string;
  hp: number;
  atk: number;
  spd: number;
  lootboxSource: string;
}

interface CollectionEntry {
  name: string;
  rarity: number;
  lootboxSource: string;
  // Normal variant
  normalImage: string;
  normalOwned: boolean;
  normalCount: number;
  // All variants owned by user (map: variantType → { owned, image, count })
  variants: Map<string, { image: string; owned: boolean; count: number }>;
  totalOwned: number;
}

interface LootboxGroup {
  name: string;
  entries: CollectionEntry[];
  totalUnique: number;
  totalOwned: number;
  isExpanded: boolean;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const RARITY_LABELS = ["Common", "Rare", "Super Rare", "SSR", "Ultra Rare", "Legend Rare"];
const RARITY_COLORS = [
  { bg: "#f8f8f8", border: "#94a3b8", text: "#475569", shadow: "#cbd5e1", glow: "rgba(148,163,184,0.3)" },
  { bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", shadow: "#bfdbfe", glow: "rgba(96,165,250,0.3)" },
  { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", shadow: "#e9d5ff", glow: "rgba(168,85,247,0.3)" },
  { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", shadow: "#f0abfc", glow: "rgba(232,121,249,0.3)" },
  { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", shadow: "#fde68a", glow: "rgba(245,158,11,0.3)" },
  { bg: "#fff1f2", border: "#fb7185", text: "#9f1239", shadow: "#fecdd3", glow: "rgba(251,113,133,0.4)" },
];

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const COLLECTION_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  .col-page {
    min-height: 100vh;
    background: #fafaf8;
    font-family: 'Nunito', sans-serif;
    position: relative;
  }
  .col-page::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      radial-gradient(circle at 15% 15%, rgba(201,184,255,0.14) 0%, transparent 50%),
      radial-gradient(circle at 85% 80%, rgba(255,184,217,0.10) 0%, transparent 50%),
      radial-gradient(circle at 50% 50%, rgba(255,245,184,0.06) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }
  .col-container { max-width: 1280px; margin: 0 auto; padding: 32px 24px; position: relative; z-index: 1; }

  /* ── Header ── */
  .col-header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 32px; }
  .col-title-wrap {}
  .col-title { font-family: 'Caveat', cursive; font-size: 44px; font-weight: 700; color: #1a1a1a; line-height: 1; margin-bottom: 4px; }
  .col-subtitle { font-size: 13px; color: #64748b; font-weight: 600; }
  .col-actions { display: flex; align-items: center; gap: 10px; }

  /* ── Doodle search ── */
  .col-search-wrap { position: relative; }
  .col-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 15px; height: 15px; }
  .col-search {
    padding: 10px 14px 10px 36px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 13px; font-weight: 600;
    box-shadow: 3px 3px 0px #c9b8ff;
    outline: none; width: 220px;
    transition: box-shadow 0.2s ease;
    color: #1a1a1a;
  }
  .col-search:focus { box-shadow: 5px 5px 0px #c9b8ff; }
  .col-search::placeholder { color: #94a3b8; }

  /* ── Doodle button ── */
  .col-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 18px;
    border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px;
    border: 2px solid #1a1a1a;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 13px; font-weight: 800; color: #1a1a1a;
    box-shadow: 3px 3px 0px #c9b8ff;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
  }
  .col-btn:hover { transform: translateY(-2px); box-shadow: 5px 5px 0px #c9b8ff; }
  .col-btn:active { transform: translateY(1px); box-shadow: 1px 1px 0px #c9b8ff; }
  .col-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .col-btn.primary { background: linear-gradient(135deg, #f3e8ff, #fce7f3); }
  .col-btn.icon-only { padding: 10px 12px; }
  .col-btn.active-toggle {
    background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    border-color: #7e22ce; color: #7e22ce;
    box-shadow: 3px 3px 0px #c9b8ff;
  }

  /* ── Filter row ── */
  .filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 28px; }
  .filter-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; display: flex; align-items: center; gap: 4px; margin-right: 4px; }
  .filter-pill {
    padding: 6px 14px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #e2e8f0;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 11px; font-weight: 800; color: #64748b;
    cursor: pointer; transition: all 0.15s ease;
  }
  .filter-pill:hover { border-color: #c9b8ff; color: #7e22ce; }
  .filter-pill.active { background: linear-gradient(135deg,#f3e8ff,#fce7f3); border-color: #1a1a1a; color: #1a1a1a; box-shadow: 2px 2px 0px #c9b8ff; }

  /* ── Lootbox section ── */
  .lootbox-section {
    margin-bottom: 28px;
    border: 2px solid #1a1a1a;
    border-radius: 20px;
    overflow: hidden;
    background: white;
    box-shadow: 4px 4px 0px #c9b8ff;
  }
  .lootbox-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px;
    cursor: pointer;
    background: linear-gradient(135deg, rgba(201,184,255,0.12), rgba(255,184,217,0.08));
    border-bottom: 2px solid #e2e8f0;
    transition: background 0.2s ease;
    user-select: none;
  }
  .lootbox-header:hover { background: linear-gradient(135deg, rgba(201,184,255,0.2), rgba(255,184,217,0.12)); }
  .lootbox-header-left { display: flex; align-items: center; gap: 12px; }
  .lootbox-icon { font-size: 22px; }
  .lootbox-name { font-family: 'Caveat', cursive; font-size: 24px; font-weight: 700; color: #1a1a1a; }
  .lootbox-progress-wrap { flex: 1; max-width: 200px; margin: 0 16px; }
  .lootbox-progress-label { font-size: 10px; font-weight: 800; color: #64748b; margin-bottom: 4px; }
  .lootbox-progress-bar { height: 8px; background: #f1f5f9; border-radius: 100px; border: 1.5px solid #e2e8f0; overflow: hidden; }
  .lootbox-progress-fill { height: 100%; border-radius: 100px; background: linear-gradient(90deg, #c9b8ff, #ff3d9a); transition: width 0.6s cubic-bezier(0.34,1.56,0.64,1); }
  .lootbox-count { font-size: 12px; font-weight: 800; color: #64748b; white-space: nowrap; }
  .lootbox-count strong { color: #1a1a1a; }

  /* ── Cards grid ── */
  .col-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
    padding: 20px;
  }

  /* ── Collection card ── */
  .col-card {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    cursor: default;
    transition: all 0.25s cubic-bezier(0.175,0.885,0.32,1.275);
    border: 2px solid;
  }
  .col-card.owned { cursor: pointer; }
  .col-card.owned:hover { transform: translateY(-4px) rotate(-0.5deg); }
  .col-card-shadow {
    position: absolute; inset: 0; border-radius: 14px; z-index: -1;
    transform: translate(4px, 4px);
  }

  /* Card image container */
  .col-card-img-wrap {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
  }
  .col-card-img-wrap img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
  }
  .col-card.owned:hover .col-card-img-wrap img { transform: scale(1.07); }

  /* Mystery card */
  .col-card-mystery {
    width: 100%; height: 100%;
    background: linear-gradient(145deg, #1a1a2e, #16213e);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 6px;
    aspect-ratio: 1;
  }
  .col-card-mystery-q {
    font-family: 'Caveat', cursive;
    font-size: 42px; font-weight: 700;
    color: rgba(255,255,255,0.15);
    line-height: 1;
    user-select: none;
  }
  .col-card-mystery-lock { opacity: 0.25; }

  /* Overlay badges */
  .col-card-owned-badge {
    position: absolute; top: 6px; right: 6px;
    background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
    color: white; font-size: 9px; font-weight: 900;
    padding: 3px 7px; border-radius: 20px;
    display: flex; align-items: center; gap: 3px;
    letter-spacing: 0.05em;
  }
  .col-card-variant-badge {
    position: absolute; top: 6px; left: 6px;
    background: rgba(201,184,255,0.9); backdrop-filter: blur(4px);
    color: #5b21b6; font-size: 8px; font-weight: 900;
    padding: 2px 6px; border-radius: 20px;
    letter-spacing: 0.05em;
  }
  .col-card-new-badge {
    position: absolute; bottom: 6px; left: 6px;
    background: linear-gradient(135deg, #ff3d9a, #c9b8ff);
    color: white; font-size: 8px; font-weight: 900;
    padding: 2px 7px; border-radius: 20px;
    letter-spacing: 0.04em;
    animation: newPulse 2s ease-in-out infinite;
  }
  @keyframes newPulse { 0%,100%{opacity:1} 50%{opacity:0.7} }

  /* Card body */
  .col-card-body { padding: 10px 12px; }
  .col-card-name { font-family: 'Caveat', cursive; font-size: 17px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; line-height: 1.1; }
  .col-card-name.mystery { color: #94a3b8; }
  .col-card-meta { display: flex; align-items: center; justify-content: space-between; }
  .rarity-badge-sm {
    font-size: 8px; font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.07em; padding: 2px 7px;
    border-radius: 20px; border: 1.5px solid;
  }
  .col-card-count { font-size: 10px; font-weight: 800; color: #94a3b8; }

  /* Variant sub-section */
  .variant-row {
    border-top: 1.5px solid #f1f5f9;
    padding: 8px 12px;
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  }
  .variant-chip {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    border-radius: 20px; border: 1.5px solid;
    font-size: 9px; font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .variant-chip.owned { background: #fffbeb; border-color: #f59e0b; color: #92400e; }
  .variant-chip.missing { background: #f8f8f8; border-color: #e2e8f0; color: #94a3b8; }
  .variant-chip-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .variant-chip.owned .variant-chip-dot { background: #f59e0b; box-shadow: 0 0 4px rgba(245,158,11,0.5); }
  .variant-chip.missing .variant-chip-dot { background: #e2e8f0; }

  /* Progress stats bar */
  .col-stats-bar {
    display: flex; gap: 16px; flex-wrap: wrap;
    padding: 20px 24px;
    background: white;
    border: 2px solid #1a1a1a;
    border-radius: 20px;
    margin-bottom: 28px;
    box-shadow: 4px 4px 0px #ffb8d9;
  }
  .col-stat { display: flex; flex-direction: column; gap: 2px; }
  .col-stat-value { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; line-height: 1; }
  .col-stat-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .col-stat-divider { width: 1.5px; background: #f1f5f9; align-self: stretch; margin: 0 4px; }

  /* Empty / loading */
  .col-empty { text-align: center; padding: 80px 24px; background: white; border: 2px dashed #e2e8f0; border-radius: 24px; }
  .col-empty-icon { font-size: 48px; margin-bottom: 16px; }
  .col-empty-title { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .col-empty-desc { font-size: 13px; color: #64748b; }
  .col-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0; gap: 16px; }
  .col-loading-text { font-family: 'Caveat', cursive; font-size: 22px; color: #94a3b8; }

  /* Completed set banner */
  .set-complete-banner {
    background: linear-gradient(135deg, #fef9c3, #fce7f3);
    border: 2px solid #f59e0b;
    border-radius: 12px;
    padding: 8px 16px;
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 800; color: #92400e;
    box-shadow: 2px 2px 0px #fde68a;
    margin: 0 20px 16px;
  }

  @media (max-width: 768px) {
    .col-title { font-size: 32px; }
    .col-header { flex-direction: column; align-items: flex-start; }
    .col-search { width: 180px; }
    .col-cards-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
    .lootbox-progress-wrap { display: none; }
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

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function CollectionPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { toast } = useToast();

  const [ownedNfts, setOwnedNfts] = useState<OwnedNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [showVariants, setShowVariants] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["all"]));

  // ── Fetch ─────────────────────────────────────────────────────────────
  const fetchNfts = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });
      if (capsRes.data.length === 0) { setOwnedNfts([]); return; }
      const kioskId = (capsRes.data[0].data?.content as any)?.fields?.for;
      if (!kioskId) { setOwnedNfts([]); return; }

      let allFields: any[] = [];
      let cursor: string | null | undefined = undefined;
      do {
        const page = await suiClient.getDynamicFields({ parentId: kioskId, cursor: cursor ?? undefined, limit: 50 });
        allFields = [...allFields, ...page.data];
        cursor = page.hasNextPage ? page.nextCursor : null;
      } while (cursor);

      const NFT_TYPE = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      const ITEM_TYPE = "0x2::kiosk::Item";
      const itemFields = allFields.filter(f => typeof f.name.type === "string" && f.name.type.startsWith(ITEM_TYPE));
      if (itemFields.length === 0) { setOwnedNfts([]); return; }

      const realNftIds = itemFields.map(f => normalizeSuiId((f.name.value as any)?.id || f.name.value)).filter(Boolean);
      const BATCH = 50;
      const nftObjects: any[] = [];
      for (let i = 0; i < realNftIds.length; i += BATCH) {
        const results = await suiClient.multiGetObjects({ ids: realNftIds.slice(i, i + BATCH), options: { showContent: true, showType: true } });
        nftObjects.push(...results);
      }

      const mapped: OwnedNFT[] = nftObjects.map((obj: any) => {
        if (!obj.data || obj.data.content?.type !== NFT_TYPE) return null;
        const f = obj.data.content?.fields;
        if (!f) return null;
        return {
          id: normalizeSuiId(obj.data.objectId),
          name: f.name ?? "Unknown",
          rarity: Number(f.rarity ?? 0),
          variantType: f.variant_type ?? "Normal",
          image: f.image_url || "",
          hp: parseInt(f.hp ?? "0"), atk: parseInt(f.atk ?? "0"), spd: parseInt(f.spd ?? "0"),
          lootboxSource: f.lootbox_source ?? "Unknown",
        };
      }).filter((n): n is OwnedNFT => n !== null);

      setOwnedNfts(mapped);
    } catch (err) {
      console.error("Collection fetch error:", err);
      toast({ variant: "destructive", title: "Failed to load collection" });
    } finally {
      setIsLoading(false);
    }
  }, [account, suiClient, toast]);

  useEffect(() => { fetchNfts(); }, [fetchNfts]);

  // ── Build collection entries ──────────────────────────────────────────
  const collectionData = useMemo((): LootboxGroup[] => {
    // Group owned NFTs by lootbox → name → variant
    const lootboxMap = new Map<string, Map<string, Map<string, { image: string; count: number }>>>();

    for (const nft of ownedNfts) {
      const lb = nft.lootboxSource || "Unknown";
      if (!lootboxMap.has(lb)) lootboxMap.set(lb, new Map());
      const nameMap = lootboxMap.get(lb)!;
      if (!nameMap.has(nft.name)) nameMap.set(nft.name, new Map());
      const variantMap = nameMap.get(nft.name)!;
      const variant = nft.variantType || "Normal";
      if (!variantMap.has(variant)) {
        variantMap.set(variant, { image: nft.image, count: 0 });
      }
      variantMap.get(variant)!.count++;
    }

    // Build groups — only based on what we know from owned NFTs
    // (In a real app you'd fetch the full roster from on-chain NFTTypeConfigs)
    const groups: LootboxGroup[] = [];

    lootboxMap.forEach((nameMap, lbName) => {
      const entries: CollectionEntry[] = [];

      nameMap.forEach((variantMap, nftName) => {
        // Get the first NFT of this name from ownedNfts for rarity info
        const sampleNft = ownedNfts.find(n => n.name === nftName && n.lootboxSource === lbName);
        const rarity = sampleNft?.rarity ?? 0;

        const variants = new Map<string, { image: string; owned: boolean; count: number }>();
        let normalImage = "";
        let normalOwned = false;
        let normalCount = 0;
        let totalOwned = 0;

        variantMap.forEach((data, variantType) => {
          totalOwned += data.count;
          if (variantType === "Normal") {
            normalImage = data.image;
            normalOwned = true;
            normalCount = data.count;
          } else {
            variants.set(variantType, { image: data.image, owned: true, count: data.count });
          }
        });

        entries.push({
          name: nftName,
          rarity,
          lootboxSource: lbName,
          normalImage: normalImage || sampleNft?.image || "",
          normalOwned,
          normalCount,
          variants,
          totalOwned,
        });
      });

      // Sort by rarity desc
      entries.sort((a, b) => b.rarity - a.rarity);

      groups.push({
        name: lbName,
        entries,
        totalUnique: entries.length,
        totalOwned: entries.reduce((s, e) => s + e.totalOwned, 0),
        isExpanded: true,
      });
    });

    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }, [ownedNfts]);

  // ── Filtered ──────────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return collectionData.map(group => ({
      ...group,
      entries: group.entries.filter(e => {
        const matchSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRarity = rarityFilter === null || e.rarity === rarityFilter;
        return matchSearch && matchRarity;
      }),
    })).filter(g => g.entries.length > 0);
  }, [collectionData, searchTerm, rarityFilter]);

  const totalUnique = useMemo(() => collectionData.reduce((s, g) => s + g.totalUnique, 0), [collectionData]);
  const totalNfts = ownedNfts.length;
  const totalVariants = useMemo(() => {
    let v = 0;
    collectionData.forEach(g => g.entries.forEach(e => { v += e.variants.size; }));
    return v;
  }, [collectionData]);
  const uniqueRarities = useMemo(() => new Set(ownedNfts.map(n => n.rarity)).size, [ownedNfts]);

  const toggleSection = (name: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <div className="col-page">
      <style dangerouslySetInnerHTML={{ __html: COLLECTION_STYLES }} />
      <Navigation />

      <div className="col-container">
        {/* Header */}
        <div className="col-header">
          <div className="col-title-wrap">
            <div className="col-title">📖 Pokédex</div>
            <div className="col-subtitle">
              {totalUnique} unique hero{totalUnique !== 1 ? "es" : ""} discovered · {totalNfts} total owned
            </div>
          </div>
          <div className="col-actions">
            <button
              className={`col-btn ${showVariants ? "active-toggle" : ""}`}
              onClick={() => setShowVariants(v => !v)}
              title="Toggle variants"
            >
              {showVariants ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>Variants</span>
            </button>
            <button className={`col-btn icon-only ${isLoading ? "disabled" : ""}`} onClick={fetchNfts} disabled={isLoading}>
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
            <div className="col-search-wrap">
              <Search size={15} className="col-search-icon" />
              <input
                className="col-search"
                placeholder="Search heroes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {!account ? (
          <div className="col-empty">
            <div className="col-empty-icon">📖</div>
            <div className="col-empty-title">Connect Your Wallet</div>
            <div className="col-empty-desc">Connect your wallet to view your Pokédex.</div>
          </div>
        ) : isLoading ? (
          <div className="col-loading">
            <div style={{ fontSize: 40 }}>📖</div>
            <div className="col-loading-text">Loading your collection...</div>
          </div>
        ) : ownedNfts.length === 0 ? (
          <div className="col-empty">
            <div className="col-empty-icon">🎴</div>
            <div className="col-empty-title">No Heroes Yet</div>
            <div className="col-empty-desc">Visit the shop to summon your first hero!</div>
            <a href="/shop" className="col-btn primary" style={{ display: "inline-flex", textDecoration: "none", marginTop: 16 }}>
              Go to Shop →
            </a>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="col-stats-bar">
              <div className="col-stat">
                <span className="col-stat-value">{totalUnique}</span>
                <span className="col-stat-label">Unique Heroes</span>
              </div>
              <div className="col-stat-divider" />
              <div className="col-stat">
                <span className="col-stat-value">{totalNfts}</span>
                <span className="col-stat-label">Total Owned</span>
              </div>
              <div className="col-stat-divider" />
              <div className="col-stat">
                <span className="col-stat-value">{totalVariants}</span>
                <span className="col-stat-label">Variants</span>
              </div>
              <div className="col-stat-divider" />
              <div className="col-stat">
                <span className="col-stat-value">{collectionData.length}</span>
                <span className="col-stat-label">Lootboxes</span>
              </div>
              <div className="col-stat-divider" />
              <div className="col-stat">
                <span className="col-stat-value">{uniqueRarities}/6</span>
                <span className="col-stat-label">Rarities Found</span>
              </div>
            </div>

            {/* Rarity filter */}
            <div className="filter-row">
              <span className="filter-label"><Filter size={10} /> Rarity</span>
              <button className={`filter-pill ${rarityFilter === null ? "active" : ""}`} onClick={() => setRarityFilter(null)}>All</button>
              {[0,1,2,3,4,5].filter(r => ownedNfts.some(n => n.rarity === r)).map(r => (
                <button key={r} className={`filter-pill ${rarityFilter === r ? "active" : ""}`} onClick={() => setRarityFilter(rarityFilter === r ? null : r)}>
                  {RARITY_LABELS[r]}
                </button>
              ))}
            </div>

            {/* Lootbox sections */}
            {filteredGroups.length === 0 ? (
              <div className="col-empty">
                <div className="col-empty-icon">🔍</div>
                <div className="col-empty-title">No Results</div>
                <div className="col-empty-desc">Try a different search or filter.</div>
                <button className="col-btn" style={{ marginTop: 16 }} onClick={() => { setSearchTerm(""); setRarityFilter(null); }}>Clear Filters</button>
              </div>
            ) : (
              filteredGroups.map(group => {
                const isExpanded = expandedSections.has(group.name);
                const pct = Math.round((group.entries.length / Math.max(group.totalUnique, 1)) * 100);
                return (
                  <div key={group.name} className="lootbox-section">
                    {/* Section header */}
                    <div className="lootbox-header" onClick={() => toggleSection(group.name)}>
                      <div className="lootbox-header-left">
                        <span className="lootbox-icon">📦</span>
                        <span className="lootbox-name">{group.name}</span>
                      </div>
                      <div className="lootbox-progress-wrap">
                        <div className="lootbox-progress-label">{group.entries.length} / {group.totalUnique} unique</div>
                        <div className="lootbox-progress-bar">
                          <div className="lootbox-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="lootbox-count"><strong>{group.totalOwned}</strong> owned</div>
                      <div style={{ marginLeft: 8, color: "#94a3b8" }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        {/* Completed banner */}
                        {group.entries.length === group.totalUnique && group.totalUnique > 0 && (
                          <div className="set-complete-banner">
                            <Sparkles size={14} />
                            Set complete! You own all unique heroes from this lootbox.
                          </div>
                        )}

                        {/* Cards grid */}
                        <div className="col-cards-grid">
                          {group.entries.map(entry => (
                            <CollectionCard
                              key={entry.name}
                              entry={entry}
                              showVariants={showVariants}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Collection Card
// ─────────────────────────────────────────────

function CollectionCard({
  entry,
  showVariants,
}: {
  entry: CollectionEntry;
  showVariants: boolean;
}) {
  const color = RARITY_COLORS[entry.rarity] ?? RARITY_COLORS[0];
  const isOwned = entry.normalOwned || entry.totalOwned > 0;
  const allVariantTypes = Array.from(entry.variants.keys());

  return (
    <div style={{ position: "relative" }}>
      {/* Drop shadow */}
      <div
        className="col-card-shadow"
        style={{ background: color.shadow }}
      />
      <div
        className={`col-card ${isOwned ? "owned" : ""}`}
        style={{
          borderColor: isOwned ? color.border : "#d1d5db",
          background: isOwned ? color.bg : "#f9fafb",
        }}
      >
        {/* Image area */}
        <div className="col-card-img-wrap">
          {isOwned && entry.normalImage ? (
            <img src={entry.normalImage} alt={entry.name} />
          ) : (
            <MysteryCard rarity={entry.rarity} />
          )}

          {/* Owned count badge */}
          {isOwned && entry.normalCount > 0 && (
            <div className="col-card-owned-badge">
              <Layers size={9} /> ×{entry.normalCount}
            </div>
          )}

          {/* Has variant badge */}
          {isOwned && allVariantTypes.length > 0 && (
            <div className="col-card-variant-badge">
              ✦ {allVariantTypes.length} var
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="col-card-body">
          <div className={`col-card-name ${!isOwned ? "mystery" : ""}`}>
            {isOwned ? entry.name : "???"}
          </div>
          <div className="col-card-meta">
            <span
              className="rarity-badge-sm"
              style={{ background: color.bg, borderColor: color.border, color: color.text }}
            >
              {RARITY_LABELS[entry.rarity]}
            </span>
            {isOwned && (
              <span className="col-card-count">×{entry.totalOwned}</span>
            )}
          </div>
        </div>

        {/* Variant chips */}
        {showVariants && isOwned && allVariantTypes.length > 0 && (
          <div className="variant-row">
            {allVariantTypes.map(v => {
              const vData = entry.variants.get(v)!;
              return (
                <div
                  key={v}
                  className={`variant-chip ${vData.owned ? "owned" : "missing"}`}
                  title={vData.owned ? `${v} ×${vData.count}` : `${v} (not owned)`}
                >
                  <div className="variant-chip-dot" />
                  {v}
                  {vData.owned && vData.count > 1 && <span>×{vData.count}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Mystery Card (unowned)
// ─────────────────────────────────────────────

function MysteryCard({ rarity }: { rarity: number }) {
  const glowColor = RARITY_COLORS[rarity]?.glow ?? "rgba(148,163,184,0.3)";
  return (
    <div
      className="col-card-mystery"
      style={{
        background: `radial-gradient(ellipse at center, rgba(30,27,75,0.9) 0%, #0f0f1a 100%)`,
        boxShadow: `inset 0 0 30px ${glowColor}`,
      }}
    >
      <div className="col-card-mystery-q">?</div>
      <div className="col-card-mystery-lock">
        <Lock size={16} color="rgba(255,255,255,0.3)" />
      </div>
    </div>
  );
}