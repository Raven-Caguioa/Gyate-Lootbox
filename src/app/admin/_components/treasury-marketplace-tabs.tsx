"use client";

import { useState } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins, Wallet, RefreshCw, ShieldCheck, AlertCircle, CheckCircle2, Copy, Check } from "lucide-react";
import { PACKAGE_ID, TREASURY_POOL, MODULE_NAMES, FUNCTIONS, PUBLISHER, ADMIN_REGISTRY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import type { TreasuryStats } from "../_hooks/use-admin-data";

// ─────────────────────────────────────────────
// Treasury Tab
// ─────────────────────────────────────────────

interface TreasuryTabProps {
  treasuryStats: TreasuryStats | null;
  isFetchingTreasury: boolean;
  fetchTreasuryData: () => void;
}

export function TreasuryTab({ treasuryStats, isFetchingTreasury, fetchTreasuryData }: TreasuryTabProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const sui = (mist: string | undefined) =>
    mist ? (parseInt(mist) / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0";

  const handleWithdraw = async () => {
    if (!withdrawAmount || !account) return;
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.TREASURY}::${FUNCTIONS.WITHDRAW}`,
      arguments: [
        txb.object(ADMIN_REGISTRY),
        txb.object(TREASURY_POOL),
        txb.pure.u64(BigInt(Math.floor(parseFloat(withdrawAmount) * 1_000_000_000))),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Withdrawal Successful", description: `${withdrawAmount} SUI sent to admin wallet.` });
        setIsPending(false);
        setWithdrawAmount("");
        fetchTreasuryData();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Withdrawal Failed", description: err.message });
        setIsPending(false);
      },
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="w-5 h-5 text-accent" /> Treasury Overview
          </CardTitle>
          <CardDescription>Current balance and activity</CardDescription>
        </CardHeader>
        <CardContent>
          {isFetchingTreasury ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Balance",          treasuryStats?.balance],
                ["From Lootboxes",   treasuryStats?.totalFromLootboxes],
                ["From Marketplace", treasuryStats?.totalFromMarketplace],
                ["Total Withdrawn",  treasuryStats?.totalWithdrawn],
              ].map(([label, value]) => (
                <div key={label as string} className="space-y-1 p-3 rounded-xl bg-white/5 border border-white/5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</Label>
                  <div className="text-base font-bold">{sui(value as string | undefined)} SUI</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card border-accent/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="w-5 h-5 text-accent" /> Withdraw
          </CardTitle>
          <CardDescription>Transfer SUI from treasury to your wallet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Amount to Withdraw (SUI)</Label>
            <Input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
          </div>
          <Button
            className="w-full glow-violet bg-accent font-bold h-12"
            onClick={handleWithdraw}
            disabled={isPending || !withdrawAmount}
          >
            {isPending
              ? <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              : <Wallet className="w-4 h-4 mr-2" />
            }
            Execute On-Chain Withdrawal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Marketplace Tab
// ─────────────────────────────────────────────

interface MarketplaceTabProps {
  policyExists: boolean | null;
  policyObjectId: string | null;
  isCheckingPolicy: boolean;
  checkPolicy: () => void;
}

export function MarketplaceTab({ policyExists, policyObjectId, isCheckingPolicy, checkPolicy }: MarketplaceTabProps) {
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [copied, setCopied] = useState(false);
  // Holds the policy ID extracted directly from the tx result so it
  // displays immediately after creation without waiting for a re-check.
  const [freshPolicyId, setFreshPolicyId] = useState<string | null>(null);

  // Prefer the live value from the hook; fall back to the just-created one.
  const displayedPolicyId = policyObjectId ?? freshPolicyId;
  const isActive = policyExists || freshPolicyId !== null;

  const handleCopy = () => {
    if (!displayedPolicyId) return;
    navigator.clipboard.writeText(displayedPolicyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateTransferPolicy = async () => {
    setIsPending(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.CREATE_TRANSFER_POLICY}`,
      arguments: [txb.object(PUBLISHER)],
    });

    signAndExecute(
      { transaction: txb },
      {
        onSuccess: async (result) => {
          toast({ title: "TransferPolicy Created" });

          // ── Extract the new TransferPolicy shared object ID from the tx effects ──
          // Created objects come back in objectChanges[]; the shared TransferPolicy
          // is the entry whose type contains "TransferPolicy" but NOT "TransferPolicyCap".
          try {
            const tx = await suiClient.getTransactionBlock({
              digest: result.digest,
              options: { showObjectChanges: true },
            });

            const policyChange = tx.objectChanges?.find(
              (c) =>
                c.type === "created" &&
                (c as any).objectType?.includes("TransferPolicy") &&
                !(c as any).objectType?.includes("TransferPolicyCap")
            );

            if (policyChange && "objectId" in policyChange) {
              setFreshPolicyId(policyChange.objectId);
            }
          } catch (extractErr) {
            // Non-fatal — checkPolicy() below will still populate policyObjectId.
            console.warn("Could not extract policy ID from tx:", extractErr);
          }

          setIsPending(false);
          checkPolicy();
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Creation Failed", description: err.message });
          setIsPending(false);
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent" /> Initialize Marketplace
          </CardTitle>
          <CardDescription>Create a TransferPolicy to enable secondary trading</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-xl bg-accent/5 border border-accent/10 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Secondary sales require a TransferPolicy to ensure all Kiosk-based trades follow protocol rules.
              </p>
              {isCheckingPolicy ? (
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : isActive ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Missing</span>
                </div>
              )}
            </div>

            <p className="text-xs font-mono text-muted-foreground/60 italic">
              Publisher ID: {PUBLISHER.slice(0, 20)}...
            </p>

            {/* ── Policy Object ID — shown whenever we have it (on load OR right after creation) ── */}
            {displayedPolicyId && (
              <div className="mt-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-400">
                  TransferPolicy Object ID — copy this into TRANSFER_POLICY in sui-constants.ts
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-green-300 break-all flex-1">
                    {displayedPolicyId}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 p-1.5 rounded-md hover:bg-green-500/20 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied
                      ? <Check className="w-4 h-4 text-green-400" />
                      : <Copy className="w-4 h-4 text-green-400" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button
            className="w-full glow-violet bg-accent font-bold h-12"
            onClick={handleCreateTransferPolicy}
            disabled={isPending || isActive}
          >
            {isPending
              ? <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              : <ShieldCheck className="w-4 h-4 mr-2" />
            }
            {isActive ? "Policy Already Active" : "Create TransferPolicy"}
          </Button>

          <div className="text-center">
            <Button variant="link" size="sm" onClick={checkPolicy} className="text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3 mr-1" /> Re-check On-Chain Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}