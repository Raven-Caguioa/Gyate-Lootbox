
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, RefreshCw } from "lucide-react";
import { NFTCard } from "./nft-card";
import { MOCK_USER_NFTS } from "@/lib/mock-data";

interface RevealLootboxDialogProps {
  box: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevealLootboxDialog({ box, open, onOpenChange }: RevealLootboxDialogProps) {
  // We start directly at animating since this dialog is only opened after a successful transaction
  const [step, setStep] = useState<"animating" | "result">("animating");
  const [revealedNft, setRevealedNft] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setStep("animating");
      setRevealedNft(null);
      // Simulate summoning delay to show the animation
      const timer = setTimeout(() => {
        const randomNft = MOCK_USER_NFTS[Math.floor(Math.random() * MOCK_USER_NFTS.length)];
        setRevealedNft(randomNft);
        setStep("result");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-transparent border-none shadow-none flex items-center justify-center p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Lootbox Reveal</DialogTitle>
          <DialogDescription>
            Summoning process to reveal your new hero character.
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

          {step === "result" && revealedNft && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500 flex flex-col items-center">
              <div className="space-y-2">
                <h2 className="font-headline text-4xl font-bold text-white">Summon Successful!</h2>
                <p className="text-muted-foreground">You have received a new hero.</p>
              </div>
              
              <div className="glow-purple rounded-3xl overflow-hidden scale-110">
                <NFTCard nft={revealedNft} className="w-72" />
              </div>

              <div className="flex gap-4 w-full pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 border-white/10 text-white bg-white/5 hover:bg-white/10"
                  onClick={() => onOpenChange(false)}
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
