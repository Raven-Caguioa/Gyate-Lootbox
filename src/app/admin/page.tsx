"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, TREASURY_POOL, LOOTBOX_REGISTRY, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Coins, ArrowUpRight, Lock, Package, Settings, Sparkles, CheckCircle2, ListPlus, RefreshCw, Eye, ChevronDown, ChevronRight, Image as ImageIcon, Info } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { RARITY_LABELS } from "@/lib/mock-data";

interface LootboxOption {
  id: string;
  name: string;
  isSetup: boolean;
  isActive: boolean;
}

interface VariantData {
  variant_name: string;
  drop_rate: string;
  value_multiplier: string;
  custom_image_url: string;
  enabled: boolean;
}

interface NFTTypeData {
  name: string;
  base_value: string;
  base_image_url: string;
  variant_configs: { fields: VariantData }[];
  min_hp: string;
  max_hp: string;
  min_atk: string;
  max_atk: string;
  min_spd: string;
  max_spd: string;
  rarity?: number;
}

interface LootboxFullData {
  id: string;
  name: string;
  price: string;
  admin: string;
  is_active: boolean;
  is_setup_mode: boolean;
  pity_enabled: boolean;
  common_configs: NFTTypeData[];
  rare_configs: NFTTypeData[];
  super_rare_configs: NFTTypeData[];
  ssr_configs: NFTTypeData[];
  ultra_rare_configs: NFTTypeData[];
  legend_rare_configs: NFTTypeData[];
}

