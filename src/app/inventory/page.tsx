
"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, ShoppingBag, Loader2, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_CAP } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { NFT } from "@/lib/mock-data";
import { Transaction } from "@mysten/sui/transactions";
import { cn } from "@/lib/utils";

export default function InventoryPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [userNfts, setUserNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBurning, setIsBurning] = useState(false);

  const fetchUserNfts = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
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

      const fields = await suiClient.getDynamicFields({ parentId: kioskId });
      const nftType = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      
      if (fields.data.length === 0) {
        setUserNfts([]);
        setIsLoading(false);
        return;
      }

      const nftObjects = await suiClient.multiGetObjects({
        ids: fields.data.map(f => f.objectId),
        options: { showContent: true, showType: true }
      });

      const mappedNfts: NFT[] = nftObjects
        .map((obj: any) => {
          const fields = obj.data?.content?.fields;
          // Kiosk items are nested in Dynamic Fields
          const nftData = fields?.value?.fields || fields;
          if (!nftData || obj.data?.content?.type !== nftType) return null;

          return {
            id: nftData.id?.id || obj.data?.objectId,
            name: nftData.name,
            rarity: nftData.rarity,
            variantType: nftData.variant_type,
            image: nftData.image_url || "https://images.unsplash.com/photo-1743355694962-40376ef681da?q=80&w=400",
            hp: parseInt(nftData.hp),
            atk: parseInt(nftData.atk),
            spd: parseInt(nftData.spd),
            baseValue: parseInt(nftData.base_value),
            actualValue: parseInt(nftData.actual_value),
            lootboxSource: nftData.lootbox_source,
            globalId: parseInt(nftData.global_sequential_id),
            kioskId: kioskId,
            kioskCapId: kioskCapId,
          };
        })
        .filter((n): n is NFT => n !== null);

      setUserNfts(mappedNfts);
    } catch (err) {
      console.error("Discovery error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [account, suiClient]);

  const handleBurnNft = async (nft: NFT) => {
    if (!account || !nft.kioskId || !nft.kioskCapId) return;
    setIsBurning(true);
    
    try {
      const txb = new Transaction();
      // Reverted to 4 arguments to match contract signature: (kiosk, cap, treasury_cap, nft_id)
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.BURN_NFT_FOR_GYATE}`,
        arguments: [
          txb.object(nft.kioskId),
          txb.object(nft.kioskCapId),
          txb.object(TREASURY_CAP),
          txb.pure.address(nft.id),
        ],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Hero Sacrificed", description: "You've received $GYATE tokens. Refresh your profile to see updated stats." });
          setIsBurning(false);
          setSelectedNft(null);
          setTimeout(fetchUserNfts, 3000);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Burn failed", description: err.message });
          setIsBurning(false);
        }
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup error", description: err.message });
      setIsBurning(false);
    }
  };

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
            <p className="text-muted-foreground">Manage your on-chain collection and $GYATE economy.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={fetchUserNfts} className="border-white/10">
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            <div className="relative md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search NFTs..." className="pl-10 bg-white/5 border-white/10" />
            </div>
          </div>
        </div>

        {!account ? (
          <div className="py-32 text-center glass-card rounded-3xl">
             <div className="max-w-xs mx-auto space-y-4">
               <ShoppingBag className="w-12 h-12 text-primary mx-auto" />
               <h2 className="text-xl font-bold font-headline">Connect Wallet</h2>
               <p className="text-sm text-muted-foreground">View your collection on the Sui network.</p>
             </div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
            <p className="font-headline tracking-widest text-muted-foreground">Accessing Kiosk...</p>
          </div>
        ) : userNfts.length === 0 ? (
          <div className="py-32 text-center glass-card rounded-3xl">
            <div className="max-w-xs mx-auto space-y-4">
              <LayoutGrid className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold">Collection Empty</h2>
              <p className="text-sm text-muted-foreground">Visit the Emporium to summon your first hero.</p>
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
        isInventory={true}
        onBurn={() => selectedNft && handleBurnNft(selectedNft)}
        isBurning={isBurning}
      />
    </div>
  );
}
