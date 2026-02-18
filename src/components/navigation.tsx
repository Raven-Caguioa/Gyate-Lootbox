"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Store, ShoppingBag, LayoutDashboard, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Home", icon: LayoutDashboard },
    { href: "/shop", label: "Shop", icon: Store },
    { href: "/inventory", label: "Inventory", icon: ShoppingBag },
    { href: "/marketplace", label: "Market", icon: Coins },
  ];

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
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col items-end mr-2">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Balance</span>
            <span className="text-sm font-bold flex items-center gap-1">
              <span className="text-accent">1,250</span> $GYATE
            </span>
          </div>
          <Button variant="outline" size="sm" className="gap-2 border-primary/50 hover:bg-primary/10">
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Connect Wallet</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
