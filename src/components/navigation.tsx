
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Store, ShoppingBag, LayoutDashboard, Coins, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";

export function Navigation() {
  const pathname = usePathname();
  const account = useCurrentAccount();

  const navItems = [
    { href: "/", label: "Home", icon: LayoutDashboard },
    { href: "/shop", label: "Shop", icon: Store },
    { href: "/inventory", label: "Inventory", icon: ShoppingBag },
    { href: "/marketplace", label: "Market", icon: Coins },
  ];

  const isAdmin = account?.address === "0x8a00a0227d2bcec1bf3dfa86c312ae037bbd9518113cbc1d60253090ac7905d8"; // Example admin check

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
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Network</span>
            <span className="text-sm font-bold flex items-center gap-1">
              <span className="text-accent">Sui Mainnet</span>
            </span>
          </div>
          <div className="sui-connect-wrapper">
             <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
