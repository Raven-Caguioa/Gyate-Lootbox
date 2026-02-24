"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, OBJECT_IDS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy, Wallet, UserCircle, RefreshCw, Zap, Flame, Package,
  Sparkles, Loader2, Info, CheckCircle2, Lock, Star, Sword,
  CoinsIcon, ArrowDownToLine, TrendingUp, ShoppingBag, CircleDollarSign
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { cn } from "@/lib/utils";
import Image from "next/image";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PlayerStatsData {
  id: string;
  total_opens: string;
  total_burns: string;
  total_gyate_spent: string;
  rarity_mints: string[];
}

interface UserBadge {
  id: string;
  achievement_id: string;
  name: string;
  imageUrl: string;
  earnedAt: string;
}

interface AchievementDef {
  id: string;
  name: string;
  description: string;
  badge_image_url: string;
  gyate_reward: string;
  requirement_type: string;
  requirement_value: string;
  requirement_rarity: string;
  enabled: boolean;
}

interface KioskEarnings {
  kioskId: string;
  kioskCapId: string;
  profitsMist: bigint;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const REQ_OPEN_COUNT        = "0";
const REQ_BURN_COUNT        = "1";
const REQ_RARITY_MINT_COUNT = "2";
const REQ_GYATE_SPENT       = "3";
const REQ_ADMIN_GRANTED     = "4";

const RARITY_LABELS = ["Common", "Rare", "Super Rare", "SSR", "Ultra Rare", "Legend Rare"];

function mistToSui(mist: bigint): string {
  const sui = Number(mist) / 1_000_000_000;
  return sui.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

// ─────────────────────────────────────────────
// Achievement helpers
// ─────────────────────────────────────────────

function getProgress(ach: AchievementDef, stats: PlayerStatsData): { current: number; required: number; pct: number } {
  const required = parseInt(ach.requirement_value || "0");
  let current = 0;
  switch (ach.requirement_type) {
    case REQ_OPEN_COUNT:        current = parseInt(stats.total_opens || "0"); break;
    case REQ_BURN_COUNT:        current = parseInt(stats.total_burns || "0"); break;
    case REQ_GYATE_SPENT:       current = parseInt(stats.total_gyate_spent || "0"); break;
    case REQ_RARITY_MINT_COUNT: {
      const idx = parseInt(ach.requirement_rarity || "0");
      current = parseInt(stats.rarity_mints?.[idx] || "0");
      break;
    }
    case REQ_ADMIN_GRANTED:
    default: return { current: 0, required: 0, pct: 0 };
  }
  const pct = required > 0 ? Math.min((current / required) * 100, 100) : 0;
  return { current, required, pct };
}

function getRequirementLabel(ach: AchievementDef): string {
  const val = parseInt(ach.requirement_value || "0");
  switch (ach.requirement_type) {
    case REQ_OPEN_COUNT:        return `Open ${val} lootbox${val !== 1 ? "es" : ""}`;
    case REQ_BURN_COUNT:        return `Burn ${val} NFT${val !== 1 ? "s" : ""}`;
    case REQ_GYATE_SPENT:       return `Spend ${val} $GYATE on lootboxes`;
    case REQ_RARITY_MINT_COUNT: {
      const rarity = RARITY_LABELS[parseInt(ach.requirement_rarity || "0")] ?? "Unknown";
      return `Mint ${val} ${rarity} NFT${val !== 1 ? "s" : ""}`;
    }
    case REQ_ADMIN_GRANTED: return "Granted by admin";
    default:                return "Unknown requirement";
  }
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function ProfilePage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"stats" | "achievements" | "earnings">("stats");

  const [stats, setStats]               = useState<PlayerStatsData | null>(null);
  const [badges, setBadges]             = useState<UserBadge[]>([]);
  const [achievements, setAchievements] = useState<AchievementDef[]>([]);
  const [earnings, setEarnings]         = useState<KioskEarnings | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [claimingId, setClaimingId]     = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // ── Fetch all data ──────────────────────────────────────────────────
  const fetchProfileData = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      // 1. PlayerStats
      const statsObjects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::PlayerStats` },
        options: { showContent: true },
      });

      let fetchedStats: PlayerStatsData | null = null;
      if (statsObjects.data.length > 0) {
        const fields = (statsObjects.data[0].data?.content as any)?.fields;
        fetchedStats = {
          id:                statsObjects.data[0].data?.objectId || "",
          total_opens:       fields.total_opens,
          total_burns:       fields.total_burns,
          total_gyate_spent: fields.total_gyate_spent,
          rarity_mints:      fields.rarity_mints,
          // FIX: claimed_ids is now a Table<u64, bool> — not readable as a plain array.
          // We derive claimed status from owned AchievementBadge objects instead (see below).
        };
        setStats(fetchedStats);
      }

      // 2. Badges — FIX: this is now the ONLY source of truth for claimed achievement IDs.
      // claimed_ids in PlayerStats changed from vector<u64> to Table<u64, bool>.
      // Tables serialize as { fields: { id: {...}, size: "N" } } — not iterable from the frontend.
      // Reading which achievements are claimed is done by checking what AchievementBadge
      // objects the player actually owns in their wallet.
      const badgeObjects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::AchievementBadge` },
        options: { showContent: true },
      });
      const fetchedBadges: UserBadge[] = badgeObjects.data.map((obj: any) => {
        const f = obj.data?.content?.fields;
        return {
          id:             obj.data?.objectId,
          achievement_id: String(f.achievement_id),
          name:           f.achievement_name,
          imageUrl:       f.badge_image_url,
          earnedAt:       f.earned_at,
        };
      });
      setBadges(fetchedBadges);

      // 3. AchievementRegistry
      if (OBJECT_IDS?.ACHIEVEMENT_REGISTRY) {
        const regObj = await suiClient.getObject({
          id: OBJECT_IDS.ACHIEVEMENT_REGISTRY,
          options: { showContent: true },
        });
        const regFields = (regObj.data?.content as any)?.fields;

        // FIX: achievements is now a Table<u64, AchievementDef>.
        // Tables are not inlined in getObject content — dynamic fields must be paginated.
        // We read achievement_ids (the ordered vector) to get IDs, then fetch each one
        // as a dynamic field from the table.
        const achievementIds: string[] = regFields?.achievement_ids ?? [];

        if (achievementIds.length > 0) {
          const tableId = regFields?.achievements?.fields?.id?.id;
          if (tableId) {
            // Fetch all dynamic fields of the Table (each is one AchievementDef)
            let allDynFields: any[] = [];
            let cursor: string | null | undefined = undefined;
            do {
              const page = await suiClient.getDynamicFields({
                parentId: tableId,
                cursor: cursor ?? undefined,
                limit: 50,
              });
              allDynFields = [...allDynFields, ...page.data];
              cursor = page.hasNextPage ? page.nextCursor : null;
            } while (cursor);

            // Fetch each AchievementDef object
            if (allDynFields.length > 0) {
              const defObjects = await suiClient.multiGetObjects({
                ids: allDynFields.map(f => f.objectId),
                options: { showContent: true },
              });

              const parsed: AchievementDef[] = defObjects
                .map((obj: any) => {
                  const f = obj.data?.content?.fields?.value?.fields ?? obj.data?.content?.fields;
                  if (!f || !f.enabled) return null;
                  return {
                    id:                 String(f.id),
                    name:               f.name,
                    description:        f.description,
                    badge_image_url:    f.badge_image_url,
                    gyate_reward:       f.gyate_reward,
                    requirement_type:   String(f.requirement_type),
                    requirement_value:  f.requirement_value,
                    requirement_rarity: String(f.requirement_rarity),
                    enabled:            f.enabled,
                  } as AchievementDef;
                })
                .filter((a): a is AchievementDef => a !== null);

              setAchievements(parsed);
            }
          }
        }
      }

      // 4. Kiosk earnings
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });

      if (capsRes.data.length > 0) {
        const kioskCapId = capsRes.data[0].data?.objectId!;
        const kioskId    = (capsRes.data[0].data?.content as any)?.fields?.for;

        if (kioskId) {
          const kioskObj = await suiClient.getObject({
            id: kioskId,
            options: { showContent: true },
          });

          const kioskFields = (kioskObj.data?.content as any)?.fields;
          const rawProfits = kioskFields?.profits?.fields?.value
            ?? kioskFields?.profits
            ?? "0";

          setEarnings({
            kioskId,
            kioskCapId,
            profitsMist: BigInt(rawProfits.toString()),
          });
        }
      }

    } catch (err) {
      console.error("Profile fetch error:", err);
      toast({ variant: "destructive", title: "Fetch Error", description: "Could not load profile data." });
    } finally {
      setIsLoading(false);
    }
  }, [account, suiClient, toast]);

  // ── Initialize stats ────────────────────────────────────────────────
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
        toast({ title: "Profile Initialized!", description: "Your on-chain progress tracking is now active." });
        setIsInitializing(false);
        setTimeout(fetchProfileData, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Initialization Failed", description: err.message });
        setIsInitializing(false);
      },
    });
  };

  // ── Claim achievement ───────────────────────────────────────────────
  const handleClaim = async (achievementId: string) => {
    if (!account || !stats) return;
    setClaimingId(achievementId);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::${FUNCTIONS.CLAIM_ACHIEVEMENT}`,
      arguments: [
        txb.object(OBJECT_IDS.ACHIEVEMENT_REGISTRY),
        txb.object(stats.id),
        txb.pure.u64(parseInt(achievementId)),
        txb.object(OBJECT_IDS.TREASURY_CAP),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "🏆 Achievement Claimed!", description: "Badge and GYATE reward sent to your wallet." });
        setClaimingId(null);
        setTimeout(fetchProfileData, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Claim Failed", description: err.message });
        setClaimingId(null);
      },
    });
  };

  // ── Withdraw kiosk earnings ─────────────────────────────────────────
  const handleWithdrawEarnings = async () => {
    if (!account || !earnings || earnings.profitsMist <= 0n) return;
    setIsWithdrawing(true);

    try {
      const txb = new Transaction();

      const [profitCoin] = txb.moveCall({
        target: "0x2::kiosk::withdraw",
        arguments: [
          txb.object(earnings.kioskId),
          txb.object(earnings.kioskCapId),
          txb.pure.option("u64", null),
        ],
      });

      txb.transferObjects([profitCoin], account.address);

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({
            title: "💰 Earnings Withdrawn!",
            description: `${mistToSui(earnings.profitsMist)} SUI sent to your wallet.`,
          });
          setIsWithdrawing(false);
          setTimeout(fetchProfileData, 3000);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Withdrawal Failed", description: err.message });
          setIsWithdrawing(false);
        },
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
      setIsWithdrawing(false);
    }
  };

  useEffect(() => { fetchProfileData(); }, [fetchProfileData]);

  // ── Not connected ───────────────────────────────────────────────────
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

  // ── Main render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-purple">
                <UserCircle className="w-12 h-12 text-white" />
              </div>
              <div>
                <h1 className="font-headline text-4xl font-bold">Player Profile</h1>
                <p className="text-muted-foreground font-mono text-sm">
                  {account.address.slice(0, 10)}...{account.address.slice(-6)}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={fetchProfileData}
              disabled={isLoading}
              className="bg-white/5 border-white/10"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
              {isLoading ? "Syncing..." : "Sync Data"}
            </Button>
          </div>

          {/* No stats yet */}
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
                  {isInitializing
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <Sparkles className="w-4 h-4 mr-2" />}
                  Initialize Player Stats
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Tab switcher */}
              <div className="flex gap-2 border-b border-white/10">
                <TabButton active={activeTab === "stats"} onClick={() => setActiveTab("stats")}>
                  <UserCircle className="w-4 h-4" /> Overview
                </TabButton>

                <TabButton active={activeTab === "achievements"} onClick={() => setActiveTab("achievements")}>
                  <Trophy className="w-4 h-4" />
                  Achievements
                  {achievements.filter(a =>
                    !badges.some(b => b.achievement_id === String(a.id)) &&
                    a.requirement_type !== REQ_ADMIN_GRANTED &&
                    getProgress(a, stats).pct >= 100
                  ).length > 0 && (
                    <span className="ml-1 text-[10px] bg-yellow-400/20 text-yellow-400 rounded-full px-1.5 py-0.5 font-bold">
                      {achievements.filter(a =>
                        !badges.some(b => b.achievement_id === String(a.id)) &&
                        a.requirement_type !== REQ_ADMIN_GRANTED &&
                        getProgress(a, stats).pct >= 100
                      ).length} ready
                    </span>
                  )}
                </TabButton>

                <TabButton active={activeTab === "earnings"} onClick={() => setActiveTab("earnings")}>
                  <CoinsIcon className="w-4 h-4" />
                  Earnings
                  {earnings && earnings.profitsMist > 0n && (
                    <span className="ml-1 text-[10px] bg-green-400/20 text-green-400 rounded-full px-1.5 py-0.5 font-bold">
                      {mistToSui(earnings.profitsMist)} SUI
                    </span>
                  )}
                </TabButton>
              </div>

              {/* ── STATS TAB ── */}
              {activeTab === "stats" && (
                <div className="grid lg:grid-cols-[1fr_400px] gap-8">
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard icon={Package} label="Total Summons"  value={stats.total_opens} />
                      <StatCard icon={Flame}   label="NFTs Burned"    value={stats.total_burns} />
                      <StatCard icon={Zap}     label="$GYATE Spent"   value={stats.total_gyate_spent} />
                      <StatCard icon={Trophy}  label="Badges"         value={badges.length.toString()} />
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
                          <RarityProgress label="Ultra Rare"  count={stats.rarity_mints[4]} color="bg-yellow-400" />
                          <RarityProgress label="SSR"         count={stats.rarity_mints[3]} color="bg-pink-400" />
                          <RarityProgress label="Super Rare"  count={stats.rarity_mints[2]} color="bg-purple-400" />
                          <RarityProgress label="Rare"        count={stats.rarity_mints[1]} color="bg-blue-400" />
                          <RarityProgress label="Common"      count={stats.rarity_mints[0]} color="bg-slate-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Badges sidebar */}
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
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Trophy className="w-6 h-6 text-accent/50" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm truncate">{badge.name}</h4>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                  Earned in Epoch {badge.earnedAt}
                                </p>
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

              {/* ── ACHIEVEMENTS TAB ── */}
              {activeTab === "achievements" && (
                <AchievementsTab
                  achievements={achievements}
                  stats={stats}
                  // FIX: pass owned badges instead of claimed_ids from stats,
                  // since claimed_ids is now a Table and not readable as an array
                  claimedAchievementIds={new Set(badges.map(b => b.achievement_id))}
                  claimingId={claimingId}
                  onClaim={handleClaim}
                  onRefresh={fetchProfileData}
                  isLoading={isLoading}
                />
              )}

              {/* ── EARNINGS TAB ── */}
              {activeTab === "earnings" && (
                <EarningsTab
                  earnings={earnings}
                  isLoading={isLoading}
                  isWithdrawing={isWithdrawing}
                  onWithdraw={handleWithdrawEarnings}
                  onRefresh={fetchProfileData}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Earnings Tab
// ─────────────────────────────────────────────

function EarningsTab({
  earnings,
  isLoading,
  isWithdrawing,
  onWithdraw,
  onRefresh,
}: {
  earnings: KioskEarnings | null;
  isLoading: boolean;
  isWithdrawing: boolean;
  onWithdraw: () => void;
  onRefresh: () => void;
}) {
  const hasEarnings = earnings && earnings.profitsMist > 0n;

  return (
    <div className="space-y-6 max-w-2xl">

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          SUI earned from marketplace sales sits in your Kiosk until you withdraw it.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="bg-white/5 border-white/10 text-xs"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1.5", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {!earnings ? (
        <Card className="glass-card border-white/10">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-7 h-7 text-muted-foreground opacity-40" />
            </div>
            <p className="text-muted-foreground text-sm">
              No Kiosk found. Create one in your Inventory to start selling.
            </p>
            <Button variant="link" asChild className="text-accent text-xs">
              <a href="/inventory">Go to Inventory</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className={cn(
            "overflow-hidden border transition-all",
            hasEarnings
              ? "border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.06)]"
              : "border-white/10"
          )}>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                <div className={cn(
                  "w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0",
                  hasEarnings
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-white/5 border border-white/10"
                )}>
                  <CircleDollarSign className={cn(
                    "w-10 h-10",
                    hasEarnings ? "text-green-400" : "text-muted-foreground/30"
                  )} />
                </div>

                <div className="flex-1 text-center md:text-left space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Pending Kiosk Earnings
                  </p>
                  <div className="flex items-end gap-3">
                    <span className={cn(
                      "font-headline text-5xl font-bold",
                      hasEarnings ? "text-green-400" : "text-muted-foreground/40"
                    )}>
                      {mistToSui(earnings.profitsMist)}
                    </span>
                    <span className="text-xl font-bold text-muted-foreground mb-1">SUI</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {earnings.profitsMist.toString()} MIST
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <Button
                    size="lg"
                    onClick={onWithdraw}
                    disabled={!hasEarnings || isWithdrawing}
                    className={cn(
                      "font-bold px-8 h-12",
                      hasEarnings
                        ? "bg-green-500 hover:bg-green-400 text-black shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                        : "bg-white/5 text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    {isWithdrawing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <ArrowDownToLine className="w-4 h-4 mr-2" />
                    )}
                    {isWithdrawing ? "Withdrawing..." : "Withdraw to Wallet"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoTile
              icon={<TrendingUp className="w-4 h-4 text-accent" />}
              label="How earnings work"
              value="When a buyer purchases your NFT, the sale price goes directly into your Kiosk balance. Withdraw anytime — no expiry."
            />
            <InfoTile
              icon={<CoinsIcon className="w-4 h-4 text-yellow-400" />}
              label="Protocol fee"
              value="10% of each sale is taken as a marketplace fee before the remainder lands in your Kiosk. You always receive 90% of the listing price."
            />
            <InfoTile
              icon={<ArrowDownToLine className="w-4 h-4 text-green-400" />}
              label="Withdraw cost"
              value="Withdrawing costs one standard Sui gas fee (~0.003 SUI). The entire pending balance is sent to your wallet in one transaction."
            />
          </div>

          {!hasEarnings && (
            <div className="text-center py-8 glass-card rounded-2xl border-dashed border-white/10">
              <p className="text-sm text-muted-foreground">
                No pending earnings yet. List some heroes in the{" "}
                <a href="/marketplace" className="text-accent underline underline-offset-2">marketplace</a> to start earning.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Achievements Tab
// ─────────────────────────────────────────────

function AchievementsTab({
  achievements,
  stats,
  claimedAchievementIds,  // FIX: was stats.claimed_ids (vector), now Set derived from owned badges
  claimingId,
  onClaim,
  onRefresh,
  isLoading,
}: {
  achievements: AchievementDef[];
  stats: PlayerStatsData;
  claimedAchievementIds: Set<string>;
  claimingId: string | null;
  onClaim: (id: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  const claimable  = achievements.filter(a =>
    !claimedAchievementIds.has(String(a.id)) &&
    a.requirement_type !== REQ_ADMIN_GRANTED &&
    getProgress(a, stats).pct >= 100
  );
  const inProgress = achievements.filter(a =>
    !claimedAchievementIds.has(String(a.id)) &&
    (a.requirement_type === REQ_ADMIN_GRANTED || getProgress(a, stats).pct < 100)
  );
  const claimed = achievements.filter(a => claimedAchievementIds.has(String(a.id)));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="text-green-400 font-bold">{claimable.length} claimable</span>
          <span>·</span>
          <span>{inProgress.length} in progress</span>
          <span>·</span>
          <span className="text-accent">{claimed.length} earned</span>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading} className="bg-white/5 border-white/10 text-xs">
          <RefreshCw className={cn("w-3 h-3 mr-1.5", isLoading && "animate-spin")} />
          Refresh Progress
        </Button>
      </div>

      {achievements.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl border-dashed border-white/10">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">No achievements published yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {claimable.length > 0 && (
            <section className="space-y-3">
              <SectionLabel icon={<Star className="w-4 h-4 text-yellow-400" />} label="Ready to Claim" />
              <div className="grid gap-3">
                {claimable.map(a => (
                  <AchievementCard key={a.id} achievement={a} stats={stats} status="claimable" claimingId={claimingId} onClaim={onClaim} />
                ))}
              </div>
            </section>
          )}
          {inProgress.length > 0 && (
            <section className="space-y-3">
              <SectionLabel icon={<Sword className="w-4 h-4 text-primary" />} label="In Progress" />
              <div className="grid gap-3">
                {inProgress.map(a => (
                  <AchievementCard key={a.id} achievement={a} stats={stats} status="locked" claimingId={claimingId} onClaim={onClaim} />
                ))}
              </div>
            </section>
          )}
          {claimed.length > 0 && (
            <section className="space-y-3">
              <SectionLabel icon={<CheckCircle2 className="w-4 h-4 text-green-400" />} label="Earned" />
              <div className="grid gap-3">
                {claimed.map(a => (
                  <AchievementCard key={a.id} achievement={a} stats={stats} status="claimed" claimingId={claimingId} onClaim={onClaim} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Achievement Card
// ─────────────────────────────────────────────

function AchievementCard({
  achievement: a, stats, status, claimingId, onClaim,
}: {
  achievement: AchievementDef;
  stats: PlayerStatsData;
  status: "claimable" | "locked" | "claimed";
  claimingId: string | null;
  onClaim: (id: string) => void;
}) {
  const isAdminGranted = a.requirement_type === REQ_ADMIN_GRANTED;
  const { current, required, pct } = isAdminGranted ? { current: 0, required: 0, pct: 0 } : getProgress(a, stats);
  const isClaiming = claimingId === a.id;

  return (
    <Card className={cn(
      "bg-white/5 overflow-hidden transition-all",
      status === "claimable" ? "border-yellow-400/40 hover:border-yellow-400/70 shadow-[0_0_20px_rgba(250,204,21,0.08)]" :
      status === "claimed"   ? "border-green-500/30" :
      "border-white/5 hover:border-white/10"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            "relative w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden border flex items-center justify-center",
            status === "claimed"   ? "border-green-500/30 bg-green-500/5" :
            status === "claimable" ? "border-yellow-400/40 bg-yellow-400/5" :
            "border-white/10 bg-white/5"
          )}>
            {a.badge_image_url ? (
              <Image src={a.badge_image_url} alt={a.name} fill className="object-contain p-1" />
            ) : (
              <Trophy className={cn("w-6 h-6",
                status === "claimed"   ? "text-green-400" :
                status === "claimable" ? "text-yellow-400" :
                "text-muted-foreground/30"
              )} />
            )}
            {status === "claimed" && (
              <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-400 drop-shadow-lg" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate">{a.name}</h4>
                {a.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{a.description}</p>}
              </div>
              {parseInt(a.gyate_reward || "0") > 0 && (
                <span className="flex-shrink-0 text-[10px] font-bold bg-accent/10 text-accent border border-accent/20 rounded-full px-2 py-0.5 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> {a.gyate_reward} GYATE
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              {getRequirementLabel(a)}
            </p>
            {!isAdminGranted && status !== "claimed" && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                  <span>{current.toLocaleString()} / {required.toLocaleString()}</span>
                  <span>{Math.floor(pct)}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", pct >= 100 ? "bg-yellow-400" : "bg-primary")}
                    style={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%` }}
                  />
                </div>
              </div>
            )}
            {status === "claimed" && (
              <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold uppercase tracking-widest">
                <CheckCircle2 className="w-3 h-3" /> Earned
              </div>
            )}
            {isAdminGranted && status === "locked" && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                <Lock className="w-3 h-3" /> Admin granted only
              </div>
            )}
          </div>

          {status === "claimable" && (
            <Button
              size="sm"
              onClick={() => onClaim(a.id)}
              disabled={isClaiming}
              className="flex-shrink-0 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-xs px-4"
            >
              {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trophy className="w-3 h-3 mr-1" /> Claim</>}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors",
        active ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
      {icon}{label}
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
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

function RarityProgress({ label, count, color }: { label: string; count: string; color: string }) {
  const num = parseInt(count || "0");
  const progress = Math.min((num / 100) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-bold">
        <span className="text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-foreground">{num}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${num > 0 ? Math.max(progress, 2) : 0}%` }}
        />
      </div>
    </div>
  );
}