"use client";

import { Navigation } from "@/components/navigation";
import { Store, Sparkles, Loader2, RefreshCw, Zap, Info, Coins, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import { RevealLootboxDialog } from "@/components/reveal-lootbox-dialog";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, LOOTBOX_REGISTRY, TREASURY_POOL, MODULE_NAMES, FUNCTIONS, RANDOM_STATE, GATEKEEPER_CAP, STATS_REGISTRY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";
import { NFT } from "@/lib/mock-data";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PossibleNFT { name: string; image: string; }
interface LootboxData {
  id: string; name: string; price: string; gyate_price: string; description: string; image: string;
  pity_enabled: boolean; multi_open_enabled: boolean; multi_open_size: string;
  common_count: number; rare_count: number; super_rare_count: number;
  ssr_count: number; ultra_rare_count: number; legend_rare_count: number;
  possibleNfts: PossibleNFT[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const SHOP_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  .shop-page {
    min-height: 100vh;
    background: #fafaf8;
    font-family: 'Nunito', sans-serif;
  }
  .shop-page::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      radial-gradient(circle at 10% 20%, rgba(255,245,184,0.25) 0%, transparent 40%),
      radial-gradient(circle at 90% 80%, rgba(201,184,255,0.15) 0%, transparent 40%),
      radial-gradient(circle at 50% 50%, rgba(255,184,217,0.08) 0%, transparent 60%);
    pointer-events: none; z-index: 0;
  }
  .shop-container { max-width: 1280px; margin: 0 auto; padding: 36px 24px; position: relative; z-index: 1; }

  /* Header */
  .shop-header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 48px; }
  .shop-title { font-family: 'Caveat', cursive; font-size: 52px; font-weight: 700; color: #1a1a1a; line-height: 1; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
  .shop-subtitle { font-size: 14px; color: #64748b; font-weight: 600; }

  /* Payment toggle */
  .payment-toggle {
    display: flex;
    background: white;
    border: 2px solid #1a1a1a;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    padding: 4px;
    box-shadow: 4px 4px 0px #c9b8ff;
    gap: 4px;
  }
  .payment-toggle-btn {
    padding: 8px 20px;
    border-radius: 255px 12px 225px 12px / 12px 225px 12px 255px;
    border: none; cursor: pointer;
    font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 900;
    text-transform: uppercase; letter-spacing: 0.05em;
    transition: all 0.2s ease; color: #94a3b8; background: transparent;
  }
  .payment-toggle-btn.active-sui { background: #1a1a1a; color: white; }
  .payment-toggle-btn.active-gyate { background: linear-gradient(135deg, #f3e8ff, #fce7f3); color: #7e22ce; border: 1.5px solid #c9b8ff; }

  /* Lootbox cards grid */
  .lootbox-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px,1fr)); gap: 28px; }

  /* Card */
  .lootbox-card {
    background: white;
    border: 2px solid #1a1a1a;
    border-radius: 24px;
    overflow: hidden;
    position: relative;
    transition: transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
    display: flex; flex-direction: column;
  }
  .lootbox-card:hover { transform: translateY(-4px); }
  .lootbox-card-shadow {
    position: absolute; inset: 0; border-radius: 22px;
    background: linear-gradient(135deg, #c9b8ff, #ffb8d9);
    transform: translate(6px,6px); z-index: -1;
  }

  /* Carousel area */
  .card-carousel { position: relative; aspect-ratio: 4/3; overflow: hidden; background: #f8f4ff; }
  .card-carousel-inner { display: flex; height: 100%; }
  .carousel-slide { flex: 0 0 100%; min-width: 0; height: 100%; position: relative; }
  .carousel-slide img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease; }
  .carousel-slide:hover img { transform: scale(1.05); }
  .carousel-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%); }
  .carousel-label {
    position: absolute; bottom: 10px; left: 10px;
    font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
    color: white; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
    padding: 4px 10px; border-radius: 20px;
  }

  /* Badges on card */
  .card-badges { position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
  .card-badge {
    font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em;
    padding: 3px 9px; border-radius: 20px; border: 1.5px solid;
    backdrop-filter: blur(4px);
  }
  .card-badge.pity { background: rgba(243,232,255,0.9); color: #7e22ce; border-color: #c9b8ff; }
  .card-badge.multi { background: rgba(219,234,254,0.9); color: #1d4ed8; border-color: #93c5fd; }

  /* Card body */
  .card-body { padding: 20px; display: flex; flex-direction: column; flex: 1; }
  .card-name { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }

  /* Rarity drops mini display */
  .card-drops { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px; }
  .drop-pill {
    font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em;
    padding: 2px 8px; border-radius: 20px; border: 1.5px solid;
  }
  .drop-pill.common { background: #f8f8f8; color: #475569; border-color: #cbd5e1; }
  .drop-pill.rare { background: #eff6ff; color: #1d4ed8; border-color: #93c5fd; }
  .drop-pill.super-rare { background: #faf5ff; color: #7e22ce; border-color: #d8b4fe; }
  .drop-pill.ssr { background: #fdf4ff; color: #86198f; border-color: #f0abfc; }
  .drop-pill.ultra { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
  .drop-pill.legend { background: #fff1f2; color: #9f1239; border-color: #fda4af; }

  /* Price row */
  .price-row {
    display: flex; align-items: flex-end; justify-content: space-between;
    padding: 14px 0; border-top: 2px dashed #f1f5f9; border-bottom: 2px dashed #f1f5f9;
    margin-bottom: 16px;
  }
  .price-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .price-main { font-family: 'Caveat', cursive; font-size: 32px; font-weight: 700; color: #1a1a1a; line-height: 1; }
  .price-currency { font-size: 14px; font-weight: 900; color: #7e22ce; margin-left: 4px; }
  .price-alt { font-size: 13px; font-weight: 800; color: #94a3b8; text-decoration: line-through; display: flex; align-items: center; gap: 3px; }
  .price-alt.active-gyate { color: #7e22ce; text-decoration: none; font-size: 15px; }

  /* Action buttons */
  .action-row { display: grid; gap: 8px; }
  .action-row.two-col { grid-template-columns: 1fr 1fr; }
  .shop-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 13px 16px;
    border: 2px solid #1a1a1a;
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; color: #1a1a1a;
    cursor: pointer; transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
  }
  .shop-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
  .shop-btn.primary {
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    box-shadow: 4px 4px 0px #c9b8ff;
  }
  .shop-btn.primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 6px 6px 0px #c9b8ff; }
  .shop-btn.secondary {
    border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px;
    background: white;
    box-shadow: 3px 3px 0px #e2e8f0;
  }
  .shop-btn.secondary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 5px 5px 0px #e2e8f0; }
  .shop-btn.pity {
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    background: #fdf4ff;
    color: #86198f; border-color: #e879f9;
    box-shadow: 3px 3px 0px #f0abfc;
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .shop-btn.pity:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 5px 5px 0px #f0abfc; }

  /* Loading/empty states */
  .shop-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0; gap: 20px; }
  .shop-loading-text { font-family: 'Caveat', cursive; font-size: 24px; color: #94a3b8; }
  .shop-empty {
    text-align: center; padding: 100px 24px;
    background: white; border: 2px dashed #e2e8f0; border-radius: 28px;
  }
  .shop-empty-icon { font-size: 56px; margin-bottom: 20px; }
  .shop-empty-title { font-family: 'Caveat', cursive; font-size: 32px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .shop-empty-desc { font-size: 14px; color: #64748b; max-width: 360px; margin: 0 auto; }

  @media (max-width: 768px) {
    .shop-title { font-size: 38px; }
    .lootbox-grid { grid-template-columns: 1fr; }
    .action-row.two-col { grid-template-columns: 1fr; }
  }
`;

// ─── Carousel ─────────────────────────────────────────────────────────────────

function LootboxPreviewCarousel({ nfts, fallbackImage }: { nfts: PossibleNFT[]; fallbackImage: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 30 });
  useEffect(() => {
    if (!emblaApi || nfts.length <= 1) return;
    const id = setInterval(() => emblaApi.scrollNext(), 3000);
    return () => clearInterval(id);
  }, [emblaApi, nfts.length]);

  if (nfts.length === 0) {
    return (
      <div className="card-carousel">
        <Image src={fallbackImage} alt="Lootbox" fill className="object-cover" />
        <div className="carousel-overlay" />
      </div>
    );
  }

  return (
    <div className="card-carousel" ref={emblaRef}>
      <div className="card-carousel-inner">
        {nfts.map((nft, idx) => (
          <div key={idx} className="carousel-slide">
            <Image src={nft.image || fallbackImage} alt={nft.name} fill className="object-cover" />
            <div className="carousel-overlay" />
            <div className="carousel-label">Possible Drop: {nft.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ShopPage() {
  const [activeBoxes, setActiveBoxes] = useState<LootboxData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'SUI' | 'GYATE'>('SUI');
  const [revealBox, setRevealBox] = useState<LootboxData | null>(null);
  const [revealResults, setRevealResults] = useState<NFT[]>([]);
  const [showReveal, setShowReveal] = useState(false);

  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const fetchActiveLootboxes = useCallback(async () => {
    setIsLoading(true);
    try {
      const registryObj = await suiClient.getObject({ id: LOOTBOX_REGISTRY, options: { showContent: true } });
      const activeIds = (registryObj.data?.content as any)?.fields?.active_ids || [];
      if (activeIds.length === 0) { setActiveBoxes([]); return; }

      const boxesData = await suiClient.multiGetObjects({ ids: activeIds, options: { showContent: true } });
      const boxes: LootboxData[] = boxesData.map((obj: any) => {
        const fields = obj.data?.content?.fields;
        const extractNfts = (configs: any[]) => configs ? configs.map(c => ({ name: c.fields.name, image: c.fields.base_image_url })) : [];
        const possibleNfts = [
          ...extractNfts(fields.common_configs), ...extractNfts(fields.rare_configs),
          ...extractNfts(fields.super_rare_configs), ...extractNfts(fields.ssr_configs),
          ...extractNfts(fields.ultra_rare_configs), ...extractNfts(fields.legend_rare_configs),
        ];
        return {
          id: obj.data?.objectId, name: fields?.name || "Premium Crate",
          price: fields?.price || "0", gyate_price: fields?.gyate_price || "100",
          description: "Verified on-chain random hero summon.",
          image: "https://images.unsplash.com/photo-1632809199725-72a4245e846b?q=80&w=600",
          pity_enabled: fields?.pity_enabled || false,
          multi_open_enabled: fields?.multi_open_enabled || false,
          multi_open_size: fields?.multi_open_size || "10",
          common_count: fields?.common_configs?.length || 0,
          rare_count: fields?.rare_configs?.length || 0,
          super_rare_count: fields?.super_rare_configs?.length || 0,
          ssr_count: fields?.ssr_configs?.length || 0,
          ultra_rare_count: fields?.ultra_rare_configs?.length || 0,
          legend_rare_count: fields?.legend_rare_configs?.length || 0,
          possibleNfts,
        };
      });
      setActiveBoxes(boxes);
    } catch (err) { console.error("Discovery error:", err); }
    finally { setIsLoading(false); }
  }, [suiClient]);

  useEffect(() => { fetchActiveLootboxes(); }, [fetchActiveLootboxes]);

  const handleSummon = async (box: LootboxData, mode: 'single' | 'multi' | 'pity' = 'single') => {
    if (!account) { toast({ variant: "destructive", title: "Wallet required" }); return; }

    // ── Snapshot the signer address immediately ───────────────────────────────
    // account.address from useCurrentAccount() can change mid-async if the user
    // switches wallets. Capture it once here so every subsequent async call uses
    // the same address that will actually sign the transaction. This prevents
    // object ownership mismatches (e.g. KioskOwnerCap from a different wallet
    // ending up in a tx signed by the current wallet).
    const signerAddress = account.address;

    const totalChars = box.common_count + box.rare_count + box.super_rare_count + box.ssr_count + box.ultra_rare_count + box.legend_rare_count;
    if (totalChars === 0) { toast({ variant: "destructive", title: "Empty Protocol", description: "This lootbox has no character types registered yet." }); return; }
    setIsPending(true);
    try {
      // ── Kiosk ──────────────────────────────────────────────────────────────
      const ownedCaps = await suiClient.getOwnedObjects({
        owner: signerAddress,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });
      if (ownedCaps.data.length === 0) {
        toast({ variant: "destructive", title: "Kiosk Required", description: "You need a Kiosk to receive characters." });
        setIsPending(false); return;
      }
      const kioskCapId = ownedCaps.data[0].data?.objectId;
      if (!kioskCapId) {
        toast({ variant: "destructive", title: "Kiosk Error", description: "Could not read your KioskOwnerCap. Try refreshing." });
        setIsPending(false); return;
      }
      const kioskId = (ownedCaps.data[0].data?.content as any)?.fields?.for;

      // ── PlayerStats (SHARED object — resolve via StatsRegistry) ────────────
      // PlayerStats is NOT owned by the player. It's a shared object registered
      // in StatsRegistry.stats_by_owner (Table<address, ID>). We fetch it via
      // getDynamicFieldObject so we get its on-chain object ID.
      const statsId = await resolveStatsId(suiClient, signerAddress);
      if (!statsId) {
        toast({
          variant: "destructive",
          title: "Profile Setup Required",
          description: "Please initialize your player profile in the Account / Profile section first.",
        });
        setIsPending(false); return;
      }

      // ── Build transaction ──────────────────────────────────────────────────
      const txb = new Transaction();
      let paymentAmount = mode === 'multi'
        ? BigInt(paymentMethod === 'SUI' ? box.price : box.gyate_price) * BigInt(box.multi_open_size)
        : BigInt(paymentMethod === 'SUI' ? box.price : box.gyate_price);

      let targetFunction = "";
      if (paymentMethod === 'SUI') {
        if (mode === 'single') targetFunction = FUNCTIONS.OPEN_LOOTBOX;
        else if (mode === 'multi') targetFunction = FUNCTIONS.MULTI_OPEN_LOOTBOX;
        else if (mode === 'pity') targetFunction = FUNCTIONS.OPEN_LOOTBOX_WITH_PITY;
      } else {
        if (mode === 'single') targetFunction = FUNCTIONS.OPEN_LOOTBOX_WITH_GYATE;
        else if (mode === 'multi') targetFunction = FUNCTIONS.MULTI_OPEN_LOOTBOX_GYATE;
        else if (mode === 'pity') targetFunction = FUNCTIONS.OPEN_LOOTBOX_GYATE_WITH_PITY;
      }

      let paymentCoin;
      if (paymentMethod === 'SUI') {
        const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(paymentAmount)]);
        paymentCoin = coin;
      } else {
        const gyateType = `${PACKAGE_ID}::${MODULE_NAMES.GYATE_COIN}::GYATE_COIN`;
        const coins = await suiClient.getCoins({ owner: signerAddress, coinType: gyateType });
        if (coins.data.length === 0) throw new Error("No $GYATE tokens found in wallet.");
        const [mainCoin, ...otherCoins] = coins.data.map((c: any) => c.coinObjectId);
        if (otherCoins.length > 0) txb.mergeCoins(txb.object(mainCoin), otherCoins.map((c: string) => txb.object(c)));
        const [coin] = txb.splitCoins(txb.object(mainCoin), [txb.pure.u64(paymentAmount)]);
        paymentCoin = coin;
      }

      let progressId: string | null = null;
      if (mode === 'pity') {
        const progressObjects = await suiClient.getOwnedObjects({
          owner: signerAddress,
          filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::UserProgress` },
          options: { showContent: true },
        });
        const progress = progressObjects.data.find((p: any) => p.data?.content?.fields?.lootbox_id === box.id);
        if (!progress) {
          toast({ variant: "destructive", title: "Pity Tracking Disabled", description: "Initialize pity progress for this box in your profile." });
          setIsPending(false); return;
        }
        progressId = progress.data!.objectId;
      }

      const callArgs = [
        txb.object(box.id),
        txb.object(LOOTBOX_REGISTRY),
        paymentMethod === 'SUI' ? txb.object(TREASURY_POOL) : txb.object(GATEKEEPER_CAP),
      ];
      if (mode === 'pity' && progressId) callArgs.push(txb.object(progressId));
      callArgs.push(
        paymentCoin,
        txb.object(statsId),   // shared PlayerStats object — pass by ID directly
        txb.object(RANDOM_STATE),
        txb.object(kioskId),
        txb.object(kioskCapId!),
      );

      txb.moveCall({ target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${targetFunction}`, arguments: callArgs });

      signAndExecute({ transaction: txb }, {
        onSuccess: async (result) => {
          toast({ title: "Transaction Sent", description: "Waiting for blockchain confirmation..." });
          try {
            const resp = await suiClient.waitForTransaction({ digest: result.digest, options: { showEvents: true } });
            const nftMintedEvents = resp.events?.filter((e: any) => e.type.includes("::NFTMintedEvent")) || [];
            if (nftMintedEvents.length === 0) throw new Error("No characters minted in transaction.");
            const nftIds = nftMintedEvents.map((e: any) => e.parsedJson.nft_id);
            const objects = await suiClient.multiGetObjects({ ids: nftIds, options: { showContent: true } });
            const results: NFT[] = objects.map((obj: any) => {
              const fields = obj.data?.content?.fields;
              return {
                id: obj.data?.objectId, name: fields.name, rarity: fields.rarity,
                variantType: fields.variant_type, image: fields.image_url,
                hp: parseInt(fields.hp), atk: parseInt(fields.atk), spd: parseInt(fields.spd),
                baseValue: parseInt(fields.base_value), actualValue: parseInt(fields.actual_value),
                lootboxSource: fields.lootbox_source, globalId: parseInt(fields.global_sequential_id),
              };
            });
            setRevealBox(box); setRevealResults(results); setShowReveal(true); setIsPending(false);
          } catch (err: any) {
            toast({ variant: "destructive", title: "Reveal Error", description: err.message });
            setIsPending(false);
          }
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Summon Failed", description: err.message });
          setIsPending(false);
        },
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Summon Error", description: err.message });
      setIsPending(false);
    }
  };

  return (
    <div className="shop-page">
      <style dangerouslySetInnerHTML={{ __html: SHOP_STYLES }} />
      <Navigation />

      <div className="shop-container">
        <div className="shop-header">
          <div>
            <div className="shop-title">Summoning Altar</div>
            <div className="shop-subtitle">On-chain randomness · Bad-luck protection · $GYATE rewards</div>
          </div>

          <div className="payment-toggle">
            <button
              className={`payment-toggle-btn ${paymentMethod === 'SUI' ? 'active-sui' : ''}`}
              onClick={() => setPaymentMethod('SUI')}
            >
              ◈ SUI Mode
            </button>
            <button
              className={`payment-toggle-btn ${paymentMethod === 'GYATE' ? 'active-gyate' : ''}`}
              onClick={() => setPaymentMethod('GYATE')}
            >
              ✦ GYATE Mode
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="shop-loading">
            <div style={{ fontSize: 56 }}>📦</div>
            <div className="shop-loading-text">Consulting the registry...</div>
          </div>
        ) : activeBoxes.length === 0 ? (
          <div className="shop-empty">
            <div className="shop-empty-icon">🏛️</div>
            <div className="shop-empty-title">Registry Empty</div>
            <div className="shop-empty-desc">No lootboxes are currently active on the protocol. Check back soon!</div>
          </div>
        ) : (
          <div className="lootbox-grid">
            {activeBoxes.map(box => (
              <div key={box.id} style={{ position: "relative" }}>
                <div className="lootbox-card-shadow" />
                <div className="lootbox-card">
                  <LootboxPreviewCarousel nfts={box.possibleNfts} fallbackImage={box.image} />

                  <div className="card-badges">
                    {box.pity_enabled && <span className="card-badge pity">✦ Pity</span>}
                    {box.multi_open_enabled && <span className="card-badge multi">{box.multi_open_size}× Batch</span>}
                  </div>

                  <div className="card-body">
                    <div className="card-name">{box.name}</div>

                    <div className="card-drops">
                      {box.common_count > 0 && <span className="drop-pill common">Common ×{box.common_count}</span>}
                      {box.rare_count > 0 && <span className="drop-pill rare">Rare ×{box.rare_count}</span>}
                      {box.super_rare_count > 0 && <span className="drop-pill super-rare">SR ×{box.super_rare_count}</span>}
                      {box.ssr_count > 0 && <span className="drop-pill ssr">SSR ×{box.ssr_count}</span>}
                      {box.ultra_rare_count > 0 && <span className="drop-pill ultra">UR ×{box.ultra_rare_count}</span>}
                      {box.legend_rare_count > 0 && <span className="drop-pill legend">Legend ×{box.legend_rare_count}</span>}
                    </div>

                    <div className="price-row">
                      <div>
                        <div className="price-label">Price</div>
                        <div style={{ display: "flex", alignItems: "baseline" }}>
                          <span className="price-main" style={{ opacity: paymentMethod === 'GYATE' ? 0.3 : 1 }}>
                            {Number(box.price) / 1_000_000_000}
                          </span>
                          <span className="price-currency" style={{ opacity: paymentMethod === 'GYATE' ? 0.3 : 1 }}>SUI</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="price-label">Alt Price</div>
                        <span className={`price-alt ${paymentMethod === 'GYATE' ? 'active-gyate' : ''}`}>
                          {box.gyate_price} <Coins size={12} />
                        </span>
                      </div>
                    </div>

                    <div className={`action-row ${box.multi_open_enabled ? 'two-col' : ''}`}>
                      <button className="shop-btn primary" disabled={isPending} onClick={() => handleSummon(box, 'single')}>
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : "✦ Single Pull"}
                      </button>
                      {box.multi_open_enabled && (
                        <button className="shop-btn secondary" disabled={isPending} onClick={() => handleSummon(box, 'multi')}>
                          {box.multi_open_size}× Batch
                        </button>
                      )}
                    </div>
                    {box.pity_enabled && (
                      <div style={{ marginTop: 8 }}>
                        <button className="shop-btn pity" style={{ width: "100%" }} disabled={isPending} onClick={() => handleSummon(box, 'pity')}>
                          ⚡ Pity-Guaranteed Summon
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RevealLootboxDialog
        box={revealBox} results={revealResults} open={showReveal}
        onOpenChange={open => { setShowReveal(open); if (!open) { setRevealResults([]); setRevealBox(null); } }}
      />
    </div>
  );
}