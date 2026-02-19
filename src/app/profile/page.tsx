
"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Wallet, UserCircle, RefreshCw, Zap, Flame, Package, Sparkles, Loader2, Info } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface PlayerStatsData {
  id: string;
  total_opens: string;
  total_burns: string;
  total_gyate_spent: string;
  rarity_mints: string[];
  claimed_ids: string[];
}

interface UserBadge {
  id: string;
  achievement_id: string;
  name: string;
  imageUrl: string;
  earnedAt: string;
}

export default function ProfilePage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const [stats, setStats] = useState<PlayerStatsData | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const fetchProfileData = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      // 1. Fetch PlayerStats
      const statsObjects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::PlayerStats` },
        options: { showContent: true }
      });

      if (statsObjects.data.length > 0) {
        const fields = (statsObjects.data[0].data?.content as any)?.fields;
        setStats({
          id: statsObjects.data[0].data?.objectId || "",
          total_opens: fields.total_opens,
          total_burns: fields.total_burns,
          total_gyate_spent: fields.total_gyate_spent,
          rarity_mints: fields.rarity_mints,
          claimed_ids: fields.claimed_ids,
        });
      }

      // 2. Fetch Badges
      const badgeObjects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::AchievementBadge` },
        options: { showContent: true }
      });

      const mappedBadges = badgeObjects.data.map((obj: any) => {
        const fields = obj.data?.content?.fields;
        return {
          id: obj.data?.objectId,
          achievement_id: fields.achievement_id,
          name: fields.achievement_name,
          imageUrl: fields.badge_image_url,
          earnedAt: fields.earned_at,
        };
      });
      setBadges(mappedBadges);

    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [account, suiClient]);

  const handleInitializeStats = async () => {
    if (!account) return;
    setIsInitializing(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::${FUNCTIONS.INITIALIZE_STATS}`,
      arguments: [],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Profile Initialized", description: "Your on-chain progress tracking is now active." });
        setIsInitializing(false);
        setTimeout(fetchProfileData, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Initialization Failed", description: err.message });
        setIsInitializing(false);
      }
    });
  };

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  if (!account) {
    return (
      <div className="min-h-screen gradient-bg">
        <Navigation />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto space-y-6 glass-card p-12 rounded-3xl border-primary/20">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Wallet className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-headline">Connect Wallet</h1>
            <p className="text-muted-foreground">Please connect your Sui wallet to view your profile and achievements.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-purple">
                <UserCircle className="w-12 h-12 text-white" />
              </div>
              <div>
                <h1 className="font-headline text-4xl font-bold">Player Profile</h1>
                <p className="text-muted-foreground font-mono text-sm">{account.address.slice(0, 10)}...{account.address.slice(-6)}</p>
              </div>
            </div>
            <Button variant="outline" onClick={fetchProfileData} disabled={isLoading} className="bg-white/5 border-white/10">
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
              Sync Data
            </Button>
          </div>

          {!stats ? (
            <Card className="glass-card border-accent/40 overflow-hidden">
              <CardContent className="p-12 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <Info className="w-8 h-8 text-accent" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold font-headline">Setup Required</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    To track your on-chain summons, burns, and unlock rewards, you need to initialize your player stats object.
                  </p>
                </div>
                <Button 
                  size="lg" 
                  onClick={handleInitializeStats} 
                  disabled={isInitializing}
                  className="glow-violet bg-accent hover:bg-accent/80 font-bold px-8"
                >
                  {isInitializing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Initialize Player Stats
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-[1fr_400px] gap-8">
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Package} label="Total Summons" value={stats.total_opens} />
                  <StatCard icon={Flame} label="NFTs Burned" value={stats.total_burns} />
                  <StatCard icon={Zap} label="$GYATE Spent" value={stats.total_gyate_spent} />
                  <StatCard icon={Trophy} label="Badges" value={badges.length.toString()} />
                </div>

                <Card className="glass-card border-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" /> Rarity Distribution
                    </CardTitle>
                    <CardDescription>Breakdown of all heroes minted per tier</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4">
                       <RarityProgress label="Legend Rare" count={stats.rarity_mints[5]} color="bg-red-500" />
                       <RarityProgress label="Ultra Rare" count={stats.rarity_mints[4]} color="bg-yellow-400" />
                       <RarityProgress label="SSR" count={stats.rarity_mints[3]} color="bg-pink-400" />
                       <RarityProgress label="Super Rare" count={stats.rarity_mints[2]} color="bg-purple-400" />
                       <RarityProgress label="Rare" count={stats.rarity_mints[1]} color="bg-blue-400" />
                       <RarityProgress label="Common" count={stats.rarity_mints[0]} color="bg-slate-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <h3 className="font-headline text-xl font-bold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-accent" /> Soulbound Badges
                </h3>
                <div className="grid gap-4">
                  {badges.length > 0 ? (
                    badges.map((badge) => (
                      <Card key={badge.id} className="bg-white/5 border-white/5 overflow-hidden group hover:border-accent/30 transition-colors">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-accent/20 bg-black/40 p-1">
                            {badge.imageUrl ? (
                              <Image src={badge.imageUrl} alt={badge.name} fill className="object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Trophy className="w-6 h-6 text-accent/50" /></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm truncate">{badge.name}</h4>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Earned in Epoch {badge.earnedAt}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 glass-card rounded-2xl border-dashed border-white/10">
                      <p className="text-sm text-muted-foreground">No badges earned yet.</p>
                      <Button variant="link" asChild className="text-accent text-xs mt-2">
                        <a href="/shop">Go Summon Heroes</a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <Card className="bg-white/5 border-white/5 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-bold font-headline">{value}</div>
    </Card>
  );
}

function RarityProgress({ label, count, color }: { label: string, count: string, color: string }) {
  const num = parseInt(count || "0");
  const max = 100; 
  const progress = Math.min((num / max) * 100, 100);
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-bold">
        <span className="text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-foreground">{num}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${num > 0 ? Math.max(progress, 2) : 0}%` }} />
      </div>
    </div>
  );
}
