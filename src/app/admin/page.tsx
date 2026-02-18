"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, TREASURY_POOL, LOOTBOX_REGISTRY, MODULE_NAMES, FUNCTIONS, TREASURY_CAP } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Coins, ShieldCheck, ArrowUpRight, Lock, Plus, Package, Settings, Sparkles, Sword, Shield, Zap, Image as ImageIcon, CheckCircle2, ListPlus } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const [isPending, setIsPending] = useState(false);

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
  const [variantNftName, setVariantNftName] = useState("");
  const [variantName, setVariantName] = useState("");
  const [variantDropRate, setVariantDropRate] = useState("5"); // 5%
  const [variantMultiplier, setVariantMultiplier] = useState("150"); // 1.5x
  const [variantImage, setVariantImage] = useState("");

  // --- Treasury State ---
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [mintRecipient, setMintRecipient] = useState("");

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
        toast({ title: "Step 1 Complete", description: "Draft created. Now add NFT types." });
        setIsPending(false);
      },
      onError: (err) => { toast({ variant: "destructive", title: "Failed", description: err.message }); setIsPending(false); },
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
      },
      onError: (err) => { toast({ variant: "destructive", title: "Failed", description: err.message }); setIsPending(false); },
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
        toast({ title: "Lootbox Activated!", description: "Box is now live for players." });
        setIsPending(false);
      },
      onError: (err) => { toast({ variant: "destructive", title: "Activation Failed", description: err.message }); setIsPending(false); },
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

  const handleAdminMint = () => {
    if (!mintAmount || !mintRecipient) return;
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.GYATE_COIN}::${FUNCTIONS.ADMIN_MINT}`,
      arguments: [
        txb.object(TREASURY_CAP),
        txb.pure.u64(BigInt(mintAmount)),
        txb.pure.address(mintRecipient),
        txb.pure.string("Admin Distribution"),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => toast({ title: "Tokens Minted", description: `${mintAmount} $GYATE sent to ${mintRecipient}.` }),
      onError: (err) => toast({ variant: "destructive", title: "Failed", description: err.message }),
    });
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
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 px-4 py-2 text-sm">
              <Lock className="w-4 h-4 mr-2" /> Admin Session Active
            </Badge>
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
              <div className="grid md:grid-cols-3 gap-8">
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
                    <CardDescription>Define NFT types for the box</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Target Lootbox ID</Label>
                      <Input value={targetBoxId} onChange={(e) => setTargetBoxId(e.target.value)} placeholder="0x..." />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Rarity (0-5)</Label>
                        <Select value={nftRarity} onValueChange={setNftRarity}>
                          <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[0,1,2,3,4,5].map(r => <SelectItem key={r} value={r.toString()}>{r} (Tier)</SelectItem>)}
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
                        const [min, max] = e.target.value.split("-");
                        if(max) setStats({...stats, minHp: min, maxHp: max});
                      }} /></div>
                      <div className="space-y-1"><Label className="text-[10px]">ATK Range</Label><Input placeholder="10-20" onChange={(e) => {
                        const [min, max] = e.target.value.split("-");
                        if(max) setStats({...stats, minAtk: min, maxAtk: max});
                      }} /></div>
                      <div className="space-y-1"><Label className="text-[10px]">SPD Range</Label><Input placeholder="5-15" onChange={(e) => {
                        const [min, max] = e.target.value.split("-");
                        if(max) setStats({...stats, minSpd: min, maxSpd: max});
                      }} /></div>
                    </div>
                    <Button variant="outline" className="w-full border-white/10 hover:bg-white/10" onClick={handleAddNftType} disabled={isPending}>
                      Add NFT Type
                    </Button>
                  </CardContent>
                </Card>

                {/* Step 3: Finalize */}
                <Card className="glass-card border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Badge className="bg-primary/20 text-primary">03</Badge> Go Live
                    </CardTitle>
                    <CardDescription>Activate the lootbox for all</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 flex flex-col justify-center h-[300px]">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto animate-pulse">
                        <CheckCircle2 className="w-8 h-8 text-accent" />
                      </div>
                      <p className="text-sm text-muted-foreground px-4">
                        Ensure all rarities (Common to Legend) have at least one NFT type defined before activating.
                      </p>
                    </div>
                    <Button className="w-full glow-violet bg-accent hover:bg-accent/80 font-bold" onClick={handleFinalize} disabled={isPending || !targetBoxId}>
                      Finalize & Activate
                    </Button>
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
                      <Input placeholder="0x..." value={mintRecipient} onChange={(e) => setMintRecipient(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (GYATE)</Label>
                      <Input type="number" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} />
                    </div>
                    <Button className="w-full bg-blue-600 hover:bg-blue-500 font-bold" onClick={handleAdminMint}>
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
                        <Label>Target Box ID</Label>
                        <Input value={targetBoxId} onChange={(e) => setTargetBoxId(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Base NFT Name</Label>
                        <Input value={variantNftName} onChange={(e) => setVariantNftName(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Variant Name</Label>
                        <Input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="e.g. Holographic" />
                      </div>
                      <div className="space-y-2">
                        <Label>Rarity (0-5)</Label>
                        <Input type="number" value={nftRarity} onChange={(e) => setNftRarity(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Drop Rate (%)</Label>
                        <Input type="number" value={variantDropRate} onChange={(e) => setVariantDropRate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Value Multiplier (%)</Label>
                        <Input type="number" value={variantMultiplier} onChange={(e) => setVariantMultiplier(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Custom Variant Image URL</Label>
                      <Input value={variantImage} onChange={(e) => setVariantImage(e.target.value)} />
                    </div>
                    <Button className="w-full bg-pink-600 hover:bg-pink-500 font-bold">
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
