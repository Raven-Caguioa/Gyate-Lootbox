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
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, ADMIN_REGISTRY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { ProtocolInspector } from "./protocol-inspector";
import type { LootboxOption, LootboxFullData } from "../_hooks/use-admin-data";
import { RARITY_LABELS } from "@/lib/mock-data";

// ─── Preset definitions ───────────────────────────────────────────────────────

type PresetKey = "golden" | "shadow" | "crystal" | "inferno" | "spectral";

interface Preset {
  key: PresetKey;
  label: string;
  description: string;
  swatchClass: string;
  ringColor: string;
  glowClass: string;
  defaultName: string;
  defaultMultiplier: string;
  defaultDropRate: string;
  swatchOverlay?: React.ReactNode;
}

const PRESETS: Preset[] = [
  {
    key: "golden", label: "Golden",
    description: "UR gold shimmer · cycling gradient · star particles",
    swatchClass: "relative overflow-hidden bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600",
    ringColor: "ring-yellow-400", glowClass: "shadow-[0_0_22px_rgba(251,191,36,0.55)]",
    defaultName: "Golden", defaultMultiplier: "200", defaultDropRate: "3",
    swatchOverlay: (
      <>
        <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg,transparent 30%,rgba(253,230,138,0.7) 50%,transparent 70%)", backgroundSize: "200% 200%", animation: "goldSweep 1.8s ease-in-out infinite" }} />
        {[{ top: "18%", left: "15%" }, { top: "12%", right: "14%" }, { bottom: "20%", left: "20%" }, { bottom: "15%", right: "18%" }, { top: "50%", left: "50%", transform: "translate(-50%,-50%)" }].map((s, i) => (
          <span key={i} className="absolute w-1 h-1 rounded-full bg-yellow-100" style={{ ...s, boxShadow: "0 0 4px rgba(253,230,138,0.9)", animation: `starPulse ${1.2 + i * 0.15}s ease-in-out infinite` }} />
        ))}
      </>
    ),
  },
  {
    key: "shadow", label: "Shadow", description: "Pulsing dark void overlay",
    swatchClass: "bg-gradient-to-br from-purple-900 to-black",
    ringColor: "ring-purple-500", glowClass: "shadow-[0_0_20px_rgba(168,85,247,0.4)]",
    defaultName: "Shadow", defaultMultiplier: "175", defaultDropRate: "4",
  },
  {
    key: "crystal", label: "Crystal", description: "Icy blue wave shimmer",
    swatchClass: "bg-gradient-to-br from-cyan-300 to-blue-500",
    ringColor: "ring-cyan-400", glowClass: "shadow-[0_0_20px_rgba(34,211,238,0.4)]",
    defaultName: "Crystal", defaultMultiplier: "160", defaultDropRate: "5",
  },
  {
    key: "inferno", label: "Inferno", description: "Flickering fire red overlay",
    swatchClass: "bg-gradient-to-br from-orange-500 to-red-700",
    ringColor: "ring-orange-500", glowClass: "shadow-[0_0_20px_rgba(249,115,22,0.4)]",
    defaultName: "Inferno", defaultMultiplier: "185", defaultDropRate: "3",
  },
  {
    key: "spectral", label: "Spectral", description: "Legend prismatic · dual shimmer · twinkle stars",
    swatchClass: "relative overflow-hidden",
    ringColor: "ring-pink-400", glowClass: "shadow-[0_0_22px_rgba(255,157,226,0.55)]",
    defaultName: "Spectral", defaultMultiplier: "170", defaultDropRate: "4",
    swatchOverlay: (
      <>
        <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg,#ff9de2,#ffd6a5,#caffbf,#9bf6ff,#a0c4ff,#bdb2ff,#ff9de2)", backgroundSize: "400% 400%", animation: "holographic 2s ease infinite" }} />
        <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg,transparent 25%,rgba(255,255,255,0.45) 50%,transparent 75%)", backgroundSize: "200% 200%", animation: "holoSweep1 2.2s ease-in-out infinite" }} />
        {[{ top: "15%", left: "12%", bg: "#ff9de2" }, { top: "10%", right: "15%", bg: "#9bf6ff" }, { bottom: "18%", left: "18%", bg: "#bdb2ff" }, { bottom: "12%", right: "12%", bg: "#caffbf" }, { top: "48%", left: "48%", transform: "translate(-50%,-50%)", bg: "#fff" }].map((s, i) => (
          <span key={i} className="absolute w-1 h-1 rounded-full" style={{ top: s.top, left: s.left, right: (s as any).right, bottom: (s as any).bottom, transform: (s as any).transform, background: s.bg, boxShadow: `0 0 5px ${s.bg}`, animation: `starPulse ${1.1 + i * 0.18}s ease-in-out infinite` }} />
        ))}
      </>
    ),
  },
];

