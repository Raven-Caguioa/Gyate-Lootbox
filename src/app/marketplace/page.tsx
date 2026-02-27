"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Search, RefreshCw, Info, Loader2, Filter, X } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL, TRANSFER_POLICY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@mysten/sui/transactions";
import { NFT, RARITY_LABELS } from "@/lib/mock-data";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeSuiId(id: string | any): string {
  if (!id) return "";
  const str = typeof id === "string" ? id : id?.id || id?.objectId || JSON.stringify(id);
  return str.toLowerCase().replace(/^(0x)?/, "0x");
}
function mistToSui(mist: string | number | bigint): number {
  return Number(BigInt(mist.toString())) / 1_000_000_000;
}

interface ActiveListing { nftId: string; kioskId: string; priceMist: string; }

// ─── Rarity config ────────────────────────────────────────────────────────────

const RARITY_DOODLE_COLORS = [
  { bg: "#f8f8f8", border: "#94a3b8", text: "#475569", shadow: "#cbd5e1" },
  { bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", shadow: "#bfdbfe" },
  { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", shadow: "#e9d5ff" },
  { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", shadow: "#f0abfc" },
  { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", shadow: "#fde68a" },
  { bg: "#fff1f2", border: "#fb7185", text: "#9f1239", shadow: "#fecdd3" },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const MKT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  .mkt-page {
    min-height: 100vh;
    background: #fafaf8;
    font-family: 'Nunito', sans-serif;
    position: relative;
  }
  .mkt-page::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      radial-gradient(circle at 15% 30%, rgba(201,184,255,0.12) 0%, transparent 50%),
      radial-gradient(circle at 85% 70%, rgba(255,184,217,0.10) 0%, transparent 50%);
    pointer-events: none; z-index: 0;
  }
  .mkt-container { max-width: 1280px; margin: 0 auto; padding: 32px 24px; position: relative; z-index: 1; }

  .mkt-header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 36px; }
  .mkt-title { font-family: 'Caveat', cursive; font-size: 44px; font-weight: 700; color: #1a1a1a; line-height: 1; margin-bottom: 4px; }
  .mkt-subtitle { font-size: 13px; color: #64748b; font-weight: 600; }
  .mkt-header-actions { display: flex; align-items: center; gap: 10px; }

  .mkt-btn {
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
  .mkt-btn:hover { transform: translateY(-2px); box-shadow: 5px 5px 0px #c9b8ff; }
  .mkt-btn:active { transform: translateY(1px); box-shadow: 1px 1px 0px #c9b8ff; }
  .mkt-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .mkt-btn.icon-only { padding: 10px 12px; }

  .mkt-search-wrap { position: relative; }
  .mkt-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 15px; height: 15px; }
  .mkt-search {
    padding: 10px 14px 10px 36px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 13px; font-weight: 600;
    box-shadow: 3px 3px 0px #c9b8ff;
    outline: none; width: 220px;
    transition: box-shadow 0.2s ease; color: #1a1a1a;
  }
  .mkt-search:focus { box-shadow: 5px 5px 0px #c9b8ff; }
  .mkt-search::placeholder { color: #94a3b8; }

  .mkt-layout { display: grid; grid-template-columns: 260px 1fr; gap: 28px; align-items: start; }
  @media (max-width: 900px) { .mkt-layout { grid-template-columns: 1fr; } }

  .mkt-sidebar {
    position: sticky; top: 88px;
    background: white;
    border: 2px solid #1a1a1a;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 5px 5px 0px #c9b8ff;
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
  }
  .sidebar-title {
    font-family: 'Caveat', cursive; font-size: 22px; font-weight: 700; color: #1a1a1a;
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 18px;
  }
  .sidebar-reset {
    font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em;
    color: #94a3b8; cursor: pointer; background: none; border: none;
    font-family: 'Nunito', sans-serif; padding: 4px 8px; border-radius: 6px;
    transition: color 0.15s ease;
  }
  .sidebar-reset:hover { color: #7e22ce; }
  .sidebar-label {
    font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em;
    color: #94a3b8; margin-bottom: 10px; display: flex; align-items: center; gap: 4px;
  }
  .sidebar-divider { height: 1px; background: #f1f5f9; margin: 16px 0; }

  .rarity-pills { display: flex; flex-direction: column; gap: 6px; }
  .rarity-pill {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 12px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #e2e8f0;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 11px; font-weight: 800; color: #64748b;
    cursor: pointer; transition: all 0.15s ease;
    width: 100%; box-sizing: border-box; text-align: left;
  }
  .rarity-pill:hover { border-color: #c9b8ff; color: #7e22ce; }
  .rarity-pill.active {
    background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    border-color: #1a1a1a; color: #1a1a1a;
    box-shadow: 2px 2px 0px #c9b8ff;
  }
  .rarity-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; border: 1.5px solid; }

  .stat-section { margin-bottom: 14px; }
  .stat-range-row { display: flex; gap: 6px; width: 100%; }
  .stat-range-input {
    flex: 1;
    min-width: 0;
    padding: 7px 8px;
    border: 2px solid #e2e8f0; border-radius: 12px;
    font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 700; color: #1a1a1a;
    outline: none; transition: border-color 0.15s, box-shadow 0.15s; background: #fafaf8;
    box-sizing: border-box;
    width: 100%;
  }
  .stat-range-input:focus { border-color: #c9b8ff; box-shadow: 1px 1px 0px #c9b8ff; }

  .sidebar-info {
    margin-top: 16px; padding: 11px 12px;
    background: #fdf4ff; border: 1.5px solid #e9d5ff; border-radius: 12px;
    display: flex; gap: 8px;
  }
  .sidebar-info p { font-size: 10px; color: #64748b; line-height: 1.6; margin: 0; }

  .listing-count {
    font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em;
    color: #94a3b8; margin-bottom: 20px;
    display: flex; align-items: center; gap: 8px;
  }

  .listing-item { display: flex; flex-direction: column; gap: 8px; }
  .listing-card-area { position: relative; }
  .listing-shadow {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border-radius: 20px;
    transform: translate(5px, 5px);
    z-index: 0;
    pointer-events: none;
  }
  .listing-card {
    border: 2px solid;
    border-radius: 20px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
    position: relative; z-index: 1;
    background: white;
  }
  .listing-card:hover { transform: translateY(-3px) rotate(-0.3deg); }

  .listing-price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }
  .listing-price-label {
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94a3b8;
  }
  .listing-price-value {
    font-family: 'Caveat', cursive;
    font-size: 18px;
    font-weight: 700;
    color: #7e22ce;
  }

  .buy-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px 14px; width: 100%;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a;
    background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    font-family: 'Nunito', sans-serif;
    font-size: 12px; font-weight: 800; color: #1a1a1a;
    box-shadow: 3px 3px 0px #c9b8ff;
    cursor: pointer; transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
    box-sizing: border-box;
  }
  .buy-btn:hover { transform: translateY(-2px); box-shadow: 5px 5px 0px #c9b8ff; }
  .buy-btn:active { transform: translateY(1px); box-shadow: 1px 1px 0px #c9b8ff; }
  .buy-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .buy-btn.yours {
    background: #f8f8f8; color: #94a3b8; border-color: #e2e8f0;
    box-shadow: 3px 3px 0px #e2e8f0; cursor: default;
  }
  .buy-btn.yours:hover { transform: none; box-shadow: 3px 3px 0px #e2e8f0; }

  .listing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }

  .mkt-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0; gap: 16px; }
  .mkt-loading-text { font-family: 'Caveat', cursive; font-size: 22px; color: #94a3b8; }
  .mkt-empty {
    text-align: center; padding: 80px 24px;
    background: white; border: 2px dashed #e2e8f0; border-radius: 24px;
  }
  .mkt-empty-icon { font-size: 48px; margin-bottom: 16px; }
  .mkt-empty-title { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .mkt-empty-desc { font-size: 13px; color: #64748b; margin-bottom: 20px; }

  @media (max-width: 768px) {
    .mkt-title { font-size: 32px; }
    .mkt-header { flex-direction: column; align-items: flex-start; }
    .mkt-search { width: 180px; }
    .listing-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [listings, setListings] = useState<NFT[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRarities, setSelectedRarities] = useState<number[]>([]);
  const [hpRange, setHpRange] = useState({ min: "0", max: "9999" });
  const [atkRange, setAtkRange] = useState({ min: "0", max: "9999" });
  const [spdRange, setSpdRange] = useState({ min: "0", max: "9999" });

  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const NFT_TYPE = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;

  // ── Fetch TransferPolicy<GyateNFT> dynamically ────────────────────────────
  // Query by StructType so we never rely on a hardcoded ID that may not exist.
const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listedRes, purchasedRes, delistedRes] = await Promise.all([
        suiClient.queryEvents({ query: { MoveEventType: `0x2::kiosk::ItemListed<${NFT_TYPE}>` }, limit: 100, order: "descending" }),
        suiClient.queryEvents({ query: { MoveEventType: `0x2::kiosk::ItemPurchased<${NFT_TYPE}>` }, limit: 100, order: "descending" }),
        suiClient.queryEvents({ query: { MoveEventType: `0x2::kiosk::ItemDelisted<${NFT_TYPE}>` }, limit: 100, order: "descending" }),
      ]);
      const soldIds = new Set(purchasedRes.data.map((e: any) => normalizeSuiId(e.parsedJson?.id)));
      const delistedIds = new Set(delistedRes.data.map((e: any) => normalizeSuiId(e.parsedJson?.id)));
      const seen = new Set<string>();
      const activeListings: ActiveListing[] = [];
      for (const e of listedRes.data) {
        const nftId = normalizeSuiId(e.parsedJson?.id);
        const kioskId = normalizeSuiId(e.parsedJson?.kiosk);
        const priceMist = e.parsedJson?.price?.toString() ?? "0";
        if (!nftId || seen.has(nftId)) continue;
        seen.add(nftId);
        if (soldIds.has(nftId) || delistedIds.has(nftId)) continue;
        activeListings.push({ nftId, kioskId, priceMist });
      }
      if (activeListings.length === 0) { setListings([]); return; }
      const verifiedListings: NFT[] = [];
      await Promise.all(activeListings.map(async (listing) => {
        try {
          const dynField = await suiClient.getDynamicFieldObject({ parentId: listing.kioskId, name: { type: "0x2::kiosk::Item", value: { id: listing.nftId } } });
          if (!dynField?.data?.content) return;
          const listedField = await suiClient.getDynamicFieldObject({ parentId: listing.kioskId, name: { type: "0x2::kiosk::Listing", value: { id: listing.nftId, is_exclusive: false } } }).catch(() => null);
          if (!listedField?.data) return;
          const nftObj = await suiClient.getObject({ id: listing.nftId, options: { showContent: true } });
          const fields = (nftObj.data?.content as any)?.fields;
          if (!fields) return;
          verifiedListings.push({
            id: listing.nftId, name: fields.name ?? "Unknown", rarity: Number(fields.rarity ?? 0),
            variantType: fields.variant_type ?? "Normal", image: fields.image_url ?? "",
            hp: Number(fields.hp ?? 0), atk: Number(fields.atk ?? 0), spd: Number(fields.spd ?? 0),
            baseValue: Number(fields.base_value ?? 0), actualValue: Number(fields.actual_value ?? 0),
            lootboxSource: fields.lootbox_source ?? "", globalId: Number(fields.global_sequential_id ?? 0),
            price: mistToSui(listing.priceMist), priceMist: listing.priceMist,
            seller: "On-Chain Listing", kioskId: listing.kioskId,
          } as NFT & { priceMist: string });
        } catch { }
      }));
      setListings(verifiedListings);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not load marketplace listings." });
    } finally { setIsLoading(false); }
  }, [suiClient, NFT_TYPE, toast]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // ── Buy ────────────────────────────────────────────────────────────────────
  //
  // Move signature:
  //   buy_nft(seller_kiosk, policy, pool, nft_id: ID, payment: Coin<SUI>,
  //           buyer_kiosk, buyer_cap, ctx)
  //
  // Fee model (from contract):
  //   buyer sends: listed_price + floor(listed_price / 10)  i.e. listed * 1.1
  //   fee = total - floor(total * 10 / 11)
  //   payment passed to kiosk::purchase = floor(total * 10 / 11) = listed_price
  const transferPolicyId = TRANSFER_POLICY;
  //
  const handleBuyNft = async (item: NFT & { priceMist?: string }) => {
    if (!account) {
      toast({ variant: "destructive", title: "Connect your wallet first" });
      return;
    }
    if (!item.kioskId) {
      toast({ variant: "destructive", title: "Missing kiosk data" });
      return;
    }
    if (!transferPolicyId) {
      toast({ variant: "destructive", title: "Marketplace not ready", description: "TransferPolicy not found on-chain. Try refreshing." });
      return;
    }

    setIsPending(true);
    try {
      // ── 1. Fetch buyer's KioskOwnerCap ────────────────────────────────────
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });

      if (capsRes.data.length === 0) {
        toast({
          variant: "destructive",
          title: "No Kiosk Found",
          description: "Create a kiosk first before buying.",
        });
        setIsPending(false);
        return;
      }

      const buyerCapId  = capsRes.data[0].data!.objectId;

      // `for` field on KioskOwnerCap holds the kiosk object ID.
      // The Sui RPC can return it as a plain "0x..." string OR a nested { id: "0x..." }
      // object depending on the SDK version — normalise both shapes.
      const rawFor = (capsRes.data[0].data?.content as any)?.fields?.for;
      const buyerKioskId: string | undefined =
        typeof rawFor === "string"
          ? rawFor
          : typeof rawFor?.id === "string"
            ? rawFor.id
            : undefined;

      if (!buyerKioskId) {
        toast({
          variant: "destructive",
          title: "Could not resolve your Kiosk ID.",
          description: "Try reconnecting your wallet.",
        });
        setIsPending(false);
        return;
      }

      // ── 2. Compute payment ────────────────────────────────────────────────
      // listed_price is what the seller set.
      // Total buyer sends = listed_price + floor(listed_price / 10)
      const listedMist    = BigInt(item.priceMist ?? Math.round((item.price ?? 0) * 1_000_000_000));
      const feeMist       = listedMist / 10n;           // floor division — matches contract
      const totalMist     = listedMist + feeMist;       // what we split from gas

      // ── 3. Build PTB ──────────────────────────────────────────────────────
      const txb = new Transaction();

      const [paymentCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(totalMist)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.BUY_NFT}`,
        typeArguments: [],   // no type params on buy_nft itself — types are inferred
        arguments: [
          txb.object(normalizeSuiId(item.kioskId)),          // seller_kiosk: &mut Kiosk
          txb.object(TRANSFER_POLICY),                       // policy: &mut TransferPolicy<GyateNFT>
          txb.object(TREASURY_POOL),                         // pool: &mut TreasuryPool
          txb.pure.address(normalizeSuiId(item.id)),         // nft_id: ID  ← was txb.pure.id(), use pure.address instead
          paymentCoin,                                       // payment: Coin<SUI>
          txb.object(normalizeSuiId(buyerKioskId)),          // buyer_kiosk: &mut Kiosk
          txb.object(normalizeSuiId(buyerCapId)),            // buyer_cap: &KioskOwnerCap
        ],
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: () => {
            toast({
              title: "Purchase Successful! 🎉",
              description: `${item.name} is now in your Kiosk.`,
            });
            setIsPending(false);
            setSelectedNft(null);
            setTimeout(fetchListings, 3000);
          },
          onError: (err) => {
            toast({ variant: "destructive", title: "Purchase Failed", description: err.message });
            setIsPending(false);
          },
        },
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
      setIsPending(false);
    }
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const filteredListings = useMemo(() => {
    const minHp = parseInt(hpRange.min) || 0, maxHp = parseInt(hpRange.max) || 999999;
    const minAtk = parseInt(atkRange.min) || 0, maxAtk = parseInt(atkRange.max) || 999999;
    const minSpd = parseInt(spdRange.min) || 0, maxSpd = parseInt(spdRange.max) || 999999;
    return listings.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.id.includes(searchTerm);
      const matchesRarity = selectedRarities.length === 0 || selectedRarities.includes(l.rarity);
      return matchesSearch && matchesRarity && l.hp >= minHp && l.hp <= maxHp && l.atk >= minAtk && l.atk <= maxAtk && l.spd >= minSpd && l.spd <= maxSpd;
    });
  }, [listings, searchTerm, selectedRarities, hpRange, atkRange, spdRange]);

  const toggleRarity = (r: number) => setSelectedRarities(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  const resetFilters = () => { setSearchTerm(""); setSelectedRarities([]); setHpRange({ min:"0", max:"9999" }); setAtkRange({ min:"0", max:"9999" }); setSpdRange({ min:"0", max:"9999" }); };

  return (
    <div className="mkt-page">
      <style dangerouslySetInnerHTML={{ __html: MKT_STYLES }} />
      <Navigation />

      <div className="mkt-container">
        {/* ── Header ── */}
        <div className="mkt-header">
          <div>
            <div className="mkt-title">Marketplace ✦</div>
            <div className="mkt-subtitle">Verified on-chain listings · 10% kiosk-enforced royalty</div>
          </div>
          <div className="mkt-header-actions">
            <button className="mkt-btn icon-only" onClick={() => fetchListings()} disabled={isLoading}>
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
            <div className="mkt-search-wrap">
              <Search size={15} className="mkt-search-icon" />
              <input
                className="mkt-search"
                placeholder="Search heroes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mkt-layout">
          {/* ── Sidebar ── */}
          <aside>
            <div className="mkt-sidebar">
              <div className="sidebar-title">
                <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Filter size={16} /> Filters
                </span>
                <button className="sidebar-reset" onClick={resetFilters}>Reset</button>
              </div>

              <div className="sidebar-label">Rarity</div>
              <div className="rarity-pills">
                {([0,1,2,3,4,5] as const).map(r => {
                  const color = RARITY_DOODLE_COLORS[r];
                  const active = selectedRarities.includes(r);
                  return (
                    <button key={r} className={`rarity-pill ${active ? "active" : ""}`} onClick={() => toggleRarity(r)}>
                      <span className="rarity-dot" style={{ background: active ? color.text : color.bg, borderColor: color.border }} />
                      {RARITY_LABELS[r]}
                    </button>
                  );
                })}
              </div>

              <div className="sidebar-divider" />

              <div className="sidebar-label">Stats</div>
              {(["HP", "ATK", "SPD"] as const).map((label) => {
                const rangeMap = { HP: hpRange, ATK: atkRange, SPD: spdRange };
                const setMap = { HP: setHpRange, ATK: setAtkRange, SPD: setSpdRange };
                const range = rangeMap[label];
                const setRange = setMap[label];
                return (
                  <div className="stat-section" key={label}>
                    <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
                    <div className="stat-range-row">
                      <input
                        type="number" className="stat-range-input"
                        placeholder="Min" value={range.min}
                        onChange={e => setRange((p: any) => ({ ...p, min: e.target.value }))}
                      />
                      <input
                        type="number" className="stat-range-input"
                        placeholder="Max" value={range.max}
                        onChange={e => setRange((p: any) => ({ ...p, max: e.target.value }))}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="sidebar-info">
                <Info size={13} style={{ color:"#a855f7", flexShrink:0, marginTop:1 }} />
                <p>Listings verified in real-time via on-chain kiosk state. Stale items auto-hidden.</p>
              </div>
            </div>
          </aside>

          {/* ── Main ── */}
          <main>
            {isLoading ? (
              <div className="mkt-loading">
                <div style={{ fontSize:40 }}>🔍</div>
                <div className="mkt-loading-text">Scanning the marketplace...</div>
              </div>
            ) : filteredListings.length > 0 ? (
              <>
                <div className="listing-count">
                  <span>{filteredListings.length} listing{filteredListings.length !== 1 ? "s" : ""} found</span>
                  {selectedRarities.length > 0 && (
                    <button
                      onClick={() => setSelectedRarities([])}
                      style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 8px", borderRadius:20, border:"1.5px solid #e2e8f0", background:"white", fontSize:10, fontWeight:800, color:"#94a3b8", cursor:"pointer" }}
                    >
                      <X size={9} /> Clear rarity
                    </button>
                  )}
                </div>

                <div className="listing-grid">
                  {filteredListings.map(item => {
                    const color = RARITY_DOODLE_COLORS[Math.min(item.rarity ?? 0, 5)];
                    const isYours = item.kioskId === account?.address;
                    return (
                      <div key={item.id} className="listing-item">
                        <div className="listing-card-area">
                          <div className="listing-shadow" style={{ background: color.shadow }} />
                          <div
                            className="listing-card"
                            style={{ borderColor: color.border }}
                            onClick={() => setSelectedNft(item)}
                          >
                            <NFTCard nft={item} />
                          </div>
                        </div>

                        {item.price != null && (
                          <div className="listing-price-row">
                            <span className="listing-price-label">Price</span>
                            <span className="listing-price-value">{item.price.toFixed(2)} SUI</span>
                          </div>
                        )}

                        <button
                          className={`buy-btn ${isYours ? "yours" : ""}`}
                          onClick={() => !isYours && handleBuyNft(item as any)}
                          disabled={isPending || isYours}
                        >
                          {isPending ? <Loader2 size={13} className="animate-spin" /> : null}
                          {isYours ? "Your Listing" : "Buy Now →"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="mkt-empty">
                <div className="mkt-empty-icon">📭</div>
                <div className="mkt-empty-title">No Heroes Found</div>
                <div className="mkt-empty-desc">Try adjusting your filters, or check back soon for new listings.</div>
                <button className="mkt-btn" onClick={resetFilters}>Clear Filters</button>
              </div>
            )}
          </main>
        </div>
      </div>

      <NFTDetailDialog
        nft={selectedNft}
        open={!!selectedNft}
        onOpenChange={open => !open && setSelectedNft(null)}
      />
    </div>
  );
}