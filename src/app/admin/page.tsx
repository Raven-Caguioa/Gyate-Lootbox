"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, TREASURY_POOL, UPGRADE_CAP, LOOTBOX_REGISTRY, MODULE_NAMES, FUNCTIONS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Coins, ShieldCheck, TrendingDown, ArrowUpRight, Lock, Plus, Package, Settings } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
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
  const [targetBoxId, setTargetBoxId] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleClaimTreasury = () => {
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.TREASURY}::${FUNCTIONS.CLAIM_FEES}`,
      arguments: [txb.object(TREASURY_POOL), txb.object(UPGRADE_CAP)],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => toast({ title: "Treasury Claimed", description: "All accrued platform fees have been sent to admin wallet." }),
      onError: (err) => toast({ variant: "destructive", title: "Claim Failed", description: err.message }),
    });
  };

  const handleCreateLootbox = async () => {
    if (!newBoxName || !newBoxPrice) return;
    setIsPending(true);

    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.CREATE_LOOTBOX}`,
      arguments: [
        txb.object(LOOTBOX_REGISTRY),
        txb.object(UPGRADE_CAP),
        txb.pure.string(newBoxName),
        txb.pure.u64(BigInt(parseFloat(newBoxPrice) * 1_000_000_000)), // Convert SUI to MIST
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Lootbox Created", description: `${newBoxName} has been registered on-chain.` });
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

  const handleToggleStatus = (boxId: string) => {
    if (!boxId) return;
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.TOGGLE_STATUS}`,
      arguments: [
        txb.object(LOOTBOX_REGISTRY),
        txb.object(UPGRADE_CAP),
        txb.pure.string(boxId),
      ],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => toast({ title: "Status Toggled", description: `Lootbox ${boxId} visibility updated.` }),
      onError: (err) => toast({ variant: "destructive", title: "Update Failed", description: err.message }),
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
              <p className="text-muted-foreground text-lg">On-chain protocol management and registry controls.</p>
            </div>
            <div className="flex gap-4">
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 px-4 py-2 text-sm">
                <Lock className="w-4 h-4 mr-2" /> Admin Session Active
              </Badge>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Treasury Card */}
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Coins className="w-5 h-5 text-accent" /> Treasury Control
                </CardTitle>
                <CardDescription>Withdraw accumulated SUI fees</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-4xl font-bold font-headline">Syncing...</div>
                <Button className="w-full glow-purple font-bold" onClick={handleClaimTreasury}>
                  Withdraw to Admin Wallet <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Lootbox Registry Management */}
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5 text-blue-400" /> Registry Actions
                </CardTitle>
                <CardDescription>Manage on-chain configurations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2 bg-white/5 border-white/10">
                      <Plus className="w-4 h-4" /> Create New Lootbox
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-card border-white/10">
                    <DialogHeader>
                      <DialogTitle>New Lootbox Config</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="boxName">Display Name</Label>
                        <Input 
                          id="boxName" 
                          placeholder="e.g. Mythic Crate" 
                          value={newBoxName}
                          onChange={(e) => setNewBoxName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="boxPrice">Price (SUI)</Label>
                        <Input 
                          id="boxPrice" 
                          type="number" 
                          placeholder="1.0" 
                          value={newBoxPrice}
                          onChange={(e) => setNewBoxPrice(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCreateLootbox} disabled={isPending || !newBoxName || !newBoxPrice} className="w-full glow-purple">
                        {isPending ? "Transacting..." : "Deploy Config"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Toggle Box Status</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Lootbox ID String" 
                      className="bg-white/5" 
                      value={targetBoxId}
                      onChange={(e) => setTargetBoxId(e.target.value)}
                    />
                    <Button variant="outline" onClick={() => handleToggleStatus(targetBoxId)}>Toggle</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Platform Stats & Maintenance */}
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5 text-green-400" /> Maintenance
                </CardTitle>
                <CardDescription>Protocol-wide system flags</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <Button variant="outline" className="w-full justify-between bg-white/5 border-white/10">
                   Emergency Halt <Badge variant="secondary" className="bg-red-500/20 text-red-400">INACTIVE</Badge>
                 </Button>
                 <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-[10px] text-muted-foreground leading-relaxed">
                   <strong>Registry:</strong> <code>{LOOTBOX_REGISTRY.slice(0, 16)}...</code><br/>
                   <strong>UpgradeCap:</strong> <code>{UPGRADE_CAP.slice(0, 16)}...</code>
                 </div>
                 <p className="text-[10px] text-muted-foreground italic">
                   All changes require UpgradeCap signature for Transaction Block authorization.
                 </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
