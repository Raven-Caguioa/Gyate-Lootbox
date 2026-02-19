
"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Loader2, ShoppingCart, Info, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useState, useCallback, useEffect } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@mysten/sui/transactions";

export default function MarketplacePage() {
  const [selectedNft, setSelectedNft] = useState<any>(null);
  const [isPending, setIsPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [listings, setListings] = useState<any[]>([]);

  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  // Admin address who likely owns the TransferPolicy objects
  const ADMIN_ADDRESS = "0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a";

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      // Note: Without an indexer or Firestore, scanning the entire chain for Kiosk listings
      // is restricted in a browser environment. We show a message to the user about direct lookup.
      setListings([]);
    } catch (err) {
      console.error("Listing fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleBuyNft = async (listing: any) => {
    if (!account) {
      toast({ variant: "destructive", title: "Wallet required", description: "Connect your wallet to buy characters." });
      return;
    }

    setIsPending(true);
    try {
      // 1. Find buyer's KioskOwnerCap and Kiosk
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

      // 2. Discover the correct TransferPolicy for this NFT type on-chain
      const nftType = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      
      // We look for the policy owned by the Admin or Package
      const policyResponse = await suiClient.getOwnedObjects({
        owner: ADMIN_ADDRESS,
        filter: { StructType: `0x2::transfer_policy::TransferPolicy<${nftType}>` }
      });

      const transferPolicyId = policyResponse.data[0]?.data?.objectId;

      if (!transferPolicyId) {
        toast({ 
          variant: "destructive", 
          title: "Policy Error", 
          description: "Could not find an active TransferPolicy for this item type on-chain." 
        });
        setIsPending(false);
        return;
      }

      const txb = new Transaction();
      const [paymentCoin] = txb.splitCoins(txb.gas, [BigInt(listing.price * 1_000_000_000)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.BUY_NFT}`,
        arguments: [
          txb.object(listing.kioskId),
          txb.object(transferPolicyId),
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
          setIsPending(false);
          fetchListings();
        },
        onError: (err) => {
          console.error("Purchase error:", err);
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
              On-chain listings from individual user Kiosks. <span className="text-accent font-bold">10% Protocol Fee</span> enforced.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          <aside className="space-y-8 hidden lg:block">
            <div className="p-4 rounded-xl border border-white/5 bg-accent/5">
              <div className="flex gap-3 items-start">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Discovering all listed Kiosks on-chain requires an indexer. For this prototype, enter an ID or use the Discovery Index.
                </p>
              </div>
            </div>
          </aside>

          <div className="space-y-8">
            <div className="flex flex-col items-center justify-center py-24 glass-card rounded-3xl space-y-6">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
              <div className="text-center space-y-2 max-w-sm">
                <h3 className="text-xl font-bold">On-Chain Discovery Mode</h3>
                <p className="text-muted-foreground text-sm">
                  Global chain scanning for listed items is restricted without an indexer. Please use the Inventory to list items and view them here once a discovery system is configured.
                </p>
              </div>
              <Button onClick={fetchListings} variant="outline" className="border-white/10">
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh State
              </Button>
            </div>
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
