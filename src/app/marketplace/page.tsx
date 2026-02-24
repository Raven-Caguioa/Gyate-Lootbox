"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Info, Loader2, PackageSearch, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useCallback, useMemo } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL, TRANSFER_POLICY, KIOSK_REGISTRY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@mysten/sui/transactions";
import { NFT, RARITY_LABELS } from "@/lib/mock-data";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeSuiId(id: string | any): string {
  if (!id) return "";
  const str = typeof id === "string" ? id : id?.id || id?.objectId || JSON.stringify(id);
  return str.toLowerCase().replace(/^(0x)?/, "0x");
}
function mistToSui(mist: string | number | bigint): number {
  return Number(BigInt(mist.toString())) / 1_000_000_000;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveListing {
  nftId: string;
  kioskId: string;
  priceMist: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const MKT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  .mkt-page {
    min-height: 100vh;
    background: #fafaf8;
    font-family: 'Nunito', sans-serif;
  }
  .mkt-page::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      radial-gradient(circle at 15% 30%, rgba(201,184,255,0.10) 0%, transparent 50%),
      radial-gradient(circle at 85% 70%, rgba(255,184,217,0.08) 0%, transparent 50%);
    pointer-events: none; z-index: 0;
  }
  .mkt-container { max-width: 1280px; margin: 0 auto; padding: 36px 24px; position: relative; z-index: 1; }

  /* Header */
  .mkt-title { font-family: 'Caveat', cursive; font-size: 48px; font-weight: 700; color: #1a1a1a; line-height: 1; margin-bottom: 8px; }
  .mkt-subtitle { font-size: 14px; color: #64748b; font-weight: 600; }

  /* Doodle button */
  .mkt-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 20px;
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
  .mkt-btn.buy {
    width: 100%; justify-content: center;
    background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    font-size: 14px; padding: 12px 20px;
    box-shadow: 4px 4px 0px #c9b8ff;
  }
  .mkt-btn.buy:hover { box-shadow: 6px 6px 0px #c9b8ff; }
  .mkt-btn.buy:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: 4px 4px 0px #c9b8ff; }
  .mkt-btn.buy.your-listing {
    background: #f1f5f9;
    color: #94a3b8;
    box-shadow: 4px 4px 0px #e2e8f0;
    cursor: default;
  }
  .mkt-btn.buy.your-listing:hover { transform: none; box-shadow: 4px 4px 0px #e2e8f0; }

  /* Layout */
  .mkt-layout { display: grid; grid-template-columns: 300px 1fr; gap: 32px; margin-top: 40px; }
  @media (max-width: 900px) { .mkt-layout { grid-template-columns: 1fr; } }

  /* Sidebar */
  .mkt-sidebar {
    position: sticky; top: 88px; height: fit-content;
    background: white;
    border: 2px solid #1a1a1a;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 5px 5px 0px #e2e8f0;
  }
  .sidebar-title {
    font-family: 'Caveat', cursive; font-size: 22px; font-weight: 700; color: #1a1a1a;
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 20px;
  }
  .sidebar-reset {
    font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em;
    color: #94a3b8; cursor: pointer; background: none; border: none; font-family: 'Nunito', sans-serif;
    padding: 4px 8px; border-radius: 6px; transition: color 0.15s ease;
  }
  .sidebar-reset:hover { color: #7e22ce; }

  .sidebar-section { margin-bottom: 24px; }
  .sidebar-label {
    font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em;
    color: #94a3b8; margin-bottom: 10px; display: block;
  }
  .sidebar-divider { height: 1px; background: #f1f5f9; margin: 20px 0; }

  /* Doodle search in sidebar */
  .sidebar-search-wrap { position: relative; }
  .sidebar-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 13px; height: 13px; }
  .sidebar-search {
    width: 100%; box-sizing: border-box;
    padding: 9px 12px 9px 32px;
    border: 2px solid #e2e8f0;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 600;
    color: #1a1a1a; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
    background: #fafaf8;
  }
  .sidebar-search:focus { border-color: #c9b8ff; box-shadow: 2px 2px 0px #c9b8ff; }
  .sidebar-search::placeholder { color: #94a3b8; }

  /* Rarity checkboxes */
  .rarity-check-row {
    display: flex; align-items: center; gap: 10px; padding: 6px 0; cursor: pointer;
  }
  .rarity-check-box {
    width: 16px; height: 16px; border-radius: 5px; border: 2px solid #e2e8f0;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    transition: all 0.15s ease; background: white;
  }
  .rarity-check-box.checked { background: linear-gradient(135deg, #f3e8ff, #fce7f3); border-color: #1a1a1a; box-shadow: 1px 1px 0px #c9b8ff; }
  .rarity-check-label { font-size: 12px; font-weight: 700; color: #475569; transition: color 0.15s ease; }
  .rarity-check-row:hover .rarity-check-label { color: #1a1a1a; }

  /* Stat range inputs */
  .stat-range-row { display: flex; gap: 8px; }
  .stat-range-input {
    flex: 1; padding: 7px 10px;
    border: 2px solid #e2e8f0; border-radius: 12px;
    font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 700; color: #1a1a1a;
    outline: none; transition: border-color 0.15s ease; background: #fafaf8;
  }
  .stat-range-input:focus { border-color: #c9b8ff; }

  /* Info box */
  .sidebar-info {
    margin-top: 20px;
    padding: 12px;
    background: #fdf4ff;
    border: 1.5px solid #e9d5ff;
    border-radius: 12px;
    display: flex; gap: 8px;
  }
  .sidebar-info p { font-size: 10px; color: #64748b; line-height: 1.6; margin: 0; }

  /* Listing count */
  .listing-count { font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 20px; }

  /* NFT listing card */
  .listing-card {
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 20px;
    overflow: hidden;
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
    position: relative;
  }
  .listing-card:hover { border-color: #c9b8ff; transform: translateY(-2px); }
  .listing-card-shadow {
    position: absolute; inset: 0; border-radius: 18px;
    background: #e9d5ff; transform: translate(5px,5px); z-index: -1;
  }
  .listing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap: 20px; }

  /* Loading / empty */
  .mkt-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0; gap: 16px; }
  .mkt-loading-text { font-family: 'Caveat', cursive; font-size: 22px; color: #94a3b8; }
  .mkt-empty {
    text-align: center; padding: 80px 24px;
    background: white;
    border: 2px dashed #e2e8f0; border-radius: 24px;
  }
  .mkt-empty-icon { font-size: 48px; margin-bottom: 16px; }
  .mkt-empty-title { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .mkt-empty-desc { font-size: 13px; color: #64748b; margin-bottom: 20px; }
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

  // ── Fetch listings ──────────────────────────────────────────────────────────
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
          const dynField = await suiClient.getDynamicFieldObject({
            parentId: listing.kioskId,
            name: { type: "0x2::kiosk::Item", value: { id: listing.nftId } },
          });
          if (!dynField?.data?.content) return;
          const listedField = await suiClient.getDynamicFieldObject({
            parentId: listing.kioskId,
            name: { type: "0x2::kiosk::Listing", value: { id: listing.nftId, is_exclusive: false } },
          }).catch(() => null);
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
      console.error("Marketplace fetch error:", err);
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not load marketplace listings." });
    } finally { setIsLoading(false); }
  }, [suiClient, NFT_TYPE, toast]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  // ── Buy handler ─────────────────────────────────────────────────────────────
  const handleBuyNft = async (item: NFT & { priceMist?: string }) => {
    if (!account) { toast({ variant: "destructive", title: "Connect your wallet first" }); return; }
    if (!item.kioskId) { toast({ variant: "destructive", title: "Missing kiosk data for this listing" }); return; }
    setIsPending(true);
    try {
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address, filter: { StructType: "0x2::kiosk::KioskOwnerCap" }, options: { showContent: true },
      });
      if (capsRes.data.length === 0) {
        toast({ variant: "destructive", title: "No Kiosk Found", description: "You need a Kiosk to buy. Create one in your inventory first." });
        setIsPending(false); return;
      }
      const buyerCapId = capsRes.data[0].data?.objectId!;
      const buyerKioskId = (capsRes.data[0].data?.content as any)?.fields?.for;
      if (!buyerKioskId) throw new Error("Could not determine your Kiosk ID from cap.");

      const listedPriceMist: bigint = item.priceMist ? BigInt(item.priceMist) : BigInt(Math.round((item.price ?? 0) * 1_000_000_000));
      const feeMist = (listedPriceMist * 1000n) / 10000n;
      const totalPaymentMist = listedPriceMist + feeMist;

      const txb = new Transaction();
      const [paymentCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(totalPaymentMist)]);
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.BUY_NFT}`,
        arguments: [
          txb.object(normalizeSuiId(item.kioskId)), txb.object(TRANSFER_POLICY), txb.object(TREASURY_POOL),
          txb.pure.id(normalizeSuiId(item.id)), paymentCoin,
          txb.object(normalizeSuiId(buyerKioskId)), txb.object(normalizeSuiId(buyerCapId)),
        ],
      });
      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Purchase Successful! 🎉", description: `${item.name} is now in your Kiosk.` });
          setIsPending(false); setSelectedNft(null); setTimeout(fetchListings, 3000);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Purchase Failed", description: err.message ?? "Transaction rejected." });
          setIsPending(false);
        },
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message ?? "Something went wrong." });
      setIsPending(false);
    }
  };

  // ── Filters ─────────────────────────────────────────────────────────────────
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

  const toggleRarity = (rarity: number) => setSelectedRarities(prev => prev.includes(rarity) ? prev.filter(r => r !== rarity) : [...prev, rarity]);
  const resetFilters = () => { setSearchTerm(""); setSelectedRarities([]); setHpRange({ min:"0", max:"9999" }); setAtkRange({ min:"0", max:"9999" }); setSpdRange({ min:"0", max:"9999" }); };

  return (
    <div className="mkt-page">
      <style dangerouslySetInnerHTML={{ __html: MKT_STYLES }} />
      <Navigation />

      <div className="mkt-container">
        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
          <div>
            <div className="mkt-title">Marketplace </div>
            <div className="mkt-subtitle">Verified on-chain listings · 10% kiosk-enforced royalty</div>
          </div>
          <button className="mkt-btn" onClick={fetchListings} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            {isLoading ? "Syncing..." : "Refresh"}
          </button>
        </div>

        <div className="mkt-layout">
          {/* Sidebar */}
          <aside>
            <div className="mkt-sidebar">
              <div className="sidebar-title">
                <span>🔎 Filters</span>
                <button className="sidebar-reset" onClick={resetFilters}>Reset All</button>
              </div>

              <div className="sidebar-section">
                <span className="sidebar-label">Search</span>
                <div className="sidebar-search-wrap">
                  <Search size={13} className="sidebar-search-icon" />
                  <input className="sidebar-search" placeholder="Name or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>

              <div className="sidebar-divider" />

              <div className="sidebar-section">
                <span className="sidebar-label">Rarity</span>
                {([0,1,2,3,4,5] as const).map(r => (
                  <div key={r} className="rarity-check-row" onClick={() => toggleRarity(r)}>
                    <div className={`rarity-check-box ${selectedRarities.includes(r) ? "checked" : ""}`}>
                      {selectedRarities.includes(r) && <span style={{ fontSize:10, fontWeight:900, color:"#7e22ce" }}>✓</span>}
                    </div>
                    <span className="rarity-check-label">{RARITY_LABELS[r]}</span>
                  </div>
                ))}
              </div>

              <div className="sidebar-divider" />

              <div className="sidebar-section">
                {([
                  { label: "HP", range: hpRange, setRange: setHpRange },
                  { label: "ATK", range: atkRange, setRange: setAtkRange },
                  { label: "SPD", range: spdRange, setRange: setSpdRange },
                ] as const).map(({ label, range, setRange }) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <span className="sidebar-label">{label} Range</span>
                    <div className="stat-range-row">
                      <input type="number" className="stat-range-input" placeholder="Min" value={range.min} onChange={e => setRange((p: any) => ({ ...p, min: e.target.value }))} />
                      <input type="number" className="stat-range-input" placeholder="Max" value={range.max} onChange={e => setRange((p: any) => ({ ...p, max: e.target.value }))} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="sidebar-info">
                <Info size={13} style={{ color:"#a855f7", flexShrink:0, marginTop:1 }} />
                <p>Listings verified in real-time via on-chain kiosk state. Stale items auto-hidden.</p>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main>
            {isLoading ? (
              <div className="mkt-loading">
                <div style={{ fontSize:40 }}>🔍</div>
                <div className="mkt-loading-text">Scanning the marketplace...</div>
              </div>
            ) : filteredListings.length > 0 ? (
              <>
                <div className="listing-count">{filteredListings.length} listing{filteredListings.length !== 1 ? "s" : ""} found</div>
                <div className="listing-grid">
                  {filteredListings.map(item => (
                    <div key={item.id} style={{ position:"relative", display:"flex", flexDirection:"column", gap:10 }}>
                      <div className="listing-card-shadow" />
                      <div className="listing-card">
                        <NFTCard nft={item} onClick={() => setSelectedNft(item)} showPrice />
                      </div>
                      <button
                        className={`mkt-btn buy ${item.kioskId === account?.address ? "your-listing" : ""}`}
                        onClick={() => handleBuyNft(item as any)}
                        disabled={isPending || item.kioskId === account?.address}
                      >
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                        {item.kioskId === account?.address ? "Your Listing" : "Buy Now →"}
                      </button>
                    </div>
                  ))}
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

      <NFTDetailDialog nft={selectedNft} open={!!selectedNft} onOpenChange={open => !open && setSelectedNft(null)} />
    </div>
  );
}