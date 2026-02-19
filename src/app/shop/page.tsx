
"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Store, Shield, Sparkles, AlertCircle, Loader2, RefreshCw, Zap, TrendingUp, Info } from "lucide-react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import { RevealLootboxDialog } from "@/components/reveal-lootbox-dialog";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, LOOTBOX_REGISTRY, TREASURY_POOL, MODULE_NAMES, FUNCTIONS, RANDOM_STATE, ACHIEVEMENT_REGISTRY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface LootboxData {
  id: string;
  name: string;
  price: string;
  gyate_price: string;
  description: string;
  image: string;
  pity_enabled: boolean;
  multi_open_enabled: boolean;
  multi_open_size: string;
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
          gyate_price: fields?.gyate_price || "100",
          description: "Verified on-chain random hero summon.",
          image: "https://images.unsplash.com/photo-1632809199725-72a4245e846b?q=80&w=600",
          pity_enabled: fields?.pity_enabled || false,
          multi_open_enabled: fields?.multi_open_enabled || false,
          multi_open_size: fields?.multi_open_size || "10",
        };
      });

      setActiveBoxes(boxes);
    } catch (err) {
      console.error("Discovery error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    fetchActiveLootboxes();
  }, [fetchActiveLootboxes]);

  const handleSummon = async (box: LootboxData, mode: 'single' | 'multi' | 'pity' = 'single') => {
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
        toast({ variant: "destructive", title: "Kiosk Required", description: "You need a Kiosk to receive characters." });
        setIsPending(false);
        return;
      }

      const kioskCapId = ownedCaps.data[0].data?.objectId;
      const capObject = await suiClient.getObject({ id: kioskCapId!, options: { showContent: true } });
      const kioskId = (capObject.data?.content as any)?.fields?.for;

      // Find PlayerStats for Achievement recording
      const statsObjects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::PlayerStats` }
      });

      if (statsObjects.data.length === 0) {
        toast({ variant: "destructive", title: "Achievement Setup Required", description: "Initialize your stats in the account section." });
        setIsPending(false);
        return;
      }

      const statsId = statsObjects.data[0].data?.objectId;
      const txb = new Transaction();

      let targetFunction = FUNCTIONS.OPEN_LOOTBOX;
      let paymentAmount = BigInt(box.price);
      let progressId: string | null = null;

      if (mode === 'multi') {
        targetFunction = FUNCTIONS.MULTI_OPEN_LOOTBOX;
        paymentAmount = BigInt(box.price) * BigInt(box.multi_open_size);
      } else if (mode === 'pity') {
        targetFunction = FUNCTIONS.OPEN_LOOTBOX_WITH_PITY;
        const progressObjects = await suiClient.getOwnedObjects({
          owner: account.address,
          filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::UserProgress` },
          options: { showContent: true }
        });
        const progress = progressObjects.data.find((p: any) => p.data?.content?.fields?.lootbox_id === box.id);
        if (!progress) {
          toast({ variant: "destructive", title: "Pity Tracking Disabled", description: "Initialize pity for this box first." });
          setIsPending(false);
          return;
        }
        progressId = progress.data!.objectId;
      }

      const [paymentCoin] = txb.splitCoins(txb.gas, [paymentAmount]);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${targetFunction}`,
        arguments: [
          txb.object(box.id),
          txb.object(LOOTBOX_REGISTRY),
          txb.object(TREASURY_POOL),
          ...(mode === 'pity' && progressId ? [txb.object(progressId)] : []),
          paymentCoin,
          txb.object(statsId!),
          txb.object(RANDOM_STATE),
          txb.object(kioskId),
          txb.object(kioskCapId!),
        ],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Summon Successful", description: "Minting character on-chain..." });
          setOpeningBox(box);
          setIsPending(false);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Transaction failed", description: err.message });
          setIsPending(false);
        }
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup error", description: err.message });
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div className="flex-1">
              <h1 className="font-headline text-5xl font-bold mb-4 flex items-center gap-4">
                Summoning Altar
                <Sparkles className="w-8 h-8 text-accent animate-pulse" />
              </h1>
              <p className="text-muted-foreground text-lg">
                On-chain randomness with bad-luck protection and $GYATE rewards.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="glass-card border-accent/20 p-4">
                 <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Pity Enabled</div>
                 <div className="text-xl font-headline font-bold text-accent">ACTIVE</div>
              </Card>
              <Card className="glass-card border-primary/20 p-4">
                 <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Batch Summon</div>
                 <div className="text-xl font-headline font-bold text-primary">UP TO 10x</div>
              </Card>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <RefreshCw className="w-12 h-12 text-primary animate-spin" />
              <p className="font-headline tracking-widest text-muted-foreground uppercase text-sm">Consulting Registry...</p>
            </div>
          ) : activeBoxes.length === 0 ? (
            <div className="text-center py-32 glass-card rounded-3xl">
              <Store className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
              <h3 className="text-2xl font-bold">Registry Empty</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">No lootboxes are currently active on the protocol.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {activeBoxes.map((box) => (
                <Card key={box.id} className="glass-card overflow-hidden group border-white/5 hover:border-primary/40 transition-all flex flex-col">
                  <div className="relative aspect-[4/3]">
                    <Image src={box.image} alt={box.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="p-4 rounded-3xl bg-primary/20 backdrop-blur-xl border border-primary/30 glow-purple">
                        <Store className="w-12 h-12 text-white" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6 space-y-6 flex-1 flex flex-col">
                    <div>
                      <h3 className="font-headline font-bold text-2xl mb-2">{box.name}</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {box.pity_enabled && <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">Pity Tracking</Badge>}
                        {box.multi_open_enabled && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{box.multi_open_size}x Batching</Badge>}
                      </div>
                    </div>

                    <div className="space-y-4 mt-auto">
                      <div className="flex justify-between items-end border-b border-white/5 pb-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Cost</span>
                          <span className="text-2xl font-bold flex items-center gap-1">
                            {Number(box.price) / 1_000_000_000} <span className="text-accent text-sm font-headline">SUI</span>
                          </span>
                        </div>
                        <div className="text-right">
                           <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Alt Price</span>
                           <div className="text-sm font-bold text-primary">{box.gyate_price} $GYATE</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          className="h-12 font-bold glow-purple bg-primary"
                          disabled={isPending}
                          onClick={() => handleSummon(box, 'single')}
                        >
                          Single Pull
                        </Button>
                        {box.multi_open_enabled && (
                          <Button 
                            variant="secondary"
                            className="h-12 font-bold bg-accent/20 hover:bg-accent/40 text-accent"
                            disabled={isPending}
                            onClick={() => handleSummon(box, 'multi')}
                          >
                            {box.multi_open_size}x Batch
                          </Button>
                        )}
                      </div>
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
