"use client";

import { useState } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Gift, Image as ImageIcon, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import Image from "next/image";
import { PACKAGE_ID, ACHIEVEMENT_REGISTRY, STATS_REGISTRY, TREASURY_CAP, MODULE_NAMES } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { RARITY_LABELS } from "@/lib/mock-data";
import type { AchievementDef } from "../_hooks/use-admin-data";

// NOTE: Add STATS_REGISTRY to your sui-constants.ts:
// export const STATS_REGISTRY = "0x..."; // the StatsRegistry shared object ID from deployment

const REQ_LABELS: Record<number, string> = {
  0: "Open Count", 1: "Burn Count", 2: "Rarity Mint", 3: "GYATE Spent", 4: "Admin Granted",
};

interface AchievementsTabProps {
  achievements: AchievementDef[];
  isLoadingAchievements: boolean;
  fetchAchievements: () => void;
}

export function AchievementsTab({ achievements, isLoadingAchievements, fetchAchievements }: AchievementsTabProps) {
  const account         = useCurrentAccount();
  const suiClient       = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast }       = useToast();
  const [isPending, setIsPending] = useState(false);

  const [newAch, setNewAch] = useState({
    name: "", description: "", imageUrl: "", reward: "100",
    reqType: "0", reqValue: "10", reqRarity: "0",
  });

  // Grant state
  const [grantTarget, setGrantTarget]           = useState("");
  const [selectedGrantAch, setSelectedGrantAch] = useState("");
  const [resolvedStatsId, setResolvedStatsId]   = useState<string | null>(null);
  const [isResolving, setIsResolving]           = useState(false);
  const [resolveError, setResolveError]         = useState<string | null>(null);

  // ── Resolve player stats ID from StatsRegistry ─────────────────────────────
  // Uses getDynamicFieldObject: StatsRegistry stores Table<address, ID>,
  // which Sui exposes as dynamic fields keyed by address.
  const resolveStatsId = async (address: string) => {
    if (!address || address.length < 10) return;
    setIsResolving(true);
    setResolvedStatsId(null);
    setResolveError(null);

    try {
      const result = await suiClient.getDynamicFieldObject({
        parentId: STATS_REGISTRY,
        name: { type: "address", value: address },
      });

      if (!result.data) {
        setResolveError("Player has not initialized stats yet.");
        setIsResolving(false);
        return;
      }

      // The dynamic field value is the PlayerStats object ID
      const statsId = result.data.objectId;
      setResolvedStatsId(statsId);
    } catch (err: any) {
      setResolveError("Player has not initialized stats yet.");
    } finally {
      setIsResolving(false);
    }
  };

  // ── Create achievement ──────────────────────────────────────────────────────
  const handleCreateAchievement = async () => {
    if (!newAch.name || !newAch.description || !account) return;
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::create_achievement`,
      arguments: [
        txb.object(ACHIEVEMENT_REGISTRY),
        txb.pure.string(newAch.name.trim()),
        txb.pure.string(newAch.description.trim()),
        txb.pure.string((newAch.imageUrl || "").trim()),
        txb.pure.u64(BigInt(Math.floor(parseFloat(newAch.reward || "0")))),
        txb.pure.u8(parseInt(newAch.reqType || "0")),
        txb.pure.u64(BigInt(newAch.reqValue || "0")),
        txb.pure.u8(parseInt(newAch.reqRarity || "0")),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Achievement Created" });
        setIsPending(false);
        setNewAch({ ...newAch, name: "", description: "" });
        fetchAchievements();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Creation Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  // ── Admin grant ─────────────────────────────────────────────────────────────
  // No manual ID entry needed — resolvedStatsId comes from StatsRegistry lookup.
  const handleAdminGrant = async () => {
    if (!grantTarget || !selectedGrantAch || !resolvedStatsId) return;
    setIsPending(true);

    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::admin_grant_achievement`,
      arguments: [
        txb.object(ACHIEVEMENT_REGISTRY),
        txb.object(resolvedStatsId),          // shared PlayerStats — no ownership error
        txb.pure.u64(BigInt(selectedGrantAch)),
        txb.object(TREASURY_CAP),
        txb.pure.address(grantTarget.trim()),
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({
          title: "Badge Granted",
          description: `Achievement awarded to ${grantTarget.slice(0, 10)}...`,
        });
        setIsPending(false);
        setGrantTarget("");
        setSelectedGrantAch("");
        setResolvedStatsId(null);
        setResolveError(null);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Grant Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  return (
    <div className="grid md:grid-cols-[1fr_400px] gap-8">
      <div className="space-y-8">

        {/* ── Achievement Factory ── */}
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" /> Achievement Factory
            </CardTitle>
            <CardDescription>Define on-chain goals and rewards</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={newAch.name} onChange={(e) => setNewAch({ ...newAch, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>GYATE Reward</Label>
                <Input type="number" value={newAch.reward} onChange={(e) => setNewAch({ ...newAch, reward: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={newAch.description} onChange={(e) => setNewAch({ ...newAch, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Badge Image URL</Label>
              <Input value={newAch.imageUrl} onChange={(e) => setNewAch({ ...newAch, imageUrl: e.target.value })} />
            </div>
            <div className="pt-4 border-t border-white/5 grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Req Type</Label>
                <Select value={newAch.reqType} onValueChange={(v) => setNewAch({ ...newAch, reqType: v })}>
                  <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REQ_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Threshold</Label>
                <Input type="number" value={newAch.reqValue} onChange={(e) => setNewAch({ ...newAch, reqValue: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Rarity (If Type=2)</Label>
                <Select value={newAch.reqRarity} onValueChange={(v) => setNewAch({ ...newAch, reqRarity: v })}>
                  <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map(r => (
                      <SelectItem key={r} value={r.toString()}>
                        {RARITY_LABELS[r as keyof typeof RARITY_LABELS]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full glow-violet bg-accent font-bold h-12 mt-4"
              onClick={handleCreateAchievement}
              disabled={isPending}
            >
              Register On-Chain Achievement
            </Button>
          </CardContent>
        </Card>

        {/* ── Manual Grant ── */}
        <Card className="glass-card border-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gift className="w-5 h-5 text-accent" /> Manual Grant
            </CardTitle>
            <CardDescription>Award a badge directly to a player wallet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Address input + auto-resolve */}
            <div className="space-y-2">
              <Label>Target Player Address</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="0x..."
                  value={grantTarget}
                  onChange={(e) => {
                    setGrantTarget(e.target.value);
                    setResolvedStatsId(null);
                    setResolveError(null);
                  }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resolveStatsId(grantTarget)}
                  disabled={isResolving || !grantTarget}
                  className="h-10 px-4 text-xs font-semibold shrink-0"
                >
                  {isResolving
                    ? <RefreshCw className="w-3 h-3 animate-spin" />
                    : "Verify"
                  }
                </Button>
              </div>

              {/* Resolution feedback */}
              {resolvedStatsId && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Stats found — ready to grant</span>
                  <span className="ml-auto font-mono text-[9px] text-emerald-300 opacity-60">
                    {resolvedStatsId.slice(0, 10)}...
                  </span>
                </div>
              )}
              {resolveError && (
                <div className="flex items-center gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {resolveError}
                </div>
              )}
            </div>

            {/* Achievement select */}
            <div className="space-y-2">
              <Label>Select Achievement</Label>
              <Select value={selectedGrantAch} onValueChange={setSelectedGrantAch}>
                <SelectTrigger className="bg-white/5">
                  <SelectValue placeholder="Choose achievement..." />
                </SelectTrigger>
                <SelectContent>
                  {achievements.map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="secondary"
              className="w-full bg-accent/20 hover:bg-accent/40 text-accent h-12"
              onClick={handleAdminGrant}
              disabled={isPending || !grantTarget || !selectedGrantAch || !resolvedStatsId}
            >
              {isPending
                ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Granting...</>
                : "Grant Soulbound Badge"
              }
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Registry index ── */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <ImageIcon className="w-4 h-4" /> Registry Index
        </h3>
        <ScrollArea className="h-[800px] pr-4">
          <div className="grid gap-4">
            {isLoadingAchievements ? (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading...
              </div>
            ) : achievements.length > 0 ? achievements.map((a, idx) => (
              <Card key={idx} className="bg-white/5 border-white/5 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20">
                    {a.badge_image_url
                      ? <Image src={a.badge_image_url} alt={a.name} width={40} height={40} className="rounded-full" />
                      : <Trophy className="w-4 h-4 text-accent" />
                    }
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {REQ_LABELS[a.requirement_type]}: {a.requirement_value}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-primary">+{parseInt(a.gyate_reward)} G</div>
                    <div className="text-[9px] text-muted-foreground">Claimed: {a.total_claimed}</div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-2">{a.description}</p>
              </Card>
            )) : (
              <div className="text-center py-20 text-xs text-muted-foreground">
                No achievements found in registry
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}