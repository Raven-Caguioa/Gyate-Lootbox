"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hash, Sparkles, RefreshCw, Wand2, ImageIcon, CheckCircle2, Loader2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { ProtocolInspector } from "./protocol-inspector";
import type { LootboxOption, LootboxFullData } from "../_hooks/use-admin-data";
import { RARITY_LABELS } from "@/lib/mock-data";

// ─── Preset definitions (mirrors the API) ────────────────────────────────────

type PresetKey = "golden" | "shadow" | "crystal" | "inferno" | "spectral";

interface Preset {
  key: PresetKey;
  label: string;
  description: string;
  color: string;
  ringColor: string;
  glowClass: string;
  defaultName: string;
  defaultMultiplier: string;
  defaultDropRate: string;
}

const PRESETS: Preset[] = [
  {
    key: "golden",
    label: "Golden",
    description: "Animated shimmer gold tint",
    color: "bg-gradient-to-br from-yellow-400 to-amber-600",
    ringColor: "ring-yellow-400",
    glowClass: "shadow-[0_0_20px_rgba(251,191,36,0.4)]",
    defaultName: "Golden",
    defaultMultiplier: "200",
    defaultDropRate: "3",
  },
  {
    key: "shadow",
    label: "Shadow",
    description: "Pulsing dark void overlay",
    color: "bg-gradient-to-br from-purple-900 to-black",
    ringColor: "ring-purple-500",
    glowClass: "shadow-[0_0_20px_rgba(168,85,247,0.4)]",
    defaultName: "Shadow",
    defaultMultiplier: "175",
    defaultDropRate: "4",
  },
  {
    key: "crystal",
    label: "Crystal",
    description: "Icy blue wave shimmer",
    color: "bg-gradient-to-br from-cyan-300 to-blue-500",
    ringColor: "ring-cyan-400",
    glowClass: "shadow-[0_0_20px_rgba(34,211,238,0.4)]",
    defaultName: "Crystal",
    defaultMultiplier: "160",
    defaultDropRate: "5",
  },
  {
    key: "inferno",
    label: "Inferno",
    description: "Flickering fire red overlay",
    color: "bg-gradient-to-br from-orange-500 to-red-700",
    ringColor: "ring-orange-500",
    glowClass: "shadow-[0_0_20px_rgba(249,115,22,0.4)]",
    defaultName: "Inferno",
    defaultMultiplier: "185",
    defaultDropRate: "3",
  },
  {
    key: "spectral",
    label: "Spectral",
    description: "Ghostly green glow pulse",
    color: "bg-gradient-to-br from-green-300 to-emerald-600",
    ringColor: "ring-green-400",
    glowClass: "shadow-[0_0_20px_rgba(74,222,128,0.4)]",
    defaultName: "Spectral",
    defaultMultiplier: "170",
    defaultDropRate: "4",
  },
];

// ─── Generation state machine ─────────────────────────────────────────────────

type GenStatus = "idle" | "generating" | "uploading" | "done" | "error";

