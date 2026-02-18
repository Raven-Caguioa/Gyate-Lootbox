"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Store, Shield, Sparkles, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import { RevealLootboxDialog } from "@/components/reveal-lootbox-dialog";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, LOOTBOX_REGISTRY, TREASURY_POOL, MODULE_NAMES, FUNCTIONS, RANDOM_STATE } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface LootboxData {
  id: string;
  name: string;
  price: string;
  description: string;
  image: string;
}

export default function ShopPage() {
  const [openingBox, setOpeningBox] = useState<any>(null);
  const [activeBoxes, setActiveBoxes] = useState<LootboxData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const fetchActiveLootboxes = useCallback(async () => {
    setIsLoading(true);
    try {
      const registryObj = await suiClient.getObject({
        id: LOOTBOX_REGISTRY,
        options: { showContent: true }
      });

      const activeIds = (registryObj.data?.content as any)?.fields?.active_ids || [];
      
      if (activeIds.length === 0) {
        setActiveBoxes([]);
        return;
      }

      const boxesData = await suiClient.multiGetObjects({
        ids: activeIds,
        options: { showContent: true }
      });

      const boxes: LootboxData[] = boxesData.map((obj: any) => {
        const fields = obj.data?.content?.fields;
        return {
          id: obj.data?.objectId,
          name: fields?.name || "Premium Crate",
          price: fields?.price || "0",
          description: "Verified on-chain random hero summon.",
          image: "https://images.unsplash.com/photo-1632809199725-72a4245e846b?q=80&w=600",
        };
      });

      setActiveBoxes(boxes);
    } catch (err) {
      console.error("Failed to fetch active boxes:", err);
    } finally {
      setIsLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    fetchActiveLootboxes();
  }, [fetchActiveLootboxes]);

  const handleBuyLootbox = async (box: LootboxData) => {
    if (!account) {
      toast({ variant: "destructive", title: "Wallet not connected", description: "Please connect your Sui wallet to purchase lootboxes." });
      return;
    }

    setIsPending(true);
    
    try {
      // 1. Find user's KioskOwnerCap
      const ownedCaps = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `0x2::kiosk::KioskOwnerCap` },
      });

      if (ownedCaps.data.length === 0) {
        toast({ 
          variant: "destructive", 
          title: "Kiosk Required", 
          description: "You need a Gyate Kiosk to receive NFTs. Please visit the marketplace (coming soon) to create one." 
        });
        setIsPending(false);
        return;
      }

      const kioskCapId = ownedCaps.data[0].data?.objectId;
      const capObject = await suiClient.getObject({ id: kioskCapId!, options: { showContent: true } });
      const kioskId = (capObject.data?.content as any)?.fields?.for;

      const txb = new Transaction();

      // Split SUI for payment
      const [paymentCoin] = txb.splitCoins(txb.gas, [BigInt(box.price)]);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.OPEN_LOOTBOX}`,
        arguments: [
          txb.object(box.id),
          txb.object(LOOTBOX_REGISTRY),
          txb.object(TREASURY_POOL),
          paymentCoin,
          txb.object(RANDOM_STATE),
          txb.object(kioskId),
          txb.object(kioskCapId!),
        ],
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: (result) => {
            toast({ title: "Summon Successful", description: "Your hero is being minted on-chain!" });
            setOpeningBox(box);
            setIsPending(false);
          },
          onError: (err) => {
            console.error(err);
            toast({ variant: "destructive", title: "Transaction Failed", description: err.message });
            setIsPending(false);
          },
        }
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup Error", description: err.message });
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
            <div className="flex-1">
              <h1 className="font-headline text-5xl font-bold mb-4 flex items-center gap-4">
                Lootbox Emporium
                <Sparkles className="w-8 h-8 text-accent animate-pulse" />
              </h1>
              <p className="text-muted-foreground text-lg">
                Verified on-chain randomness. Transparent drop rates.
              </p>
            </div>

            <Card className="glass-card border-accent/20 w-full md:w-80">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Network Info</span>
                  <Badge variant="outline" className="border-accent/50 text-[10px]">Testnet</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-accent/80 font-bold uppercase">
                    <AlertCircle className="w-3 h-3" />
                    Kiosk system active
                  </div>
                  <Button variant="ghost" size="icon" onClick={fetchActiveLootboxes} className="h-6 w-6">
                    <RefreshCw className={`w-3 h-3 ${isLoading && 'animate-spin'}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="w-10 h-10 text-primary animate-spin" />
              <p className="text-muted-foreground font-headline uppercase tracking-widest text-sm">Consulting Registry...</p>
            </div>
          ) : activeBoxes.length === 0 ? (
            <div className="text-center py-20 glass-card rounded-3xl">
              <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold">No Active Lootboxes</h3>
              <p className="text-muted-foreground">Check back soon or visit the admin panel if you are a creator.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {activeBoxes.map((box) => (
                <Card key={box.id} className="glass-card overflow-hidden group border-white/5 hover:border-primary/40 transition-all flex flex-col h-full">
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={box.image}
                      alt={box.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="p-4 rounded-3xl bg-primary/20 backdrop-blur-xl border border-primary/30 glow-purple">
                        <Store className="w-16 h-16 text-white" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6 space-y-4 flex-1 flex flex-col">
                    <div>
                      <h3 className="font-headline font-bold text-2xl mb-2">{box.name}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {box.description}
                      </p>
                    </div>

                    <div className="pt-4 mt-auto border-t border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Cost</span>
                          <span className="text-2xl font-bold flex items-center gap-2">
                            {Number(box.price) / 1_000_000_000} <span className="text-accent text-sm font-headline uppercase">SUI</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-white/5 px-2 py-1 rounded border border-white/5 uppercase font-bold tracking-widest">
                          <Shield className="w-3 h-3" /> Verifiable
                        </div>
                      </div>
                      <Button 
                        className="w-full h-12 font-bold text-lg glow-purple"
                        disabled={isPending}
                        onClick={() => handleBuyLootbox(box)}
                      >
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                        {isPending ? "Confirming..." : "Summon Now"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <RevealLootboxDialog 
        box={openingBox} 
        open={!!openingBox} 
        onOpenChange={(open) => !open && setOpeningBox(null)} 
      />
    </div>
  );
}
