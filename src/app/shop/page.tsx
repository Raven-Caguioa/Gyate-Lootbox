
"use client";

import { Navigation } from "@/components/navigation";
import { MOCK_LOOTBOXES } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Store, Shield, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { RevealLootboxDialog } from "@/components/reveal-lootbox-dialog";
import { Progress } from "@/components/ui/progress";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, LOOTBOX_REGISTRY, TREASURY_POOL, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function ShopPage() {
  const [openingBox, setOpeningBox] = useState<any>(null);
  const [isPending, setIsPending] = useState(false);
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const handleBuyLootbox = async (box: any) => {
    if (!account) {
      toast({ variant: "destructive", title: "Wallet not connected", description: "Please connect your Sui wallet to purchase lootboxes." });
      return;
    }

    setIsPending(true);
    const txb = new Transaction();

    // Payment in SUI (MIST)
    const [coin] = txb.splitCoins(txb.gas, [box.price * 1_000_000_000]);

    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.BUY_LOOTBOX}`,
      arguments: [
        txb.object(LOOTBOX_REGISTRY),
        txb.object(TREASURY_POOL),
        txb.pure.string(box.id),
        coin,
      ],
    });

    signAndExecute(
      { transaction: txb },
      {
        onSuccess: (result) => {
          toast({ title: "Purchase Successful", description: `Transaction: ${result.digest.slice(0, 10)}...` });
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
                Verified on-chain randomness. Transparent drop rates. Epic rewards.
              </p>
            </div>

            <Card className="glass-card border-accent/20 w-full md:w-80">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">On-Chain Progress</span>
                  <Badge variant="outline" className="border-accent/50 text-[10px]">Connected</Badge>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span>Legend Rare Pity</span>
                      <span>42/100</span>
                    </div>
                    <Progress value={42} className="h-1 bg-white/5" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-accent/80 font-bold uppercase">
                  <AlertCircle className="w-3 h-3" />
                  Guaranteed LR at 100 pulls
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {MOCK_LOOTBOXES.map((box) => (
              <Card key={box.id} className="glass-card overflow-hidden group border-white/5 hover:border-primary/40 transition-all flex flex-col h-full">
                <div className="relative aspect-[4/3]">
                  <Image
                    src={box.image}
                    alt={box.name}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    data-ai-hint="fantasy lootbox"
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
                          {box.price} <span className="text-accent text-sm font-headline uppercase">{box.currency}</span>
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