interface GenState {
  status: GenStatus;
  url: string | null;
  error: string | null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VariantLabTabProps {
  draftBoxes: LootboxOption[];
  fetchFullBoxData: (
    id: string,
    setter: (d: LootboxFullData | null) => void,
    setLoading?: (v: boolean) => void
  ) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VariantLabTab({ draftBoxes, fetchFullBoxData }: VariantLabTabProps) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  // Box / NFT selection
  const [variantBoxId, setVariantBoxId]             = useState("");
  const [variantBoxData, setVariantBoxData]         = useState<LootboxFullData | null>(null);
  const [isFetchingFullData, setIsFetchingFullData] = useState(false);
  const [selectedNftForVariant, setSelectedNftForVariant] = useState("");

  // Variant fields
  const [variantName, setVariantName]         = useState("");
  const [variantDropRate, setVariantDropRate] = useState("5");
  const [variantMultiplier, setVariantMultiplier] = useState("150");
  const [variantImage, setVariantImage]       = useState("");
  const [hasSeqId, setHasSeqId]               = useState(false);
  const [useLimits, setUseLimits]             = useState(false);
  const [availFrom, setAvailFrom]             = useState("0");
  const [availUntil, setAvailUntil]           = useState("0");
  const [maxMints, setMaxMints]               = useState("0");

  // Preset system
  const [selectedPreset, setSelectedPreset]   = useState<PresetKey | null>(null);
  const [usePreset, setUsePreset]             = useState(false);
  const [genState, setGenState]               = useState<GenState>({ status: "idle", url: null, error: null });
  const [pinataGroupId, setPinataGroupId]     = useState("");

  // ── Derived ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchFullBoxData(variantBoxId, setVariantBoxData, setIsFetchingFullData);
    setSelectedNftForVariant("");
  }, [variantBoxId, fetchFullBoxData]);

  const variantNftOptions = useMemo(() => {
    if (!variantBoxData) return [];
    return [
      ...variantBoxData.common_configs,
      ...variantBoxData.rare_configs,
      ...variantBoxData.super_rare_configs,
      ...variantBoxData.ssr_configs,
      ...variantBoxData.ultra_rare_configs,
      ...variantBoxData.legend_rare_configs,
    ];
  }, [variantBoxData]);

  const selectedNftBaseImage = useMemo(() => {
    if (!selectedNftForVariant || !variantBoxData) return null;
    const [name] = selectedNftForVariant.split(":::");
    const all = variantNftOptions;
    return all.find((n) => n.name === name)?.base_image_url ?? null;
  }, [selectedNftForVariant, variantBoxData, variantNftOptions]);

  // ── Preset selection ──────────────────────────────────────────────
  const handleSelectPreset = (preset: Preset) => {
    setSelectedPreset(preset.key);
    setVariantName(preset.defaultName);
    setVariantDropRate(preset.defaultDropRate);
    setVariantMultiplier(preset.defaultMultiplier);
    setVariantImage("");
    setGenState({ status: "idle", url: null, error: null });
  };

  // ── Image generation ──────────────────────────────────────────────
  const handleGenerateImage = async () => {
    if (!selectedNftBaseImage || !selectedPreset) return;

    setGenState({ status: "generating", url: null, error: null });

    try {
      const [nftNameRaw] = selectedNftForVariant.split(":::");

      const res = await fetch("/api/variant-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrl: selectedNftBaseImage,
          preset: selectedPreset,
          nftName: nftNameRaw,
          ...(pinataGroupId.trim() && { groupId: pinataGroupId.trim() }),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Generation failed");
      }

      const { url } = await res.json();
      setVariantImage(url);
      setGenState({ status: "done", url, error: null });
      toast({ title: "Image Generated", description: "Uploaded to Pinata — URL filled in automatically." });
    } catch (err: any) {
      setGenState({ status: "idle", url: null, error: err.message });
      toast({ variant: "destructive", title: "Generation Failed", description: err.message });
    }
  };

  // ── Deploy variant on-chain ───────────────────────────────────────
  const handleAddVariant = async () => {
    if (!variantBoxId || !selectedNftForVariant || !variantName) return;
    const parts = selectedNftForVariant.split(":::");
    const name = parts[0];
    const rarity = parts[1];
    if (!name || isNaN(parseInt(rarity))) {
      toast({ variant: "destructive", title: "Selection Error", description: "Invalid character selection format." });
      return;
    }
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.ADD_VARIANT}`,
      arguments: [
        txb.object(variantBoxId),
        txb.pure.string(name.trim()),
        txb.pure.u8(parseInt(rarity)),
        txb.pure.string(variantName.trim()),
        txb.pure.u64(BigInt(Math.floor(parseFloat(variantDropRate || "0")))),
        txb.pure.u64(BigInt(Math.floor(parseFloat(variantMultiplier || "0")))),
        txb.pure.string(variantImage.trim()),
        txb.pure.bool(hasSeqId),
        txb.pure.u64(BigInt(useLimits ? (availFrom || "0") : "0")),
        txb.pure.u64(BigInt(useLimits ? (availUntil || "0") : "0")),
        txb.pure.u64(BigInt(useLimits ? (maxMints || "0") : "0")),
      ],
    });
    signAndExecute(
      { transaction: txb },
      {
        onSuccess: () => {
          toast({ title: "Variant Deployed", description: `${variantName} variant is live.` });
          setIsPending(false);
          setVariantName("");
          setVariantImage("");
          setGenState({ status: "idle", url: null, error: null });
          setSelectedPreset(null);
          fetchFullBoxData(variantBoxId, setVariantBoxData, setIsFetchingFullData);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Variant Deployment Failed", description: err.message });
          setIsPending(false);
        },
      }
    );
  };

  const isGenerating = genState.status === "generating" || genState.status === "uploading";
  const canGenerate = !!selectedNftBaseImage && !!selectedPreset && !isGenerating;
  const activePreset = PRESETS.find((p) => p.key === selectedPreset);

  return (
    <div className="grid md:grid-cols-[1fr_350px] gap-8">
      <div className="space-y-8">
        {/* ── Row 1: Select Base + Create Variant ───────────────── */}
        <div className="grid md:grid-cols-2 gap-8">

          {/* Select Base */}
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Badge className="bg-primary/20 text-primary">03</Badge> Select Base
              </CardTitle>
              <CardDescription>Choose the base NFT for variant customization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Draft Box</Label>
                <Select value={variantBoxId} onValueChange={setVariantBoxId}>
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="Choose a draft..." />
                  </SelectTrigger>
                  <SelectContent>
                    {draftBoxes.map((box) => (
                      <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Base NFT</Label>
                <Select value={selectedNftForVariant} onValueChange={setSelectedNftForVariant}>
                  <SelectTrigger className="bg-white/5">
                    <SelectValue placeholder="Choose a character..." />
                  </SelectTrigger>
                  <SelectContent>
                    {variantNftOptions.map((nft, idx) => (
                      <SelectItem key={idx} value={`${nft.name}:::${nft.rarity}`}>
                        {nft.name} ({RARITY_LABELS[nft.rarity as keyof typeof RARITY_LABELS]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Base image preview */}
              {selectedNftBaseImage && (
                <div className="mt-2 rounded-xl overflow-hidden border border-primary/20 bg-gray-100">
                  <div className="w-full aspect-square max-h-48">
                    <img src={selectedNftBaseImage} alt="Base NFT" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground py-1.5">Base Image Preview</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Variant */}
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Badge className="bg-primary/20 text-primary">04</Badge> Create Variant
              </CardTitle>
              <CardDescription>Configure appearance and mechanics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Variant Name</Label>
                <Input
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="e.g. Shiny, Holographic"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Drop Rate (%)</Label>
                  <Input type="number" value={variantDropRate} onChange={(e) => setVariantDropRate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Multiplier (%)</Label>
                  <Input type="number" value={variantMultiplier} onChange={(e) => setVariantMultiplier(e.target.value)} placeholder="150 = 1.5x" />
                </div>
              </div>

              {/* Image URL field */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Variant Image URL</span>
                  {genState.status === "done" && (
                    <span className="text-[10px] text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Auto-filled from generation
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    value={variantImage}
                    onChange={(e) => {
                      setVariantImage(e.target.value);
                      if (genState.status === "done") {
                        setGenState({ status: "idle", url: null, error: null });
                      }
                    }}
                    placeholder="IPFS or HTTPS link"
                    className={cn(
                      genState.status === "done" && "border-green-500/40 bg-green-500/5"
                    )}
                  />
                  {variantImage && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => { setVariantImage(""); setGenState({ status: "idle", url: null, error: null }); }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sequential + limits */}
              <div className="pt-4 border-t border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2"><Hash className="w-3 h-3" /> Sequential IDs</Label>
                    <p className="text-[10px] text-muted-foreground">Unique serial number per mint</p>
                  </div>
                  <Switch checked={hasSeqId} onCheckedChange={setHasSeqId} />
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-6">
                  <div className="space-y-0.5">
                    <Label>Supply & Time Limits</Label>
                    <p className="text-[10px] text-muted-foreground">Configure availability period</p>
                  </div>
                  <Switch checked={useLimits} onCheckedChange={setUseLimits} />
                </div>
                {useLimits && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">From (Epoch)</Label>
                        <Input value={availFrom} onChange={(e) => setAvailFrom(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Until (Epoch)</Label>
                        <Input value={availUntil} onChange={(e) => setAvailUntil(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Max Total Mints</Label>
                      <Input value={maxMints} onChange={(e) => setMaxMints(e.target.value)} placeholder="0 for unlimited" />
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold h-12 glow-violet"
                onClick={handleAddVariant}
                disabled={isPending || !variantBoxId || !selectedNftForVariant || !variantName || !variantImage}
              >
                {isPending
                  ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Deploying...</>
                  : <><Sparkles className="w-4 h-4 mr-2" /> Deploy Variant</>
                }
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Row 2: Preset Generator ────────────────────────────── */}
        <Card className="glass-card border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Badge className="bg-amber-500/20 text-amber-400">✦</Badge>
              <Wand2 className="w-4 h-4 text-amber-400" />
              Preset Variant Generator
            </CardTitle>
            <CardDescription>
              Select a preset to auto-apply a tint effect + animation to the base image,
              upload to Pinata, and fill the image URL automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Requirement check */}
            {(!variantBoxId || !selectedNftForVariant) && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Select a draft box and base NFT above before using presets.
              </div>
            )}

            {/* Pinata Group ID */}
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  Pinata Group ID <span className="normal-case font-normal">(optional — overrides env var)</span>
                </Label>
                <Input
                  value={pinataGroupId}
                  onChange={(e) => setPinataGroupId(e.target.value)}
                  placeholder="e.g. 01926b3a-... (leave blank to use PINATA_VARIANT_GROUP_ID)"
                  className="bg-white/5 border-white/10 text-xs h-9 font-mono"
                />
              </div>
            </div>

            {/* Preset grid */}
            <div className="grid grid-cols-5 gap-3">
              {PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.key;
                return (
                  <button
                    key={preset.key}
                    onClick={() => handleSelectPreset(preset)}
                    disabled={!selectedNftBaseImage}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      isSelected
                        ? `border-white/30 bg-white/10 ring-2 ${preset.ringColor} ${preset.glowClass}`
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg",
                      preset.color,
                      isSelected && "ring-2 ring-white/30"
                    )} />
                    <span className="text-[10px] font-bold">{preset.label}</span>
                    <span className="text-[9px] text-muted-foreground text-center leading-tight">{preset.description}</span>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Generation panel */}
            {selectedPreset && selectedNftBaseImage && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  {/* Source preview */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Source</p>
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-white/10 bg-black/40">
                      <img src={selectedNftBaseImage} alt="Source" className="w-full h-full object-contain" />
                    </div>
                  </div>

                  {/* Arrow + preset label */}
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", activePreset?.color)}>
                      <Wand2 className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-[9px] text-center font-bold uppercase tracking-wider">{activePreset?.label}</span>
                    <span className="text-[18px]">→</span>
                  </div>

                  {/* Output preview */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Output</p>
                    <div className={cn(
                      "relative aspect-square w-full rounded-xl overflow-hidden border bg-gray-100 flex items-center justify-center",
                      genState.status === "done" ? "border-green-500/50" : "border-primary/20 border-dashed"
                    )}>
                      {genState.status === "done" && genState.url ? (
                        <img src={genState.url} alt="Generated" className="w-full h-full object-contain" />
                      ) : isGenerating ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-[10px]">Processing...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ImageIcon className="w-6 h-6 opacity-30" />
                          <span className="text-[10px]">Will appear here</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Error */}
                {genState.error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {genState.error}
                  </div>
                )}

                {/* Action row */}
                <div className="flex items-center gap-3">
                  <Button
                    className={cn(
                      "flex-1 h-11 font-bold transition-all",
                      activePreset?.color ? "text-accent-foreground" : "bg-primary hover:bg-primary/90 text-primary-foreground"
                    )}
                    onClick={handleGenerateImage}
                    disabled={!canGenerate}
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating & Uploading...</>
                    ) : genState.status === "done" ? (
                      <><RefreshCw className="w-4 h-4 mr-2" /> Regenerate</>
                    ) : (
                      <><Wand2 className="w-4 h-4 mr-2" /> Generate {activePreset?.label} Variant Image</>
                    )}
                  </Button>

                  {genState.status === "done" && (
                    <div className="flex items-center gap-1.5 text-green-400 text-xs font-bold shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      URL filled
                    </div>
                  )}
                </div>

                {genState.status === "done" && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Animated WebP uploaded to Pinata. Now click{" "}
                    <span className="text-pink-400 font-bold">Deploy Variant</span> above to write it on-chain.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ProtocolInspector data={variantBoxData} isFetching={isFetchingFullData} />
    </div>
  );
}