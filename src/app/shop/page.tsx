
"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Store, Sparkles, Loader2, RefreshCw, Zap, Info, Coins } from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import { RevealLootboxDialog } from "@/components/reveal-lootbox-dialog";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, LOOTBOX_REGISTRY, TREASURY_POOL, MODULE_NAMES, FUNCTIONS, RANDOM_STATE, TREASURY_CAP } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  // Character counts to prevent instruction 14
  common_count: number;
  rare_count: number;
  super_rare_count: number;
  ssr_count: number;
  ultra_rare_count: number;
  legend_rare_count: number;
}

export default function ShopPage() {
  const [openingBox, setOpeningBox] = useState<any>(null);
  const [activeBoxes, setActiveBoxes] = useState<LootboxData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'SUI' | 'GYATE'>('SUI');
  
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
          common_count: fields?.common_configs?.length || 0,
          rare_count: fields?.rare_configs?.length || 0,
          super_rare_count: fields?.super_rare_configs?.length || 0,
          ssr_count: fields?.ssr_configs?.length || 0,
          ultra_rare_count: fields?.ultra_rare_configs?.length || 0,
          legend_rare_count: fields?.legend_rare_configs?.length || 0,
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

    // Protection: Verify the box isn't empty in a way that causes instruction 14
    const totalChars = box.common_count + box.rare_count + box.super_rare_count + box.ssr_count + box.ultra_rare_count + box.legend_rare_count;
    if (totalChars === 0) {
      toast({ variant: "destructive", title: "Empty Protocol", description: "This lootbox has no character types registered yet." });
      return;
    }

    setIsPending(true);
    
    try {
      // 1. Setup Kiosk refs
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

      // 2. Find PlayerStats
      const statsObjects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::PlayerStats` }
      });

      if (statsObjects.data.length === 0) {
        toast({ variant: "destructive", title: "Account Setup Required", description: "Initialize your profile in the Account section first." });
        setIsPending(false);
        return;
      }

      const statsId = statsObjects.data[0].data?.objectId;
      const txb = new Transaction();

      // 3. Determine payment and function
      let paymentAmount = mode === 'multi' 
        ? BigInt(paymentMethod === 'SUI' ? box.price : box.gyate_price) * BigInt(box.multi_open_size)
        : BigInt(paymentMethod === 'SUI' ? box.price : box.gyate_price);

      let targetFunction = "";
      if (paymentMethod === 'SUI') {
        if (mode === 'single') targetFunction = FUNCTIONS.OPEN_LOOTBOX;
        else if (mode === 'multi') targetFunction = FUNCTIONS.MULTI_OPEN_LOOTBOX;
        else if (mode === 'pity') targetFunction = FUNCTIONS.OPEN_LOOTBOX_WITH_PITY;
      } else {
        if (mode === 'single') targetFunction = FUNCTIONS.OPEN_LOOTBOX_WITH_GYATE;
        else if (mode === 'multi') targetFunction = FUNCTIONS.MULTI_OPEN_LOOTBOX_GYATE;
        else if (mode === 'pity') targetFunction = FUNCTIONS.OPEN_LOOTBOX_GYATE_WITH_PITY;
      }

      // 4. Handle Coin splitting/merging
      let paymentCoin;
      if (paymentMethod === 'SUI') {
        [paymentCoin] = txb.splitCoins(txb.gas, [paymentAmount]);
      } else {
        const gyateType = `${PACKAGE_ID}::${MODULE_NAMES.GYATE_COIN}::GYATE_COIN`;
        const coins = await suiClient.getCoins({ owner: account.address, coinType: gyateType });
        if (coins.data.length === 0) throw new Error("No $GYATE tokens found in wallet.");
        
        const [mainCoin, ...otherCoins] = coins.data.map(c => c.coinObjectId);
        if (otherCoins.length > 0) {
          txb.mergeCoins(txb.object(mainCoin), otherCoins.map(c => txb.object(c)));
        }
        [paymentCoin] = txb.splitCoins(txb.object(mainCoin), [paymentAmount]);
      }

      // 5. Handle Pity Progress injection if needed
      let progressId: string | null = null;
      if (mode === 'pity') {
        const progressObjects = await suiClient.getOwnedObjects({
          owner: account.address,
          filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::UserProgress` },
          options: { showContent: true }
        });
        const progress = progressObjects.data.find((p: any) => p.data?.content?.fields?.lootbox_id === box.id);
        if (!progress) {
          toast({ variant: "destructive", title: "Pity Tracking Disabled", description: "Initialize pity progress for this box in your profile." });
          setIsPending(false);
          return;
        }
        progressId = progress.data!.objectId;
      }

      // 6. Final Call Construction - ENSURE PRECISE ARGUMENT ORDER
      const callArgs = [
        txb.object(box.id),
        txb.object(LOOTBOX_REGISTRY),
        paymentMethod === 'SUI' ? txb.object(TREASURY_POOL) : txb.object(TREASURY_CAP),
      ];

      // Insert progress object for pity functions (it's the 4th argument in Move)
      if (mode === 'pity' && progressId) {
        callArgs.push(txb.object(progressId));
      }

      // Remaining arguments
      callArgs.push(paymentCoin);
      callArgs.push(txb.object(statsId!));
      callArgs.push(txb.object(RANDOM_STATE));
      callArgs.push(txb.object(kioskId));
      callArgs.push(txb.object(kioskCapId!));

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${targetFunction}`,
        arguments: callArgs,
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Summon Successful", description: "Character materialized on-chain." });
          setOpeningBox(box);
          setIsPending(false);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Summon Failed", description: err.message });
          setIsPending(false);
        }
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Summon Error", description: err.message });
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
            
            <div className="flex flex-col items-end gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn("px-6 rounded-lg font-bold text-xs h-9", paymentMethod === 'SUI' ? "bg-primary text-white glow-purple" : "text-muted-foreground")}
                  onClick={() => setPaymentMethod('SUI')}
                >
                  SUI MODE
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn("px-6 rounded-lg font-bold text-xs h-9", paymentMethod === 'GYATE' ? "bg-accent text-white glow-violet" : "text-muted-foreground")}
                  onClick={() => setPaymentMethod('GYATE')}
                >
                  $GYATE MODE
                </Button>
              </div>
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
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Active Price</span>
                          <span className={cn(
                            "text-2xl font-bold flex items-center gap-1",
                            paymentMethod === 'SUI' ? "text-white" : "text-muted-foreground line-through opacity-50"
                          )}>
                            {Number(box.price) / 1_000_000_000} <span className="text-accent text-sm font-headline">SUI</span>
                          </span>
                        </div>
                        <div className="text-right">
                           <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Alt Price</span>
                           <div className={cn(
                             "text-sm font-bold flex items-center justify-end gap-1",
                             paymentMethod === 'GYATE' ? "text-primary scale-110 transition-transform" : "text-muted-foreground line-through opacity-50"
                           )}>
                             {box.gyate_price} <Coins className="w-3 h-3" />
                           </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          className={cn(
                            "h-12 font-bold transition-all",
                            paymentMethod === 'SUI' ? "glow-purple bg-primary" : "glow-violet bg-accent"
                          )}
                          disabled={isPending}
                          onClick={() => handleSummon(box, 'single')}
                        >
                          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Single Pull"}
                        </Button>
                        {box.multi_open_enabled && (
                          <Button 
                            variant="secondary"
                            className="h-12 font-bold bg-white/5 hover:bg-white/10 border-white/10"
                            disabled={isPending}
                            onClick={() => handleSummon(box, 'multi')}
                          >
                            {box.multi_open_size}x Batch
                          </Button>
                        )}
                      </div>
                      
                      {box.pity_enabled && (
                        <Button 
                          variant="outline" 
                          className="w-full h-10 text-[10px] font-bold tracking-widest uppercase border-accent/20 text-accent hover:bg-accent/10"
                          disabled={isPending}
                          onClick={() => handleSummon(box, 'pity')}
                        >
                          Execute Pity-Guaranteed Summon
                        </Button>
                      )}
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
