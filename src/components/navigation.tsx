"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Store, ShoppingBag, LayoutDashboard, Coins, ShieldAlert, User, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConnectButton, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES } from "@/lib/sui-constants";
import { useState, useEffect, useCallback } from "react";

export function Navigation() {
  const pathname = usePathname();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  const [gyateBalance, setGyateBalance] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const fetchGyateBalance = useCallback(async () => {
    if (!account) {
      setGyateBalance(null);
      return;
    }
    setIsFetching(true);
    try {
      const gyateType = `${PACKAGE_ID}::${MODULE_NAMES.GYATE_COIN}::GYATE_COIN`;
      const coins = await suiClient.getCoins({ 
        owner: account.address, 
        coinType: gyateType 
      });
      
      const total = coins.data.reduce((acc, coin) => acc + BigInt(coin.balance), BigInt(0));
      // Display as whole tokens (assuming 9 decimals like SUI, but $GYATE often used as units)
      // If $GYATE is units (0 decimals in contract), keep as is. Usually it's 9.
      setGyateBalance((Number(total) / 1_000_000_000).toFixed(0));
    } catch (err) {
      console.error("Failed to fetch $GYATE balance:", err);
    } finally {
      setIsFetching(false);
    }
  }, [account, suiClient]);

  useEffect(() => {
    fetchGyateBalance();
    const interval = setInterval(fetchGyateBalance, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchGyateBalance]);

  const navItems = [
    { href: "/", label: "Home", icon: LayoutDashboard },
    { href: "/shop", label: "Shop", icon: Store },
    { href: "/inventory", label: "Inventory", icon: ShoppingBag },
    { href: "/marketplace", label: "Market", icon: Coins },
    { href: "/profile", label: "Account", icon: User },
  ];

  // Admin address from Move configuration
  const isAdmin = account?.address === "0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a"; 

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary glow-purple flex items-center justify-center">
            <span className="font-headline font-bold text-white">G</span>
          </div>
          <span className="font-headline font-bold text-xl tracking-tight hidden sm:block">
            GYATE<span className="text-accent">GYATE</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 md:gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                pathname === "/admin" 
                  ? "bg-red-500/10 text-red-500" 
                  : "text-red-400 hover:text-red-300 hover:bg-white/5"
              )}
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col items-end mr-2">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Balance</span>
            <div className="flex items-center gap-2">
               <span className="text-sm font-bold flex items-center gap-1 text-primary">
                {isFetching && !gyateBalance ? <RefreshCw className="w-3 h-3 animate-spin" /> : (gyateBalance || "0")} <span className="text-[10px]">$GYATE</span>
              </span>
            </div>
          </div>
          <div className="sui-connect-wrapper">
             <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
