
"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Info, ShoppingCart, Loader2, PackageSearch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@mysten/sui/transactions";
import { NFT } from "@/lib/mock-data";

export default function MarketplacePage() {
  const [selectedNft, setSelectedNft] = useState<any>(null);
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [listings, setListings] = useState<NFT[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const ADMIN_ADDRESS = "0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a";
  const NFT_TYPE = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Query all ItemListed events for our NFT type
      const listedEvents = await suiClient.queryEvents({
        query: { MoveEventType: `0x2::kiosk::ItemListed<${NFT_TYPE}>` },
      });

      // 2. Query all Purchased events
      const purchasedEvents = await suiClient.queryEvents({
        query: { MoveEventType: `0x2::kiosk::ItemPurchased<${NFT_TYPE}>` },
      });

      // 3. Query all Delisted events
      const delistedEvents = await suiClient.queryEvents({
        query: { MoveEventType: `0x2::kiosk::ItemDelisted<${NFT_TYPE}>` },
      });

      // 4. Reconcile events to find active listings
      const soldIds = new Set(purchasedEvents.data.map((e: any) => e.parsedJson.id));
      const delistedIds = new Set(delistedEvents.data.map((e: any) => e.parsedJson.id));
      
      const activeListingsMetadata = listedEvents.data
        .map((e: any) => ({
          id: e.parsedJson.id,
          kioskId: e.parsedJson.kiosk,
          price: e.parsedJson.price, // Note: standard kiosk event might not have price, checking kiosk later
        }))
        .filter(l => !soldIds.has(l.id) && !delistedIds.has(l.id));

      if (activeListingsMetadata.length === 0) {
        setListings([]);
        setIsLoading(false);
        return;
      }

      // 5. Fetch full NFT data for active listings
      const nftObjects = await suiClient.multiGetObjects({
        ids: activeListingsMetadata.map(l => l.id),
        options: { showContent: true }
      });

      // 6. Map to UI model
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
          price: meta.price ? parseInt(meta.price) / 1_000_000_000 : 1, // Fallback if price missing in event
          seller: "On-Chain Listing", // Real seller is in the kiosk owner field
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
      // 1. Find buyer's kiosk
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

      // 2. Discover TransferPolicy
      const policyResponse = await suiClient.getOwnedObjects({
        owner: ADMIN_ADDRESS,
        filter: { StructType: `0x2::transfer_policy::TransferPolicy<${NFT_TYPE}>` }
      });

      const transferPolicyId = policyResponse.data[0]?.data?.objectId;

      if (!transferPolicyId) {
        toast({ variant: "destructive", title: "Policy Error", description: "No active TransferPolicy found." });
        setIsPending(false);
        return;
      }

      // 3. Build Transaction
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

  const filteredListings = listings.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.id.includes(searchTerm)
  );

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
          <div className="flex-1">
            <h1 className="font-headline text-5xl font-bold mb-4">Marketplace</h1>
            <p className="text-muted-foreground text-lg">
              Pure on-chain event discovery. Verified by Sui RPC.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={fetchListings} disabled={isLoading} className="bg-white/5 border-white/10">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading && 'animate-spin'}`} />
              Refresh Events
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-12">
          <aside className="space-y-6">
            <Card className="glass-card border-primary/20">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Search className="w-4 h-4 text-accent" /> Filter Listings
                  </h3>
                </div>
                <Input 
                  placeholder="Filter by name or ID..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </CardContent>
            </Card>

            <div className="p-4 rounded-xl border border-white/5 bg-accent/5">
              <div className="flex gap-3 items-start">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Discovery works by scanning Move events. It may take a few seconds for new listings to propagate through the RPC nodes.
                </p>
              </div>
            </div>
          </aside>

          <main>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="font-headline tracking-widest text-muted-foreground uppercase text-xs">Querying Blockchain Events...</p>
              </div>
            ) : filteredListings.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredListings.map((item) => (
                  <div key={item.id} className="space-y-4">
                    <NFTCard nft={item} onClick={() => setSelectedNft(item)} showPrice />
                    <Button className="w-full h-12 glow-purple font-bold" onClick={() => handleBuyNft(item)} disabled={isPending}>
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Buy Now
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 glass-card rounded-3xl space-y-6 text-center px-12">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                  <PackageSearch className="w-10 h-10 text-muted-foreground opacity-50" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">No Active Listings</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Be the first to list a hero! Go to your inventory to put your characters on the market.
                  </p>
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
