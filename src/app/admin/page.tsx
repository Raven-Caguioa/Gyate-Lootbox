
"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, TREASURY_POOL, LOOTBOX_REGISTRY, MODULE_NAMES, FUNCTIONS, ACHIEVEMENT_REGISTRY, TREASURY_CAP } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Coins, ArrowUpRight, Package, RefreshCw, Eye, Image as ImageIcon, Wallet, Clock, Hash, Sparkles, Trophy, Users, FileText, Gift, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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
  has_sequential_id: boolean;
  sequential_id_counter: string;
  available_from: string;
  available_until: string;
  max_mints: string;
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
  gyate_price: string;
  admin: string;
  is_active: boolean;
  is_setup_mode: boolean;
  pity_enabled: boolean;
  multi_open_enabled: boolean;
  multi_open_size: string;
  common_configs: NFTTypeData[];
  rare_configs: NFTTypeData[];
  super_rare_configs: NFTTypeData[];
  ssr_configs: NFTTypeData[];
  ultra_rare_configs: NFTTypeData[];
  legend_rare_configs: NFTTypeData[];
}

interface AchievementDef {
  id: string;
  name: string;
  description: string;
  badge_image_url: string;
  gyate_reward: string;
  requirement_type: number;
  requirement_value: string;
  requirement_rarity: number;
  enabled: boolean;
  total_claimed: string;
}

interface TreasuryStats {
  balance: string;
  totalFromLootboxes: string;
  totalFromMarketplace: string;
  totalWithdrawn: string;
}

