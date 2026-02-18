"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Store, ShieldCheck, Sparkles, TrendingUp, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { MOCK_LOOTBOXES } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src={PlaceHolderImages[0].imageUrl}
            alt="Hero Background"
            fill
            className="object-cover opacity-30"
            data-ai-hint="fantasy cosmic"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
        </div>

        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-bold tracking-widest uppercase">
              <Sparkles className="w-3 h-3" />
              Fully On-Chain Randomness
            </div>
            <h1 className="font-headline text-5xl md:text-7xl font-bold leading-tight">
              Collect. Trade. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                Level Up.
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              Step into the GyateGyate ecosystem. Open mythic lootboxes, mint rare character variants, and trade them on a decentralized marketplace.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="h-14 px-8 text-md font-bold glow-purple">
                <Link href="/shop" className="gap-2">
                  <Store className="w-5 h-5" />
                  Explore Shop
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 px-8 text-md font-bold bg-white/5 border-white/10 hover:bg-white/10">
                <Link href="/marketplace" className="gap-2">
                  Marketplace
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/10">
              <div>
                <div className="text-2xl font-bold font-headline">10K+</div>
                <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Minted NFTs</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-headline">4.8k</div>
                <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Active Players</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-headline">125k</div>
                <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest">SUI Volume</div>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex justify-center relative">
            <div className="relative w-full max-w-md aspect-[4/5] rounded-3xl overflow-hidden glow-purple border-2 border-primary/20 animate-pulse-slow">
              <Image
                src={PlaceHolderImages[4].imageUrl}
                alt="Featured NFT"
                fill
                className="object-cover"
                data-ai-hint="celestial character"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl glass-card border-white/10">
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="font-headline font-bold text-xl">Celestial Astra</h3>
                    <p className="text-accent text-xs font-bold uppercase tracking-widest">Legend Rare</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Last Sale</p>
                    <p className="text-lg font-bold">45.0 SUI</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Floating badges */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-accent/20 border border-accent/40 backdrop-blur-md flex flex-col items-center justify-center animate-bounce-slow">
              <span className="text-[10px] font-bold uppercase tracking-widest">Fee</span>
              <span className="text-xl font-bold">10%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section className="py-24 bg-black/40">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="font-headline text-3xl md:text-4xl font-bold">Built for Collectors</h2>
            <p className="text-muted-foreground">The GyateGyate platform combines gaming mechanics with real-world value.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: ShieldCheck,
                title: "On-Chain Probabilities",
                desc: "Every lootbox open uses verifiable randomness. No black boxes, no rigged results."
              },
              {
                icon: Sparkles,
                title: "Dynamic Pity System",
                desc: "Bad luck protection ensures you're always making progress toward a Legendary pull."
              },
              {
                icon: TrendingUp,
                title: "Enforced Royalties",
                desc: "Kiosk-based trading ensures artists and creators get paid on every secondary sale."
              }
            ].map((feature, i) => (
              <Card key={i} className="glass-card border-white/5 hover:border-primary/50 transition-colors">
                <CardContent className="p-8 space-y-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-headline font-bold text-lg">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Lootboxes */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="font-headline text-3xl font-bold">Available Boxes</h2>
              <p className="text-muted-foreground">Start your collection today with these crates.</p>
            </div>
            <Button variant="link" asChild className="text-accent">
              <Link href="/shop" className="gap-1">View all store <ChevronRight className="w-4 h-4" /></Link>
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {MOCK_LOOTBOXES.map((box) => (
              <Card key={box.id} className="glass-card overflow-hidden group">
                <div className="relative aspect-video">
                  <Image
                    src={box.image}
                    alt={box.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                    data-ai-hint="treasure box"
                  />
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="p-3 rounded-2xl bg-primary/20 backdrop-blur-xl border border-primary/30 glow-purple">
                      <Store className="w-12 h-12 text-white" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-headline font-bold text-xl">{box.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{box.description}</p>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Price</span>
                      <span className="text-lg font-bold flex items-center gap-1">
                        {box.price} <span className="text-accent text-sm">{box.currency}</span>
                      </span>
                    </div>
                    <Button asChild variant="secondary" className="bg-primary/20 hover:bg-primary/40 border-primary/30">
                      <Link href={`/shop`}>Buy Now</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-black/20">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary glow-purple flex items-center justify-center">
              <span className="font-headline font-bold text-white text-sm">G</span>
            </div>
            <span className="font-headline font-bold text-lg tracking-tight">
              GYATE<span className="text-accent">GYATE</span>
            </span>
          </div>
          
          <div className="flex gap-8 text-xs text-muted-foreground uppercase font-bold tracking-widest">
            <Link href="#" className="hover:text-primary transition-colors">Twitter</Link>
            <Link href="#" className="hover:text-primary transition-colors">Discord</Link>
            <Link href="#" className="hover:text-primary transition-colors">Documentation</Link>
            <Link href="#" className="hover:text-primary transition-colors">Governance</Link>
          </div>

          <div className="text-[10px] text-muted-foreground">
            © 2024 GyateGyate Labs. Built on Sui Network.
          </div>
        </div>
      </footer>
    </div>
  );
}
