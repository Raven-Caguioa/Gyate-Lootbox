
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2 } from "lucide-react";
import { NFTCard } from "./nft-card";
import { NFT } from "@/lib/mock-data";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";

interface RevealLootboxDialogProps {
  box: any;
  results: NFT[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevealLootboxDialog({ box, results, open, onOpenChange }: RevealLootboxDialogProps) {
  const [step, setStep] = useState<"animating" | "result">("animating");

  useEffect(() => {
    if (open) {
      setStep("animating");
      // Short dramatic delay before revealing actual results
      const timer = setTimeout(() => {
        setStep("result");
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[95vh] bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl flex flex-col items-center justify-center p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Lootbox Reveal</DialogTitle>
          <DialogDescription>
            Summoning process to reveal your new hero characters.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
          
          {step === "animating" && (
            <div className="flex flex-col items-center space-y-8 animate-in fade-in zoom-in duration-500">
              <div className="relative">
                <div className="w-48 h-48 rounded-full border-4 border-dashed border-accent animate-spin-slow" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Wand2 className="w-16 h-16 text-accent animate-bounce" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="font-headline text-3xl font-bold animate-pulse text-white">Summoning Hero...</h2>
                <p className="text-muted-foreground flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  Consulting On-Chain Oracle
                  <Sparkles className="w-4 h-4 text-accent" />
                </p>
              </div>
            </div>
          )}

          {step === "result" && results.length > 0 && (
            <div className="flex flex-col items-center w-full h-full max-h-full space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="space-y-1">
                <h2 className="font-headline text-4xl font-bold text-white tracking-tight">Summon Successful!</h2>
                <p className="text-muted-foreground text-sm">
                  {results.length === 1 
                    ? `You have received ${results[0].name}.` 
                    : `You have received ${results.length} new heroes.`}
                </p>
              </div>
              
              <ScrollArea className="w-full flex-1 min-h-0 px-4">
                <div className={cn(
                  "grid gap-6 justify-items-center py-6",
                  results.length === 1 
                    ? "grid-cols-1" 
                    : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                )}>
                  {results.map((nft) => (
                    <div key={nft.id} className="glow-purple rounded-2xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
                      <NFTCard nft={nft} className="w-36 sm:w-44" />
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="w-full max-w-xs pt-2">
                <Button 
                  className="w-full h-12 glow-purple bg-primary font-bold text-white text-md"
                  onClick={() => onOpenChange(false)}
                >
                  Confirm & Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
