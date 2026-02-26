"use client";

import { useState, useCallback, useMemo } from "react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Pause, Play, RefreshCw, TrendingUp, Package,
  Coins, Sparkles, ToggleLeft, ToggleRight, DollarSign, Zap, Eye,
  Layers, Loader2, AlertTriangle, BarChart2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKAGE_ID, LOOTBOX_REGISTRY, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { ProtocolInspector } from "./protocol-inspector";
import type { LootboxOption, LootboxFullData, NFTTypeData } from "../_hooks/use-admin-data";
import { RARITY_LABELS } from "@/lib/mock-data";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type StatKey = "opens" | "revenue" | "gyate";

interface DailyPoint {
  date: string;
  opens: number;
  revenue: number;
  gyate: number;
}

// ─────────────────────────────────────────────
// Mock event data generator
// Replace with real Sui event queries in production:
// query NFTMintedEvent filtered by lootbox_name, group by timestamp epoch → date
// ─────────────────────────────────────────────

function generateMockHistory(boxes: LootboxOption[]): DailyPoint[] {
  const totalOpens = boxes.reduce((a, b) => a + parseInt(b.totalOpens || "0"), 0);
  const totalRev   = boxes.reduce((a, b) => a + parseInt(b.totalRevenueMist || "0"), 0);
  const totalGyate = boxes.reduce((a, b) => a + parseInt(b.totalGyateSpent || "0"), 0);

  const days = 14;
  const points: DailyPoint[] = [];
  let cumOpens = 0, cumRev = 0, cumGyate = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    // Distribute totals with some variance across days
    const weight = Math.random() * 0.12 + (i === 0 ? 0.15 : 0.04);
    const dayOpens = i === 0
      ? Math.max(0, totalOpens - cumOpens)
      : Math.floor(totalOpens * weight);
    const dayRev = i === 0
      ? Math.max(0, totalRev - cumRev)
      : Math.floor(totalRev * weight);
    const dayGyate = i === 0
      ? Math.max(0, totalGyate - cumGyate)
      : Math.floor(totalGyate * weight);

    cumOpens += dayOpens;
    cumRev   += dayRev;
    cumGyate += dayGyate;

    points.push({ date: label, opens: dayOpens, revenue: dayRev, gyate: dayGyate });
  }
  return points;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function mistToSui(mist: string | number): string {
  const n = typeof mist === "string" ? parseInt(mist || "0") : mist;
  return (n / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 3 });
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
  "text-slate-400", "text-blue-400", "text-purple-400",
  "text-pink-400", "text-yellow-400", "text-red-400",
];

const RARITY_BG = [
  "bg-slate-100", "bg-blue-50", "bg-purple-50",
  "bg-pink-50", "bg-yellow-50", "bg-red-50",
];

// ─────────────────────────────────────────────
// Stat config
// ─────────────────────────────────────────────

const STAT_CONFIG: Record<StatKey, {
  label: string;
  icon: any;
  color: string;
  stroke: string;
  gradient: [string, string];
  format: (v: number, boxes: LootboxOption[]) => string;
}> = {
  opens: {
    label: "Total Opens",
    icon: BarChart2,
    color: "text-violet-600",
    stroke: "#7c3aed",
    gradient: ["#7c3aed33", "#7c3aed00"],
    format: (v) => v.toLocaleString(),
  },
  revenue: {
    label: "SUI Revenue",
    icon: Coins,
    color: "text-emerald-600",
    stroke: "#059669",
    gradient: ["#05966933", "#05966900"],
    format: (v) => `${mistToSui(v)} SUI`,
  },
  gyate: {
    label: "GYATE Spent",
    icon: Zap,
    color: "text-pink-600",
    stroke: "#db2777",
    gradient: ["#db277733", "#db277700"],
    format: (v) => v.toLocaleString(),
  },
};

// ─────────────────────────────────────────────
// Custom Tooltip
// ─────────────────────────────────────────────

