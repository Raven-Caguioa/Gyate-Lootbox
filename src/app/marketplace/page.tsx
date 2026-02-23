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
import {
  PACKAGE_ID,
  MODULE_NAMES,
  FUNCTIONS,
  TREASURY_POOL,
  TRANSFER_POLICY,
  KIOSK_REGISTRY,
} from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@mysten/sui/transactions";
import { NFT, RARITY_LABELS } from "@/lib/mock-data";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeSuiId(id: string | any): string {
  if (!id) return "";
  const str =
    typeof id === "string"
      ? id
      : id?.id || id?.objectId || JSON.stringify(id);
  return str.toLowerCase().replace(/^(0x)?/, "0x");
}

/** Convert MIST (bigint/string) to SUI for display only */
function mistToSui(mist: string | number | bigint): number {
  return Number(BigInt(mist.toString())) / 1_000_000_000;
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** Internal listing type — price always stored as MIST string to avoid float loss */
interface ActiveListing {
  nftId: string;
  kioskId: string;
  priceMist: string; // raw MIST — never convert to float until display
}

// ─── Component ───────────────────────────────────────────────────────────────

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
      // Step 1 — collect ItemListed / ItemPurchased / ItemDelisted events
      const [listedRes, purchasedRes, delistedRes] = await Promise.all([
        suiClient.queryEvents({
          query: { MoveEventType: `0x2::kiosk::ItemListed<${NFT_TYPE}>` },
          limit: 100,
          order: "descending",
        }),
        suiClient.queryEvents({
          query: { MoveEventType: `0x2::kiosk::ItemPurchased<${NFT_TYPE}>` },
          limit: 100,
          order: "descending",
        }),
        suiClient.queryEvents({
          query: { MoveEventType: `0x2::kiosk::ItemDelisted<${NFT_TYPE}>` },
          limit: 100,
          order: "descending",
        }),
      ]);

      // Build sets of closed NFT IDs
      const soldIds = new Set(
        purchasedRes.data.map((e: any) => normalizeSuiId(e.parsedJson?.id))
      );
      const delistedIds = new Set(
        delistedRes.data.map((e: any) => normalizeSuiId(e.parsedJson?.id))
      );

      // Step 2 — filter to genuinely active listings
      // Deduplicate by NFT ID keeping the most recent listing event
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

      if (activeListings.length === 0) {
        setListings([]);
        return;
      }

      // Step 3 — verify each NFT is still inside its kiosk using getDynamicFieldObject
      // Kiosk stores items as dynamic fields keyed by their ID
      const verifiedListings: NFT[] = [];

      await Promise.all(
        activeListings.map(async (listing) => {
          try {
            // Query the kiosk dynamic field — this is the canonical way to read
            // a kiosk item's data. Falls through if item was removed outside the listing.
            const dynField = await suiClient.getDynamicFieldObject({
              parentId: listing.kioskId,
              name: {
                type: "0x2::kiosk::Item",
                value: { id: listing.nftId },
              },
            });

            if (!dynField?.data?.content) return;

            // Also check the kiosk listing table to confirm it's still listed
            const listedField = await suiClient.getDynamicFieldObject({
              parentId: listing.kioskId,
              name: {
                type: "0x2::kiosk::Listing",
                value: { id: listing.nftId, is_exclusive: false },
              },
            }).catch(() => null);

            // If the listing field doesn't exist the item was delisted
            if (!listedField?.data) return;

            // Step 4 — fetch full NFT object content
            const nftObj = await suiClient.getObject({
              id: listing.nftId,
              options: { showContent: true },
            });

            const fields = (nftObj.data?.content as any)?.fields;
            if (!fields) return;

            verifiedListings.push({
              id: listing.nftId,
              name: fields.name ?? "Unknown",
              rarity: Number(fields.rarity ?? 0),
              variantType: fields.variant_type ?? "Normal",
              image: fields.image_url ?? "",
              hp: Number(fields.hp ?? 0),
              atk: Number(fields.atk ?? 0),
              spd: Number(fields.spd ?? 0),
              baseValue: Number(fields.base_value ?? 0),
              actualValue: Number(fields.actual_value ?? 0),
              lootboxSource: fields.lootbox_source ?? "",
              globalId: Number(fields.global_sequential_id ?? 0),
              // Store display price as SUI float — actual purchase uses priceMist
              price: mistToSui(listing.priceMist),
              // Stash MIST price for buy transaction (avoid float round-trip)
              priceMist: listing.priceMist,
              seller: "On-Chain Listing",
              kioskId: listing.kioskId,
            } as NFT & { priceMist: string });
          } catch {
            // If any fetch fails, skip this listing silently
          }
        })
      );

      setListings(verifiedListings);
    } catch (err) {
      console.error("Marketplace fetch error:", err);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: "Could not load marketplace listings.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [suiClient, NFT_TYPE, toast]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // ── Buy handler ─────────────────────────────────────────────────────────────
  const handleBuyNft = async (item: NFT & { priceMist?: string }) => {
    if (!account) {
      toast({ variant: "destructive", title: "Connect your wallet first" });
      return;
    }
    if (!item.kioskId) {
      toast({ variant: "destructive", title: "Missing kiosk data for this listing" });
      return;
    }

    setIsPending(true);
    try {
      // Step 1 — find buyer's KioskOwnerCap
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });

      if (capsRes.data.length === 0) {
        toast({
          variant: "destructive",
          title: "No Kiosk Found",
          description: "You need a Kiosk to buy. Create one in your inventory first.",
        });
        setIsPending(false);
        return;
      }

      const buyerCapId = capsRes.data[0].data?.objectId!;
      const buyerKioskId = (capsRes.data[0].data?.content as any)?.fields?.for;

      if (!buyerKioskId) {
        throw new Error("Could not determine your Kiosk ID from cap.");
      }

      // Step 2 — calculate total payment: listed_price + 10% fee
      // Contract splits fee out first, remainder = exact listed_price for kiosk::purchase
      // Buyer pays: listed_price * 1.1 (e.g. 0.11 SUI for a 0.1 SUI listing)
      const listedPriceMist: bigint = item.priceMist
        ? BigInt(item.priceMist)
        : BigInt(Math.round((item.price ?? 0) * 1_000_000_000));
      const feeMist = (listedPriceMist * 1000n) / 10000n;
      const totalPaymentMist = listedPriceMist + feeMist;

      // Step 3 — build the transaction
      const txb = new Transaction();

      // Split total payment (listed price + fee) from gas coin
      const [paymentCoin] = txb.splitCoins(txb.gas, [
        txb.pure.u64(totalPaymentMist),
      ]);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.BUY_NFT}`,
        arguments: [
          txb.object(normalizeSuiId(item.kioskId)),   // seller_kiosk
          txb.object(TRANSFER_POLICY),                 // policy
          txb.object(TREASURY_POOL),                   // pool
          txb.pure.id(normalizeSuiId(item.id)),        // nft_id — must be ID type not address
          paymentCoin,                                  // payment coin
          txb.object(normalizeSuiId(buyerKioskId)),   // buyer_kiosk
          txb.object(normalizeSuiId(buyerCapId)),     // buyer_cap
        ],
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: (result) => {
            toast({
              title: "Purchase Successful! 🎉",
              description: `${item.name} is now in your Kiosk.`,
            });
            setIsPending(false);
            setSelectedNft(null);
            // Refresh after a short delay to let indexer catch up
            setTimeout(fetchListings, 3000);
          },
          onError: (err) => {
            console.error("Buy error:", err);
            toast({
              variant: "destructive",
              title: "Purchase Failed",
              description: err.message ?? "Transaction rejected.",
            });
            setIsPending(false);
          },
        }
      );
    } catch (err: any) {
      console.error("Buy setup error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message ?? "Something went wrong.",
      });
      setIsPending(false);
    }
  };

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filteredListings = useMemo(() => {
    const minHp = parseInt(hpRange.min) || 0;
    const maxHp = parseInt(hpRange.max) || 999999;
    const minAtk = parseInt(atkRange.min) || 0;
    const maxAtk = parseInt(atkRange.max) || 999999;
    const minSpd = parseInt(spdRange.min) || 0;
    const maxSpd = parseInt(spdRange.max) || 999999;

    return listings.filter((l) => {
      const matchesSearch =
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.id.includes(searchTerm);
      const matchesRarity =
        selectedRarities.length === 0 || selectedRarities.includes(l.rarity);
      const matchesHp = l.hp >= minHp && l.hp <= maxHp;
      const matchesAtk = l.atk >= minAtk && l.atk <= maxAtk;
      const matchesSpd = l.spd >= minSpd && l.spd <= maxSpd;

      return matchesSearch && matchesRarity && matchesHp && matchesAtk && matchesSpd;
    });
  }, [listings, searchTerm, selectedRarities, hpRange, atkRange, spdRange]);

  const toggleRarity = (rarity: number) => {
    setSelectedRarities((prev) =>
      prev.includes(rarity) ? prev.filter((r) => r !== rarity) : [...prev, rarity]
    );
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedRarities([]);
    setHpRange({ min: "0", max: "9999" });
    setAtkRange({ min: "0", max: "9999" });
    setSpdRange({ min: "0", max: "9999" });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
          <div className="flex-1">
            <h1 className="font-headline text-5xl font-bold mb-4">Marketplace</h1>
            <p className="text-muted-foreground text-lg">
              Fully verified on-chain listings. Search by rarity and combat stats.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={fetchListings}
              disabled={isLoading}
              className="bg-white/5 border-white/10 h-11 px-6"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-12">
          {/* Sidebar filters */}
          <aside className="space-y-6">
            <Card className="glass-card border-primary/20 sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-widest flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-accent" /> Filters
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-7 text-[10px] font-bold text-muted-foreground"
                  >
                    RESET
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Search */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Search
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Name or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-white/5 border-white/10 pl-9 text-xs"
                    />
                  </div>
                </div>

                <Separator className="bg-white/5" />

                {/* Rarity */}
                <div className="space-y-4">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Rarity
                  </Label>
                  <div className="grid gap-3">
                    {([0, 1, 2, 3, 4, 5] as const).map((r) => (
                      <div
                        key={r}
                        className="flex items-center space-x-3 group cursor-pointer"
                        onClick={() => toggleRarity(r)}
                      >
                        <Checkbox
                          checked={selectedRarities.includes(r)}
                          onCheckedChange={() => toggleRarity(r)}
                          className="border-white/20 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                        />
                        <span
                          className={cn(
                            "text-xs font-medium transition-colors",
                            selectedRarities.includes(r)
                              ? "text-foreground"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                        >
                          {RARITY_LABELS[r]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-white/5" />

                {/* Stat ranges */}
                <div className="space-y-6">
                  {(
                    [
                      { label: "HP", range: hpRange, setRange: setHpRange },
                      { label: "ATK", range: atkRange, setRange: setAtkRange },
                      { label: "SPD", range: spdRange, setRange: setSpdRange },
                    ] as const
                  ).map(({ label, range, setRange }) => (
                    <div key={label} className="space-y-3">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        {label} (Min / Max)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={range.min}
                          onChange={(e) =>
                            setRange((prev: any) => ({ ...prev, min: e.target.value }))
                          }
                          className="bg-white/5 border-white/10 text-xs h-8"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={range.max}
                          onChange={(e) =>
                            setRange((prev: any) => ({ ...prev, max: e.target.value }))
                          }
                          className="bg-white/5 border-white/10 text-xs h-8"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="p-4 rounded-xl border border-white/5 bg-accent/5">
              <div className="flex gap-3 items-start">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Listings are verified in real-time via on-chain kiosk state. Stale or
                  delisted items are hidden automatically.
                </p>
              </div>
            </div>
          </aside>

          {/* Main grid */}
          <main>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="font-headline tracking-widest text-muted-foreground uppercase text-xs">
                  Syncing Registry...
                </p>
              </div>
            ) : filteredListings.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground mb-6 uppercase tracking-widest">
                  {filteredListings.length} listing{filteredListings.length !== 1 ? "s" : ""} found
                </p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredListings.map((item) => (
                    <div
                      key={item.id}
                      className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      <NFTCard
                        nft={item}
                        onClick={() => setSelectedNft(item)}
                        showPrice
                      />
                      <Button
                        className="w-full h-12 glow-purple font-bold"
                        onClick={() => handleBuyNft(item as any)}
                        disabled={isPending || item.kioskId === account?.address}
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        {item.kioskId === account?.address
                          ? "Your Listing"
                          : "Buy Now"}
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 glass-card rounded-3xl space-y-6 text-center px-12">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                  <PackageSearch className="w-10 h-10 text-muted-foreground opacity-30" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">No Heroes Found</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Try adjusting your filters, or check back soon for new listings.
                  </p>
                  <Button
                    variant="link"
                    onClick={resetFilters}
                    className="text-accent font-bold mt-4"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <NFTDetailDialog
        nft={selectedNft}
        open={!!selectedNft}
        onOpenChange={(open) => !open && setSelectedNft(null)}
      />
    </div>
  );
}
