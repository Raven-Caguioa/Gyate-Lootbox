
"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Button } from "@/components/ui/button";
import { Search, Filter, CreditCard, RefreshCw, Loader2, ShoppingCart, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useMemo } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL, TRANSFER_POLICY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@mysten/sui/transactions";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, deleteDoc } from "firebase/firestore";
import { NFT } from "@/lib/mock-data";

export default function MarketplacePage() {
  const [selectedNft, setSelectedNft] = useState<any>(null);
  const [isPending, setIsPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const db = useFirestore();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  // Firestore query for listed items
  const listingsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "nfts"), where("isListed", "==", true));
  }, [db]);

  const { data: listings, isLoading } = useCollection<any>(listingsQuery);

  const filteredListings = useMemo(() => {
    if (!listings) return [];
    return listings.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [listings, searchQuery]);

  const handleBuyNft = async (listing: any) => {
    if (!account) {
      toast({ variant: "destructive", title: "Wallet required", description: "Connect your wallet to buy characters." });
      return;
    }

    setIsPending(true);
    try {
      // 1. Find buyer's Kiosk
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
      const [paymentCoin] = txb.splitCoins(txb.gas, [BigInt(listing.price * 1_000_000_000)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.BUY_NFT}`,
        arguments: [
          txb.object(listing.kioskId),
          txb.object(TRANSFER_POLICY),
          txb.object(TREASURY_POOL),
          txb.pure.id(listing.id),
          paymentCoin,
          txb.object(buyerKioskId),
          txb.object(buyerCapId!),
        ],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Purchase Successful", description: "The character has been moved to your Kiosk." });
          // Remove from Firestore index
          if (db) {
            deleteDoc(doc(db, "nfts", listing.id));
          }
          setIsPending(false);
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
              Live listings from the GyateGyate network. <span className="text-accent font-bold">10% Protocol Fee</span> supports the ecosystem.
            </p>
          </div>
          
          <div className="flex gap-4 items-center">
            <Card className="glass-card border-primary/20 py-2 px-4 flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Active Listings</span>
                <span className="font-bold">{listings?.length || 0} Found</span>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          <aside className="space-y-8 hidden lg:block">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Search className="w-3 h-3" /> Search
              </h3>
              <Input 
                placeholder="Search name or ID..." 
                className="bg-white/5 border-white/10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-accent/5">
              <div className="flex gap-3 items-start">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Items listed here are held in individual user Kiosks. The Marketplace Indexer tracks these listings in real-time.
                </p>
              </div>
            </div>
          </aside>

          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex gap-2">
                <Badge className="bg-primary px-3 py-1">All Listings</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing <span className="text-foreground font-bold">{filteredListings.length}</span> results
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="font-headline uppercase tracking-widest text-muted-foreground">Syncing Marketplace...</p>
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="py-20 text-center glass-card rounded-3xl space-y-4">
                <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto" />
                <h3 className="text-xl font-bold">Marketplace is Quiet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">No items are currently listed. Head to your inventory to list your first hero!</p>
                <Button asChild variant="outline" className="border-white/10">
                  <a href="/inventory">Go to Inventory</a>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredListings.map((item) => (
                  <div key={item.id} className="relative group">
                    <NFTCard 
                      nft={{
                        id: item.id,
                        name: item.name,
                        rarity: item.rarity,
                        variantType: item.variantType,
                        image: item.imageUrl,
                        hp: item.hp,
                        atk: item.atk,
                        spd: item.spd,
                        globalId: item.globalSequentialId,
                        price: item.price
                      }} 
                      showPrice={true}
                      onClick={() => setSelectedNft(item)}
                    />
                    <div className="absolute inset-x-4 bottom-24 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        className="w-full h-10 font-bold bg-accent glow-violet"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyNft(item);
                        }}
                        disabled={isPending}
                      >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Quick Buy"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <NFTDetailDialog 
        nft={selectedNft ? {
          id: selectedNft.id,
          name: selectedNft.name,
          rarity: selectedNft.rarity,
          variantType: selectedNft.variantType,
          image: selectedNft.imageUrl,
          hp: selectedNft.hp,
          atk: selectedNft.atk,
          spd: selectedNft.spd,
          baseValue: selectedNft.baseValue,
          actualValue: selectedNft.actualValue,
          lootboxSource: selectedNft.lootboxSource,
          globalId: selectedNft.globalSequentialId
        } : null} 
        open={!!selectedNft} 
        onOpenChange={(open) => !open && setSelectedNft(null)} 
      />
    </div>
  );
}
