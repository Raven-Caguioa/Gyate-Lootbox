"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { MOCK_USER_NFTS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Search, Filter, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";

export default function InventoryPage() {
  const [selectedNft, setSelectedNft] = useState<any>(null);

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="font-headline text-4xl font-bold mb-2">Inventory</h1>
            <p className="text-muted-foreground">Manage your GyateGyate collection and prepare for battle.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search NFTs..." className="pl-10 bg-white/5 border-white/10" />
            </div>
            <Button variant="outline" size="icon" className="border-white/10"><Filter className="w-4 h-4" /></Button>
            <Tabs defaultValue="grid" className="hidden sm:block">
              <TabsList className="bg-white/5 border-white/10">
                <TabsTrigger value="grid" className="data-[state=active]:bg-primary"><LayoutGrid className="w-4 h-4" /></TabsTrigger>
                <TabsTrigger value="list" className="data-[state=active]:bg-primary"><List className="w-4 h-4" /></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {MOCK_USER_NFTS.length === 0 ? (
          <div className="py-32 text-center glass-card rounded-3xl">
            <div className="max-w-xs mx-auto space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                <LayoutGrid className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold font-headline">No NFTs Found</h2>
              <p className="text-sm text-muted-foreground">Your collection is empty. Head over to the shop to open your first lootbox!</p>
              <Button asChild className="glow-purple">
                <a href="/shop">Go to Shop</a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {MOCK_USER_NFTS.map((nft) => (
              <NFTCard 
                key={nft.id} 
                nft={nft} 
                onClick={() => setSelectedNft(nft)}
              />
            ))}
          </div>
        )}
      </div>

      <NFTDetailDialog 
        nft={selectedNft} 
        open={!!selectedNft} 
        onOpenChange={(open) => !open && setSelectedNft(null)} 
      />
    </div>
  );
}
