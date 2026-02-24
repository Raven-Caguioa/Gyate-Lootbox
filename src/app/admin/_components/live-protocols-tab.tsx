"use client";

import { useState, useCallback } from "react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Pause, Play, RefreshCw, TrendingUp, Package,
  Coins, Sparkles, ToggleLeft, ToggleRight, DollarSign, Zap, Eye,
  BarChart3, Layers, Loader2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKAGE_ID, LOOTBOX_REGISTRY, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { ProtocolInspector } from "./protocol-inspector";
import type { LootboxOption, LootboxFullData, NFTTypeData } from "../_hooks/use-admin-data";
import { RARITY_LABELS } from "@/lib/mock-data";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function mistToSui(mist: string): string {
  const n = parseInt(mist || "0");
  return (n / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function totalNfts(box: LootboxFullData): number {
  return box.common_configs.length + box.rare_configs.length + box.super_rare_configs.length +
    box.ssr_configs.length + box.ultra_rare_configs.length + box.legend_rare_configs.length;
}

function totalVariants(box: LootboxFullData): number {
  const all = [
    ...box.common_configs, ...box.rare_configs, ...box.super_rare_configs,
    ...box.ssr_configs, ...box.ultra_rare_configs, ...box.legend_rare_configs,
  ];
  return all.reduce((acc, nft) => acc + (nft.variant_configs?.length ?? 0), 0);
}

function allNftOptions(box: LootboxFullData): { nft: NFTTypeData; rarity: number }[] {
  return [
    ...box.common_configs.map(n => ({ nft: n, rarity: 0 })),
    ...box.rare_configs.map(n => ({ nft: n, rarity: 1 })),
    ...box.super_rare_configs.map(n => ({ nft: n, rarity: 2 })),
    ...box.ssr_configs.map(n => ({ nft: n, rarity: 3 })),
    ...box.ultra_rare_configs.map(n => ({ nft: n, rarity: 4 })),
    ...box.legend_rare_configs.map(n => ({ nft: n, rarity: 5 })),
  ];
}

const RARITY_COLORS = [
  "text-slate-400", "text-blue-500", "text-purple-500",
  "text-pink-500", "text-yellow-500", "text-red-500",
];

// ─────────────────────────────────────────────
// Stat mini-card
// ─────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, color = "text-slate-800" }: {
  icon: any; label: string; value: string; color?: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-slate-50 border border-slate-200">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={cn("text-lg font-bold font-headline", color)}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Variant toggle row
// ─────────────────────────────────────────────

function VariantToggleRow({
  nftName, rarity, variantName, enabled, boxId, onToggled,
}: {
  nftName: string; rarity: number; variantName: string;
  enabled: boolean; boxId: string; onToggled: () => void;
}) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const handleToggle = async () => {
    setIsPending(true);
    const txb = new Transaction();

    // FIX: correct argument order matches Move signature:
    // toggle_variant(lootbox, rarity: u8, nft_name: String, variant_name: String, enabled: bool, ctx)
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::toggle_variant`,
      arguments: [
        txb.object(boxId),
        txb.pure.u8(rarity),            // ← rarity FIRST (was swapped)
        txb.pure.string(nftName),       // ← nft_name SECOND (was swapped)
        txb.pure.string(variantName),
        txb.pure.bool(!enabled),
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: enabled ? "Variant Disabled" : "Variant Enabled", description: `${variantName} updated.` });
        setIsPending(false);
        setTimeout(onToggled, 2000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Toggle Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-lg border text-[11px] transition-all",
      enabled ? "bg-slate-50 border-slate-200" : "bg-red-50 border-red-200"
    )}>
      <div className="flex items-center gap-2">
        <Sparkles className={cn("w-3 h-3", enabled ? "text-purple-500" : "text-slate-400")} />
        <span className="font-bold text-slate-800">{variantName}</span>
        <span className={cn("text-[9px] font-bold", RARITY_COLORS[rarity])}>
          ({RARITY_LABELS[rarity as keyof typeof RARITY_LABELS]})
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        disabled={isPending}
        className={cn(
          "h-7 px-3 text-[10px] font-bold gap-1.5",
          enabled ? "text-green-600 hover:text-red-500" : "text-red-500 hover:text-green-600"
        )}
      >
        {isPending
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : enabled
            ? <><ToggleRight className="w-3.5 h-3.5" /> On</>
            : <><ToggleLeft className="w-3.5 h-3.5" /> Off</>
        }
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Expanded box panel
// ─────────────────────────────────────────────

function LiveBoxPanel({
  box, fullData, isFetching, onRefreshFull, onPauseToggle, isPending,
}: {
  box: LootboxOption;
  fullData: LootboxFullData | null;
  isFetching: boolean;
  onRefreshFull: () => void;
  onPauseToggle: (boxId: string, currentlyActive: boolean) => void;
  isPending: boolean;
}) {
  const [showInspector, setShowInspector] = useState(false);
  const [showVariants, setShowVariants]   = useState(false);
  const [showPriceEdit, setShowPriceEdit] = useState(false);
  const [newSuiPrice, setNewSuiPrice]     = useState("");
  const [newGyatePrice, setNewGyatePrice] = useState("");

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const [isPriceUpdating, setIsPriceUpdating] = useState(false);

  const handleUpdatePrice = async () => {
    if (!newSuiPrice && !newGyatePrice) return;

    // update_prices requires the box to be PAUSED first.
    // We warn if the box is currently active.
    if (box.isActive) {
      toast({
        variant: "destructive",
        title: "Box must be paused",
        description: "Pause the lootbox before updating prices (Move requirement).",
      });
      return;
    }

    setIsPriceUpdating(true);
    const txb = new Transaction();

    // FIX: use `update_prices` (plural) which takes BOTH prices in one tx.
    // Signature: update_prices(registry, lootbox, new_sui_price: u64, new_gyate_price: u64, ctx)
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::update_prices`,
      arguments: [
        txb.object(LOOTBOX_REGISTRY),   // ← registry required (was missing)
        txb.object(box.id),
        txb.pure.u64(
          newSuiPrice
            ? BigInt(Math.floor(parseFloat(newSuiPrice) * 1_000_000_000))
            : BigInt(box.price)
        ),
        txb.pure.u64(
          newGyatePrice ? BigInt(newGyatePrice) : BigInt(box.gyatePrice)
        ),
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Price Updated", description: "New prices are live on-chain." });
        setIsPriceUpdating(false);
        setShowPriceEdit(false);
        setNewSuiPrice("");
        setNewGyatePrice("");
        setTimeout(onRefreshFull, 2000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Update Failed", description: err.message });
        setIsPriceUpdating(false);
      },
    });
  };

  const variants = fullData
    ? allNftOptions(fullData).flatMap(({ nft, rarity }) =>
        (nft.variant_configs ?? []).map(v => ({
          nftName: nft.name,
          rarity,
          variantName: v.fields.variant_name,
          enabled: v.fields.enabled,
        }))
      )
    : [];

  const activeVariants   = variants.filter(v => v.enabled).length;
  const inactiveVariants = variants.filter(v => !v.enabled).length;

  return (
    <Card className={cn(
      "border transition-all shadow-[3px_3px_0px_rgba(201,184,255,0.3)]",
      box.isActive ? "border-green-200" : "border-orange-200"
    )}>
      <CardContent className="p-5">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1",
              box.isActive ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-orange-400"
            )} />
            <div className="min-w-0">
              <h3 className="font-headline font-bold text-lg truncate text-slate-900">{box.name}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                  box.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700"
                )}>
                  {box.isActive ? "Live" : "Paused"}
                </span>
                {box.pityEnabled && (
                  <Badge variant="outline" className="text-[9px] border-purple-300 text-purple-600 py-0">Pity</Badge>
                )}
                {box.multiOpenEnabled && (
                  <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-600 py-0">{box.multiOpenSize}x Multi</Badge>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPauseToggle(box.id, box.isActive)}
            disabled={isPending}
            className={cn(
              "h-8 px-4 text-xs font-bold border gap-1.5 flex-shrink-0",
              box.isActive
                ? "border-orange-300 text-orange-600 hover:bg-orange-50"
                : "border-green-300 text-green-600 hover:bg-green-50"
            )}
          >
            {isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : box.isActive
                ? <><Pause className="w-3 h-3" /> Pause</>
                : <><Play className="w-3 h-3" /> Resume</>
            }
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          <StatPill
            icon={TrendingUp}
            label="Total Opens"
            value={parseInt(box.totalOpens || "0").toLocaleString()}
            color="text-purple-600"
          />
          <StatPill
            icon={Coins}
            label="SUI Revenue"
            value={`${mistToSui(box.totalRevenueMist)} SUI`}
            color="text-green-600"
          />
          <StatPill
            icon={Zap}
            label="GYATE Spent"
            value={parseInt(box.totalGyateSpent || "0").toLocaleString()}
            color="text-pink-600"
          />
          <StatPill
            icon={DollarSign}
            label="Price"
            value={`${mistToSui(box.price)} SUI`}
            color="text-slate-700"
          />
        </div>

        {/* Inventory health */}
        {fullData && (
          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Inventory Health
              </span>
              <span>{totalNfts(fullData)} types · {totalVariants(fullData)} variants</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {(["common_configs", "rare_configs", "super_rare_configs", "ssr_configs", "ultra_rare_configs", "legend_rare_configs"] as const).map((key, i) => {
                const count  = fullData[key].length;
                const labels = ["C", "R", "SR", "SSR", "UR", "LR"];
                return (
                  <div key={i} className={cn(
                    "rounded-lg p-2 text-center border",
                    count > 0 ? "bg-white border-slate-200" : "bg-red-50 border-red-200"
                  )}>
                    <div className={cn("text-[9px] font-bold uppercase", RARITY_COLORS[i])}>{labels[i]}</div>
                    <div className={cn("text-sm font-bold", count > 0 ? "text-slate-800" : "text-red-500")}>{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowInspector(!showInspector);
              if (!fullData && !isFetching) onRefreshFull();
            }}
            className="h-8 text-xs border-slate-200 gap-1.5 text-slate-700"
          >
            <Eye className="w-3 h-3" />
            {showInspector ? "Hide" : "Inspect"}
          </Button>

          {/* Only show Variants button after fullData is loaded */}
          {fullData && variants.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVariants(!showVariants)}
              className="h-8 text-xs border-slate-200 gap-1.5 text-slate-700"
            >
              <Sparkles className="w-3 h-3" />
              Variants
              {inactiveVariants > 0 && (
                <span className="ml-1 text-[9px] bg-red-100 text-red-600 rounded-full px-1.5 font-bold">
                  {inactiveVariants} off
                </span>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPriceEdit(!showPriceEdit)}
            className="h-8 text-xs border-slate-200 gap-1.5 text-slate-700"
          >
            <DollarSign className="w-3 h-3" /> Edit Price
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshFull}
            disabled={isFetching}
            className="h-8 text-xs text-slate-500 gap-1.5 ml-auto"
          >
            <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
            Sync
          </Button>
        </div>

        {/* Price edit panel */}
        {showPriceEdit && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
            {/* Warn if box is live — update_prices requires paused */}
            {box.isActive && (
              <div className="flex items-center gap-2 text-[11px] text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Pause the lootbox first — Move requires the box to be paused to update prices.
              </div>
            )}
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Update Prices</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">New SUI Price</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  placeholder={`Current: ${mistToSui(box.price)} SUI`}
                  value={newSuiPrice}
                  onChange={(e) => setNewSuiPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-600">New GYATE Price</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  placeholder={`Current: ${box.gyatePrice} GYATE`}
                  value={newGyatePrice}
                  onChange={(e) => setNewGyatePrice(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleUpdatePrice}
              disabled={isPriceUpdating || (!newSuiPrice && !newGyatePrice) || box.isActive}
              className="w-full h-9 font-bold text-xs bg-slate-900 text-white hover:bg-slate-800"
            >
              {isPriceUpdating && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
              Confirm Price Update
            </Button>
          </div>
        )}

        {/* Variant toggle panel */}
        {showVariants && fullData && variants.length > 0 && (
          <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Variant Controls
              <span className="text-green-600 ml-2">{activeVariants} active</span>
              {inactiveVariants > 0 && (
                <span className="text-red-500">· {inactiveVariants} disabled</span>
              )}
            </p>
            <div className="grid gap-1.5">
              {variants.map((v, idx) => (
                <VariantToggleRow
                  key={`${v.nftName}-${v.variantName}-${idx}`}
                  boxId={box.id}
                  nftName={v.nftName}
                  rarity={v.rarity}
                  variantName={v.variantName}
                  enabled={v.enabled}
                  onToggled={onRefreshFull}
                />
              ))}
            </div>
          </div>
        )}

        {/* Inspector */}
        {showInspector && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2">
            <ProtocolInspector
              data={fullData}
              isFetching={isFetching}
              title={`${box.name} Contents`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Main Tab
// ─────────────────────────────────────────────

interface LiveProtocolsTabProps {
  liveBoxes: LootboxOption[];
  isLoadingBoxes: boolean;
  fetchLootboxes: () => void;
  fetchFullBoxData: (
    id: string,
    setter: (d: LootboxFullData | null) => void,
    setLoading?: (v: boolean) => void
  ) => Promise<void>;
}

export function LiveProtocolsTab({
  liveBoxes, isLoadingBoxes, fetchLootboxes, fetchFullBoxData,
}: LiveProtocolsTabProps) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const [boxFullData, setBoxFullData] = useState<Record<string, LootboxFullData | null>>({});
  const [boxFetching, setBoxFetching] = useState<Record<string, boolean>>({});

  const refreshBox = useCallback((id: string) => {
    setBoxFetching(prev => ({ ...prev, [id]: true }));
    fetchFullBoxData(
      id,
      (data) => setBoxFullData(prev => ({ ...prev, [id]: data })),
      (loading) => setBoxFetching(prev => ({ ...prev, [id]: loading }))
    );
  }, [fetchFullBoxData]);

  // FIX: pause/unpause — correct, matches Move signature:
  // pause(registry: &mut LootboxRegistry, lootbox: &mut LootboxConfig, ctx)
  const handlePauseToggle = async (boxId: string, currentlyActive: boolean) => {
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${currentlyActive ? FUNCTIONS.PAUSE : FUNCTIONS.UNPAUSE}`,
      arguments: [
        txb.object(LOOTBOX_REGISTRY), // registry first ✓
        txb.object(boxId),            // lootbox second ✓
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({
          title: currentlyActive ? "Lootbox Paused" : "Lootbox Resumed",
          description: currentlyActive ? "Removed from active shop." : "Now live in the shop.",
        });
        setIsPending(false);
        setTimeout(fetchLootboxes, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  const totalOpens   = liveBoxes.reduce((acc, b) => acc + parseInt(b.totalOpens   || "0"), 0);
  const totalRevenue = liveBoxes.reduce((acc, b) => acc + parseInt(b.totalRevenueMist || "0"), 0);
  const activeCount  = liveBoxes.filter(b => b.isActive).length;
  const pausedCount  = liveBoxes.length - activeCount;

  return (
    <div className="space-y-8">

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 p-4 space-y-1 shadow-[3px_3px_0px_rgba(201,184,255,0.3)]">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-green-500" /> Live
          </div>
          <div className="text-3xl font-bold font-headline text-green-600">{activeCount}</div>
        </Card>
        <Card className="border-slate-200 p-4 space-y-1 shadow-[3px_3px_0px_rgba(201,184,255,0.3)]">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Pause className="w-3 h-3 text-orange-400" /> Paused
          </div>
          <div className="text-3xl font-bold font-headline text-orange-500">{pausedCount}</div>
        </Card>
        <Card className="border-slate-200 p-4 space-y-1 shadow-[3px_3px_0px_rgba(201,184,255,0.3)]">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3 text-purple-500" /> Total Opens
          </div>
          <div className="text-3xl font-bold font-headline text-slate-800">{totalOpens.toLocaleString()}</div>
        </Card>
        <Card className="border-slate-200 p-4 space-y-1 shadow-[3px_3px_0px_rgba(201,184,255,0.3)]">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Coins className="w-3 h-3 text-yellow-500" /> Total Revenue
          </div>
          <div className="text-3xl font-bold font-headline text-yellow-600">
            {(totalRevenue / 1_000_000_000).toFixed(2)} SUI
          </div>
        </Card>
      </div>

      {/* Box list */}
      {isLoadingBoxes ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading protocols...
        </div>
      ) : liveBoxes.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border-2 border-dashed border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No finalized lootboxes yet.</p>
          <p className="text-[11px] text-slate-400 mt-1">Activate a draft from the Lootbox Factory tab first.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {liveBoxes.map((box) => (
            <LiveBoxPanel
              key={box.id}
              box={box}
              fullData={boxFullData[box.id] ?? null}
              isFetching={boxFetching[box.id] ?? false}
              onRefreshFull={() => refreshBox(box.id)}
              onPauseToggle={handlePauseToggle}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}