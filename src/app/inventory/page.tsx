"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Button } from "@/components/ui/button";
import { Search, Filter, LayoutGrid, List, RefreshCw, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useCallback } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES } from "@/lib/sui-constants";
import { NFT } from "@/lib/mock-data";

export default function InventoryPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [userNfts, setUserNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUserNfts = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      // 1. Find user's KioskOwnerCap
      const ownedCaps = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `0x2::kiosk::KioskOwnerCap` },
      });

      if (ownedCaps.data.length === 0) {
        setUserNfts([]);
        setIsLoading(false);
        return;
      }

      const kioskCapId = ownedCaps.data[0].data?.objectId;
      const capObject = await suiClient.getObject({ id: kioskCapId!, options: { showContent: true } });
      const kioskId = (capObject.data?.content as any)?.fields?.for;

      // 2. Query dynamic fields of the Kiosk to find GyateNFTs
      const fields = await suiClient.getDynamicFields({
        parentId: kioskId,
      });

      // Filter for fields that might be our NFTs
      // In Kiosk, items are typically stored with the item ID as the name
      const nftIds = fields.data.map(f => f.objectId);
      
      if (nftIds.length === 0) {
        setUserNfts([]);
        setIsLoading(false);
        return;
      }

      // Fetch the actual objects to check types
      const nftObjects = await suiClient.multiGetObjects({
        ids: nftIds,
        options: { showContent: true }
      });

      const nftType = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      
      const mappedNfts: NFT[] = nftObjects
        .filter((obj: any) => obj.data?.content?.type === nftType)
        .map((obj: any) => {
          const fields = obj.data?.content?.fields;
          return {
            id: obj.data?.objectId,
            name: fields.name,
            rarity: fields.rarity,
            variantType: fields.variant_type,
            image: fields.image_url || "https://images.unsplash.com/photo-1743355694962-40376ef681da?q=80&w=400",
            hp: parseInt(fields.hp),
            atk: parseInt(fields.atk),
            spd: parseInt(fields.spd),
            baseValue: parseInt(fields.base_value),
            actualValue: parseInt(fields.actual_value),
            lootboxSource: fields.lootbox_source,
            globalId: parseInt(fields.global_sequential_id),
          };
        });

      setUserNfts(mappedNfts);
    } catch (err) {
      console.error("Failed to fetch user NFTs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [account, suiClient]);

  useEffect(() => {
    fetchUserNfts();
  }, [fetchUserNfts]);

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="font-headline text-4xl font-bold mb-2">Inventory</h1>
            <p className="text-muted-foreground">Manage your GyateGyate collection and prepare for battle.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button variant="outline" size="icon" onClick={fetchUserNfts} className="border-white/10">
              <RefreshCw className={`w-4 h-4 ${isLoading && 'animate-spin'}`} />
            </Button>
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search NFTs..." className="pl-10 bg-white/5 border-white/10" />
            </div>
            <Button variant="outline" size="icon" className="border-white/10"><Filter className="w-4 h-4" /></Button>
            <Tabs defaultValue="grid" className="hidden sm:block">
              <TabsList className="bg-white/5 border-white/10">
                <TabsTrigger value="grid" className="data-[state=active]:bg-primary"><LayoutGrid className="w-4 h-4" /></TabsTrigger>
                <TabsTrigger value="list" className="data-[state=active]:bg-primary"><List className="w-4 h-4" /></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {!account ? (
          <div className="py-32 text-center glass-card rounded-3xl">
            <div className="max-w-xs mx-auto space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold font-headline">Wallet Not Connected</h2>
              <p className="text-sm text-muted-foreground">Please connect your Sui wallet to view your collection.</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
            <p className="font-headline tracking-widest text-muted-foreground">Accessing Kiosk...</p>
          </div>
        ) : userNfts.length === 0 ? (
          <div className="py-32 text-center glass-card rounded-3xl">
            <div className="max-w-xs mx-auto space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                <LayoutGrid className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold font-headline">No NFTs Found</h2>
              <p className="text-sm text-muted-foreground">Your collection is empty. Head over to the shop to open your first lootbox!</p>
              <Button asChild className="glow-purple">
                <a href="/shop">Go to Shop</a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {userNfts.map((nft) => (
              <NFTCard 
                key={nft.id} 
                nft={nft} 
                onClick={() => setSelectedNft(nft)}
              />
            ))}
          </div>
        )}
      </div>

      <NFTDetailDialog 
        nft={selectedNft} 
        open={!!selectedNft} 
        onOpenChange={(open) => !open && setSelectedNft(null)} 
      />
    </div>
  );
}
