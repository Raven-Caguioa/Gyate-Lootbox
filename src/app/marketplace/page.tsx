"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { MOCK_MARKETPLACE } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Search, Filter, TrendingUp, History, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";

export default function MarketplacePage() {
  const [selectedNft, setSelectedNft] = useState<any>(null);

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
          <div className="flex-1">
            <h1 className="font-headline text-5xl font-bold mb-4">Marketplace</h1>
            <p className="text-muted-foreground text-lg">
              The premier destination for GyateGyate character trading. <span className="text-accent font-bold">10% Platform Fee</span> applies to all sales.
            </p>
          </div>
          
          <div className="flex gap-4 items-center">
            <Card className="glass-card border-primary/20 py-2 px-4 flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">24h Volume</span>
                <span className="font-bold">1,420 SUI</span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Floor Price</span>
                <span className="font-bold">0.45 SUI</span>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          {/* Filters Sidebar */}
          <aside className="space-y-8 hidden lg:block">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Search className="w-3 h-3" /> Search
              </h3>
              <Input placeholder="Search name or ID..." className="bg-white/5 border-white/10" />
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Filter className="w-3 h-3" /> Rarity
              </h3>
              <div className="grid gap-2">
                {["Common", "Rare", "Super Rare", "SSR", "Ultra Rare", "Legend Rare"].map((rarity) => (
                  <label key={rarity} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                    <div className="w-4 h-4 rounded border border-white/20 group-hover:border-primary transition-colors" />
                    <span className="text-sm font-medium">{rarity}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <CreditCard className="w-3 h-3" /> Price Range
              </h3>
              <div className="flex items-center gap-2">
                <Input placeholder="Min" className="bg-white/5 border-white/10" />
                <span className="text-muted-foreground">to</span>
                <Input placeholder="Max" className="bg-white/5 border-white/10" />
              </div>
            </div>

            <Button className="w-full bg-primary/20 hover:bg-primary/40 border-primary/30 text-primary font-bold">
              Apply Filters
            </Button>
          </aside>

          {/* Listings Grid */}
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex gap-2">
                <Badge className="bg-primary px-3 py-1">New Listings</Badge>
                <Badge variant="outline" className="border-white/10 px-3 py-1 hover:bg-white/5 cursor-pointer">Lowest Price</Badge>
                <Badge variant="outline" className="border-white/10 px-3 py-1 hover:bg-white/5 cursor-pointer">Highest Rarity</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing <span className="text-foreground font-bold">{MOCK_MARKETPLACE.length}</span> results
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {MOCK_MARKETPLACE.map((nft) => (
                <NFTCard 
                  key={nft.id} 
                  nft={nft} 
                  showPrice={true}
                  onClick={() => setSelectedNft(nft)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <NFTDetailDialog 
        nft={selectedNft} 
        open={!!selectedNft} 
        onOpenChange={(open) => !open && setSelectedNft(null)} 
      />
    </div>
  );
}
