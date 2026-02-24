"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, RefreshCw, AlertCircle, Sparkles, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import type { LootboxFullData, NFTTypeData, VariantData } from "../_hooks/use-admin-data";

function RarityTier({ label, configs, isFetching }: {
  label: string;
  configs: NFTTypeData[];
  isFetching?: boolean;
}) {
  const isEmpty = !configs || configs.length === 0;
  return (
    <div className="space-y-4">
      <h4 className={cn(
        "text-xs font-bold uppercase tracking-widest border-b border-white/5 pb-2 flex justify-between",
        isEmpty ? "text-red-400" : "text-muted-foreground"
      )}>
        {label} ({configs?.length || 0})
        {isEmpty && <AlertCircle className="w-3 h-3" />}
      </h4>
      {isEmpty ? (
        <div className="py-4 text-[10px] text-center text-red-400/50 bg-red-400/5 rounded-lg border border-red-400/10 border-dashed">
          No characters registered in this tier
        </div>
      ) : (
        <div className="grid gap-3">
          {configs.map((nft, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0">
                  {nft.base_image_url ? (
                    <Image src={nft.base_image_url} alt={nft.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{nft.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Base: {parseInt(nft.base_value) / 1_000_000_000} SUI
                  </div>
                </div>
                <div className="flex flex-col items-end text-[10px] gap-1">
                  <Badge variant="outline" className="text-[9px] py-0 border-white/10">HP: {nft.min_hp}–{nft.max_hp}</Badge>
                  <Badge variant="outline" className="text-[9px] py-0 border-white/10">ATK: {nft.min_atk}–{nft.max_atk}</Badge>
                </div>
              </div>

              {nft.variant_configs && nft.variant_configs.length > 0 && (
                <div className="pl-4 space-y-2 border-l border-white/5 ml-6">
                  {nft.variant_configs.map((v, vIdx) => {
                    const variant: VariantData = v.fields;
                    return (
                      <div key={vIdx} className={cn(
                        "flex items-center justify-between text-[10px] p-2 rounded-lg border",
                        variant.enabled
                          ? "bg-white/5 border-white/5"
                          : "bg-red-500/5 border-red-500/10 opacity-50"
                      )}>
                        <div className="flex items-center gap-2">
                          <Sparkles className={cn("w-3 h-3", variant.enabled ? "text-accent" : "text-muted-foreground")} />
                          <span className="font-bold">{variant.variant_name}</span>
                          {!variant.enabled && (
                            <span className="text-[9px] bg-red-500/20 text-red-400 rounded px-1">disabled</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 opacity-70 font-mono">
                          <span>{parseInt(variant.drop_rate) / 100}%</span>
                          <span>{parseInt(variant.value_multiplier) / 10000}x</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ProtocolInspectorProps {
  data: LootboxFullData | null;
  isFetching: boolean;
  title?: string;
}

export function ProtocolInspector({ data, isFetching, title = "Protocol Inspector" }: ProtocolInspectorProps) {
  return (
    <Card className="glass-card border-white/10 flex flex-col h-[800px]">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
          <Eye className="w-4 h-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          {isFetching ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading...
            </div>
          ) : data ? (
            <div className="space-y-6">
              <RarityTier label="Legend Rare" configs={data.legend_rare_configs} />
              <RarityTier label="Ultra Rare"  configs={data.ultra_rare_configs} />
              <RarityTier label="SSR"         configs={data.ssr_configs} />
              <RarityTier label="Super Rare"  configs={data.super_rare_configs} />
              <RarityTier label="Rare"        configs={data.rare_configs} />
              <RarityTier label="Common"      configs={data.common_configs} />
            </div>
          ) : (
            <div className="text-center py-20 text-xs text-muted-foreground">Select a box to inspect</div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}