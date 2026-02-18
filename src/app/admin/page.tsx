
"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, TREASURY_POOL, POLICY_ADMIN, UPGRADE_CAP, FUNCTIONS } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Coins, ShieldCheck, TrendingDown, ArrowUpRight, Lock } from "lucide-react";

export default function AdminPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const handleClaimTreasury = () => {
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::treasury::claim_fees`,
      arguments: [txb.object(TREASURY_POOL), txb.object(UPGRADE_CAP)],
    });

    signAndExecute({ transaction: txb }, {
      onSuccess: () => toast({ title: "Treasury Claimed", description: "All accrued platform fees have been sent to admin wallet." }),
      onError: (err) => toast({ variant: "destructive", title: "Claim Failed", description: err.message }),
    });
  };

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="font-headline text-5xl font-bold mb-4">Platform Governance</h1>
              <p className="text-muted-foreground text-lg">Administrative control center for the GyateGyate Protocol.</p>
            </div>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 px-4 py-2 text-sm">
              <Lock className="w-4 h-4 mr-2" /> Admin Session Active
            </Badge>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Coins className="w-5 h-5 text-accent" /> Treasury Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-4xl font-bold font-headline">4,290.50 SUI</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lootbox Rev</span>
                    <span>3,120 SUI</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Market Fees</span>
                    <span>1,170 SUI</span>
                  </div>
                </div>
                <Button className="w-full glow-purple" onClick={handleClaimTreasury}>
                  Withdraw to Wallet <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="w-5 h-5 text-green-400" /> Protocol Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Marketplace Fee (%)</label>
                    <div className="flex gap-2">
                      <Input defaultValue="10" className="bg-white/5" />
                      <Button variant="outline">Set</Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground">
                    Modifying this policy affects all active Kiosks registered via <code>{KIOSK_REGISTRY.slice(0, 10)}...</code>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingDown className="w-5 h-5 text-blue-400" /> Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <Button variant="outline" className="w-full justify-between">
                   Toggle Setup Mode <Badge variant="secondary">OFF</Badge>
                 </Button>
                 <Button variant="outline" className="w-full justify-between">
                   Sync Registry Indices <ArrowUpRight className="w-4 h-4" />
                 </Button>
                 <p className="text-[10px] text-muted-foreground leading-relaxed">
                   Registry updates require Transaction Digest authorization from Checkpoint 298740122.
                 </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
