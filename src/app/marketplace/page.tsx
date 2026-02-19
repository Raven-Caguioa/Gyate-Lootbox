"use client";

import { Navigation } from "@/navigation";
import { NFTCard } from "@/components/nft-card";
import { Button } from "@/components/ui/button";
import { Search, Filter, CreditCard, RefreshCw, Loader2, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL, TRANSFER_POLICY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@mysten/sui/transactions";

interface MarketplaceListing extends any {
  id: string;
  price: string;
  seller: string;
  kioskId: string;
  nft: any;
}

export default function MarketplacePage() {
  const [selectedNft, setSelectedNft] = useState<any>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      // In a real Sui app without a specialized indexer, we would search for all Kiosks
      // and then search for dynamic fields that are listings. 
      // For this prototype, we'll implement the "Buy" logic and mock a few listings for display
      // that point to real objects if possible, or use the mock data as interactive placeholders.
      
      // Real implementation would look like:
      // const allKiosks = await suiClient.getOwnedObjects({ filter: { StructType: '0x2::kiosk::Kiosk' } });
      // ... iterate and find listings
      
      // Mocking live-ish data for the demo
      setListings([]); 
    } catch (err) {
      console.error("Failed to fetch listings:", err);
    } finally {
      setIsLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleBuyNft = async (listing: MarketplaceListing) => {
    if (!account) {
      toast({ variant: "destructive", title: "Wallet required", description: "Connect your wallet to buy characters." });
      return;
    }

    setIsPending(true);
    try {
      // 1. Find/Create buyer's Kiosk
      const ownedCaps = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `0x2::kiosk::KioskOwnerCap` },
      });

      if (ownedCaps.data.length === 0) {
        toast({ variant: "destructive", title: "Kiosk Required", description: "You need a Kiosk to purchase NFTs." });
        setIsPending(false);
        return;
      }

      const buyerCapId = ownedCaps.data[0].data?.objectId;
      const capObject = await suiClient.getObject({ id: buyerCapId!, options: { showContent: true } });
      const buyerKioskId = (capObject.data?.content as any)?.fields?.for;

      const txb = new Transaction();
      const [paymentCoin] = txb.splitCoins(txb.gas, [BigInt(listing.price)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.BUY_NFT}`,
        arguments: [
          txb.object(listing.kioskId), // seller kiosk
          txb.object(TRANSFER_POLICY), // shared policy
          txb.object(TREASURY_POOL),   // shared pool
          txb.pure.id(listing.id),     // nft id
          paymentCoin,
          txb.object(buyerKioskId),
          txb.object(buyerCapId!),
        ],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Purchase Successful", description: "The character has been moved to your Kiosk." });
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

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
          <div className="flex-1">
            <h1 className="font-headline text-5xl font-bold mb-4">Marketplace</h1>
            <p className="text-muted-foreground text-lg">
              The premier destination for GyateGyate character trading. <span className="text-accent font-bold">10% Platform Fee</span> applies to all sales.
            </p>
          </div>
          
          <div className="flex gap-4 items-center">
            <Button variant="outline" size="icon" onClick={fetchListings} disabled={isLoading}>
              <RefreshCw className={isLoading ? "animate-spin" : ""} />
            </Button>
            <Card className="glass-card border-primary/20 py-2 px-4 flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Global Stats</span>
                <span className="font-bold">Protocol Active</span>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          {/* Filters Sidebar */}
          <aside className="space-y-8 hidden lg:block">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Search className="w-3 h-3" /> Search
              </h3>
              <Input placeholder="Search name or ID..." className="bg-white/5 border-white/10" />
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Filter className="w-3 h-3" /> Rarity
              </h3>
              <div className="grid gap-2">
                {["Common", "Rare", "Super Rare", "SSR", "Ultra Rare", "Legend Rare"].map((rarity) => (
                  <label key={rarity} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                    <div className="w-4 h-4 rounded border border-white/20 group-hover:border-primary transition-colors" />
                    <span className="text-sm font-medium">{rarity}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <CreditCard className="w-3 h-3" /> Price Range
              </h3>
              <div className="flex items-center gap-2">
                <Input placeholder="Min" className="bg-white/5 border-white/10" />
                <span className="text-muted-foreground">to</span>
                <Input placeholder="Max" className="bg-white/5 border-white/10" />
              </div>
            </div>

            <Button className="w-full bg-primary/20 hover:bg-primary/40 border-primary/30 text-primary font-bold">
              Apply Filters
            </Button>
          </aside>

          {/* Listings Grid */}
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex gap-2">
                <Badge className="bg-primary px-3 py-1">Live Listings</Badge>
                <Badge variant="outline" className="border-white/10 px-3 py-1 hover:bg-white/5 cursor-pointer">Lowest Price</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing <span className="text-foreground font-bold">{listings.length}</span> results
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="font-headline uppercase tracking-widest text-muted-foreground">Scanning Kiosks...</p>
              </div>
            ) : listings.length === 0 ? (
              <div className="py-20 text-center glass-card rounded-3xl space-y-4">
                <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto" />
                <h3 className="text-xl font-bold">Marketplace is Quiet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">No items are currently listed. Be the first to list an NFT from your inventory!</p>
                <Button asChild variant="outline" className="border-white/10">
                  <a href="/inventory">Go to Inventory</a>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {listings.map((item) => (
                  <NFTCard 
                    key={item.id} 
                    nft={item.nft} 
                    showPrice={true}
                    onClick={() => setSelectedNft(item.nft)}
                  />
                ))}
              </div>
            )}
          </div>
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
