"use client";

import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { PACKAGE_ID, LOOTBOX_REGISTRY, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { ProtocolInspector } from "./protocol-inspector";
import { ImagePickerField } from "@/components/ImagePickerField";
import type { LootboxOption, LootboxFullData } from "../_hooks/use-admin-data";
import { RARITY_LABELS } from "@/lib/mock-data";

// ── Set this to the Pinata group ID you want the image picker to read from ───
// Falls back to PINATA_VARIANT_GROUP_ID (server) but here we pass a dedicated
// group for source NFT art (PINATA_NFT_IMAGE_GROUP_ID).
// You can also hard-code the group ID string here if you prefer.
const NFT_IMAGE_GROUP_ID = process.env.NEXT_PUBLIC_NFT_IMAGE_GROUP_ID ?? undefined;

interface LootboxFactoryTabProps {
  draftBoxes: LootboxOption[];
  fetchLootboxes: () => void;
  fetchFullBoxData: (id: string, setter: (d: LootboxFullData | null) => void, setLoading?: (v: boolean) => void) => Promise<void>;
}

export function LootboxFactoryTab({ draftBoxes, fetchLootboxes, fetchFullBoxData }: LootboxFactoryTabProps) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const [contentBoxData, setContentBoxData] = useState<LootboxFullData | null>(null);
  const [isFetchingFullData, setIsFetchingFullData] = useState(false);

  // Draft form
  const [newBoxName, setNewBoxName]         = useState("");
  const [newBoxPrice, setNewBoxPrice]       = useState("1");
  const [newGyatePrice, setNewGyatePrice]   = useState("100");
  const [pityEnabled, setPityEnabled]       = useState(false);
  const [pityThresholds, setPityThresholds] = useState({ common: "0", rare: "10", sr: "50", ssr: "75", ur: "150", lr: "500" });
  const [multiOpenEnabled, setMultiOpenEnabled] = useState(false);
  const [multiOpenSize, setMultiOpenSize]   = useState("10");
  const [guaranteeRarity, setGuaranteeRarity] = useState("1");

  // Add NFT type form
  const [targetBoxId, setTargetBoxId]   = useState("");
  const [nftRarity, setNftRarity]       = useState("0");
  const [nftName, setNftName]           = useState("");
  const [nftValue, setNftValue]         = useState("1000000000");
  const [nftImage, setNftImage]         = useState("");        // ← managed by ImagePickerField
  const [burnGyateValue, setBurnGyateValue] = useState("0");
  const [stats, setStats] = useState({
    minHp: "100", maxHp: "200",
    minAtk: "10",  maxAtk: "20",
    minSpd: "5",   maxSpd: "15",
  });

  useEffect(() => {
    fetchFullBoxData(targetBoxId, setContentBoxData, setIsFetchingFullData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetBoxId]); // intentionally omit fetchFullBoxData — new ref every render

  const handleCreateDraft = async () => {
    if (!newBoxName || !newBoxPrice) return;
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.CREATE_DRAFT}`,
      arguments: [
        txb.object(LOOTBOX_REGISTRY),
        txb.pure.string(newBoxName.trim()),
        txb.pure.u64(BigInt(Math.floor(parseFloat(newBoxPrice) * 1_000_000_000))),
        txb.pure.u64(BigInt(newGyatePrice)),
        txb.pure.bool(pityEnabled),
        txb.pure.u64(BigInt(pityThresholds.common || "0")),
        txb.pure.u64(BigInt(pityThresholds.rare   || "0")),
        txb.pure.u64(BigInt(pityThresholds.sr     || "0")),
        txb.pure.u64(BigInt(pityThresholds.ssr    || "0")),
        txb.pure.u64(BigInt(pityThresholds.ur     || "0")),
        txb.pure.u64(BigInt(pityThresholds.lr     || "0")),
        txb.pure.bool(multiOpenEnabled),
        txb.pure.u64(BigInt(multiOpenSize || "0")),
        txb.pure.u8(parseInt(guaranteeRarity || "0")),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Draft Created", description: "Advanced lootbox draft successfully deployed." });
        setIsPending(false);
        setNewBoxName("");
        setTimeout(fetchLootboxes, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Creation Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  const handleAddNftType = async () => {
    if (!targetBoxId || !nftName) return;
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.ADD_NFT_TYPE}`,
      arguments: [
        txb.object(targetBoxId),
        txb.pure.u8(parseInt(nftRarity)),
        txb.pure.string(nftName.trim()),
        txb.pure.u64(BigInt(nftValue || "0")),
        txb.pure.string(nftImage.trim()),
        txb.pure.u64(BigInt(stats.minHp  || "0")),
        txb.pure.u64(BigInt(stats.maxHp  || "0")),
        txb.pure.u64(BigInt(stats.minAtk || "0")),
        txb.pure.u64(BigInt(stats.maxAtk || "0")),
        txb.pure.u64(BigInt(stats.minSpd || "0")),
        txb.pure.u64(BigInt(stats.maxSpd || "0")),
        txb.pure.u64(BigInt(burnGyateValue || "0")),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "NFT Type Added", description: `${nftName} added to ${RARITY_LABELS[parseInt(nftRarity) as keyof typeof RARITY_LABELS]} tier.` });
        setIsPending(false);
        setNftName("");
        setNftImage("");
        setBurnGyateValue("0");
        // Delay to allow the node to index the new object before re-fetching
        setTimeout(() => fetchFullBoxData(targetBoxId, setContentBoxData, setIsFetchingFullData), 2000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Addition Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  const handleFinalize = async () => {
    if (!targetBoxId || !contentBoxData) return;
    const emptyTiers = [];
    if (contentBoxData.common_configs.length === 0)      emptyTiers.push("Common");
    if (contentBoxData.rare_configs.length === 0)         emptyTiers.push("Rare");
    if (contentBoxData.super_rare_configs.length === 0)   emptyTiers.push("Super Rare");
    if (contentBoxData.ssr_configs.length === 0)          emptyTiers.push("SSR");
    if (contentBoxData.ultra_rare_configs.length === 0)   emptyTiers.push("Ultra Rare");
    if (contentBoxData.legend_rare_configs.length === 0)  emptyTiers.push("Legend Rare");
    if (emptyTiers.length > 0) {
      toast({ variant: "destructive", title: "Incomplete Protocol", description: `Missing tiers: ${emptyTiers.join(", ")}` });
      return;
    }
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.FINALIZE_AND_ACTIVATE}`,
      arguments: [txb.object(LOOTBOX_REGISTRY), txb.object(targetBoxId)],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Lootbox Activated!" });
        setIsPending(false);
        setTimeout(fetchLootboxes, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Activation Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  return (
    <div className="grid md:grid-cols-[1fr_350px] gap-8">
      <div className="space-y-8">
        <div className="grid md:grid-cols-2 gap-8">

          {/* ── Create Draft ────────────────────────────────────── */}
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Badge className="bg-primary/20 text-primary">01</Badge> Create Draft
              </CardTitle>
              <CardDescription>Setup core economic parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Box Name</Label>
                <Input value={newBoxName} onChange={(e) => setNewBoxName(e.target.value)} placeholder="Genesis Crate" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SUI Price</Label>
                  <Input type="number" value={newBoxPrice} onChange={(e) => setNewBoxPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>$GYATE Price</Label>
                  <Input type="number" value={newGyatePrice} onChange={(e) => setNewGyatePrice(e.target.value)} />
                </div>
              </div>

              <div className="space-y-6 pt-2">
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="space-y-0.5">
                    <Label>Enable Pity Tracking</Label>
                    <p className="text-[10px] text-muted-foreground">Guarantee rare drops after X failed pulls</p>
                  </div>
                  <Switch checked={pityEnabled} onCheckedChange={setPityEnabled} />
                </div>
                {pityEnabled && (
                  <div className="grid grid-cols-2 gap-3 p-4 bg-white/5 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                    {(["rare","sr","ssr","ur","lr"] as const).map((key, i) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-[10px]">{["Rare","Super Rare","SSR","Ultra Rare","Legend Rare"][i]} @</Label>
                        <Input
                          type="number" className="h-8 text-xs"
                          value={(pityThresholds as any)[key]}
                          onChange={(e) => setPityThresholds({ ...pityThresholds, [key]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="space-y-0.5">
                    <Label>Enable Multi-Open</Label>
                    <p className="text-[10px] text-muted-foreground">Allow summoning batches with guaranteed drop</p>
                  </div>
                  <Switch checked={multiOpenEnabled} onCheckedChange={setMultiOpenEnabled} />
                </div>
                {multiOpenEnabled && (
                  <div className="grid grid-cols-2 gap-3 p-4 bg-white/5 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px]">Batch Size</Label>
                      <Input type="number" className="h-8 text-xs" value={multiOpenSize} onChange={(e) => setMultiOpenSize(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px]">Guaranteed Rarity</Label>
                      <Select value={guaranteeRarity} onValueChange={setGuaranteeRarity}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[0,1,2,3,4,5].map(r => (
                            <SelectItem key={r} value={r.toString()}>{RARITY_LABELS[r as keyof typeof RARITY_LABELS]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <Button className="w-full glow-violet bg-accent font-bold h-12" onClick={handleCreateDraft} disabled={isPending}>
                {isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Deploy Protocol Draft
              </Button>
            </CardContent>
          </Card>

          {/* ── Add Contents ────────────────────────────────────── */}
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Badge className="bg-primary/20 text-primary">02</Badge> Add Contents
              </CardTitle>
              <CardDescription>Populate rarity tiers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Draft Box</Label>
                <Select value={targetBoxId} onValueChange={setTargetBoxId}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Choose a draft..." /></SelectTrigger>
                  <SelectContent>
                    {draftBoxes.map(box => <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Rarity</Label>
                  <Select value={nftRarity} onValueChange={setNftRarity}>
                    <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0,1,2,3,4,5].map(r => (
                        <SelectItem key={r} value={r.toString()}>{RARITY_LABELS[r as keyof typeof RARITY_LABELS]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>NFT Name</Label>
                  <Input value={nftName} onChange={(e) => setNftName(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Base Value (MIST)</Label>
                <Input type="number" value={nftValue} onChange={(e) => setNftValue(e.target.value)} />
              </div>

              {/* ── Image picker (replaces plain URL input) ────────── */}
              <ImagePickerField
                value={nftImage}
                onChange={setNftImage}
                groupId={NFT_IMAGE_GROUP_ID}
                label="NFT Image"
              />

              {/* Burn GYATE value */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Burn $GYATE Reward</span>
                  <span className="text-[10px] text-muted-foreground font-normal">0 = use rarity default</span>
                </Label>
                <Input
                  type="number"
                  value={burnGyateValue}
                  onChange={(e) => setBurnGyateValue(e.target.value)}
                  placeholder="e.g. 50 — leave 0 for rarity default"
                />
              </div>

              <div className="space-y-4 pt-2 border-t border-white/5">
                <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Stat RNG Ranges</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["minHp","maxHp","minAtk","maxAtk","minSpd","maxSpd"] as const).map((key) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-[10px]">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                      <Input
                        type="number" className="h-8 text-xs"
                        value={stats[key]}
                        onChange={(e) => setStats({ ...stats, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="outline" className="w-full glow-violet bg-accent font-bold h-12"
                onClick={handleAddNftType}
                disabled={isPending || !targetBoxId}
              >
                {isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Register NFT Type
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Finalize ─────────────────────────────────────────── */}
        <Card className="glass-card border-accent/20">
          <CardHeader>
            <CardTitle className="text-lg">Finalize Protocol</CardTitle>
            <CardDescription>Activate the draft for the network</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-row items-center justify-between">
              <p className="text-xs text-muted-foreground max-w-[60%] leading-relaxed italic">
                Ensure every rarity tier has at least one character before finalizing.
              </p>
              <Button
                className="glow-violet bg-accent font-bold px-8 h-12"
                onClick={handleFinalize}
                disabled={isPending || !targetBoxId}
              >
                Go Live <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ProtocolInspector data={contentBoxData} isFetching={isFetchingFullData} />
    </div>
  );
}