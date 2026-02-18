"use client";

import Image from "next/image";
import { NFT, RARITY_LABELS, RARITY_COLORS } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sword, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface NFTCardProps {
  nft: NFT;
  className?: string;
  onClick?: () => void;
  showPrice?: boolean;
}

export function NFTCard({ nft, className, onClick, showPrice }: NFTCardProps) {
  return (
    <Card 
      className={cn(
        "group overflow-hidden glass-card transition-all hover:scale-[1.02] cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={nft.image}
          alt={nft.name}
          fill
          className="object-cover transition-transform group-hover:scale-110"
          data-ai-hint="fantasy character"
        />
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge variant="secondary" className="bg-black/40 backdrop-blur-sm border-white/10 text-[10px]">
            #{nft.globalId}
          </Badge>
          {nft.variantType !== "Normal" && (
            <Badge className="bg-accent/80 hover:bg-accent text-[10px]">
              {nft.variantType}
            </Badge>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
          <div className="flex w-full justify-between items-center text-xs">
            <div className="flex items-center gap-1"><Sword className="w-3 h-3 text-red-400" /> {nft.atk}</div>
            <div className="flex items-center gap-1"><Shield className="w-3 h-3 text-blue-400" /> {nft.hp}</div>
            <div className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" /> {nft.spd}</div>
          </div>
        </div>
      </div>
      <CardContent className="p-4 bg-card/40">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-headline font-bold text-sm truncate">{nft.name}</h3>
        </div>
        <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-2", RARITY_COLORS[nft.rarity])}>
          {RARITY_LABELS[nft.rarity]}
        </p>
        
        {showPrice && nft.price && (
          <div className="pt-2 border-t border-white/5 flex justify-between items-center">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Price</span>
            <span className="text-sm font-bold text-accent">{nft.price} SUI</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