const REQ_LABELS: Record<number, string> = {
  0: "Open Count",
  1: "Burn Count",
  2: "Rarity Mint",
  3: "GYATE Spent",
  4: "Admin Granted",
};

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

  // --- Achievement State ---
  const [achievements, setAchievements] = useState<AchievementDef[]>([]);
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false);
  const [newAch, setNewAch] = useState({
    name: "",
    description: "",
    imageUrl: "",
    reward: "100",
    reqType: "0",
    reqValue: "10",
    reqRarity: "0"
  });
  const [grantTarget, setGrantTarget] = useState("");
  const [selectedGrantAch, setSelectedGrantAch] = useState("");

  // --- Treasury State ---
  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats | null>(null);
  const [isFetchingTreasury, setIsFetchingTreasury] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // --- Step 1: Draft State ---
  const [newBoxName, setNewBoxName] = useState("");
  const [newBoxPrice, setNewBoxPrice] = useState("1");
  const [newGyatePrice, setNewGyatePrice] = useState("100");
  const [pityEnabled, setPityEnabled] = useState(false);
  const [pityThresholds, setPityThresholds] = useState({
    common: "0", rare: "10", sr: "50", ssr: "75", ur: "150", lr: "500"
  });
  const [multiOpenEnabled, setMultiOpenEnabled] = useState(true);
  const [multiOpenSize, setMultiOpenSize] = useState("10");
  const [guaranteeRarity, setGuaranteeRarity] = useState("1");

  // --- Step 2: Add NFT Type State ---
  const [targetBoxId, setTargetBoxId] = useState("");
  const [nftRarity, setNftRarity] = useState("0");
  const [nftName, setNftName] = useState("");
  const [nftValue, setNftValue] = useState("1000000000"); 
  const [nftImage, setNftImage] = useState("");
  const [stats, setStats] = useState({
    minHp: "100", maxHp: "200",
    minAtk: "10", maxAtk: "20",
    minSpd: "5", maxSpd: "15"
  });

  // --- Step 3: Variants State ---
  const [selectedNftForVariant, setSelectedNftForVariant] = useState<string>(""); 
  const [variantName, setVariantName] = useState("");
  const [variantDropRate, setVariantDropRate] = useState("5"); 
  const [variantMultiplier, setVariantMultiplier] = useState("150"); 
  const [variantImage, setVariantImage] = useState("");
  const [hasSeqId, setHasSeqId] = useState(false);
  const [useLimits, setUseLimits] = useState(false);
  const [availFrom, setAvailFrom] = useState("0");
  const [availUntil, setAvailUntil] = useState("0");
  const [maxMints, setMaxMints] = useState("0");

  const fetchAchievements = useCallback(async () => {
    setIsLoadingAchievements(true);
    try {
      const obj = await suiClient.getObject({
        id: ACHIEVEMENT_REGISTRY,
        options: { showContent: true }
      });
      const achs = (obj.data?.content as any)?.fields?.achievements || [];
      setAchievements(achs.map((a: any) => a.fields));
    } catch (err) {
      console.error("Failed to fetch achievements:", err);
    } finally {
      setIsLoadingAchievements(false);
    }
  }, [suiClient]);

  const fetchTreasuryData = useCallback(async () => {
    setIsFetchingTreasury(true);
    try {
      const obj = await suiClient.getObject({
        id: TREASURY_POOL,
        options: { showContent: true }
      });
      const fields = (obj.data?.content as any)?.fields;
      if (fields) {
        setTreasuryStats({
          balance: fields.balance,
          totalFromLootboxes: fields.total_from_lootboxes,
          totalFromMarketplace: fields.total_from_marketplace,
          totalWithdrawn: fields.total_withdrawn,
        });
      }
    } catch (err) {
      console.error("Failed to fetch treasury pool:", err);
    } finally {
      setIsFetchingTreasury(false);
    }
  }, [suiClient]);

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
          gyate_price: fields.gyate_price,
          admin: fields.admin,
          is_active: fields.is_active,
          is_setup_mode: fields.is_setup_mode,
          pity_enabled: fields.pity_enabled,
          multi_open_enabled: fields.multi_open_enabled,
          multi_open_size: fields.multi_open_size,
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
    fetchTreasuryData();
    fetchAchievements();
  }, [fetchLootboxes, fetchTreasuryData, fetchAchievements]);

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
        txb.pure.u64(BigInt(newGyatePrice)),
        txb.pure.bool(pityEnabled),
        txb.pure.u64(BigInt(pityThresholds.common)),
        txb.pure.u64(BigInt(pityThresholds.rare)),
        txb.pure.u64(BigInt(pityThresholds.sr)),
        txb.pure.u64(BigInt(pityThresholds.ssr)),
        txb.pure.u64(BigInt(pityThresholds.ur)),
        txb.pure.u64(BigInt(pityThresholds.lr)),
        txb.pure.bool(multiOpenEnabled),
        txb.pure.u64(BigInt(multiOpenSize)),
        txb.pure.u8(parseInt(guaranteeRarity)),
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
        toast({ title: "NFT Type Added", description: `${nftName} added to registry.` });
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
    
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.ADD_VARIANT}`,
      arguments: [
        txb.object(targetBoxId),
        txb.pure.string(name),
        txb.pure.u8(parseInt(rarity)),
        txb.pure.string(variantName),
        txb.pure.u64(BigInt(variantDropRate)), 
        txb.pure.u64(BigInt(variantMultiplier)), 
        txb.pure.string(variantImage),
        txb.pure.bool(hasSeqId), 
        txb.pure.u64(BigInt(useLimits ? availFrom : "0")), 
        txb.pure.u64(BigInt(useLimits ? availUntil : "0")), 
        txb.pure.u64(BigInt(useLimits ? maxMints : "0")), 
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Variant Added", description: `${variantName} variant deployed.` });
        setIsPending(false);
        setVariantName("");
        fetchFullBoxData(targetBoxId);
      },
      onError: (err) => { 
        toast({ variant: "destructive", title: "Failed", description: "Check variant parameters." }); 
        setIsPending(false); 
      },
    });
  };

  const handleCreateAchievement = async () => {
    if (!newAch.name || !newAch.description) return;
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::${FUNCTIONS.CREATE_ACHIEVEMENT}`,
      arguments: [
        txb.object(ACHIEVEMENT_REGISTRY),
        txb.pure.string(newAch.name),
        txb.pure.string(newAch.description),
        txb.pure.string(newAch.imageUrl),
        txb.pure.u64(BigInt(newAch.reward)),
        txb.pure.u8(parseInt(newAch.reqType)),
        txb.pure.u64(BigInt(newAch.reqValue)),
        txb.pure.u8(parseInt(newAch.reqRarity)),
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Achievement Created", description: "New on-chain goal registered." });
        setIsPending(false);
        setNewAch({ ...newAch, name: "", description: "" });
        fetchAchievements();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Creation Failed", description: err.message });
        setIsPending(false);
      }
    });
  };

  const handleAdminGrant = async () => {
    if (!grantTarget || !selectedGrantAch) return;
    setIsPending(true);
    
    try {
      const statsObjects = await suiClient.getOwnedObjects({
        owner: grantTarget,
        filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::PlayerStats` }
      });

      if (statsObjects.data.length === 0) {
        toast({ variant: "destructive", title: "User Error", description: "Target address has not initialized stats." });
        setIsPending(false);
        return;
      }

      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::CLAIM_ACHIEVEMENT`, 
        arguments: [
           txb.object(ACHIEVEMENT_REGISTRY),
           txb.object(statsObjects.data[0].data!.objectId),
           txb.pure.u64(BigInt(selectedGrantAch)),
           txb.object(TREASURY_CAP),
           txb.pure.address(grantTarget)
        ],
      });

      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "Badge Granted", description: "Achievement soulbound to target wallet." });
          setIsPending(false);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Grant Failed", description: err.message });
          setIsPending(false);
        }
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "System Error", description: err.message });
      setIsPending(false);
    }
  };

  const handleFinalize = async () => {
    if (!targetBoxId || !selectedBoxFullData) return;

    // Check for empty tiers that would cause "Dry run failed" instruction 14
    const emptyTiers = [];
    if (selectedBoxFullData.common_configs.length === 0) emptyTiers.push("Common");
    if (selectedBoxFullData.rare_configs.length === 0) emptyTiers.push("Rare");
    if (selectedBoxFullData.super_rare_configs.length === 0) emptyTiers.push("Super Rare");
    if (selectedBoxFullData.ssr_configs.length === 0) emptyTiers.push("SSR");
    if (selectedBoxFullData.ultra_rare_configs.length === 0) emptyTiers.push("Ultra Rare");
    if (selectedBoxFullData.legend_rare_configs.length === 0) emptyTiers.push("Legend Rare");

    if (emptyTiers.length > 0) {
      toast({ 
        variant: "destructive", 
        title: "Incomplete Protocol", 
        description: `Each rarity tier must have at least one NFT type. Missing: ${emptyTiers.join(", ")}` 
      });
      return;
    }

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
        toast({ title: "Lootbox Activated!", description: "Protocol updated successfully." });
        setIsPending(false);
        setTimeout(fetchLootboxes, 3000);
      },
      onError: (err) => { 
        toast({ variant: "destructive", title: "Activation Failed", description: err.message }); 
        setIsPending(false); 
      },
    });
  };

  const renderRarityTier = (label: string, configs: NFTTypeData[]) => {
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
              </div>
            ))}
          </div>
        )}
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
              <h1 className="font-headline text-5xl font-bold mb-4 tracking-tight">Protocol Admin</h1>
              <p className="text-muted-foreground text-lg">Manage lootboxes, variants, and the $GYATE economy.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { fetchLootboxes(); fetchTreasuryData(); fetchAchievements(); }} 
                disabled={isLoadingBoxes || isFetchingTreasury || isLoadingAchievements}
                className="bg-white/5 border-white/10"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", (isLoadingBoxes || isFetchingTreasury || isLoadingAchievements) && "animate-spin")} />
                Sync
              </Button>
            </div>
          </div>

          <Tabs defaultValue="lootbox" className="space-y-8">
            <TabsList className="bg-white/5 border border-white/10 p-1 h-14 overflow-x-auto whitespace-nowrap">
              <TabsTrigger value="lootbox" className="px-8 h-full data-[state=active]:bg-primary">
                <Package className="w-4 h-4 mr-2" /> Lootbox Factory
              </TabsTrigger>
              <TabsTrigger value="achievements" className="px-8 h-full data-[state=active]:bg-primary">
                <Trophy className="w-4 h-4 mr-2" /> Achievements
              </TabsTrigger>
              <TabsTrigger value="treasury" className="px-8 h-full data-[state=active]:bg-primary">
                <Coins className="w-4 h-4 mr-2" /> Treasury
              </TabsTrigger>
              <TabsTrigger value="variants" className="px-8 h-full data-[state=active]:bg-primary">
                <Sparkles className="w-4 h-4 mr-2" /> Variant Lab
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lootbox" className="space-y-8">
              <div className="grid md:grid-cols-[1fr_350px] gap-8">
                <div className="space-y-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    <Card className="glass-card border-primary/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Badge className="bg-primary/20 text-primary">01</Badge> Create Draft
                        </CardTitle>
                        <CardDescription>Setup core economic parameters</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
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
                        <Button className="w-full glow-purple font-bold" onClick={handleCreateDraft} disabled={isPending}>
                          Deploy Protocol Draft
                        </Button>
                      </CardContent>
                    </Card>

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
                            <SelectTrigger className="bg-white/5 border-white/10">
                              <SelectValue placeholder="Choose a draft..." />
                            </SelectTrigger>
                            <SelectContent>
                              {myLootboxes.filter(b => b.isSetup).map(box => (
                                <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label>Rarity</Label>
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
                          <Input value={nftImage} onChange={(e) => setNftImage(e.target.value)} placeholder="IPFS or HTTPS link" />
                        </div>
                        <Button variant="outline" className="w-full" onClick={handleAddNftType} disabled={isPending || !targetBoxId}>
                          Register NFT Type
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="glass-card border-accent/20">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Finalize Protocol</CardTitle>
                        <CardDescription>Activate the draft for the network</CardDescription>
                      </div>
                      <Button className="glow-violet bg-accent" onClick={handleFinalize} disabled={isPending || !targetBoxId}>
                        Go Live <ArrowUpRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardHeader>
                  </Card>
                </div>

                <Card className="glass-card border-white/10 flex flex-col h-[700px]">
                  <CardHeader className="border-b border-white/5">
                    <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                      <Eye className="w-4 h-4" /> Protocol Inspector
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-4">
                      {isFetchingFullData ? (
                        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading...
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
                        <div className="text-center py-20 text-xs text-muted-foreground">Select a draft to inspect</div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="achievements" className="space-y-8">
              <div className="grid md:grid-cols-[1fr_400px] gap-8">
                <div className="space-y-8">
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
                          <Input value={newAch.name} onChange={(e) => setNewAch({...newAch, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>GYATE Reward</Label>
                          <Input type="number" value={newAch.reward} onChange={(e) => setNewAch({...newAch, reward: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input value={newAch.description} onChange={(e) => setNewAch({...newAch, description: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Badge Image URL</Label>
                        <Input value={newAch.imageUrl} onChange={(e) => setNewAch({...newAch, imageUrl: e.target.value})} />
                      </div>
                      
                      <div className="pt-4 border-t border-white/5 grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Req Type</Label>
                          <Select value={newAch.reqType} onValueChange={(v) => setNewAch({...newAch, reqType: v})}>
                            <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(REQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Threshold</Label>
                          <Input type="number" value={newAch.reqValue} onChange={(e) => setNewAch({...newAch, reqValue: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Rarity (If Type=2)</Label>
                          <Select value={newAch.reqRarity} onValueChange={(v) => setNewAch({...newAch, reqRarity: v})}>
                            <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[0,1,2,3,4,5].map(r => <SelectItem key={r} value={r.toString()}>{RARITY_LABELS[r as keyof typeof RARITY_LABELS]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button className="w-full glow-purple h-12 mt-4" onClick={handleCreateAchievement} disabled={isPending}>
                        Register On-Chain Achievement
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass-card border-accent/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Gift className="w-5 h-5 text-accent" /> Manual Grant
                      </CardTitle>
                      <CardDescription>Award a badge directly to a player wallet</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="space-y-2">
                         <Label>Target Player Address</Label>
                         <Input placeholder="0x..." value={grantTarget} onChange={(e) => setGrantTarget(e.target.value)} />
                       </div>
                       <div className="space-y-2">
                         <Label>Select Achievement</Label>
                         <Select value={selectedGrantAch} onValueChange={setSelectedGrantAch}>
                           <SelectTrigger className="bg-white/5"><SelectValue placeholder="Choose achievement..." /></SelectTrigger>
                           <SelectContent>
                             {achievements.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                           </SelectContent>
                         </Select>
                       </div>
                       <Button variant="secondary" className="w-full bg-accent/20 hover:bg-accent/40 text-accent h-12" onClick={handleAdminGrant} disabled={isPending || !grantTarget || !selectedGrantAch}>
                         Grant Soulbound Badge
                       </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Registry Index
                  </h3>
                  <ScrollArea className="h-[700px] pr-4">
                    <div className="grid gap-4">
                      {isLoadingAchievements ? (
                        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading...
                        </div>
                      ) : achievements.length > 0 ? (
                        achievements.map((a, idx) => (
                          <Card key={idx} className="bg-white/5 border-white/5 p-4 space-y-3">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20">
                                 {a.badge_image_url ? (
                                   <Image src={a.badge_image_url} alt={a.name} width={40} height={40} className="rounded-full" />
                                 ) : <Trophy className="w-4 h-4 text-accent" />}
                               </div>
                               <div className="flex-1">
                                 <div className="text-sm font-bold">{a.name}</div>
                                 <div className="text-[10px] text-muted-foreground">{REQ_LABELS[a.requirement_type]}: {a.requirement_value}</div>
                               </div>
                               <div className="text-right">
                                 <div className="text-xs font-bold text-primary">+{a.gyate_reward} G</div>
                                 <div className="text-[9px] text-muted-foreground">Claimed: {a.total_claimed}</div>
                               </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-2">{a.description}</p>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-20 text-xs text-muted-foreground">No achievements found in registry</div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="treasury" className="space-y-8">
              <div className="grid md:grid-cols-[1fr_400px] gap-8">
                <Card className="glass-card border-primary/20">
                  <CardHeader>
                    <CardTitle>Treasury Operations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Withdraw SUI</Label>
                      <Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                    </div>
                    <Button className="w-full h-12 glow-purple" onClick={() => {}} disabled={isPending}>
                      Execute On-Chain Withdrawal
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-accent" /> Treasury Pool Status
                  </h3>
                  <div className="grid gap-4">
                    <Card className="bg-white/5 border-white/10 p-4">
                      <div className="text-[10px] text-muted-foreground uppercase mb-1">Available SUI</div>
                      <div className="text-3xl font-bold font-headline">
                        {treasuryStats ? (parseInt(treasuryStats.balance) / 1000000000).toFixed(2) : "0.00"}
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="variants" className="space-y-8">
               <Card className="glass-card border-primary/20 max-w-2xl mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-accent" /> Variant Lab
                    </CardTitle>
                    <CardDescription>Configure special hero editions and limited drops</CardDescription>
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
                        <Label>NFT Selection</Label>
                        <Select value={selectedNftForVariant} onValueChange={setSelectedNftForVariant} disabled={!targetBoxId}>
                          <SelectTrigger className="bg-white/5">
                            <SelectValue placeholder="Select character..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allAvailableNfts.map((nft, idx) => (
                              <SelectItem key={idx} value={`${nft.name}|${nft.rarity}`}>
                                {nft.name} ({RARITY_LABELS[nft.rarity as keyof typeof RARITY_LABELS]})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Variant Name</Label>
                        <Input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="e.g. Shiny, Holographic" />
                      </div>
                      <div className="space-y-2">
                        <Label>Drop Rate (%)</Label>
                        <Input type="number" value={variantDropRate} onChange={(e) => setVariantDropRate(e.target.value)} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Value Multiplier (%)</Label>
                        <Input type="number" value={variantMultiplier} onChange={(e) => setVariantMultiplier(e.target.value)} placeholder="150 = 1.5x" />
                      </div>
                      <div className="space-y-2">
                        <Label>Variant Image URL</Label>
                        <Input value={variantImage} onChange={(e) => setVariantImage(e.target.value)} placeholder="IPFS or HTTPS link" />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2"><Hash className="w-3 h-3" /> Sequential IDs</Label>
                          <p className="text-[10px] text-muted-foreground">Give each mint a unique serial number (e.g. #1, #2)</p>
                        </div>
                        <Switch checked={hasSeqId} onCheckedChange={setHasSeqId} />
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-6">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">Supply & Time Limits</Label>
                          <p className="text-[10px] text-muted-foreground">Configure availability period and maximum total supply</p>
                        </div>
                        <Switch checked={useLimits} onCheckedChange={setUseLimits} />
                      </div>

                      {useLimits && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                                <Clock className="w-3 h-3" /> Available From (Epoch)
                              </Label>
                              <Input value={availFrom} onChange={(e) => setAvailFrom(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                                <Clock className="w-3 h-3" /> Available Until (Epoch)
                              </Label>
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

                    <Button className="w-full bg-pink-600 hover:bg-pink-500 font-bold h-12 glow-violet" onClick={handleAddVariant} disabled={isPending || !targetBoxId || !selectedNftForVariant}>
                      {isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Deploy Variant to Blockchain
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
