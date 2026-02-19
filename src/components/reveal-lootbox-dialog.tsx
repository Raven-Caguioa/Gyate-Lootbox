
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Store, Sparkles, Wand2, RefreshCw } from "lucide-react";
import { NFTCard } from "./nft-card";
import { MOCK_USER_NFTS } from "@/lib/mock-data";

interface RevealLootboxDialogProps {
  box: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevealLootboxDialog({ box, open, onOpenChange }: RevealLootboxDialogProps) {
  const [step, setStep] = useState<"ready" | "animating" | "result">("ready");
  const [revealedNft, setRevealedNft] = useState<any>(null);

  useEffect(() => {
    if (!open) {
      setStep("ready");
      setRevealedNft(null);
    }
  }, [open]);

  const handleOpen = () => {
    setStep("animating");
    setTimeout(() => {
      // Simulate random selection
      const randomNft = MOCK_USER_NFTS[Math.floor(Math.random() * MOCK_USER_NFTS.length)];
      setRevealedNft(randomNft);
      setStep("result");
    }, 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-transparent border-none shadow-none flex items-center justify-center p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Lootbox Reveal</DialogTitle>
          <DialogDescription>
            The process of opening a {box?.name || 'lootbox'} to reveal a new hero character on-chain.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full flex flex-col items-center justify-center text-center space-y-8">
          
          {step === "ready" && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-300">
              <div className="w-48 h-48 rounded-full bg-primary/20 flex items-center justify-center mx-auto border-2 border-primary/40 glow-purple animate-pulse">
                <Store className="w-24 h-24 text-white" />
              </div>
              <div className="space-y-4">
                <h2 className="font-headline text-3xl font-bold">Ready to open?</h2>
                <p className="text-muted-foreground">{box?.name} summon initiated.</p>
                <Button 
                  size="lg" 
                  className="w-full h-14 text-lg font-bold glow-purple bg-primary"
                  onClick={handleOpen}
                >
                  Confirm Summon
                </Button>
              </div>
            </div>
          )}

          {step === "animating" && (
            <div className="space-y-8">
              <div className="relative">
                <div className="w-48 h-48 rounded-full border-4 border-dashed border-accent animate-spin-slow" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Wand2 className="w-16 h-16 text-accent animate-bounce" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="font-headline text-3xl font-bold animate-pulse">Summoning Hero...</h2>
                <p className="text-muted-foreground flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  Consulting On-Chain Oracle
                  <Sparkles className="w-4 h-4 text-accent" />
                </p>
              </div>
            </div>
          )}

          {step === "result" && revealedNft && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500 flex flex-col items-center">
              <div className="space-y-2">
                <h2 className="font-headline text-4xl font-bold">Summon Successful!</h2>
                <p className="text-muted-foreground">You have received a new hero.</p>
              </div>
              
              <div className="glow-purple rounded-3xl overflow-hidden scale-110">
                <NFTCard nft={revealedNft} className="w-72" />
              </div>

              <div className="flex gap-4 w-full pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 border-white/10"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button 
                  className="flex-1 h-12 bg-accent hover:bg-accent/80 font-bold"
                  onClick={handleOpen}
                >
                  Open Another
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
