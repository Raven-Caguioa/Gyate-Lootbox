"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, TREASURY_POOL, LOOTBOX_REGISTRY, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Coins, ShieldCheck, ArrowUpRight, Lock, Plus, Package, Settings, Sparkles } from "lucide-react";
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

export default function AdminPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const [newBoxName, setNewBoxName] = useState("");
  const [newBoxPrice, setNewBoxPrice] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [targetBoxId, setTargetBoxId] = useState("");
  const [isPending, setIsPending] = useState(false);

  // Pity Settings
  const [pityEnabled, setPityEnabled] = useState(false);
  const [pityRare, setPityRare] = useState("10");
  const [pitySuperRare, setPitySuperRare] = useState("50");
  const [pityUltraRare, setPityUltraRare] = useState("100");

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
      onSuccess: () => toast({ title: "Withdrawal Initiated", description: "SUI has been sent to the admin address defined in Move." }),
      onError: (err) => toast({ variant: "destructive", title: "Withdrawal Failed", description: err.message }),
    });
  };

  const handleCreateLootbox = async () => {
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
        toast({ title: "Draft Lootbox Created", description: `${newBoxName} is now in setup mode. Add NFT types next.` });
        setNewBoxName("");
        setNewBoxPrice("");
        setIsPending(false);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Creation Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  const handlePause = (boxId: string) => {
    if (!boxId) return;
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.PAUSE}`,
      arguments: [
        txb.object(LOOTBOX_REGISTRY),
        txb.object(boxId),
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => toast({ title: "Lootbox Paused", description: "Sales have been halted." }),
      onError: (err) => toast({ variant: "destructive", title: "Pause Failed", description: err.message }),
    });
  };

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h1 className="font-headline text-5xl font-bold mb-4">Platform Governance</h1>
              <p className="text-muted-foreground text-lg">On-chain protocol management for GyateGyate.</p>
            </div>
            <div className="flex gap-4">
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 px-4 py-2 text-sm">
                <Lock className="w-4 h-4 mr-2" /> Admin Session
              </Badge>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Treasury Card */}
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Coins className="w-5 h-5 text-accent" /> Treasury Pool
                </CardTitle>
                <CardDescription>Manage collected platform fees</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Withdraw Amount (SUI)</Label>
                  <Input 
                    type="number" 
                    placeholder="0.0" 
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                  />
                </div>
                <Button className="w-full glow-purple font-bold" onClick={handleWithdraw}>
                  Withdraw to Admin <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Lootbox Registry Management */}
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5 text-blue-400" /> Registry
                </CardTitle>
                <CardDescription>Create draft lootboxes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2 bg-white/5 border-white/10">
                      <Plus className="w-4 h-4" /> Create Draft Box
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-card border-white/10 max-w-md">
                    <DialogHeader>
                      <DialogTitle>New Lootbox Draft</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={newBoxName} onChange={(e) => setNewBoxName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Price (SUI)</Label>
                        <Input type="number" value={newBoxPrice} onChange={(e) => setNewBoxPrice(e.target.value)} />
                      </div>
                      
                      <div className="pt-4 space-y-4 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-accent" /> Enable Pity</Label>
                          <Switch checked={pityEnabled} onCheckedChange={setPityEnabled} />
                        </div>
                        {pityEnabled && (
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Rare</Label>
                              <Input size={1} value={pityRare} onChange={(e) => setPityRare(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">SR</Label>
                              <Input size={1} value={pitySuperRare} onChange={(e) => setPitySuperRare(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">UR</Label>
                              <Input size={1} value={pityUltraRare} onChange={(e) => setPityUltraRare(e.target.value)} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCreateLootbox} disabled={isPending || !newBoxName || !newBoxPrice} className="w-full glow-purple">
                        {isPending ? "Deploying..." : "Create Draft"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Quick Pause</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Box ID" 
                      className="bg-white/5" 
                      value={targetBoxId}
                      onChange={(e) => setTargetBoxId(e.target.value)}
                    />
                    <Button variant="outline" onClick={() => handlePause(targetBoxId)}>Pause</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Platform Stats & Maintenance */}
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5 text-green-400" /> System
                </CardTitle>
                <CardDescription>Protocol information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-[10px] text-muted-foreground leading-relaxed">
                   <strong>Package:</strong> <code>{PACKAGE_ID.slice(0, 16)}...</code><br/>
                   <strong>Registry:</strong> <code>{LOOTBOX_REGISTRY.slice(0, 16)}...</code><br/>
                   <strong>Treasury:</strong> <code>{TREASURY_POOL.slice(0, 16)}...</code>
                 </div>
                 <p className="text-[10px] text-muted-foreground italic">
                   Admin actions require the wallet designated as @admin in the Move package.
                 </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
