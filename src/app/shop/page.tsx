"use client";

import { Navigation } from "@/components/navigation";
import { Loader2, Coins, Clock, Sparkles } from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { RevealLootboxDialog } from "@/components/reveal-lootbox-dialog";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, LOOTBOX_REGISTRY, TREASURY_POOL, MODULE_NAMES, FUNCTIONS, RANDOM_STATE, GATEKEEPER_CAP, STATS_REGISTRY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import useEmblaCarousel from "embla-carousel-react";
import { NFT, RARITY_LABELS } from "@/lib/mock-data";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PossibleNFT { name: string; image: string; }
interface LootboxData {
  id: string; name: string; price: string; gyate_price: string; description: string; image: string;
  pity_enabled: boolean; multi_open_enabled: boolean; multi_open_size: string;
  common_count: number; rare_count: number; super_rare_count: number;
  ssr_count: number; ultra_rare_count: number; legend_rare_count: number;
  possibleNfts: PossibleNFT[];
  is_seasonal: boolean;
  available_from: number;
  available_until: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveStatsId(suiClient: any, playerAddress: string): Promise<string | null> {
  try {
    const registryObj = await suiClient.getObject({ id: STATS_REGISTRY, options: { showContent: true } });
    const tableId = (registryObj.data?.content as any)?.fields?.stats_by_owner?.fields?.id?.id;
    if (!tableId) return null;
    const field = await suiClient.getDynamicFieldObject({
      parentId: tableId,
      name: { type: "address", value: playerAddress },
    });
    const rawId = (field?.data?.content as any)?.fields?.value;
    if (!rawId) return null;
    return typeof rawId === "string" ? rawId : rawId?.id ?? null;
  } catch (err) {
    console.error("resolveStatsId failed:", err);
    return null;
  }
}

const SUI_EPOCH_ZERO_MS = new Date("2023-05-03T00:00:00Z").getTime();
const MS_PER_EPOCH = 24 * 60 * 60 * 1000;
function epochToLabel(epoch: number): string {
  if (!epoch) return "";
  const d = new Date(SUI_EPOCH_ZERO_MS + epoch * MS_PER_EPOCH);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function mistToSui(mist: string | number | bigint): number {
  return Number(BigInt(mist.toString())) / 1_000_000_000;
}

// ─── Rarity Colors ───────────────────────────────────────────────────────────

const RARITY_DOODLE_COLORS = [
  { bg: "#f8f8f8",   border: "#94a3b8", text: "#475569", shadow: "#cbd5e1" },
  { bg: "#eff6ff",   border: "#60a5fa", text: "#1d4ed8", shadow: "#bfdbfe" },
  { bg: "#faf5ff",   border: "#a855f7", text: "#7e22ce", shadow: "#e9d5ff" },
  { bg: "#fdf4ff",   border: "#e879f9", text: "#86198f", shadow: "#f0abfc" },
  { bg: "#fffbeb",   border: "#f59e0b", text: "#92400e", shadow: "#fde68a" },
  { bg: "#fff1f2",   border: "#fb7185", text: "#9f1239", shadow: "#fecdd3" },
];

const RARITY_GLOW_COLORS = [
  "rgba(148,163,184,0.35)",
  "rgba(96,165,250,0.4)",
  "rgba(168,85,247,0.5)",
  "rgba(232,121,249,0.55)",
  "rgba(251,191,36,0.55)",
  "rgba(251,113,133,0.6)",
];

// ─── Confetti Helper ─────────────────────────────────────────────────────────

function spawnConfetti(container: HTMLElement, colors: string[]) {
  for (let i = 0; i < 60; i++) {
    const el = document.createElement("div");
    el.className = "shop-confetti-piece";
    const angle = Math.random() * 360;
    const distance = 120 + Math.random() * 180;
    const cx = Math.cos((angle * Math.PI) / 180) * distance;
    const cy = Math.sin((angle * Math.PI) / 180) * distance - 60;
    el.style.cssText = `
      left: 50%; top: 50%; margin: -4px 0 0 -4px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      --cx: ${cx}px; --cy: ${cy}px; --cr: ${Math.random() * 720 - 360}deg;
      animation-duration: ${0.7 + Math.random() * 0.8}s;
      animation-delay: ${Math.random() * 0.3}s;
      border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
      width: ${4 + Math.random() * 8}px; height: ${4 + Math.random() * 8}px;
    `;
    container.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

// ─── Lootbox Opening Animation ───────────────────────────────────────────────

type OpenPhase = "idle" | "shaking" | "opening" | "revealed";

interface LootboxOpenAnimationProps {
  box: LootboxData | null;
  phase: OpenPhase;
  results: NFT[];
  isMulti: boolean;
  onClose: () => void;
  onShowFullReveal: () => void;
}

function LootboxOpenAnimation({ box, phase, results, isMulti, onClose, onShowFullReveal }: LootboxOpenAnimationProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const topResult = results[0];
  const rarityIndex = topResult?.rarity ?? 0;
  const glowColor = RARITY_GLOW_COLORS[Math.min(rarityIndex, 5)];
  const rarityColor = RARITY_DOODLE_COLORS[Math.min(rarityIndex, 5)];

  // Trigger box animation when phase becomes "opening"
  useEffect(() => {
    const box = boxRef.current;
    if (!box || phase !== "opening") return;
    if (glowRef.current) glowRef.current.classList.add("show");
    box.style.animation = "none";
    void box.offsetWidth;
    box.classList.add("is-shaking");
    const t1 = setTimeout(() => {
      box.classList.remove("is-shaking");
      box.classList.add("is-open");
    }, 500);
    return () => clearTimeout(t1);
  }, [phase]);

  // Confetti on reveal
  useEffect(() => {
    if (phase === "revealed" && confettiRef.current) {
      spawnConfetti(confettiRef.current, [
        "#c9b8ff", "#ffb8d9", "#b8ffe8", "#fff5b8", "#ffffff",
        rarityColor.border, rarityColor.shadow,
      ]);
    }
  }, [phase, rarityColor]);

  const isActive = phase !== "idle";
  const showBox = phase === "shaking" || phase === "opening";
  const showReveal = phase === "revealed";

  const statusText: Record<OpenPhase, string> = {
    idle: "",
    shaking: "Summoning...",
    opening: "Opening your box ✦",
    revealed: results.length > 1 ? `${results.length} Heroes revealed! ✨` : `${topResult?.name ?? "Hero"} revealed! ✨`,
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: OPEN_ANIM_STYLES }} />

      <div className={`shop-open-overlay ${isActive ? "active" : ""}`}>
        {/* Light floating particles */}
        <div className="shop-open-particles">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="shop-open-particle"
              style={{
                left: `${Math.random() * 100}%`,
                width: `${3 + Math.random() * 6}px`,
                height: `${3 + Math.random() * 6}px`,
                background: ["#c9b8ff", "#ffb8d9", "#b8ffe8", "#fff5b8", "#fde68a"][i % 5],
                animationDuration: `${3 + Math.random() * 4}s`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Confetti */}
        <div ref={confettiRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 500 }} />

        <div className="shop-open-stage">
          {/* Pulsing aura */}
          {showBox && (
            <div className="shop-p-aura" style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }} />
          )}

          {/* ── 3D BOX ── */}
          {showBox && (
            <div style={{ position: "relative" }}>
              <div
                ref={glowRef}
                className="shop-p-rarity-glow"
                style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }}
              />
              <div className="shop-p-scene">
                <div className="shop-p-ground-shadow" />
                <div className="shop-p-box-wrapper" ref={boxRef}>
                  {/* Sparkles */}
                  <div className="shop-p-sparkles">
                    {["✦","✧","⭐","💫","✨","🌸","💎"].map((s, i) => (
                      <span key={i} className="shop-p-spark">{s}</span>
                    ))}
                    <div className="shop-p-burst-ring" />
                    <div className="shop-p-burst-ring" style={{ width: 280, height: 280, margin: "-140px 0 0 -140px", animationDelay: "0.65s" }} />
                  </div>
                  {/* Body */}
                  <div className="shop-p-body-group">
                    <div className="shop-p-face shop-p-face-front">
                      <div className="shop-p-rib-v" /><div className="shop-p-rib-h" />
                      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 40, opacity: 0.15 }}>❓</div>
                        <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: "#1a1a1a25" }}>LOOT BOX</span>
                      </div>
                    </div>
                    <div className="shop-p-face shop-p-face-back" />
                    <div className="shop-p-face shop-p-face-right"><div className="shop-p-rib-v" /><div className="shop-p-rib-h" /></div>
                    <div className="shop-p-face shop-p-face-left" />
                    <div className="shop-p-face shop-p-face-bottom" />
                  </div>
                  {/* Lid */}
                  <div className="shop-p-lid-group">
                    <div className="shop-p-lid-top">
                      <div className="shop-p-lid-rib-v" /><div className="shop-p-lid-rib-h" />
                      <div className="shop-p-bow">
                        <div className="shop-p-bow-ear L" /><div className="shop-p-bow-ear R" />
                        <div className="shop-p-bow-knot" />
                        <div className="shop-p-bow-tail L" /><div className="shop-p-bow-tail R" />
                      </div>
                    </div>
                    <div className="shop-p-lid-skirt shop-p-lid-skirt-front"><div className="shop-p-skirt-rib-v" /></div>
                    <div className="shop-p-lid-skirt shop-p-lid-skirt-back" />
                    <div className="shop-p-lid-skirt shop-p-lid-skirt-right"><div className="shop-p-skirt-rib-v" /></div>
                    <div className="shop-p-lid-skirt shop-p-lid-skirt-left" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── REVEALED CARD ── */}
          {showReveal && topResult && (
            <div
              className="shop-reveal-card"
              style={{
                borderColor: rarityColor.border,
                boxShadow: `0 0 0 3px ${rarityColor.shadow}, 10px 10px 0px ${rarityColor.shadow}`,
              }}
            >
              {rarityIndex >= 2 && <div className="shop-holo-shimmer" />}

              <div className="shop-reveal-header">
                <div
                  className="shop-reveal-rarity-badge"
                  style={{ color: rarityColor.text, borderColor: rarityColor.border, background: rarityColor.bg }}
                >
                  {RARITY_LABELS[rarityIndex] ?? "Common"}
                </div>
                <button className="shop-reveal-close-btn" onClick={onClose}>✕</button>
              </div>

              {/* NFT image or multi-result indicator */}
              <div className="shop-reveal-img" style={{ borderColor: rarityColor.border }}>
                {topResult.image ? (
                  <img src={topResult.image} alt={topResult.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${rarityColor.bg}, ${rarityColor.shadow})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60 }}>📦</div>
                )}
                <div className="shop-reveal-img-overlay" />
                {results.length > 1 && (
                  <div className="shop-reveal-multi-badge">+{results.length - 1} more</div>
                )}
                {rarityIndex >= 3 && (
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${rarityColor.shadow}44, transparent, ${rarityColor.shadow}44)`, backgroundSize: "200% 200%", animation: "shopHoloSweep 2s ease-in-out infinite", pointerEvents: "none", zIndex: 2 }} />
                )}
              </div>

              <div className="shop-reveal-name">{topResult.name}</div>
              <div className="shop-reveal-id">#{topResult.globalId ?? "????"} · {topResult.variantType ?? "Standard"}</div>

              <div className="shop-reveal-stats-row">
                {[["HP", topResult.hp], ["ATK", topResult.atk], ["SPD", topResult.spd]].map(([label, val]) => (
                  <div key={label as string} className="shop-reveal-stat" style={{ borderColor: rarityColor.shadow }}>
                    <span className="shop-reveal-stat-val" style={{ color: rarityColor.text }}>{val}</span>
                    <span className="shop-reveal-stat-lbl">{label}</span>
                  </div>
                ))}
              </div>

              <button
                className="shop-reveal-view-btn"
                onClick={onClose}
                style={{ background: `linear-gradient(135deg, #1a1a1a, ${rarityColor.text})` }}
              >
                <Sparkles size={15} />
                Added to your Kiosk ✓
              </button>
            </div>
          )}

          {/* Status text */}
          {showBox && (
            <>
              <div className="shop-open-status">{statusText[phase]}</div>
              <div className="shop-open-sub">Sui Blockchain · On-Chain Randomness</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Animation Styles (light mode) ───────────────────────────────────────────

const OPEN_ANIM_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  /* ── Overlay: light frosted glass ── */
  .shop-open-overlay {
    position: fixed; inset: 0; z-index: 9000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(250, 248, 245, 0.88);
    backdrop-filter: blur(16px);
    opacity: 0; pointer-events: none;
    transition: opacity 0.4s ease;
  }
  .shop-open-overlay.active { opacity: 1; pointer-events: all; }

  /* Floating particles */
  .shop-open-particles { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .shop-open-particle {
    position: absolute; border-radius: 50%; pointer-events: none;
    animation: shopParticleDrift linear infinite; opacity: 0.55;
  }
  @keyframes shopParticleDrift {
    0%   { transform: translateY(100vh) rotate(0deg); opacity: 0; }
    10%  { opacity: 0.7; }
    90%  { opacity: 0.4; }
    100% { transform: translateY(-20vh) rotate(720deg); opacity: 0; }
  }

  /* Stage */
  .shop-open-stage {
    position: relative; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 480px; padding: 40px;
  }

  /* ── 3D Box ── */
  .shop-p-scene {
    perspective: 800px; perspective-origin: 50% 35%;
    width: 260px; height: 240px; position: relative;
  }
  .shop-p-box-wrapper {
    position: absolute; width: 200px; height: 200px; top: 80px; left: 30px;
    transform-style: preserve-3d; transform: rotateX(-22deg) rotateY(-38deg);
    animation: shopPFloatBox 5s ease-in-out infinite; cursor: pointer; will-change: transform;
  }
  .shop-p-body-group { position: absolute; inset: 0; transform-style: preserve-3d; }
  .shop-p-face {
    position: absolute; width: 200px; height: 200px; border: 3px solid #1a1a1a;
    display: flex; align-items: center; justify-content: center; overflow: hidden;
  }
  .shop-p-face-front  { transform: rotateY(0deg)   translateZ(100px); background: linear-gradient(160deg,#fffde8,#fff5b8); }
  .shop-p-face-back   { transform: rotateY(180deg) translateZ(100px); background: linear-gradient(160deg,#d0edff,#b8eeff); }
  .shop-p-face-right  { transform: rotateY(90deg)  translateZ(100px); background: linear-gradient(160deg,#ffe0ef,#ffb8d9); }
  .shop-p-face-left   { transform: rotateY(-90deg) translateZ(100px); background: linear-gradient(160deg,#d8fff0,#b8ffe8); }
  .shop-p-face-bottom { transform: rotateX(-90deg) translateZ(100px); background: linear-gradient(160deg,#fff5cc,#fffae0); }

  .shop-p-lid-group {
    position: absolute; top: 0; left: 0; width: 200px; height: 200px;
    transform-style: preserve-3d; transform: translateY(-200px);
    transform-origin: 50% 100%; transition: transform 0.7s cubic-bezier(0.34,1.05,0.64,1);
  }
  .shop-p-box-wrapper.is-open .shop-p-lid-group { transform: translateY(-200px) translateX(280px); }

  .shop-p-lid-top {
    position: absolute; width: 200px; height: 200px; border: 3px solid #1a1a1a;
    background: linear-gradient(145deg,#fffde8,#fff5b8);
    display: flex; align-items: center; justify-content: center; overflow: hidden;
    transform: rotateX(90deg) translateZ(-70px);
  }
  .shop-p-lid-skirt { position: absolute; top: 170px; width: 200px; height: 30px; border: 3px solid #1a1a1a; overflow: hidden; }
  .shop-p-lid-skirt-front { transform: rotateY(0deg)   translateZ(100px); background: linear-gradient(180deg,#fffde8,#fff5b8); }
  .shop-p-lid-skirt-back  { transform: rotateY(180deg) translateZ(100px); background: linear-gradient(180deg,#d0edff,#b8eeff); }
  .shop-p-lid-skirt-right { transform: rotateY(90deg)  translateZ(100px); background: linear-gradient(180deg,#ffe0ef,#ffb8d9); }
  .shop-p-lid-skirt-left  { transform: rotateY(-90deg) translateZ(100px); background: linear-gradient(180deg,#d8fff0,#b8ffe8); }

  .shop-p-rib-v { position: absolute; left: 50%; top: 0; bottom: 0; width: 26px; transform: translateX(-50%); background: linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left: 2px solid #c4006e; border-right: 2px solid #c4006e; z-index: 1; pointer-events: none; }
  .shop-p-rib-h { position: absolute; top: 50%; left: 0; right: 0; height: 26px; transform: translateY(-50%); background: linear-gradient(to bottom,#ffb8e0,#ff3d9a,#ffb8e0); border-top: 2px solid #c4006e; border-bottom: 2px solid #c4006e; z-index: 1; pointer-events: none; }
  .shop-p-lid-rib-v { position: absolute; left: 50%; top: 0; bottom: 0; width: 26px; transform: translateX(-50%); background: linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left: 2px solid #c4006e; border-right: 2px solid #c4006e; pointer-events: none; z-index: 1; }
  .shop-p-lid-rib-h { position: absolute; top: 50%; left: 0; right: 0; height: 26px; transform: translateY(-50%); background: linear-gradient(to bottom,#ffb8e0,#ff3d9a,#ffb8e0); border-top: 2px solid #c4006e; border-bottom: 2px solid #c4006e; pointer-events: none; z-index: 1; }
  .shop-p-skirt-rib-v { position: absolute; left: 50%; top: 0; bottom: 0; width: 26px; transform: translateX(-50%); background: linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left: 2px solid #c4006e; border-right: 2px solid #c4006e; pointer-events: none; }

  .shop-p-bow { position: absolute; width: 68px; height: 44px; top: 50%; left: 50%; transform: translate(-50%,-58%); z-index: 10; }
  .shop-p-bow-ear { position: absolute; width: 28px; height: 22px; background: linear-gradient(135deg,#ffb8e0,#ff3d9a); border: 2.5px solid #c4006e; top: 0; }
  .shop-p-bow-ear.L { left: 0; border-radius: 50% 0 50% 0; transform: rotate(-26deg); transform-origin: right center; }
  .shop-p-bow-ear.R { right: 0; border-radius: 0 50% 0 50%; transform: rotate(26deg); transform-origin: left center; }
  .shop-p-bow-knot { position: absolute; width: 15px; height: 15px; background: #ff3d9a; border: 2.5px solid #c4006e; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 6; }
  .shop-p-bow-tail { position: absolute; bottom: -6px; width: 15px; height: 14px; background: linear-gradient(135deg,#ffb8e0,#ff3d9a); border: 2px solid #c4006e; }
  .shop-p-bow-tail.L { left: 16px; border-radius: 0 0 0 8px; transform: rotate(12deg); }
  .shop-p-bow-tail.R { right: 16px; border-radius: 0 0 8px 0; transform: rotate(-12deg); }

  .shop-p-ground-shadow {
    position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 170px; height: 22px;
    background: radial-gradient(ellipse, rgba(180,150,220,0.3) 0%, transparent 72%);
    border-radius: 50%; pointer-events: none; animation: shopPShadowSync 5s ease-in-out infinite;
  }
  @keyframes shopPShadowSync { 0%,100%{transform:translateX(-50%) scaleX(1);opacity:0.5} 50%{transform:translateX(-50%) scaleX(0.72);opacity:0.2} }

  /* Sparkles */
  .shop-p-sparkles { position: absolute; inset: -80px; pointer-events: none; z-index: 200; }
  .shop-p-spark { position: absolute; top: 50%; left: 50%; font-size: 20px; opacity: 0; transform: translate(-50%,-50%); }
  .shop-p-box-wrapper.is-open .shop-p-spark { animation: shopPSparkFly 1s ease forwards; }
  .shop-p-spark:nth-child(1){--tx:-90px;--ty:-85px;animation-delay:0.36s}
  .shop-p-spark:nth-child(2){--tx:90px;--ty:-85px;animation-delay:0.41s}
  .shop-p-spark:nth-child(3){--tx:-112px;--ty:5px;animation-delay:0.38s}
  .shop-p-spark:nth-child(4){--tx:112px;--ty:5px;animation-delay:0.44s}
  .shop-p-spark:nth-child(5){--tx:-68px;--ty:100px;animation-delay:0.46s}
  .shop-p-spark:nth-child(6){--tx:68px;--ty:100px;animation-delay:0.39s}
  .shop-p-spark:nth-child(7){--tx:0;--ty:-118px;animation-delay:0.34s}
  @keyframes shopPSparkFly {
    0%{opacity:1;transform:translate(-50%,-50%) scale(0.4) rotate(0)}
    60%{opacity:1}
    100%{opacity:0;transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(1.4) rotate(210deg)}
  }

  .shop-p-burst-ring {
    position: absolute; top: 50%; left: 50%;
    width: 200px; height: 200px; margin: -100px 0 0 -100px;
    border-radius: 50%; border: 3px solid rgba(255,61,154,0.5);
    pointer-events: none; opacity: 0; z-index: 150; transform: scale(0.3);
  }
  .shop-p-box-wrapper.is-open .shop-p-burst-ring {
    animation: shopBurstRing 0.9s cubic-bezier(0.22,1,0.36,1) 0.5s forwards;
  }
  @keyframes shopBurstRing {
    0%  { opacity: 0.8; transform: scale(0.3); }
    100%{ opacity: 0;   transform: scale(3);   }
  }

  @keyframes shopPFloatBox {
    0%,100%{transform:rotateX(-22deg) rotateY(-38deg) translateY(0)}
    50%{transform:rotateX(-22deg) rotateY(-38deg) translateY(-16px)}
  }
  @keyframes shopPShake {
    0%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(0,0,0)}
    20%,80%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(-7px,0,0)}
    40%,60%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(9px,0,0)}
    100%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(0,0,0)}
  }
  .shop-p-box-wrapper.is-shaking { animation: shopPShake 0.48s cubic-bezier(0.36,0.07,0.19,0.97) both !important; }

  /* Aura — lightened for light mode */
  .shop-p-aura {
    position: absolute; width: 280px; height: 280px;
    top: 50%; left: 50%; margin: -140px 0 0 -140px;
    border-radius: 50%; pointer-events: none; z-index: 0;
    animation: shopAuraPulse 2s ease-in-out infinite;
  }
  @keyframes shopAuraPulse {
    0%,100%{ transform: scale(0.85); opacity: 0.18; }
    50%{ transform: scale(1.15); opacity: 0.42; }
  }

  /* Rarity glow */
  .shop-p-rarity-glow {
    position: absolute; top: 50%; left: 50%;
    width: 320px; height: 320px; margin: -160px 0 0 -160px;
    border-radius: 50%; pointer-events: none; z-index: -1;
    opacity: 0; transition: opacity 0.5s ease; filter: blur(40px);
  }
  .shop-p-rarity-glow.show { opacity: 1; }

  /* ── Status text — dark on light bg ── */
  .shop-open-status {
    font-family: 'Caveat', cursive; font-size: 26px; font-weight: 700;
    color: #1a1a1a; text-align: center; margin-top: 24px; min-height: 36px;
    letter-spacing: 0.02em;
    text-shadow: 0 1px 8px rgba(201,184,255,0.5);
    animation: shopStatusPulse 1.6s ease-in-out infinite;
  }
  @keyframes shopStatusPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }

  .shop-open-sub {
    font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 700;
    color: #94a3b8; text-align: center; margin-top: 6px;
    letter-spacing: 0.1em; text-transform: uppercase;
  }

  /* ── Reveal card ── */
  .shop-reveal-card {
    background: white; border: 3px solid; border-radius: 24px;
    padding: 24px; width: 320px; max-width: 90vw;
    position: relative; overflow: hidden;
    animation: shopCardPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
  }
  @keyframes shopCardPop {
    0%  { transform: scale(0) rotate(-6deg); opacity: 0; }
    100%{ transform: scale(1) rotate(0deg);  opacity: 1; }
  }

  .shop-reveal-header {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
  }
  .shop-reveal-rarity-badge {
    padding: 4px 12px; border-radius: 99px; font-family: 'Nunito', sans-serif;
    font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em;
    border: 2px solid currentColor;
  }
  .shop-reveal-close-btn {
    width: 30px; height: 30px; border-radius: 50%; border: 2px solid #1a1a1a;
    background: #f8f8f8; display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 14px; font-weight: 700; color: #1a1a1a;
    transition: all 0.15s ease;
  }
  .shop-reveal-close-btn:hover { background: #1a1a1a; color: white; }

  .shop-reveal-img {
    width: 100%; aspect-ratio: 1; border-radius: 14px; overflow: hidden;
    border: 3px solid; margin-bottom: 14px; position: relative;
  }
  .shop-reveal-img-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.25), transparent 60%);
    pointer-events: none;
  }
  .shop-reveal-multi-badge {
    position: absolute; bottom: 10px; right: 10px;
    background: rgba(0,0,0,0.7); color: white;
    font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800;
    padding: 4px 10px; border-radius: 20px; backdrop-filter: blur(4px);
  }

  .shop-reveal-name {
    font-family: 'Caveat', cursive; font-size: 26px; font-weight: 700;
    color: #1a1a1a; margin-bottom: 2px;
  }
  .shop-reveal-id {
    font-size: 10px; font-weight: 700; color: #94a3b8;
    letter-spacing: 0.1em; margin-bottom: 14px;
  }

  .shop-reveal-stats-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 14px;
  }
  .shop-reveal-stat {
    background: #fafaf8; border: 2px solid; border-radius: 10px;
    padding: 7px 4px; text-align: center;
  }
  .shop-reveal-stat-val {
    font-family: 'Caveat', cursive; font-size: 20px; font-weight: 700;
    display: block; line-height: 1;
  }
  .shop-reveal-stat-lbl {
    font-size: 9px; font-weight: 900; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-top: 2px;
  }

  .shop-reveal-view-btn {
    width: 100%; padding: 13px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a; color: white;
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800;
    box-shadow: 4px 4px 0px #c9b8ff; cursor: pointer;
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .shop-reveal-view-btn:hover { transform: translateY(-2px); box-shadow: 6px 6px 0px #c9b8ff; }

  /* Holographic shimmer */
  .shop-holo-shimmer {
    position: absolute; inset: 0; border-radius: 22px;
    background: linear-gradient(105deg, transparent 20%, rgba(201,184,255,0.18) 38%, rgba(255,184,217,0.18) 50%, rgba(184,238,255,0.18) 62%, transparent 80%);
    background-size: 200% 200%; animation: shopHoloSweep 2.5s ease-in-out infinite;
    pointer-events: none; z-index: 1;
  }
  @keyframes shopHoloSweep { 0%,100%{background-position:-100% 0;opacity:0.4} 50%{background-position:200% 0;opacity:0.9} }
  @keyframes shopHoloSweep { 0%,100%{background-position:-100% 0} 50%{background-position:200% 0} }

  /* Confetti */
  .shop-confetti-piece {
    position: absolute; width: 8px; height: 8px; border-radius: 2px;
    pointer-events: none; opacity: 0; animation: shopConfettiFall linear forwards;
  }
  @keyframes shopConfettiFall {
    0%  { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
    80% { opacity: 0.8; }
    100%{ opacity: 0; transform: translate(var(--cx), var(--cy)) rotate(var(--cr)) scale(0.4); }
  }

  @keyframes shopHoloSweep {
    0%,100%{background-position:-100% 0; opacity: 0.5}
    50%{background-position:200% 0; opacity: 1}
  }
`;

// ─── Shop Styles ──────────────────────────────────────────────────────────────

const SHOP_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  .shop-page { min-height: 100vh; background: #fafaf8; font-family: 'Nunito', sans-serif; }
  .shop-page::before {
    content: ''; position: fixed; inset: 0;
    background-image:
      radial-gradient(circle at 10% 20%, rgba(255,245,184,0.25) 0%, transparent 40%),
      radial-gradient(circle at 90% 80%, rgba(201,184,255,0.15) 0%, transparent 40%),
      radial-gradient(circle at 50% 50%, rgba(255,184,217,0.08) 0%, transparent 60%);
    pointer-events: none; z-index: 0;
  }
  .shop-container { max-width: 1280px; margin: 0 auto; padding: 36px 24px; position: relative; z-index: 1; }

  .shop-header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 48px; }
  .shop-title { font-family: 'Caveat', cursive; font-size: 52px; font-weight: 700; color: #1a1a1a; line-height: 1; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; }
  .shop-subtitle { font-size: 14px; color: #64748b; font-weight: 600; }

  .payment-toggle { display: flex; background: white; border: 2px solid #1a1a1a; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; padding: 4px; box-shadow: 4px 4px 0px #c9b8ff; gap: 4px; }
  .payment-toggle-btn { padding: 8px 20px; border-radius: 255px 12px 225px 12px / 12px 225px 12px 255px; border: none; cursor: pointer; font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; transition: all 0.2s ease; color: #94a3b8; background: transparent; }
  .payment-toggle-btn.active-sui { background: #1a1a1a; color: white; }
  .payment-toggle-btn.active-gyate { background: linear-gradient(135deg, #f3e8ff, #fce7f3); color: #7e22ce; border: 1.5px solid #c9b8ff; }

  .lootbox-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px,1fr)); gap: 28px; }

  .lootbox-card { background: white; border: 2px solid #1a1a1a; border-radius: 24px; overflow: hidden; position: relative; transition: transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275); display: flex; flex-direction: column; }
  .lootbox-card:hover { transform: translateY(-4px); }
  .lootbox-card.seasonal { border-color: #f59e0b; }
  .lootbox-card-shadow { position: absolute; inset: 0; border-radius: 22px; background: linear-gradient(135deg, #c9b8ff, #ffb8d9); transform: translate(6px,6px); z-index: -1; }
  .lootbox-card-shadow.seasonal { background: linear-gradient(135deg, #fde68a, #fcd34d); }

  .card-carousel { position: relative; aspect-ratio: 4/3; overflow: hidden; background: #f8f4ff; }
  .card-carousel-inner { display: flex; height: 100%; }
  .carousel-slide { flex: 0 0 100%; min-width: 0; height: 100%; position: relative; }
  .carousel-slide img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease; }
  .carousel-slide:hover img { transform: scale(1.05); }
  .carousel-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%); }
  .carousel-label { position: absolute; bottom: 10px; left: 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: white; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); padding: 4px 10px; border-radius: 20px; }

  .card-badges { position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
  .card-badge { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 20px; border: 1.5px solid; backdrop-filter: blur(4px); }
  .card-badge.pity { background: rgba(243,232,255,0.9); color: #7e22ce; border-color: #c9b8ff; }
  .card-badge.multi { background: rgba(219,234,254,0.9); color: #1d4ed8; border-color: #93c5fd; }
  .card-badge.seasonal { background: rgba(254,243,199,0.95); color: #92400e; border-color: #fcd34d; }

  .seasonal-strip { display: flex; align-items: center; gap: 6px; padding: 7px 16px; background: linear-gradient(135deg, #fffbeb, #fef3c7); border-top: 1.5px dashed #fcd34d; font-size: 11px; font-weight: 800; color: #92400e; }

  .card-body { padding: 20px; display: flex; flex-direction: column; flex: 1; }
  .card-name { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }

  .card-drops { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px; }
  .drop-pill { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 20px; border: 1.5px solid; }
  .drop-pill.common { background: #f8f8f8; color: #475569; border-color: #cbd5e1; }
  .drop-pill.rare { background: #eff6ff; color: #1d4ed8; border-color: #93c5fd; }
  .drop-pill.super-rare { background: #faf5ff; color: #7e22ce; border-color: #d8b4fe; }
  .drop-pill.ssr { background: #fdf4ff; color: #86198f; border-color: #f0abfc; }
  .drop-pill.ultra { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
  .drop-pill.legend { background: #fff1f2; color: #9f1239; border-color: #fda4af; }

  .price-row { display: flex; align-items: flex-end; justify-content: space-between; padding: 14px 0; border-top: 2px dashed #f1f5f9; border-bottom: 2px dashed #f1f5f9; margin-bottom: 16px; }
  .price-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .price-main { font-family: 'Caveat', cursive; font-size: 32px; font-weight: 700; color: #1a1a1a; line-height: 1; }
  .price-currency { font-size: 14px; font-weight: 900; color: #7e22ce; margin-left: 4px; }
  .price-alt { font-size: 13px; font-weight: 800; color: #94a3b8; text-decoration: line-through; display: flex; align-items: center; gap: 3px; }
  .price-alt.active-gyate { color: #7e22ce; text-decoration: none; font-size: 15px; }

  .action-row { display: grid; gap: 8px; }
  .action-row.two-col { grid-template-columns: 1fr 1fr; }
  .shop-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 13px 16px; border: 2px solid #1a1a1a; font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; color: #1a1a1a; cursor: pointer; transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275); }
  .shop-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
  .shop-btn.primary { border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; background: linear-gradient(135deg, #f3e8ff, #fce7f3); box-shadow: 4px 4px 0px #c9b8ff; }
  .shop-btn.primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 6px 6px 0px #c9b8ff; }
  .shop-btn.secondary { border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px; background: white; box-shadow: 3px 3px 0px #e2e8f0; }
  .shop-btn.secondary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 5px 5px 0px #e2e8f0; }
  .shop-btn.pity { border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; background: #fdf4ff; color: #86198f; border-color: #e879f9; box-shadow: 3px 3px 0px #f0abfc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .shop-btn.pity:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 5px 5px 0px #f0abfc; }

  .shop-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0; gap: 20px; }
  .shop-loading-text { font-family: 'Caveat', cursive; font-size: 24px; color: #94a3b8; }
  .shop-empty { text-align: center; padding: 100px 24px; background: white; border: 2px dashed #e2e8f0; border-radius: 28px; }
  .shop-empty-icon { font-size: 56px; margin-bottom: 20px; }
  .shop-empty-title { font-family: 'Caveat', cursive; font-size: 32px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .shop-empty-desc { font-size: 14px; color: #64748b; max-width: 360px; margin: 0 auto; }

  @media (max-width: 768px) {
    .shop-title { font-size: 38px; }
    .lootbox-grid { grid-template-columns: 1fr; }
    .action-row.two-col { grid-template-columns: 1fr; }
  }
`;

// ─── Carousel ─────────────────────────────────────────────────────────────────

function LootboxPreviewCarousel({ nfts, fallbackImage }: { nfts: PossibleNFT[]; fallbackImage: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 30 });
  useEffect(() => {
    if (!emblaApi || nfts.length <= 1) return;
    const id = setInterval(() => emblaApi.scrollNext(), 3000);
    return () => clearInterval(id);
  }, [emblaApi, nfts.length]);

  if (nfts.length === 0) {
    return (
      <div className="card-carousel">
        <Image src={fallbackImage} alt="Lootbox" fill className="object-cover" />
        <div className="carousel-overlay" />
      </div>
    );
  }

  return (
    <div className="card-carousel" ref={emblaRef}>
      <div className="card-carousel-inner">
        {nfts.map((nft, idx) => (
          <div key={idx} className="carousel-slide">
            <Image src={nft.image || fallbackImage} alt={nft.name} fill className="object-cover" />
            <div className="carousel-overlay" />
            <div className="carousel-label">Possible Drop: {nft.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ShopPage() {
  const [activeBoxes, setActiveBoxes] = useState<LootboxData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'SUI' | 'GYATE'>('SUI');

  // Full reveal dialog (existing)
  const [revealBox, setRevealBox] = useState<LootboxData | null>(null);
  const [revealResults, setRevealResults] = useState<NFT[]>([]);
  const [showReveal, setShowReveal] = useState(false);

  // ── New: opening animation state ──
  const [openPhase, setOpenPhase] = useState<OpenPhase>("idle");
  const [openBox, setOpenBox] = useState<LootboxData | null>(null);
  const [openResults, setOpenResults] = useState<NFT[]>([]);
  const [openMode, setOpenMode] = useState<'single' | 'multi' | 'pity'>('single');
  // Ref so the phase timer callback always sees the latest results & mode
  const openResultsRef = useRef<NFT[]>([]);
  const openModeRef = useRef<'single' | 'multi' | 'pity'>('single');
  const openBoxRef = useRef<LootboxData | null>(null);

  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const fetchActiveLootboxes = useCallback(async () => {
    setIsLoading(true);
    try {
      const registryObj = await suiClient.getObject({ id: LOOTBOX_REGISTRY, options: { showContent: true } });
      const activeIds = (registryObj.data?.content as any)?.fields?.active_ids || [];
      if (activeIds.length === 0) { setActiveBoxes([]); return; }

      const boxesData = await suiClient.multiGetObjects({ ids: activeIds, options: { showContent: true } });
      const boxes: LootboxData[] = boxesData.map((obj: any) => {
        const fields = obj.data?.content?.fields;
        const extractNfts = (configs: any[]) => configs ? configs.map(c => ({ name: c.fields.name, image: c.fields.base_image_url })) : [];
        const possibleNfts = [
          ...extractNfts(fields.common_configs), ...extractNfts(fields.rare_configs),
          ...extractNfts(fields.super_rare_configs), ...extractNfts(fields.ssr_configs),
          ...extractNfts(fields.ultra_rare_configs), ...extractNfts(fields.legend_rare_configs),
        ];
        return {
          id: obj.data?.objectId, name: fields?.name || "Premium Crate",
          price: fields?.price || "0", gyate_price: fields?.gyate_price || "100",
          description: "Verified on-chain random hero summon.",
          image: "https://images.unsplash.com/photo-1632809199725-72a4245e846b?q=80&w=600",
          pity_enabled: fields?.pity_enabled || false,
          multi_open_enabled: fields?.multi_open_enabled || false,
          multi_open_size: fields?.multi_open_size || "10",
          common_count: fields?.common_configs?.length || 0,
          rare_count: fields?.rare_configs?.length || 0,
          super_rare_count: fields?.super_rare_configs?.length || 0,
          ssr_count: fields?.ssr_configs?.length || 0,
          ultra_rare_count: fields?.ultra_rare_configs?.length || 0,
          legend_rare_count: fields?.legend_rare_configs?.length || 0,
          possibleNfts,
          is_seasonal: fields?.is_seasonal || false,
          available_from: parseInt(fields?.available_from || "0"),
          available_until: parseInt(fields?.available_until || "0"),
        };
      });
      setActiveBoxes(boxes);
    } catch (err) { console.error("Discovery error:", err); }
    finally { setIsLoading(false); }
  }, [suiClient]);

  useEffect(() => { fetchActiveLootboxes(); }, [fetchActiveLootboxes]);

  // Auto-advance opening → revealed (single) OR straight to dialog (multi/pity)
  useEffect(() => {
    if (openPhase !== "opening") return;
    const t = setTimeout(() => {
      const mode = openModeRef.current;
      const results = openResultsRef.current;
      const box = openBoxRef.current;
      if (mode === 'multi') {
        // Multi: skip single-card reveal, go straight to full dialog
        setRevealBox(box);
        setRevealResults(results);
        setShowReveal(true);
        setOpenPhase("idle");
        setOpenBox(null);
        setOpenResults([]);
      } else {
        // Single / pity: show the single reveal card
        setOpenPhase("revealed");
      }
    }, 3800);
    return () => clearTimeout(t);
  }, [openPhase]);

  const closeOpenAnimation = () => {
    setOpenPhase("idle");
    setOpenBox(null);
    setOpenResults([]);
  };

  // Only used by single-pull reveal card button
  const showFullReveal = () => {
    setRevealBox(openBox);
    setRevealResults(openResults);
    setShowReveal(true);
    closeOpenAnimation();
  };

  const handleSummon = async (box: LootboxData, mode: 'single' | 'multi' | 'pity' = 'single') => {
    if (!account) { toast({ variant: "destructive", title: "Wallet required" }); return; }
    const signerAddress = account.address;
    const totalChars = box.common_count + box.rare_count + box.super_rare_count + box.ssr_count + box.ultra_rare_count + box.legend_rare_count;
    if (totalChars === 0) { toast({ variant: "destructive", title: "Empty Protocol", description: "This lootbox has no character types registered yet." }); return; }

    // Show box animation immediately (shaking phase while tx processes)
    setOpenBox(box);
    setOpenMode(mode);
    setOpenPhase("shaking");
    setIsPending(true);
    openModeRef.current = mode;
    openBoxRef.current = box;
    openResultsRef.current = [];

    try {
      const txb = new Transaction();

      // ── Kiosk ──────────────────────────────────────────────────────────────
      const ownedCaps = await suiClient.getOwnedObjects({
        owner: signerAddress,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });
      let kioskArg: any, kioskCapArg: any, autoCreatingKiosk = false;
      if (ownedCaps.data.length === 0) {
        autoCreatingKiosk = true;
        toast({ title: "🎒 Setting up your Kiosk", description: "No Kiosk found — one will be created for you!" });
        const [newKiosk, newKioskCap] = txb.moveCall({ target: "0x2::kiosk::new", arguments: [] });
        kioskArg = newKiosk; kioskCapArg = newKioskCap;
      } else {
        const capId = ownedCaps.data[0].data?.objectId;
        if (!capId) { toast({ variant: "destructive", title: "Kiosk Error" }); setIsPending(false); closeOpenAnimation(); return; }
        const kioskIdStr = (ownedCaps.data[0].data?.content as any)?.fields?.for;
        kioskArg = txb.object(kioskIdStr); kioskCapArg = txb.object(capId);
      }

      // ── PlayerStats ────────────────────────────────────────────────────────
      const statsId = await resolveStatsId(suiClient, signerAddress);
      if (!statsId) {
        toast({ variant: "destructive", title: "Profile Setup Required" });
        setIsPending(false); closeOpenAnimation(); return;
      }

      // ── Payment ────────────────────────────────────────────────────────────
      const paymentAmount = mode === 'multi'
        ? BigInt(paymentMethod === 'SUI' ? box.price : box.gyate_price) * BigInt(box.multi_open_size)
        : BigInt(paymentMethod === 'SUI' ? box.price : box.gyate_price);

      let targetFunction = "";
      if (paymentMethod === 'SUI') {
        if (mode === 'single') targetFunction = FUNCTIONS.OPEN_LOOTBOX;
        else if (mode === 'multi') targetFunction = FUNCTIONS.MULTI_OPEN_LOOTBOX;
        else if (mode === 'pity') targetFunction = FUNCTIONS.OPEN_LOOTBOX_WITH_PITY;
      } else {
        if (mode === 'single') targetFunction = FUNCTIONS.OPEN_LOOTBOX_WITH_GYATE;
        else if (mode === 'multi') targetFunction = FUNCTIONS.MULTI_OPEN_LOOTBOX_GYATE;
        else if (mode === 'pity') targetFunction = FUNCTIONS.OPEN_LOOTBOX_GYATE_WITH_PITY;
      }

      let paymentCoin;
      if (paymentMethod === 'SUI') {
        const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(paymentAmount)]);
        paymentCoin = coin;
      } else {
        const gyateType = `${PACKAGE_ID}::${MODULE_NAMES.GYATE_COIN}::GYATE_COIN`;
        const coins = await suiClient.getCoins({ owner: signerAddress, coinType: gyateType });
        if (coins.data.length === 0) throw new Error("No $GYATE tokens found in wallet.");
        const [mainCoin, ...otherCoins] = coins.data.map((c: any) => c.coinObjectId);
        if (otherCoins.length > 0) txb.mergeCoins(txb.object(mainCoin), otherCoins.map((c: string) => txb.object(c)));
        const [coin] = txb.splitCoins(txb.object(mainCoin), [txb.pure.u64(paymentAmount)]);
        paymentCoin = coin;
      }

      // ── Pity ──────────────────────────────────────────────────────────────
      let progressId: string | null = null;
      if (mode === 'pity') {
        const progressObjects = await suiClient.getOwnedObjects({ owner: signerAddress, filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::UserProgress` }, options: { showContent: true } });
        const progress = progressObjects.data.find((p: any) => p.data?.content?.fields?.lootbox_id === box.id);
        if (!progress) { toast({ variant: "destructive", title: "Pity Tracking Disabled" }); setIsPending(false); closeOpenAnimation(); return; }
        progressId = progress.data!.objectId;
      }

      const callArgs = [
        txb.object(box.id), txb.object(LOOTBOX_REGISTRY),
        paymentMethod === 'SUI' ? txb.object(TREASURY_POOL) : txb.object(GATEKEEPER_CAP),
      ];
      if (mode === 'pity' && progressId) callArgs.push(txb.object(progressId));
      callArgs.push(paymentCoin, txb.object(statsId), txb.object(RANDOM_STATE), kioskArg, kioskCapArg);

      txb.moveCall({ target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${targetFunction}`, arguments: callArgs });

      if (autoCreatingKiosk) {
        txb.moveCall({ target: "0x2::transfer::public_share_object", typeArguments: ["0x2::kiosk::Kiosk"], arguments: [kioskArg] });
        txb.transferObjects([kioskCapArg], txb.pure.address(signerAddress));
      }

      signAndExecute({ transaction: txb }, {
        onSuccess: async (result) => {
          // Advance to opening animation now that tx succeeded
          setOpenPhase("opening");
          try {
            const resp = await suiClient.waitForTransaction({ digest: result.digest, options: { showEvents: true } });
            const nftMintedEvents = resp.events?.filter((e: any) => e.type.includes("::NFTMintedEvent")) || [];
            if (nftMintedEvents.length === 0) throw new Error("No characters minted in transaction.");
            const nftIds = nftMintedEvents.map((e: any) => e.parsedJson.nft_id);
            const objects = await suiClient.multiGetObjects({ ids: nftIds, options: { showContent: true } });
            const results: NFT[] = objects.map((obj: any) => {
              const fields = obj.data?.content?.fields;
              return {
                id: obj.data?.objectId, name: fields.name, rarity: fields.rarity,
                variantType: fields.variant_type, image: fields.image_url,
                hp: parseInt(fields.hp), atk: parseInt(fields.atk), spd: parseInt(fields.spd),
                baseValue: parseInt(fields.base_value), actualValue: parseInt(fields.actual_value),
                lootboxSource: fields.lootbox_source, globalId: parseInt(fields.global_sequential_id),
              };
            });
            // Store results; the phase timer will advance to "revealed" or dialog
            setOpenResults(results);
            openResultsRef.current = results;
            setIsPending(false);
          } catch (err: any) {
            toast({ variant: "destructive", title: "Reveal Error", description: err.message });
            closeOpenAnimation();
            setIsPending(false);
          }
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Summon Failed", description: err.message });
          closeOpenAnimation();
          setIsPending(false);
        },
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Summon Error", description: err.message });
      closeOpenAnimation();
      setIsPending(false);
    }
  };

  return (
    <div className="shop-page">
      <style dangerouslySetInnerHTML={{ __html: SHOP_STYLES }} />
      <Navigation />

      {/* ── Lootbox Opening Animation Overlay ── */}
      <LootboxOpenAnimation
        box={openBox}
        phase={openPhase}
        results={openResults}
        isMulti={openMode === 'multi'}
        onClose={closeOpenAnimation}
        onShowFullReveal={showFullReveal}
      />

      <div className="shop-container">
        <div className="shop-header">
          <div>
            <div className="shop-title">Summoning Altar</div>
            <div className="shop-subtitle">On-chain randomness · Bad-luck protection · $GYATE rewards</div>
          </div>
          <div className="payment-toggle">
            <button className={`payment-toggle-btn ${paymentMethod === 'SUI' ? 'active-sui' : ''}`} onClick={() => setPaymentMethod('SUI')}>◈ SUI Mode</button>
            <button className={`payment-toggle-btn ${paymentMethod === 'GYATE' ? 'active-gyate' : ''}`} onClick={() => setPaymentMethod('GYATE')}>✦ GYATE Mode</button>
          </div>
        </div>

        {isLoading ? (
          <div className="shop-loading"><div style={{ fontSize: 56 }}>📦</div><div className="shop-loading-text">Consulting the registry...</div></div>
        ) : activeBoxes.length === 0 ? (
          <div className="shop-empty"><div className="shop-empty-icon">🏛️</div><div className="shop-empty-title">Registry Empty</div><div className="shop-empty-desc">No lootboxes are currently active on the protocol. Check back soon!</div></div>
        ) : (
          <div className="lootbox-grid">
            {activeBoxes.map(box => (
              <div key={box.id} style={{ position: "relative" }}>
                <div className={`lootbox-card-shadow ${box.is_seasonal ? "seasonal" : ""}`} />
                <div className={`lootbox-card ${box.is_seasonal ? "seasonal" : ""}`}>
                  <LootboxPreviewCarousel nfts={box.possibleNfts} fallbackImage={box.image} />

                  <div className="card-badges">
                    {box.is_seasonal && <span className="card-badge seasonal">⏳ Limited</span>}
                    {box.pity_enabled && <span className="card-badge pity">✦ Pity</span>}
                    {box.multi_open_enabled && <span className="card-badge multi">{box.multi_open_size}× Batch</span>}
                  </div>

                  {box.is_seasonal && box.available_until > 0 && (
                    <div className="seasonal-strip">
                      <Clock size={12} />
                      <span>
                        {box.available_from > 0
                          ? `${epochToLabel(box.available_from)} → ${epochToLabel(box.available_until)}`
                          : `Ends ${epochToLabel(box.available_until)}`}
                      </span>
                    </div>
                  )}

                  <div className="card-body">
                    <div className="card-name">{box.name}</div>
                    <div className="card-drops">
                      {box.common_count > 0 && <span className="drop-pill common">Common ×{box.common_count}</span>}
                      {box.rare_count > 0 && <span className="drop-pill rare">Rare ×{box.rare_count}</span>}
                      {box.super_rare_count > 0 && <span className="drop-pill super-rare">SR ×{box.super_rare_count}</span>}
                      {box.ssr_count > 0 && <span className="drop-pill ssr">SSR ×{box.ssr_count}</span>}
                      {box.ultra_rare_count > 0 && <span className="drop-pill ultra">UR ×{box.ultra_rare_count}</span>}
                      {box.legend_rare_count > 0 && <span className="drop-pill legend">Legend ×{box.legend_rare_count}</span>}
                    </div>
                    <div className="price-row">
                      <div>
                        <div className="price-label">Price</div>
                        <div style={{ display: "flex", alignItems: "baseline" }}>
                          <span className="price-main" style={{ opacity: paymentMethod === 'GYATE' ? 0.3 : 1 }}>{Number(box.price) / 1_000_000_000}</span>
                          <span className="price-currency" style={{ opacity: paymentMethod === 'GYATE' ? 0.3 : 1 }}>SUI</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="price-label">Alt Price</div>
                        <span className={`price-alt ${paymentMethod === 'GYATE' ? 'active-gyate' : ''}`}>{box.gyate_price} <Coins size={12} /></span>
                      </div>
                    </div>
                    <div className={`action-row ${box.multi_open_enabled ? 'two-col' : ''}`}>
                      <button className="shop-btn primary" disabled={isPending} onClick={() => handleSummon(box, 'single')}>
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : "✦ Single Pull"}
                      </button>
                      {box.multi_open_enabled && (
                        <button className="shop-btn secondary" disabled={isPending} onClick={() => handleSummon(box, 'multi')}>{box.multi_open_size}× Batch</button>
                      )}
                    </div>
                    {box.pity_enabled && (
                      <div style={{ marginTop: 8 }}>
                        <button className="shop-btn pity" style={{ width: "100%" }} disabled={isPending} onClick={() => handleSummon(box, 'pity')}>⚡ Pity-Guaranteed Summon</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Existing full reveal dialog — shown after clicking "View All Heroes" */}
      <RevealLootboxDialog
        box={revealBox}
        results={revealResults}
        open={showReveal}
        onOpenChange={open => { setShowReveal(open); if (!open) { setRevealResults([]); setRevealBox(null); } }}
      />
    </div>
  );
}