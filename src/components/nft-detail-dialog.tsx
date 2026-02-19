"use client";

import { useState } from "react";
import { NFT, RARITY_LABELS } from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Sword, Shield, Zap, Sparkles, Wand2, Tag, Info, Loader2 } from "lucide-react";
import { suggestNftName } from "@/ai/flows/suggest-nft-name";
import { generateNftLore } from "@/ai/flows/generate-nft-lore";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";

interface NFTDetailDialogProps {
  nft: NFT | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInventory?: boolean;
}

export function NFTDetailDialog({ nft, open, onOpenChange, isInventory }: NFTDetailDialogProps) {
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [isGeneratingLore, setIsGeneratingLore] = useState(false);
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [suggestedLore, setSuggestedLore] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [isPending, setIsPending] = useState(false);

  const { toast } = useToast();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  if (!nft) return null;

  const handleSuggestName = async () => {
    setIsGeneratingName(true);
    try {
      const result = await suggestNftName({
        nftBaseName: nft.name,
        nftRarity: nft.rarity,
        nftVariantType: nft.variantType,
        nftImageUrl: nft.image,
      });
      setSuggestedName(result);
      toast({ title: "Name Suggested!", description: "AI has generated a unique name for your character." });
    } catch (error) {
      toast({ variant: "destructive", title: "Generation failed" });
    } finally {
      setIsGeneratingName(false);
    }
  };

  const handleGenerateLore = async () => {
    setIsGeneratingLore(true);
    try {
      const result = await generateNftLore({
        name: suggestedName || nft.name,
        rarity: RARITY_LABELS[nft.rarity],
        variant_type: nft.variantType,
        hp: nft.hp,
        atk: nft.atk,
        spd: nft.spd,
        image_url: nft.image,
      });
      setSuggestedLore(result.lore);
      toast({ title: "Lore Created!", description: "AI has woven a story for your hero." });
    } catch (error) {
      toast({ variant: "destructive", title: "Lore generation failed" });
    } finally {
      setIsGeneratingLore(false);
    }
  };

  const handleListForSale = async () => {
    if (!account || !listPrice) return;
    setIsPending(true);

    try {
      // 1. Find user's KioskOwnerCap
      const ownedCaps = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `0x2::kiosk::KioskOwnerCap` },
      });

      if (ownedCaps.data.length === 0) {
        toast({ variant: "destructive", title: "Kiosk Required", description: "You need a Kiosk to list items." });
        setIsPending(false);
        return;
      }

      const kioskCapId = ownedCaps.data[0].data?.objectId;
      const capObject = await suiClient.getObject({ id: kioskCapId!, options: { showContent: true } });
      const kioskId = (capObject.data?.content as any)?.fields?.for;

      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.LIST_NFT}`,
        arguments: [
          txb.object(kioskId),
          txb.object(kioskCapId!),
          txb.pure.id(nft.id),
          txb.pure.u64(BigInt(parseFloat(listPrice) * 1_000_000_000)),
        ],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Listed Successfully", description: `${nft.name} is now on the marketplace for ${listPrice} SUI.` });
          setIsPending(false);
          onOpenChange(false);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Listing Failed", description: err.message });
          setIsPending(false);
        }
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-white/10 glass-card">
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-[4/5] md:aspect-auto">
            <Image
              src={nft.image}
              alt={nft.name}
              fill
              className="object-cover"
              data-ai-hint="fantasy character"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex flex-wrap gap-2">
              <Badge variant="secondary" className="backdrop-blur-md border-white/10 uppercase font-bold tracking-widest text-xs py-1">
                {RARITY_LABELS[nft.rarity]}
              </Badge>
              <Badge className="bg-accent/80 backdrop-blur-md text-xs py-1">
                {nft.variantType} Variant
              </Badge>
            </div>
          </div>

          <div className="p-8 flex flex-col gap-6">
            <DialogHeader className="p-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">NFT ID #{nft.globalId || nft.id.slice(0, 6)}</span>
              </div>
              <DialogTitle className="font-headline text-4xl font-bold flex items-center gap-3">
                {suggestedName || nft.name}
                {suggestedName && <Sparkles className="w-5 h-5 text-accent animate-pulse" />}
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-8">
                {/* Stats Section */}
                <div className="space-y-4">
                  <h3 className="text-xs uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Core Statistics
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <StatItem icon={Shield} label="HP" value={nft.hp} max={2500} color="blue" />
                    <StatItem icon={Sword} label="ATK" value={nft.atk} max={600} color="red" />
                    <StatItem icon={Zap} label="SPD" value={nft.spd} max={400} color="yellow" />
                  </div>
                </div>

                {/* AI Tools Section */}
                <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <h3 className="text-xs uppercase font-bold tracking-widest text-accent flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> AI Enhancement Lab
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleSuggestName} 
                      disabled={isGeneratingName}
                      className="border-accent/30 hover:bg-accent/10"
                    >
                      {isGeneratingName ? <Wand2 className="w-4 h-4 animate-spin mr-2" /> : <Tag className="w-4 h-4 mr-2" />}
                      Suggest Name
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleGenerateLore} 
                      disabled={isGeneratingLore}
                      className="border-primary/30 hover:bg-primary/10"
                    >
                      {isGeneratingLore ? <Wand2 className="w-4 h-4 animate-spin mr-2" /> : <Info className="w-4 h-4 mr-2" />}
                      Generate Lore
                    </Button>
                  </div>

                  {suggestedLore && (
                    <div className="mt-4 p-4 rounded-lg bg-black/40 text-sm leading-relaxed text-muted-foreground">
                      <p className="whitespace-pre-line italic">"{suggestedLore}"</p>
                    </div>
                  )}
                </div>

                {/* Economy Info */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-3 border-t border-white/10">
                    <span className="text-xs text-muted-foreground font-bold">Lootbox Source</span>
                    <span className="text-sm font-medium">{nft.lootboxSource}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-t border-white/10">
                    <span className="text-xs text-muted-foreground font-bold">Base Value</span>
                    <span className="text-sm font-medium">{nft.baseValue} MIST</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-t border-white/10">
                    <span className="text-xs text-muted-foreground font-bold">Actual Value</span>
                    <span className="text-sm font-bold text-accent">{nft.actualValue} MIST</span>
                  </div>
                </div>

                {isInventory && (
                  <div className="pt-4 border-t border-white/10 space-y-4">
                    <h3 className="text-xs uppercase font-bold tracking-widest text-primary">Marketplace Listing</h3>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Input 
                          placeholder="Price in SUI" 
                          type="number" 
                          value={listPrice} 
                          onChange={(e) => setListPrice(e.target.value)}
                          className="bg-white/5"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">SUI</span>
                      </div>
                      <Button onClick={handleListForSale} disabled={isPending || !listPrice} className="bg-primary/20 hover:bg-primary/40 text-primary border-primary/20">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "List NFT"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="mt-auto pt-6 flex gap-3">
              <Button className="flex-1 font-bold h-12 bg-primary hover:bg-primary/80 glow-purple">
                Battle Mode
              </Button>
              {!isInventory && (
                <Button className="flex-1 font-bold h-12 bg-accent hover:bg-accent/80">
                  Buy Character
                </Button>
              )}
            </div>
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
          <Icon className={`w-3 h-3 text-${color}-400`} /> {label}
        </span>
        <span>{value}</span>
      </div>
      <Progress value={percentage} className={`h-1 bg-white/5`} />
    </div>
  );
}
