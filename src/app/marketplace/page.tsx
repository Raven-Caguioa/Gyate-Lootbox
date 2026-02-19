
"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, AlertTriangle, Info, ExternalLink, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useCallback } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@mysten/sui/transactions";

export default function MarketplacePage() {
  const [selectedNft, setSelectedNft] = useState<any>(null);
  const [isPending, setIsPending] = useState(false);
  const [lookupId, setLookupId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [foundListing, setFoundListing] = useState<any>(null);

  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const ADMIN_ADDRESS = "0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a";

  const handleLookupKiosk = async () => {
    if (!lookupId) return;
    setIsLoading(true);
    setFoundListing(null);
    try {
      // Direct on-chain lookup for items in a specific Kiosk
      const kioskData = await suiClient.getDynamicFields({
        parentId: lookupId,
      });

      const nftType = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      
      const objects = await suiClient.multiGetObjects({
        ids: kioskData.data.map(f => f.objectId),
        options: { showContent: true, showType: true }
      });

      const items = objects.map((obj: any) => {
        const fields = obj.data?.content?.fields;
        const nftData = fields?.value?.fields || fields;
        if (!nftData || obj.data?.content?.type !== nftType) return null;

        return {
          id: nftData.id?.id || obj.data?.objectId,
          name: nftData.name,
          rarity: nftData.rarity,
          variantType: nftData.variant_type,
          image: nftData.image_url,
          hp: parseInt(nftData.hp),
          atk: parseInt(nftData.atk),
          spd: parseInt(nftData.spd),
          kioskId: lookupId,
          price: 1, // In a real app, you'd fetch the Kiosk's 'PurchaseCap' or price metadata
        };
      }).filter(n => n !== null);

      if (items.length > 0) {
        setFoundListing(items[0]);
        toast({ title: "Kiosk Found", description: `Discovered ${items.length} items for sale.` });
      } else {
        toast({ variant: "destructive", title: "No items", description: "This Kiosk has no GyateNFTs listed." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Lookup Failed", description: "Could not find Kiosk on-chain." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyNft = async (item: any) => {
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

      const nftType = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      const policyResponse = await suiClient.getOwnedObjects({
        owner: ADMIN_ADDRESS,
        filter: { StructType: `0x2::transfer_policy::TransferPolicy<${nftType}>` }
      });

      const transferPolicyId = policyResponse.data[0]?.data?.objectId;

      if (!transferPolicyId) {
        toast({ variant: "destructive", title: "Policy Error", description: "No active TransferPolicy found." });
        setIsPending(false);
        return;
      }

      const txb = new Transaction();
      const [paymentCoin] = txb.splitCoins(txb.gas, [BigInt(item.price * 1_000_000_000)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.BUY_NFT}`,
        arguments: [
          txb.object(item.kioskId),
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
          toast({ title: "Purchase Successful", description: "Item moved to your Kiosk." });
          setIsPending(false);
          setFoundListing(null);
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
              Pure on-chain discovery. Connect to Kiosks directly.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[350px_1fr] gap-12">
          <aside className="space-y-6">
            <Card className="glass-card border-primary/20">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Search className="w-4 h-4 text-accent" /> Kiosk Discovery
                  </h3>
                  <p className="text-xs text-muted-foreground">Enter a user's Kiosk ID to explore their available listings.</p>
                </div>
                <div className="space-y-3">
                  <Input 
                    placeholder="0x... (Kiosk ID)" 
                    value={lookupId} 
                    onChange={(e) => setLookupId(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                  <Button className="w-full glow-purple font-bold" onClick={handleLookupKiosk} disabled={isLoading}>
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
                    Scan Kiosk
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 rounded-xl border border-white/5 bg-accent/5">
              <div className="flex gap-3 items-start">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Without an off-chain indexer, the marketplace operates via direct peer-to-peer discovery. Share your Kiosk ID with other players to enable trading.
                </p>
              </div>
            </div>
          </aside>

          <main className="space-y-8">
            {foundListing ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <NFTCard nft={foundListing} onClick={() => setSelectedNft(foundListing)} />
                  <Button className="w-full h-12 glow-purple font-bold" onClick={() => handleBuyNft(foundListing)} disabled={isPending}>
                    {isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    Buy for {foundListing.price} SUI
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 glass-card rounded-3xl space-y-6 text-center px-12">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-muted-foreground opacity-50" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">Ready for Exploration</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Use the sidebar to scan a specific Kiosk ID. All trading operations are verified on-chain via your local Sui Client.
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