export default function AdminPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const [isPending, setIsPending] = useState(false);
  const [myLootboxes, setMyLootboxes] = useState<LootboxOption[]>([]);
  const [isLoadingBoxes, setIsLoadingBoxes] = useState(false);
  const [selectedBoxFullData, setSelectedBoxFullData] = useState<LootboxFullData | null>(null);
  const [isFetchingFullData, setIsFetchingFullData] = useState(false);

  // --- Step 1: Draft State ---
  const [newBoxName, setNewBoxName] = useState("");
  const [newBoxPrice, setNewBoxPrice] = useState("");
  const [pityEnabled, setPityEnabled] = useState(false);
  const [pityRare, setPityRare] = useState("10");
  const [pitySuperRare, setPitySuperRare] = useState("50");
  const [pityUltraRare, setPityUltraRare] = useState("100");

  // --- Step 2: Add NFT Type State ---
  const [targetBoxId, setTargetBoxId] = useState("");
  const [nftRarity, setNftRarity] = useState("0");
  const [nftName, setNftName] = useState("");
  const [nftValue, setNftValue] = useState("1000000000"); // 1 SUI in MIST
  const [nftImage, setNftImage] = useState("");
  const [stats, setStats] = useState({
    minHp: "100", maxHp: "200",
    minAtk: "10", maxAtk: "20",
    minSpd: "5", maxSpd: "15"
  });

  // --- Step 3: Variants State ---
  const [selectedNftForVariant, setSelectedNftForVariant] = useState<string>(""); // Format: "name|rarity"
  const [variantName, setVariantName] = useState("");
  const [variantDropRate, setVariantDropRate] = useState("5"); // 5%
  const [variantMultiplier, setVariantMultiplier] = useState("150"); // 1.5x (150 * 100 = 15000 BPS)
  const [variantImage, setVariantImage] = useState("");

  // --- Treasury State ---
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const fetchLootboxes = useCallback(async () => {
    setIsLoadingBoxes(true);
    try {
      const registryObj = await suiClient.getObject({
        id: LOOTBOX_REGISTRY,
        options: { showContent: true }
      });

      const allIds = (registryObj.data?.content as any)?.fields?.all_ids || [];
      
      if (allIds.length === 0) {
        setMyLootboxes([]);
        return;
      }

      const boxesData = await suiClient.multiGetObjects({
        ids: allIds,
        options: { showContent: true }
      });

      const boxes: LootboxOption[] = boxesData.map((obj: any) => {
        const fields = obj.data?.content?.fields;
        return {
          id: obj.data?.objectId,
          name: fields?.name || "Unnamed Box",
          isSetup: fields?.is_setup_mode || false,
          isActive: fields?.is_active || false,
        };
      });

      setMyLootboxes(boxes);
    } catch (err) {
      console.error("Failed to fetch boxes from registry:", err);
    } finally {
      setIsLoadingBoxes(false);
    }
  }, [suiClient]);

  const fetchFullBoxData = useCallback(async (id: string) => {
    if (!id) return;
    setIsFetchingFullData(true);
    try {
      const obj = await suiClient.getObject({
        id,
        options: { showContent: true }
      });
      const fields = (obj.data?.content as any)?.fields;
      if (fields) {
        setSelectedBoxFullData({
          id,
          name: fields.name,
          price: fields.price,
          admin: fields.admin,
          is_active: fields.is_active,
          is_setup_mode: fields.is_setup_mode,
          pity_enabled: fields.pity_enabled,
          common_configs: fields.common_configs.map((c: any) => ({ ...c.fields, rarity: 0 })),
          rare_configs: fields.rare_configs.map((c: any) => ({ ...c.fields, rarity: 1 })),
          super_rare_configs: fields.super_rare_configs.map((c: any) => ({ ...c.fields, rarity: 2 })),
          ssr_configs: fields.ssr_configs.map((c: any) => ({ ...c.fields, rarity: 3 })),
          ultra_rare_configs: fields.ultra_rare_configs.map((c: any) => ({ ...c.fields, rarity: 4 })),
          legend_rare_configs: fields.legend_rare_configs.map((c: any) => ({ ...c.fields, rarity: 5 })),
        });
      }
    } catch (err) {
      console.error("Failed to fetch full box data:", err);
    } finally {
      setIsFetchingFullData(false);
    }
  }, [suiClient]);

  useEffect(() => {
    fetchLootboxes();
  }, [fetchLootboxes]);

  useEffect(() => {
    if (targetBoxId) {
      fetchFullBoxData(targetBoxId);
    } else {
      setSelectedBoxFullData(null);
    }
  }, [targetBoxId, fetchFullBoxData]);

  const allAvailableNfts = useMemo(() => {
    if (!selectedBoxFullData) return [];
    return [
      ...selectedBoxFullData.common_configs,
      ...selectedBoxFullData.rare_configs,
      ...selectedBoxFullData.super_rare_configs,
      ...selectedBoxFullData.ssr_configs,
      ...selectedBoxFullData.ultra_rare_configs,
      ...selectedBoxFullData.legend_rare_configs,
    ];
  }, [selectedBoxFullData]);

  const handleCreateDraft = async () => {
    if (!newBoxName || !newBoxPrice) return;
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.CREATE_DRAFT}`,
      arguments: [
        txb.object(LOOTBOX_REGISTRY),
        txb.pure.string(newBoxName),
        txb.pure.u64(BigInt(parseFloat(newBoxPrice) * 1_000_000_000)),
        txb.pure.bool(pityEnabled),
        txb.pure.u64(BigInt(pityRare)),
        txb.pure.u64(BigInt(pitySuperRare)),
        txb.pure.u64(BigInt(pityUltraRare)),
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Draft Created", description: "Lootbox draft successfully deployed on-chain." });
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
        txb.pure.string(nftName),
        txb.pure.u64(BigInt(nftValue)),
        txb.pure.string(nftImage),
        txb.pure.u64(BigInt(stats.minHp)), txb.pure.u64(BigInt(stats.maxHp)),
        txb.pure.u64(BigInt(stats.minAtk)), txb.pure.u64(BigInt(stats.maxAtk)),
        txb.pure.u64(BigInt(stats.minSpd)), txb.pure.u64(BigInt(stats.maxSpd)),
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "NFT Type Added", description: `${nftName} added to rarity tier ${nftRarity}.` });
        setIsPending(false);
        setNftName("");
        fetchFullBoxData(targetBoxId);
      },
      onError: (err) => { 
        toast({ variant: "destructive", title: "Addition Failed", description: err.message }); 
        setIsPending(false); 
      },
    });
  };

  const handleAddVariant = async () => {
    if (!targetBoxId || !selectedNftForVariant || !variantName) return;
    const [name, rarity] = selectedNftForVariant.split("|");
    setIsPending(true);
    const txb = new Transaction();
    
    // Move function signature: (lootbox, nft_name, rarity, variant_name, drop_rate_pct, value_multiplier_pct, image_url, has_seq, from, until, max)
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.ADD_VARIANT}`,
      arguments: [
        txb.object(targetBoxId),
        txb.pure.string(name),
        txb.pure.u8(parseInt(rarity)),
        txb.pure.string(variantName),
        txb.pure.u64(BigInt(variantDropRate)), // Passed as percentage (e.g. 5 for 5%)
        txb.pure.u64(BigInt(variantMultiplier)), // Passed as percentage (e.g. 150 for 1.5x)
        txb.pure.string(variantImage),
        txb.pure.bool(true), // has_sequential_id
        txb.pure.u64(BigInt(0)), // available_from
        txb.pure.u64(BigInt(0)), // available_until
        txb.pure.u64(BigInt(0)), // max_mints
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Variant Added", description: `${variantName} variant added to ${name}.` });
        setIsPending(false);
        setVariantName("");
        fetchFullBoxData(targetBoxId);
      },
      onError: (err) => { 
        console.error("Add Variant Error:", err);
        toast({ 
          variant: "destructive", 
          title: "Failed to Add Variant", 
          description: "Ensure the drop rate doesn't exceed 100% and you are the box admin." 
        }); 
        setIsPending(false); 
      },
    });
  };

  const handleFinalize = async () => {
    if (!targetBoxId) return;
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.FINALIZE_AND_ACTIVATE}`,
      arguments: [
        txb.object(LOOTBOX_REGISTRY),
        txb.object(targetBoxId),
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Lootbox Activated!", description: "Box is now live for all players." });
        setIsPending(false);
        setTimeout(fetchLootboxes, 3000);
      },
      onError: (err) => { 
        toast({ variant: "destructive", title: "Activation Failed", description: err.message }); 
        setIsPending(false); 
      },
    });
  };

  const handleWithdraw = () => {
    if (!withdrawAmount) return;
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.TREASURY}::${FUNCTIONS.WITHDRAW}`,
      arguments: [
        txb.object(TREASURY_POOL),
        txb.pure.u64(BigInt(parseFloat(withdrawAmount) * 1_000_000_000)),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => toast({ title: "Success", description: "Funds withdrawn to admin wallet." }),
      onError: (err) => toast({ variant: "destructive", title: "Failed", description: err.message }),
    });
  };

  const renderRarityTier = (label: string, configs: NFTTypeData[]) => {
    if (!configs || configs.length === 0) return null;
    return (
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-white/5 pb-2">
          {label} ({configs.length})
        </h4>
        <div className="grid gap-3">
          {configs.map((nft, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0">
                  {nft.base_image_url ? (
                    <Image src={nft.base_image_url} alt={nft.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon className="w-4 h-4" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{nft.name}</div>
                  <div className="text-[10px] text-muted-foreground">Base: {parseInt(nft.base_value) / 1000000000} SUI</div>
                </div>
                <div className="flex flex-col items-end text-[10px] gap-1">
                  <Badge variant="outline" className="text-[9px] py-0 border-white/10">HP: {nft.min_hp}-{nft.max_hp}</Badge>
                  <Badge variant="outline" className="text-[9px] py-0 border-white/10">ATK: {nft.min_atk}-{nft.max_atk}</Badge>
                </div>
              </div>
              {nft.variant_configs && nft.variant_configs.length > 0 && (
                <div className="pl-14 space-y-1">
                  <div className="text-[9px] uppercase font-bold text-accent tracking-widest mb-1 flex items-center gap-1">
                    <Sparkles className="w-2 h-2" /> Variants
                  </div>
                  {nft.variant_configs.filter(v => v.fields.variant_name !== "Normal").map((v, vidx) => (
                    <div key={vidx} className="flex items-center justify-between text-[10px] bg-accent/5 rounded px-2 py-1 border border-accent/10">
                      <span className="font-medium text-accent">{v.fields.variant_name}</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>Drop: {parseInt(v.fields.drop_rate) / 100}%</span>
                        <span>Mult: {parseInt(v.fields.value_multiplier) / 10000}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen gradient-bg pb-20">
      <Navigation />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h1 className="font-headline text-5xl font-bold mb-4 tracking-tight">Platform Forge</h1>
              <p className="text-muted-foreground text-lg">On-chain protocol management for the GyateGyate ecosystem.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchLootboxes} 
                disabled={isLoadingBoxes}
                className="bg-white/5 border-white/10"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isLoadingBoxes && "animate-spin")} />
                Sync Drafts
              </Button>
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 px-4 py-2 text-sm">
                <Lock className="w-4 h-4 mr-2" /> Admin Session Active
              </Badge>
            </div>
          </div>

          <Tabs defaultValue="lootbox" className="space-y-8">
            <TabsList className="bg-white/5 border border-white/10 p-1 h-14">
              <TabsTrigger value="lootbox" className="px-8 h-full data-[state=active]:bg-primary">
                <Package className="w-4 h-4 mr-2" /> Lootbox Factory
              </TabsTrigger>
              <TabsTrigger value="treasury" className="px-8 h-full data-[state=active]:bg-primary">
                <Coins className="w-4 h-4 mr-2" /> Treasury & Tokens
              </TabsTrigger>
              <TabsTrigger value="variants" className="px-8 h-full data-[state=active]:bg-primary">
                <Sparkles className="w-4 h-4 mr-2" /> Variant Lab
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lootbox" className="space-y-8">
              <div className="grid md:grid-cols-[1fr_350px] gap-8">
                <div className="space-y-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Step 1: Create Draft */}
                    <Card className="glass-card border-primary/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Badge className="bg-primary/20 text-primary">01</Badge> Create Draft
                        </CardTitle>
                        <CardDescription>Initiate a new box on-chain</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Box Name</Label>
                          <Input value={newBoxName} onChange={(e) => setNewBoxName(e.target.value)} placeholder="e.g. Genesis Crate" />
                        </div>
                        <div className="space-y-2">
                          <Label>Price (SUI)</Label>
                          <Input type="number" value={newBoxPrice} onChange={(e) => setNewBoxPrice(e.target.value)} placeholder="0.5" />
                        </div>
                        <div className="pt-4 border-t border-white/5 space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">Pity System</Label>
                            <Switch checked={pityEnabled} onCheckedChange={setPityEnabled} />
                          </div>
                          {pityEnabled && (
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px]">Rare</Label>
                                <Input value={pityRare} onChange={(e) => setPityRare(e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">SR</Label>
                                <Input value={pitySuperRare} onChange={(e) => setPitySuperRare(e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px]">UR</Label>
                                <Input value={pityUltraRare} onChange={(e) => setPityUltraRare(e.target.value)} />
                              </div>
                            </div>
                          )}
                        </div>
                        <Button className="w-full glow-purple font-bold mt-4" onClick={handleCreateDraft} disabled={isPending}>
                          Deploy Draft Crate
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Step 2: Add NFT Types */}
                    <Card className="glass-card border-primary/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Badge className="bg-primary/20 text-primary">02</Badge> Add Contents
                        </CardTitle>
                        <CardDescription>Define NFT types for your drafts</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Select Draft Box</Label>
                          <Select value={targetBoxId} onValueChange={setTargetBoxId}>
                            <SelectTrigger className="bg-white/5 border-white/10">
                              <SelectValue placeholder={isLoadingBoxes ? "Loading..." : "Choose a draft..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {myLootboxes.filter(b => b.isSetup).map(box => (
                                <SelectItem key={box.id} value={box.id}>
                                  {box.name} <span className="text-[10px] opacity-50 ml-2">({box.id.slice(0,6)}...)</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label>Rarity (0-5)</Label>
                            <Select value={nftRarity} onValueChange={setNftRarity}>
                              <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[0,1,2,3,4,5].map(r => <SelectItem key={r} value={r.toString()}>{RARITY_LABELS[r as keyof typeof RARITY_LABELS]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>NFT Name</Label>
                            <Input value={nftName} onChange={(e) => setNftName(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Image URL</Label>
                          <Input value={nftImage} onChange={(e) => setNftImage(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1"><Label className="text-[10px]">HP Range</Label><Input placeholder="100-200" onChange={(e) => {
                            const parts = e.target.value.split("-");
                            if(parts.length === 2) setStats({...stats, minHp: parts[0], maxHp: parts[1]});
                          }} /></div>
                          <div className="space-y-1"><Label className="text-[10px]">ATK Range</Label><Input placeholder="10-20" onChange={(e) => {
                            const parts = e.target.value.split("-");
                            if(parts.length === 2) setStats({...stats, minAtk: parts[0], maxAtk: parts[1]});
                          }} /></div>
                          <div className="space-y-1"><Label className="text-[10px]">SPD Range</Label><Input placeholder="5-15" onChange={(e) => {
                            const parts = e.target.value.split("-");
                            if(parts.length === 2) setStats({...stats, minSpd: parts[0], maxSpd: parts[1]});
                          }} /></div>
                        </div>
                        <Button variant="outline" className="w-full border-white/10 hover:bg-white/10" onClick={handleAddNftType} disabled={isPending || !targetBoxId}>
                          Add NFT Type
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Step 3: Finalize */}
                  <Card className="glass-card border-accent/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Badge className="bg-accent/20 text-accent">03</Badge> Finalize & Deploy
                        </CardTitle>
                        <CardDescription>Activate the draft for public access</CardDescription>
                      </div>
                      <Button className="glow-violet bg-accent hover:bg-accent/80 font-bold px-8 h-12" onClick={handleFinalize} disabled={isPending || !targetBoxId}>
                        Go Live <ArrowUpRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardHeader>
                  </Card>
                </div>

                {/* Draft Preview Sidebar */}
                <Card className="glass-card border-white/10 flex flex-col h-[700px]">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                      <Eye className="w-4 h-4 text-accent" /> Draft Inspector
                    </CardTitle>
                    {targetBoxId && selectedBoxFullData ? (
                      <div className="pt-2">
                        <div className="font-bold text-lg">{selectedBoxFullData.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] px-1 h-4">{parseInt(selectedBoxFullData.price) / 1000000000} SUI</Badge>
                          {selectedBoxFullData.pity_enabled && <Badge className="text-[9px] px-1 h-4 bg-accent">Pity Enabled</Badge>}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground py-4 text-center">Select a draft to preview its content</div>
                    )}
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-4">
                      {isFetchingFullData ? (
                        <div className="flex items-center justify-center py-20 gap-2 text-sm text-muted-foreground">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Fetching config...
                        </div>
                      ) : selectedBoxFullData ? (
                        <div className="space-y-6">
                          {renderRarityTier("Legend Rare", selectedBoxFullData.legend_rare_configs)}
                          {renderRarityTier("Ultra Rare", selectedBoxFullData.ultra_rare_configs)}
                          {renderRarityTier("SSR", selectedBoxFullData.ssr_configs)}
                          {renderRarityTier("Super Rare", selectedBoxFullData.super_rare_configs)}
                          {renderRarityTier("Rare", selectedBoxFullData.rare_configs)}
                          {renderRarityTier("Common", selectedBoxFullData.common_configs)}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                            <Package className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <p className="text-xs text-muted-foreground">No draft selected. Choose one from Step 2 to inspect tiers.</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="treasury" className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <Card className="glass-card border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Coins className="w-5 h-5 text-accent" /> Treasury Pool
                    </CardTitle>
                    <CardDescription>Claim SUI from sales & fees</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Withdraw Amount (SUI)</Label>
                      <Input type="number" placeholder="0.0" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                    </div>
                    <Button className="w-full glow-purple font-bold" onClick={handleWithdraw}>
                      Withdraw to Admin <ArrowUpRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>

                <Card className="glass-card border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="w-5 h-5 text-blue-400" /> $GYATE Distribution
                    </CardTitle>
                    <CardDescription>Mint tokens for giveaways/rewards</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Recipient Address</Label>
                      <Input placeholder="0x..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (GYATE)</Label>
                      <Input type="number" />
                    </div>
                    <Button className="w-full bg-blue-600 hover:bg-blue-500 font-bold">
                      Mint $GYATE Tokens
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="variants" className="space-y-8">
               <Card className="glass-card border-primary/20 max-w-2xl mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ListPlus className="w-5 h-5 text-pink-400" /> Special Variant Lab
                    </CardTitle>
                    <CardDescription>Attach Shiny/Holographic variants to NFT types</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Target Box</Label>
                        <Select value={targetBoxId} onValueChange={setTargetBoxId}>
                          <SelectTrigger className="bg-white/5"><SelectValue placeholder="Select box..." /></SelectTrigger>
                          <SelectContent>
                            {myLootboxes.map(box => <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Base NFT Selection</Label>
                        <Select value={selectedNftForVariant} onValueChange={setSelectedNftForVariant} disabled={!targetBoxId}>
                          <SelectTrigger className="bg-white/5">
                            <SelectValue placeholder={targetBoxId ? "Select base hero..." : "Select box first..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {allAvailableNfts.length > 0 ? (
                              allAvailableNfts.map((nft, idx) => (
                                <SelectItem key={idx} value={`${nft.name}|${nft.rarity}`}>
                                  {nft.name} ({RARITY_LABELS[nft.rarity as keyof typeof RARITY_LABELS]})
                                </SelectItem>
                              ))
                            ) : (
                              <div className="p-2 text-center text-xs text-muted-foreground">No NFTs found in this box.</div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Variant Name</Label>
                        <Input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="e.g. Holographic" />
                      </div>
                      <div className="space-y-2">
                        <Label>Drop Rate (% of Total Box)</Label>
                        <Input type="number" value={variantDropRate} onChange={(e) => setVariantDropRate(e.target.value)} placeholder="e.g. 5" />
                        <p className="text-[10px] text-muted-foreground mt-1">1 = 1% probability</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Value Multiplier (%)</Label>
                        <Input type="number" value={variantMultiplier} onChange={(e) => setVariantMultiplier(e.target.value)} placeholder="e.g. 150" />
                        <p className="text-[10px] text-muted-foreground mt-1">100 = 1x, 150 = 1.5x</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Custom Variant Image URL</Label>
                        <Input value={variantImage} onChange={(e) => setVariantImage(e.target.value)} />
                      </div>
                    </div>
                    <Button 
                      className="w-full bg-pink-600 hover:bg-pink-500 font-bold"
                      onClick={handleAddVariant}
                      disabled={isPending || !targetBoxId || !selectedNftForVariant}
                    >
                      {isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Deploy Special Variant
                    </Button>
                  </CardContent>
               </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