function ChartTooltip({ active, payload, label, activeMetric }: any) {
  if (!active || !payload?.length) return null;
  const cfg = STAT_CONFIG[activeMetric as StatKey];
  const val = payload[0]?.value ?? 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="text-slate-400 font-medium mb-1">{label}</p>
      <p className={cn("font-bold text-sm", cfg.color)}>
        {activeMetric === "revenue" ? `${mistToSui(val)} SUI` : val.toLocaleString()}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Clickable stat card
// ─────────────────────────────────────────────

function StatCard({
  statKey, value, isActive, onClick, boxes,
}: {
  statKey: StatKey;
  value: number;
  isActive: boolean;
  onClick: () => void;
  boxes: LootboxOption[];
}) {
  const cfg = STAT_CONFIG[statKey];
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all duration-200 w-full group",
        isActive
          ? "bg-white border-slate-300 shadow-md shadow-slate-100"
          : "bg-white/60 border-slate-200 hover:border-slate-300 hover:bg-white"
      )}
    >
      {isActive && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
          style={{ background: STAT_CONFIG[statKey].stroke }} />
      )}
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center",
          isActive ? "bg-slate-900" : "bg-slate-100 group-hover:bg-slate-200"
        )}>
          <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-slate-500")} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{cfg.label}</span>
      </div>
      <span className={cn("text-2xl font-bold tracking-tight", cfg.color)}>
        {cfg.format(value, boxes)}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────
// Analytics Panel
// ─────────────────────────────────────────────

