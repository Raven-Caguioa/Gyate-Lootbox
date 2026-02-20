
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
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL } from "@/lib/sui-constants";
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
  const [listings, setListings] = useState<NFT[]>([]);
  
  // Filtering State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRarities, setSelectedRarities] = useState<number[]>([]);
  const [hpRange, setHpRange] = useState([0, 2500]);
  const [atkRange, setAtkRange] = useState([0, 600]);
  const [spdRange, setSpdRange] = useState([0, 400]);

  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const ADMIN_ADDRESS = "0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a";
  const NFT_TYPE = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const listedEvents = await suiClient.queryEvents({
        query: { MoveEventType: `0x2::kiosk::ItemListed<${NFT_TYPE}>` },
      });

      const purchasedEvents = await suiClient.queryEvents({
        query: { MoveEventType: `0x2::kiosk::ItemPurchased<${NFT_TYPE}>` },
      });

      const delistedEvents = await suiClient.queryEvents({
        query: { MoveEventType: `0x2::kiosk::ItemDelisted<${NFT_TYPE}>` },
      });

      const soldIds = new Set(purchasedEvents.data.map((e: any) => e.parsedJson.id));
      const delistedIds = new Set(delistedEvents.data.map((e: any) => e.parsedJson.id));
      
      const activeListingsMetadata = listedEvents.data
        .map((e: any) => ({
          id: e.parsedJson.id,
          kioskId: e.parsedJson.kiosk,
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
        options: { showContent: true }
      });

      const mappedListings: NFT[] = nftObjects.map((obj: any, idx) => {
        const fields = obj.data?.content?.fields;
        if (!fields) return null;
        
        const meta = activeListingsMetadata[idx];

        return {
          id: obj.data?.objectId,
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
      toast({ variant: "destructive", title: "Discovery Failed", description: "Could not query Sui events." });
    } finally {
      setIsLoading(false);
    }
  }, [suiClient, NFT_TYPE, toast]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleBuyNft = async (item: NFT) => {
    if (!account) {
      toast({ variant: "destructive", title: "Wallet required", description: "Connect to buy characters." });
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

      // Switch to queryObjects to find shared TransferPolicies
      const policyResponse = await suiClient.queryObjects({
        filter: { StructType: `0x2::transfer_policy::TransferPolicy<${NFT_TYPE}>` }
      });

      const transferPolicyId = policyResponse.data[0]?.data?.objectId;

      if (!transferPolicyId) {
        toast({ variant: "destructive", title: "Policy Error", description: "No active TransferPolicy found on the network for this character type." });
        setIsPending(false);
        return;
      }

      const txb = new Transaction();
      const [paymentCoin] = txb.splitCoins(txb.gas, [BigInt((item.price || 1) * 1_000_000_000)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.BUY_NFT}`,
        arguments: [
          txb.object(item.kioskId!),
          txb.object(transferPolicyId),
          txb.object(TREASURY_POOL),
          txb.pure.id(item.id),
          paymentCoin,
          txb.object(buyerKioskId),
          txb.object(buyerCapId!),
        ],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Purchase Successful", description: `${item.name} is now yours!` });
          setIsPending(false);
          fetchListings();
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
    return listings.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.id.includes(searchTerm);
      const matchesRarity = selectedRarities.length === 0 || selectedRarities.includes(l.rarity);
      const matchesHp = l.hp >= hpRange[0] && l.hp <= hpRange[1];
      const matchesAtk = l.atk >= atkRange[0] && l.atk <= atkRange[1];
      const matchesSpd = l.spd >= spdRange[0] && l.spd <= spdRange[1];
      
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
    setHpRange([0, 2500]);
    setAtkRange([0, 600]);
    setSpdRange([0, 400]);
  };

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
          <div className="flex-1">
            <h1 className="font-headline text-5xl font-bold mb-4">Marketplace</h1>
            <p className="text-muted-foreground text-lg">
              Pure on-chain event discovery. Filter by rarity and specialized combat stats.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={fetchListings} disabled={isLoading} className="bg-white/5 border-white/10 h-11 px-6">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading && 'animate-spin'}`} />
              Refresh Data
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-12">
          <aside className="space-y-6">
            <Card className="glass-card border-primary/20 sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-widest flex items-center justify-between">
                  <span className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-accent" /> Filter Station</span>
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-[10px] font-bold text-muted-foreground hover:text-accent">RESET</Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Search */}
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

                {/* Rarity Checkboxes */}
                <div className="space-y-4">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Rarity Tier</Label>
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

                {/* Stat Inputs */}
                <div className="space-y-6">
                  {/* HP Range */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">HP Range</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={hpRange[0]}
                        onChange={(e) => setHpRange([parseInt(e.target.value) || 0, hpRange[1]])}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={hpRange[1]}
                        onChange={(e) => setHpRange([hpRange[0], parseInt(e.target.value) || 0])}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                    </div>
                  </div>

                  {/* ATK Range */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ATK Range</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={atkRange[0]}
                        onChange={(e) => setAtkRange([parseInt(e.target.value) || 0, atkRange[1]])}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={atkRange[1]}
                        onChange={(e) => setAtkRange([atkRange[0], parseInt(e.target.value) || 0])}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                    </div>
                  </div>

                  {/* SPD Range */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">SPD Range</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={spdRange[0]}
                        onChange={(e) => setSpdRange([parseInt(e.target.value) || 0, spdRange[1]])}
                        className="bg-white/5 border-white/10 text-xs h-8"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={spdRange[1]}
                        onChange={(e) => setSpdRange([spdRange[0], parseInt(e.target.value) || 0])}
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
                  Refining filters helps you find specific stat spreads for competitive play.
                </p>
              </div>
            </div>
          </aside>

          <main>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="font-headline tracking-widest text-muted-foreground uppercase text-xs">Accessing Blockchain Registry...</p>
              </div>
            ) : filteredListings.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredListings.map((item) => (
                  <div key={item.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <NFTCard nft={item} onClick={() => setSelectedNft(item)} showPrice />
                    <Button className="w-full h-12 glow-purple font-bold" onClick={() => handleBuyNft(item)} disabled={isPending}>
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Acquire Character
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
                  <h3 className="text-2xl font-bold">No Matches Found</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Try adjusting your stat ranges or selecting different rarity tiers to broaden your search.
                  </p>
                  <Button variant="link" onClick={resetFilters} className="text-accent font-bold mt-4">Clear All Filters</Button>
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
