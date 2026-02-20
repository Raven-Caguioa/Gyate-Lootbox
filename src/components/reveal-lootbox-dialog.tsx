
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, RefreshCw } from "lucide-react";
import { NFTCard } from "./nft-card";
import { NFT } from "@/lib/mock-data";
import { ScrollArea } from "./ui/scroll-area";

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
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] bg-transparent border-none shadow-none flex items-center justify-center p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Lootbox Reveal</DialogTitle>
          <DialogDescription>
            Summoning process to reveal your new hero characters.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full flex flex-col items-center justify-center text-center space-y-8">
          
          {step === "animating" && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500">
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
            <div className="space-y-8 animate-in fade-in zoom-in duration-500 flex flex-col items-center w-full">
              <div className="space-y-2">
                <h2 className="font-headline text-4xl font-bold text-white">Summon Successful!</h2>
                <p className="text-muted-foreground">
                  {results.length === 1 
                    ? `You have received ${results[0].name}.` 
                    : `You have received ${results.length} new heroes.`}
                </p>
              </div>
              
              <ScrollArea className="w-full max-h-[60vh] px-4">
                <div className={cn(
                  "grid gap-6 justify-items-center py-6",
                  results.length === 1 
                    ? "grid-cols-1" 
                    : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
                )}>
                  {results.map((nft) => (
                    <div key={nft.id} className="glow-purple rounded-3xl overflow-hidden transform hover:scale-105 transition-transform duration-300">
                      <NFTCard nft={nft} className="w-48 sm:w-56" />
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-4 w-full max-w-xs pt-4">
                <Button 
                  className="flex-1 h-12 glow-purple bg-primary font-bold text-white"
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

// Helper for cn in this file if needed, or import it
import { cn } from "@/lib/utils";
