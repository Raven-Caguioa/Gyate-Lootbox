"use client";

import { useState } from "react";
import { NFT, RARITY_LABELS, BURN_REWARDS } from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { Sword, Shield, Zap, Tag, Loader2, Flame, Coins } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";
import { cn } from "@/lib/utils";

interface NFTDetailDialogProps {
  nft: NFT | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInventory?: boolean;
  onBurn?: () => void;
  isBurning?: boolean;
}

export function NFTDetailDialog({ nft, open, onOpenChange, isInventory, onBurn, isBurning }: NFTDetailDialogProps) {
  const [listPrice, setListPrice] = useState("");
  const [isListing, setIsListing] = useState(false);

  const { toast } = useToast();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  if (!nft) return null;

  const handleListForSale = async () => {
    if (!account || !listPrice || !nft.kioskId || !nft.kioskCapId) return;
    setIsListing(true);

    try {
      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.LIST_NFT}`,
        arguments: [
          txb.object(nft.kioskId),
          txb.object(nft.kioskCapId),
          txb.pure.id(nft.id),
          txb.pure.u64(BigInt(parseFloat(listPrice) * 1_000_000_000)),
        ],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Listed Successfully", description: "Your hero is now on the marketplace." });
          setIsListing(false);
          onOpenChange(false);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Listing Failed", description: err.message });
          setIsListing(false);
        }
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
      setIsListing(false);
    }
  };

  const burnReward = BURN_REWARDS[nft.rarity];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-white/10 glass-card">
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-[4/5] md:aspect-auto">
            <Image src={nft.image} alt={nft.name} fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </div>

          <div className="p-8 flex flex-col gap-6">
            <DialogHeader className="p-0">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest text-[10px]">#{nft.globalId}</Badge>
                {nft.variantType !== "Normal" && <Badge className="bg-accent">{nft.variantType}</Badge>}
              </div>
              <DialogTitle className="font-headline text-4xl font-bold flex items-center gap-3">
                {nft.name}
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="max-h-[500px] pr-4">
              <div className="space-y-8">
                <div className="grid grid-cols-3 gap-4">
                  <StatItem icon={Shield} label="HP" value={nft.hp} max={2500} color="blue" />
                  <StatItem icon={Sword} label="ATK" value={nft.atk} max={600} color="red" />
                  <StatItem icon={Zap} label="SPD" value={nft.spd} max={400} color="yellow" />
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <h3 className="text-xs uppercase font-bold tracking-widest text-muted-foreground">About Character</h3>
                  <div className="text-[11px] leading-relaxed text-muted-foreground">
                    This is a {RARITY_LABELS[nft.rarity]} {nft.variantType} hero summoned from the on-chain protocol. 
                    Each attribute is cryptographically rolled using verifiable randomness.
                  </div>
                </div>

                {isInventory && (
                  <div className="space-y-6 pt-4 border-t border-white/10">
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-widest text-primary font-bold">List for Sale</Label>
                      <div className="flex gap-2">
                        <Input placeholder="Price SUI" type="number" value={listPrice} onChange={(e) => setListPrice(e.target.value)} className="bg-white/5" />
                        <Button onClick={handleListForSale} disabled={isListing || !listPrice} className="glow-purple">
                          {isListing ? <Loader2 className="w-4 h-4 animate-spin" /> : "List"}
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-3">
                       <div className="flex items-center justify-between">
                         <h3 className="text-xs uppercase font-bold tracking-widest text-red-400">Burn Station</h3>
                         <div className="flex items-center gap-1 text-red-400 font-bold text-xs">
                           +{burnReward} <Coins className="w-3 h-3" />
                         </div>
                       </div>
                       <p className="text-[10px] text-muted-foreground">
                         Sacrifice this hero to receive <span className="text-red-400 font-bold">{burnReward} $GYATE</span> tokens based on its {RARITY_LABELS[nft.rarity]} rarity.
                       </p>
                       <Button variant="destructive" className="w-full h-10 gap-2 font-bold" onClick={onBurn} disabled={isBurning}>
                         {isBurning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                         Burn for {burnReward} $GYATE
                       </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatItem({ icon: Icon, label, value, max, color }: any) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1">
          <Icon className={cn("w-3 h-3", color === "blue" ? "text-blue-400" : color === "red" ? "text-red-400" : "text-yellow-400")} /> {label}
        </span>
        <span>{value}</span>
      </div>
      <Progress value={percentage} className="h-1 bg-white/5" />
    </div>
  );
}