const SWATCH_KEYFRAMES = `
@keyframes goldSweep { 0%,100% { background-position: -100% 0; opacity: 0.5; } 50% { background-position: 200% 0; opacity: 1; } }
@keyframes starPulse { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.3); } }
@keyframes holographic { 0% { background-position: 0% 50%; filter: hue-rotate(0deg); } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; filter: hue-rotate(360deg); } }
@keyframes holoSweep1 { 0%,100% { background-position: -100% 0; opacity: 0.4; } 50% { background-position: 220% 0; opacity: 1; } }
`;

function useSwatchStyles() {
  useEffect(() => {
    if (document.getElementById("variant-lab-swatch-styles")) return;
    const style = document.createElement("style");
    style.id = "variant-lab-swatch-styles";
    style.textContent = SWATCH_KEYFRAMES;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

type GenStatus = "idle" | "generating" | "uploading" | "done" | "error";
interface GenState { status: GenStatus; url: string | null; error: string | null; }

interface VariantLabTabProps {
  draftBoxes: LootboxOption[];
  fetchFullBoxData: (id: string, setter: (d: LootboxFullData | null) => void, setLoading?: (v: boolean) => void) => Promise<void>;
}

export function VariantLabTab({ draftBoxes, fetchFullBoxData }: VariantLabTabProps) {
  useSwatchStyles();

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const [variantBoxId, setVariantBoxId]         = useState("");
  const [variantBoxData, setVariantBoxData]     = useState<LootboxFullData | null>(null);
  const [isFetchingFullData, setIsFetchingFullData] = useState(false);
  const [selectedNftForVariant, setSelectedNftForVariant] = useState("");

  const [variantName, setVariantName]           = useState("");
  const [variantDropRate, setVariantDropRate]   = useState("5");
  const [variantMultiplier, setVariantMultiplier] = useState("150");
  const [variantImage, setVariantImage]         = useState("");
  const [hasSeqId, setHasSeqId]                 = useState(false);
  const [useLimits, setUseLimits]               = useState(false);
  const [availFrom, setAvailFrom]               = useState("0");
  const [availUntil, setAvailUntil]             = useState("0");
  const [maxMints, setMaxMints]                 = useState("0");

  const [selectedPreset, setSelectedPreset]     = useState<PresetKey | null>(null);
  const [genState, setGenState]                 = useState<GenState>({ status: "idle", url: null, error: null });
  const [pinataGroupId, setPinataGroupId]       = useState("");

  useEffect(() => {
    fetchFullBoxData(variantBoxId, setVariantBoxData, setIsFetchingFullData);
    setSelectedNftForVariant("");
  }, [variantBoxId, fetchFullBoxData]);

  const variantNftOptions = useMemo(() => {
    if (!variantBoxData) return [];
    return [
      ...variantBoxData.common_configs, ...variantBoxData.rare_configs,
      ...variantBoxData.super_rare_configs, ...variantBoxData.ssr_configs,
      ...variantBoxData.ultra_rare_configs, ...variantBoxData.legend_rare_configs,
    ];
  }, [variantBoxData]);

  const selectedNftBaseImage = useMemo(() => {
    if (!selectedNftForVariant || !variantBoxData) return null;
    const [name] = selectedNftForVariant.split(":::");
    return variantNftOptions.find((n) => n.name === name)?.base_image_url ?? null;
  }, [selectedNftForVariant, variantBoxData, variantNftOptions]);

  const handleSelectPreset = (preset: Preset) => {
    setSelectedPreset(preset.key);
    setVariantName(preset.defaultName);
    setVariantDropRate(preset.defaultDropRate);
    setVariantMultiplier(preset.defaultMultiplier);
    setVariantImage("");
    setGenState({ status: "idle", url: null, error: null });
  };

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
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Generation failed"); }
      const { url } = await res.json();
      setVariantImage(url);
      setGenState({ status: "done", url, error: null });
      toast({ title: "Image Generated", description: "Animated GIF uploaded to Pinata — URL filled in." });
    } catch (err: any) {
      setGenState({ status: "idle", url: null, error: err.message });
      toast({ variant: "destructive", title: "Generation Failed", description: err.message });
    }
  };

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
        txb.object(ADMIN_REGISTRY),   // NEW: first arg
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
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Variant Deployed", description: `${variantName} variant is live.` });
        setIsPending(false);
        setVariantName(""); setVariantImage("");
        setGenState({ status: "idle", url: null, error: null });
        setSelectedPreset(null);
        fetchFullBoxData(variantBoxId, setVariantBoxData, setIsFetchingFullData);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Variant Deployment Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  const isGenerating = genState.status === "generating" || genState.status === "uploading";
  const canGenerate  = !!selectedNftBaseImage && !!selectedPreset && !isGenerating;
  const activePreset = PRESETS.find((p) => p.key === selectedPreset);
  const presetTypeBadge =
    selectedPreset === "golden"   ? { label: "UR Gold",        color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" } :
    selectedPreset === "spectral" ? { label: "Legend Rainbow", color: "text-pink-400   border-pink-500/30   bg-pink-500/10"   } :
    null;

  return (
    <div className="grid md:grid-cols-[1fr_350px] gap-8">
      <div className="space-y-8">
        <div className="grid md:grid-cols-2 gap-8">

          {/* ── Select Base ── */}
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
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Choose a draft..." /></SelectTrigger>
                  <SelectContent>
                    {draftBoxes.map((box) => <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Select Base NFT</Label>
                <Select value={selectedNftForVariant} onValueChange={setSelectedNftForVariant}>
                  <SelectTrigger className="bg-white/5"><SelectValue placeholder="Choose a character..." /></SelectTrigger>
                  <SelectContent>
                    {variantNftOptions.map((nft, idx) => (
                      <SelectItem key={idx} value={`${nft.name}:::${nft.rarity}`}>
                        {nft.name} ({RARITY_LABELS[nft.rarity as keyof typeof RARITY_LABELS]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

          {/* ── Create Variant ── */}
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
                <Input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="e.g. Shiny, Holographic" />
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
                    onChange={(e) => { setVariantImage(e.target.value); if (genState.status === "done") setGenState({ status: "idle", url: null, error: null }); }}
                    placeholder="IPFS or HTTPS link"
                    className={cn(genState.status === "done" && "border-green-500/40 bg-green-500/5")}
                  />
                  {variantImage && (
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => { setVariantImage(""); setGenState({ status: "idle", url: null, error: null }); }}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
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
                    <Label>Supply &amp; Time Limits</Label>
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

        {/* ── Preset Generator ── */}
        <Card className="glass-card border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Badge className="bg-amber-500/20 text-amber-400">✦</Badge>
              <Wand2 className="w-4 h-4 text-amber-400" /> Preset Variant Generator
            </CardTitle>
            <CardDescription>
              Golden uses UR-style cycling gold gradient + star particles. Spectral uses Legend-style prismatic holographic shimmer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(!variantBoxId || !selectedNftForVariant) && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" /> Select a draft box and base NFT above before using presets.
              </div>
            )}
            <div className="flex-1 space-y-1.5">
              <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Pinata Group ID <span className="normal-case font-normal">(optional — overrides env var)</span>
              </Label>
              <Input value={pinataGroupId} onChange={(e) => setPinataGroupId(e.target.value)}
                placeholder="e.g. 01926b3a-... (leave blank to use PINATA_VARIANT_GROUP_ID)"
                className="bg-white/5 border-white/10 text-xs h-9 font-mono"
              />
            </div>
            <div className="grid grid-cols-5 gap-3">
              {PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.key;
                return (
                  <button key={preset.key} onClick={() => handleSelectPreset(preset)} disabled={!selectedNftBaseImage}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      isSelected ? `border-white/30 bg-white/10 ring-2 ${preset.ringColor} ${preset.glowClass}` : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-lg", preset.swatchClass, isSelected && "ring-2 ring-white/30")}>{preset.swatchOverlay}</div>
                    <span className="text-[10px] font-bold">{preset.label}</span>
                    <span className="text-[9px] text-muted-foreground text-center leading-tight">{preset.description}</span>
                    {(preset.key === "golden" || preset.key === "spectral") && (
                      <span className={cn("text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                        preset.key === "golden" ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" : "text-pink-400 border-pink-500/30 bg-pink-500/10"
                      )}>
                        {preset.key === "golden" ? "UR Gold" : "Legend"}
                      </span>
                    )}
                    {isSelected && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white" />}
                  </button>
                );
              })}
            </div>

            {selectedPreset && selectedNftBaseImage && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                {presetTypeBadge && (
                  <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold", presetTypeBadge.color)}>
                    <Sparkles className="w-3 h-3" />
                    <span>
                      <span className="font-bold">{presetTypeBadge.label} effect</span>
                      {" — "}
                      {selectedPreset === "golden"
                        ? "cycling gold gradient · diagonal shimmer sweep · star particles"
                        : "prismatic hue-rotate · dual opposing sweeps · nebula glow · twinkle stars"}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Source</p>
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-white/10 bg-black/40">
                      <img src={selectedNftBaseImage} alt="Source" className="w-full h-full object-contain" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center relative overflow-hidden", activePreset?.swatchClass)}>
                      {activePreset?.swatchOverlay}
                      <Wand2 className="w-4 h-4 text-white relative z-10" />
                    </div>
                    <span className="text-[9px] text-center font-bold uppercase tracking-wider">{activePreset?.label}</span>
                    <span className="text-[18px]">→</span>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Output</p>
                    <div className={cn(
                      "relative aspect-square w-full rounded-xl overflow-hidden border flex items-center justify-center",
                      genState.status === "done" ? "border-green-500/50 bg-black/20" : "border-primary/20 border-dashed bg-gray-100"
                    )}>
                      {genState.status === "done" && genState.url ? (
                        <img src={genState.url} alt="Generated" className="w-full h-full object-contain" />
                      ) : isGenerating ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-[10px]">Rendering frames...</span>
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

                {genState.error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {genState.error}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button className="flex-1 h-11 font-bold bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleGenerateImage} disabled={!canGenerate}>
                    {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating &amp; Uploading...</>
                      : genState.status === "done" ? <><RefreshCw className="w-4 h-4 mr-2" /> Regenerate</>
                      : <><Wand2 className="w-4 h-4 mr-2" /> Generate {activePreset?.label} Variant Image</>
                    }
                  </Button>
                  {genState.status === "done" && (
                    <div className="flex items-center gap-1.5 text-green-400 text-xs font-bold shrink-0">
                      <CheckCircle2 className="w-4 h-4" /> URL filled
                    </div>
                  )}
                </div>

                {genState.status === "done" && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Animated GIF uploaded to Pinata. Now click <span className="text-pink-400 font-bold">Deploy Variant</span> above to write it on-chain.
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