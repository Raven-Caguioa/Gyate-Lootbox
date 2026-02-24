"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Package, ShieldCheck, Trophy, Coins, Sparkles, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

import { useAdminData } from "./_hooks/use-admin-data";
import { LootboxFactoryTab }         from "./_components/lootbox-factory-tab";
import { LiveProtocolsTab }          from "./_components/live-protocols-tab";
import { VariantLabTab }             from "./_components/variant-lab-tab";
import { AchievementsTab }           from "./_components/achievements-tab";
import { TreasuryTab, MarketplaceTab } from "./_components/treasury-marketplace-tabs";

export default function AdminPage() {
  const {
    myLootboxes, liveBoxes, draftBoxes,
    achievements, treasuryStats,
    policyExists, isCheckingPolicy,
    isLoadingBoxes, isLoadingAchievements, isFetchingTreasury,
    fetchLootboxes, fetchAchievements, fetchTreasuryData, checkPolicy, syncAll,
    fetchFullBoxData,
  } = useAdminData();

  const isSyncing = isLoadingBoxes || isFetchingTreasury || isLoadingAchievements;

  return (
    <div className="min-h-screen gradient-bg pb-20">
      <Navigation />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h1 className="font-headline text-5xl font-bold mb-4 tracking-tight">Protocol Admin</h1>
              <p className="text-muted-foreground text-lg">Manage lootboxes, variants, and the $GYATE economy.</p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={syncAll}
              disabled={isSyncing}
              className="bg-white/5 border-white/10"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
              Sync All
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="live" className="space-y-8">
            <TabsList className="bg-white/5 border border-white/10 p-1 h-14 overflow-x-auto whitespace-nowrap">
              <TabsTrigger value="live"        className="px-6 h-full data-[state=active]:bg-primary">
                <Activity className="w-4 h-4 mr-2" /> Live Protocols
                {liveBoxes.length > 0 && (
                  <span className="ml-2 text-[10px] bg-green-500/20 text-green-400 rounded-full px-1.5 font-bold">
                    {liveBoxes.filter(b => b.isActive).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="lootbox"     className="px-6 h-full data-[state=active]:bg-primary">
                <Package className="w-4 h-4 mr-2" /> Lootbox Factory
              </TabsTrigger>
              <TabsTrigger value="variants"    className="px-6 h-full data-[state=active]:bg-primary">
                <Sparkles className="w-4 h-4 mr-2" /> Variant Lab
              </TabsTrigger>
              <TabsTrigger value="achievements" className="px-6 h-full data-[state=active]:bg-primary">
                <Trophy className="w-4 h-4 mr-2" /> Achievements
              </TabsTrigger>
              <TabsTrigger value="treasury"    className="px-6 h-full data-[state=active]:bg-primary">
                <Coins className="w-4 h-4 mr-2" /> Treasury
              </TabsTrigger>
              <TabsTrigger value="marketplace" className="px-6 h-full data-[state=active]:bg-primary">
                <ShieldCheck className="w-4 h-4 mr-2" /> Marketplace
              </TabsTrigger>
            </TabsList>

            <TabsContent value="live">
              <LiveProtocolsTab
                liveBoxes={liveBoxes}
                isLoadingBoxes={isLoadingBoxes}
                fetchLootboxes={fetchLootboxes}
                fetchFullBoxData={fetchFullBoxData}
              />
            </TabsContent>

            <TabsContent value="lootbox">
              <LootboxFactoryTab
                draftBoxes={draftBoxes}
                fetchLootboxes={fetchLootboxes}
                fetchFullBoxData={fetchFullBoxData}
              />
            </TabsContent>

            <TabsContent value="variants">
              <VariantLabTab
                draftBoxes={draftBoxes}
                fetchFullBoxData={fetchFullBoxData}
              />
            </TabsContent>

            <TabsContent value="achievements">
              <AchievementsTab
                achievements={achievements}
                isLoadingAchievements={isLoadingAchievements}
                fetchAchievements={fetchAchievements}
              />
            </TabsContent>

            <TabsContent value="treasury">
              <TreasuryTab
                treasuryStats={treasuryStats}
                isFetchingTreasury={isFetchingTreasury}
                fetchTreasuryData={fetchTreasuryData}
              />
            </TabsContent>

            <TabsContent value="marketplace">
              <MarketplaceTab
                policyExists={policyExists}
                isCheckingPolicy={isCheckingPolicy}
                checkPolicy={checkPolicy}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}