function AnalyticsPanel({ boxes }: { boxes: LootboxOption[] }) {
  const [activeMetric, setActiveMetric] = useState<StatKey>("opens");
  const history = useMemo(() => generateMockHistory(boxes), [boxes]);

  const totalOpens   = boxes.reduce((a, b) => a + parseInt(b.totalOpens || "0"), 0);
  const totalRevenue = boxes.reduce((a, b) => a + parseInt(b.totalRevenueMist || "0"), 0);
  const totalGyate   = boxes.reduce((a, b) => a + parseInt(b.totalGyateSpent || "0"), 0);
  const activeCount  = boxes.filter(b => b.isActive).length;
  const pausedCount  = boxes.length - activeCount;

  const cfg = STAT_CONFIG[activeMetric];

  return (
    <div className="space-y-5">
      {/* Status row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold text-emerald-700">{activeCount} Live</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          <span className="text-[11px] font-bold text-orange-600">{pausedCount} Paused</span>
        </div>
        <span className="text-[10px] text-slate-400 ml-auto">
          {boxes.length} total protocol{boxes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Main panel: graph + stats */}
      <div className="grid grid-cols-[1fr_220px] gap-4">

        {/* Graph */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {cfg.label}
              </p>
              <p className={cn("text-xl font-bold mt-0.5", cfg.color)}>
                {activeMetric === "opens"
                  ? totalOpens.toLocaleString()
                  : activeMetric === "revenue"
                    ? `${mistToSui(totalRevenue)} SUI`
                    : totalGyate.toLocaleString()
                }
              </p>
            </div>
            <div className="text-[10px] text-slate-400">Last 14 days</div>
          </div>

          <div className="h-[180px] px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={cfg.stroke} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={cfg.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    activeMetric === "revenue"
                      ? `${(v / 1e9).toFixed(1)}`
                      : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
                  }
                />
                <Tooltip
                  content={<ChartTooltip activeMetric={activeMetric} />}
                  cursor={{ stroke: cfg.stroke, strokeWidth: 1, strokeDasharray: "4 2" }}
                />
                <Area
                  type="monotone"
                  dataKey={activeMetric}
                  stroke={cfg.stroke}
                  strokeWidth={2}
                  fill="url(#areaGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: cfg.stroke, stroke: "white", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stat cards — clickable to switch graph */}
        <div className="flex flex-col gap-2.5">
          <StatCard statKey="opens"   value={totalOpens}   isActive={activeMetric === "opens"}   onClick={() => setActiveMetric("opens")}   boxes={boxes} />
          <StatCard statKey="revenue" value={totalRevenue} isActive={activeMetric === "revenue"} onClick={() => setActiveMetric("revenue")} boxes={boxes} />
          <StatCard statKey="gyate"   value={totalGyate}   isActive={activeMetric === "gyate"}   onClick={() => setActiveMetric("gyate")}   boxes={boxes} />
        </div>
      </div>
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
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::toggle_variant`,
      arguments: [
        txb.object(boxId),
        txb.pure.u8(rarity),
        txb.pure.string(nftName),
        txb.pure.string(variantName),
        txb.pure.bool(!enabled),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: enabled ? "Variant Disabled" : "Variant Enabled" });
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
      "flex items-center justify-between px-3 py-2 rounded-xl border text-[11px] transition-all",
      enabled ? "bg-white border-slate-200" : "bg-red-50 border-red-200"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className={cn("w-3 h-3 flex-shrink-0", enabled ? "text-violet-500" : "text-slate-300")} />
        <span className="font-semibold text-slate-700 truncate">{variantName}</span>
        <span className={cn("text-[9px] font-bold flex-shrink-0", RARITY_COLORS[rarity])}>
          {(RARITY_LABELS as any)[rarity]}
        </span>
      </div>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
          enabled
            ? "text-emerald-600 hover:bg-emerald-50"
            : "text-red-500 hover:bg-red-100"
        )}
      >
        {isPending
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : enabled
            ? <><ToggleRight className="w-3.5 h-3.5" /> On</>
            : <><ToggleLeft className="w-3.5 h-3.5" /> Off</>
        }
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Box card
// ─────────────────────────────────────────────

function BoxCard({
  box, fullData, isFetching, onRefreshFull, onPauseToggle, isPending,
}: {
  box: LootboxOption;
  fullData: LootboxFullData | null;
  isFetching: boolean;
  onRefreshFull: () => void;
  onPauseToggle: (boxId: string, currentlyActive: boolean) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded]       = useState(false);
  const [showInspect, setShowInspect] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  const [showPrice, setShowPrice]     = useState(false);
  const [newSuiPrice, setNewSuiPrice] = useState("");
  const [newGyatePrice, setNewGyatePrice] = useState("");
  const [isPriceUpdating, setIsPriceUpdating] = useState(false);

  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const variants = useMemo(() => {
    if (!fullData) return [];
    return allNftOptions(fullData).flatMap(({ nft, rarity }) =>
      (nft.variant_configs ?? [])
        .filter(v => v.fields.variant_name !== "Normal")
        .map(v => ({
          nftName: nft.name,
          rarity,
          variantName: v.fields.variant_name,
          enabled: v.fields.enabled,
        }))
    );
  }, [fullData]);

  const disabledVariants = variants.filter(v => !v.enabled).length;

  const rarityKeys = [
    "common_configs", "rare_configs", "super_rare_configs",
    "ssr_configs", "ultra_rare_configs", "legend_rare_configs",
  ] as const;
  const rarityLabels = ["C", "R", "SR", "SSR", "UR", "LR"];

  const handleUpdatePrice = async () => {
    if (box.isActive) {
      toast({ variant: "destructive", title: "Pause first", description: "Box must be paused to update prices." });
      return;
    }
    setIsPriceUpdating(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::update_prices`,
      arguments: [
        txb.object(LOOTBOX_REGISTRY),
        txb.object(box.id),
        txb.pure.u64(newSuiPrice
          ? BigInt(Math.floor(parseFloat(newSuiPrice) * 1_000_000_000))
          : BigInt(box.price)),
        txb.pure.u64(newGyatePrice ? BigInt(newGyatePrice) : BigInt(box.gyatePrice)),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Prices updated" });
        setIsPriceUpdating(false);
        setShowPrice(false);
        setNewSuiPrice(""); setNewGyatePrice("");
        setTimeout(onRefreshFull, 2000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Update failed", description: err.message });
        setIsPriceUpdating(false);
      },
    });
  };

  return (
    <div className={cn(
      "rounded-2xl border bg-white transition-all duration-200",
      box.isActive ? "border-slate-200" : "border-orange-200 bg-orange-50/30"
    )}>
      {/* ── Header row ── */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Status dot */}
        <span className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          box.isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-orange-400"
        )} />

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 truncate">{box.name}</span>
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
              box.isActive ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-600"
            )}>
              {box.isActive ? "Live" : "Paused"}
            </span>
            {box.pityEnabled && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">
                Pity
              </span>
            )}
            {box.multiOpenEnabled && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                {box.multiOpenSize}× Multi
              </span>
            )}
          </div>
          {/* Inline mini stats */}
          <div className="flex items-center gap-4 mt-1">
            <span className="text-[10px] text-slate-400">
              <span className="font-semibold text-slate-600">{parseInt(box.totalOpens || "0").toLocaleString()}</span> opens
            </span>
            <span className="text-[10px] text-slate-400">
              <span className="font-semibold text-emerald-600">{mistToSui(box.totalRevenueMist || "0")}</span> SUI
            </span>
            <span className="text-[10px] text-slate-400">
              <span className="font-semibold text-pink-600">{parseInt(box.totalGyateSpent || "0").toLocaleString()}</span> GYATE
            </span>
            <span className="text-[10px] text-slate-400">
              <span className="font-semibold text-slate-600">{mistToSui(box.price || "0")}</span> SUI / open
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPauseToggle(box.id, box.isActive)}
            disabled={isPending}
            className={cn(
              "h-8 px-3 text-xs font-semibold gap-1.5",
              box.isActive
                ? "text-orange-500 hover:bg-orange-50"
                : "text-emerald-600 hover:bg-emerald-50"
            )}
          >
            {isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : box.isActive
                ? <><Pause className="w-3 h-3" /> Pause</>
                : <><Play className="w-3 h-3" /> Resume</>
            }
          </Button>
          <button
            onClick={() => {
              setExpanded(!expanded);
              if (!expanded && !fullData && !isFetching) onRefreshFull();
            }}
            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-all"
          >
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">

          {/* Rarity inventory */}
          {fullData && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Inventory
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {rarityKeys.map((key, i) => {
                  const count = fullData[key].length;
                  return (
                    <div key={i} className={cn(
                      "rounded-xl p-2.5 text-center border",
                      count > 0 ? `${RARITY_BG[i]} border-transparent` : "bg-red-50 border-red-200"
                    )}>
                      <div className={cn("text-[9px] font-bold", RARITY_COLORS[i])}>{rarityLabels[i]}</div>
                      <div className={cn("text-sm font-bold mt-0.5", count > 0 ? "text-slate-700" : "text-red-500")}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setShowInspect(!showInspect); if (!fullData && !isFetching) onRefreshFull(); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all",
                showInspect ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              )}
            >
              <Eye className="w-3 h-3" /> Inspect
            </button>

            {fullData && variants.length > 0 && (
              <button
                onClick={() => setShowVariants(!showVariants)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all",
                  showVariants ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                <Sparkles className="w-3 h-3" /> Variants
                {disabledVariants > 0 && (
                  <span className="ml-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {disabledVariants}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setShowPrice(!showPrice)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all",
                showPrice ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              )}
            >
              <DollarSign className="w-3 h-3" /> Edit Price
            </button>

            <button
              onClick={onRefreshFull}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border bg-white text-slate-600 border-slate-200 hover:border-slate-300 transition-all ml-auto disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
              Sync
            </button>
          </div>

          {/* Price edit */}
          {showPrice && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              {box.isActive && (
                <div className="flex items-center gap-2 text-[11px] text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Pause this box before updating prices.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-slate-500 font-semibold">SUI Price</Label>
                  <Input type="number" className="h-8 text-xs" placeholder={`${mistToSui(box.price)} SUI`} value={newSuiPrice} onChange={e => setNewSuiPrice(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-slate-500 font-semibold">GYATE Price</Label>
                  <Input type="number" className="h-8 text-xs" placeholder={`${box.gyatePrice} GYATE`} value={newGyatePrice} onChange={e => setNewGyatePrice(e.target.value)} />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleUpdatePrice}
                disabled={isPriceUpdating || (!newSuiPrice && !newGyatePrice) || box.isActive}
                className="w-full h-8 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
              >
                {isPriceUpdating && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                Confirm
              </Button>
            </div>
          )}

          {/* Variants */}
          {showVariants && fullData && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Variant Controls
              </p>
              <div className="space-y-1.5">
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
          {showInspect && (
            <ProtocolInspector data={fullData} isFetching={isFetching} title={`${box.name} Contents`} />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main export
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

  const [boxFullData, setBoxFullData]   = useState<Record<string, LootboxFullData | null>>({});
  const [boxFetching, setBoxFetching]   = useState<Record<string, boolean>>({});

  const refreshBox = useCallback((id: string) => {
    setBoxFetching(prev => ({ ...prev, [id]: true }));
    fetchFullBoxData(
      id,
      (data) => setBoxFullData(prev => ({ ...prev, [id]: data })),
      (loading) => setBoxFetching(prev => ({ ...prev, [id]: loading }))
    );
  }, [fetchFullBoxData]);

  const handlePauseToggle = async (boxId: string, currentlyActive: boolean) => {
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${currentlyActive ? FUNCTIONS.PAUSE : FUNCTIONS.UNPAUSE}`,
      arguments: [txb.object(LOOTBOX_REGISTRY), txb.object(boxId)],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: currentlyActive ? "Paused" : "Resumed" });
        setIsPending(false);
        setTimeout(fetchLootboxes, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  return (
    <div className="space-y-8">

      {/* Analytics section */}
      {!isLoadingBoxes && liveBoxes.length > 0 && (
        <AnalyticsPanel boxes={liveBoxes} />
      )}

      {/* Divider */}
      {liveBoxes.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Protocols
          </span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
      )}

      {/* Box list */}
      {isLoadingBoxes ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-400 gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading protocols...
        </div>
      ) : liveBoxes.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border-2 border-dashed border-slate-200">
          <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">No finalized lootboxes yet.</p>
          <p className="text-xs text-slate-300 mt-1">Activate a draft from the Lootbox Factory tab first.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {liveBoxes.map((box) => (
            <BoxCard
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