
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
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL, TRANSFER_POLICY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@mysten/sui/transactions";
import { NFT, RARITY_LABELS } from "@/lib/mock-data";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function MarketplacePage() {
  const [selectedNft, setSelectedNft] = useState<any>(null);
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [listings, setListings] = useState<NFT[]>();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRarities, setSelectedRarities] = useState<number[]>([]);
  const [hpRange, setHpRange] = useState({ min: "0", max: "2500" });
  const [atkRange, setAtkRange] = useState({ min: "0", max: "600" });
  const [spdRange, setSpdRange] = useState({ min: "0", max: "400" });

  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const NFT_TYPE = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listed, purchased, delisted] = await Promise.all([
        suiClient.queryEvents({ query: { MoveEventType: `0x2::kiosk::ItemListed<${NFT_TYPE}>` } }),
        suiClient.queryEvents({ query: { MoveEventType: `0x2::kiosk::ItemPurchased<${NFT_TYPE}>` } }),
        suiClient.queryEvents({ query: { MoveEventType: `0x2::kiosk::ItemDelisted<${NFT_TYPE}>` } }),
      ]);

      const soldIds = new Set(purchased.data.map((e: any) => e.parsedJson.id));
      const delistedIds = new Set(delisted.data.map((e: any) => e.parsedJson.id));
      
      const activeListingsMetadata = listed.data
        .map((e: any) => ({
          id: e.parsedJson.id,
          kioskId: typeof e.parsedJson.kiosk === 'string' ? e.parsedJson.kiosk : e.parsedJson.kiosk?.id || e.parsedJson.kiosk,
          price: e.parsedJson.price, 
        }))
        .filter(l => !soldIds.has(l.id) && !delistedIds.has(l.id));

      if (activeListingsMetadata.length === 0) {
        setListings([]);
        setIsLoading(false);
        return;
      }

      const nftObjects = await suiClient.multiGetObjects({
        ids: activeListingsMetadata.map(l => l.id),
        options: { showContent: true, showOwner: true }
      });

      // Map metadata for easy lookup
      const metaMap = new Map(activeListingsMetadata.map(m => [m.id, m]));

      const mappedListings: NFT[] = nftObjects.map((obj: any) => {
        const fields = obj.data?.content?.fields;
        const owner = obj.data?.owner;
        if (!fields || !owner) return null;
        
        const id = obj.data?.objectId;
        const meta = metaMap.get(id);
        if (!meta) return null;

        // VERIFICATION: Check if the NFT is actually owned by the Kiosk reported in the event.
        // If the NFT was taken out of the kiosk, its owner will no longer be the kiosk ID.
        // Sui Kiosk items are owned by the Kiosk object ID.
        const actualKioskOwner = owner.AddressOwner || owner.ObjectOwner;
        if (actualKioskOwner !== meta.kioskId) {
          return null; // Stale listing, hide it.
        }

        return {
          id: id,
          name: fields.name,
          rarity: fields.rarity,
          variantType: fields.variant_type,
          image: fields.image_url,
          hp: parseInt(fields.hp),
          atk: parseInt(fields.atk),
          spd: parseInt(fields.spd),
          baseValue: parseInt(fields.base_value),
          actualValue: parseInt(fields.actual_value),
          lootboxSource: fields.lootbox_source,
          globalId: parseInt(fields.global_sequential_id),
          price: meta.price ? parseInt(meta.price) / 1_000_000_000 : 1, 
          seller: "On-Chain Listing", 
          kioskId: meta.kioskId,
        };
      }).filter((n): n is NFT => n !== null);

      setListings(mappedListings);
    } catch (err) {
      console.error("Discovery error:", err);
      toast({ variant: "destructive", title: "Discovery Failed", description: "Failed to sync marketplace data." });
    } finally {
      setIsLoading(false);
    }
  }, [suiClient, NFT_TYPE, toast]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleBuyNft = async (item: NFT) => {
    if (!account) {
      toast({ variant: "destructive", title: "Wallet required" });
      return;
    }

    setIsPending(true);
    try {
      const ownedCaps = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `0x2::kiosk::KioskOwnerCap` },
      });

      if (ownedCaps.data.length === 0) {
        toast({ variant: "destructive", title: "Kiosk Required", description: "You need a Kiosk to purchase items." });
        setIsPending(false);
        return;
      }

      const buyerCapId = ownedCaps.data[0].data?.objectId;
      const capObject = await suiClient.getObject({ id: buyerCapId!, options: { showContent: true } });
      const buyerKioskId = (capObject.data?.content as any)?.fields?.for;

      if (!buyerKioskId || !item.kioskId) {
        throw new Error("Missing Kiosk identification for trade.");
      }

      const txb = new Transaction();
      const amountMist = BigInt(Math.floor((item.price || 1) * 1_000_000_000));
      const [paymentCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(amountMist)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.BUY_NFT}`,
        arguments: [
          txb.object(item.kioskId),
          txb.object(TRANSFER_POLICY),
          txb.object(TREASURY_POOL),
          txb.pure.address(item.id),
          paymentCoin,
          txb.object(buyerKioskId),
          txb.object(buyerCapId!),
        ],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Purchase Successful", description: `${item.name} acquired.` });
          setIsPending(false);
          setTimeout(fetchListings, 3000); // Wait for indexing
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Purchase Failed", description: err.message });
          setIsPending(false);
        }
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
      setIsPending(false);
    }
  };

  const filteredListings = useMemo(() => {
    if (!listings) return [];
    const minHp = parseInt(hpRange.min) || 0;
    const maxHp = parseInt(hpRange.max) || 999999;
    const minAtk = parseInt(atkRange.min) || 0;
    const maxAtk = parseInt(atkRange.max) || 999999;
    const minSpd = parseInt(spdRange.min) || 0;
    const maxSpd = parseInt(spdRange.max) || 999999;

    return listings.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.id.includes(searchTerm);
      const matchesRarity = selectedRarities.length === 0 || selectedRarities.includes(l.rarity);
      const matchesHp = l.hp >= minHp && l.hp <= maxHp;
      const matchesAtk = l.atk >= minAtk && l.atk <= maxAtk;
      const matchesSpd = l.spd >= minSpd && l.spd <= maxSpd;
      
      return matchesSearch && matchesRarity && matchesHp && matchesAtk && matchesSpd;
    });
  }, [listings, searchTerm, selectedRarities, hpRange, atkRange, spdRange]);

  const toggleRarity = (rarity: number) => {
    setSelectedRarities(prev => 
      prev.includes(rarity) ? prev.filter(r => r !== rarity) : [...prev, rarity]
    );
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedRarities([]);
    setHpRange({ min: "0", max: "2500" });
    setAtkRange({ min: "0", max: "600" });
    setSpdRange({ min: "0", max: "400" });
  };

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
          <div className="flex-1">
            <h1 className="font-headline text-5xl font-bold mb-4">Marketplace</h1>
            <p className="text-muted-foreground text-lg">
              Fully verified on-chain listings. Search by rarity and combat stats.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={fetchListings} disabled={isLoading} className="bg-white/5 border-white/10 h-11 px-6">
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-12">
          <aside className="space-y-6">
            <Card className="glass-card border-primary/20 sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-widest flex items-center justify-between">
                  <span className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-accent" /> Filters</span>
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-[10px] font-bold text-muted-foreground">RESET</Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Search</Label>
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

                <div className="space-y-4">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Rarity</Label>
                  <div className="grid gap-3">
                    {[0, 1, 2, 3, 4, 5].map((r) => (
                      <div key={r} className="flex items-center space-x-3 group cursor-pointer" onClick={() => toggleRarity(r)}>
                        <Checkbox 
                          checked={selectedRarities.includes(r)}
                          onCheckedChange={() => toggleRarity(r)}
                          className="border-white/20 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                        />
                        <span className={cn(
                          "text-xs font-medium transition-colors",
                          selectedRarities.includes(r) ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {RARITY_LABELS[r as keyof typeof RARITY_LABELS]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-white/5" />

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">HP (Min/Max)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={hpRange.min}
                        onChange={(e) => setHpRange({ ...hpRange, min: e.target.value })}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={hpRange.max}
                        onChange={(e) => setHpRange({ ...hpRange, max: e.target.value })}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ATK (Min/Max)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={atkRange.min}
                        onChange={(e) => setAtkRange({ ...atkRange, min: e.target.value })}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={atkRange.max}
                        onChange={(e) => setAtkRange({ ...atkRange, max: e.target.value })}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">SPD (Min/Max)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={spdRange.min}
                        onChange={(e) => setSpdRange({ ...spdRange, min: e.target.value })}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={spdRange.max}
                        onChange={(e) => setSpdRange({ ...spdRange, max: e.target.value })}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 rounded-xl border border-white/5 bg-accent/5">
              <div className="flex gap-3 items-start">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Marketplace data is verified in real-time. Stale listings are hidden automatically.
                </p>
              </div>
            </div>
          </aside>

          <main>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="font-headline tracking-widest text-muted-foreground uppercase text-xs">Syncing Registry...</p>
              </div>
            ) : filteredListings.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredListings.map((item) => (
                  <div key={item.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <NFTCard nft={item} onClick={() => setSelectedNft(item)} showPrice />
                    <Button className="w-full h-12 glow-purple font-bold" onClick={() => handleBuyNft(item)} disabled={isPending}>
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Buy Character
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 glass-card rounded-3xl space-y-6 text-center px-12">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                  <PackageSearch className="w-10 h-10 text-muted-foreground opacity-30" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">No Heroes Found</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Try adjusting your filters. Some listings might be hidden if they were recently moved or sold.
                  </p>
                  <Button variant="link" onClick={resetFilters} className="text-accent font-bold mt-4">Clear Filters</Button>
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
