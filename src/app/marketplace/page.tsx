"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Search, RefreshCw, Info, Loader2, Filter, X, Sparkles } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL, TRANSFER_POLICY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@mysten/sui/transactions";
import { NFT, RARITY_LABELS } from "@/lib/mock-data";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeSuiId(id: string | any): string {
  if (!id) return "";
  const str = typeof id === "string" ? id : id?.id || id?.objectId || JSON.stringify(id);
  return str.toLowerCase().replace(/^(0x)?/, "0x");
}
function mistToSui(mist: string | number | bigint): number {
  return Number(BigInt(mist.toString())) / 1_000_000_000;
}

interface ActiveListing { nftId: string; kioskId: string; priceMist: string; }

const RARITY_DOODLE_COLORS = [
  { bg: "#f8f8f8", border: "#94a3b8", text: "#475569", shadow: "#cbd5e1" },
  { bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", shadow: "#bfdbfe" },
  { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", shadow: "#e9d5ff" },
  { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", shadow: "#f0abfc" },
  { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", shadow: "#fde68a" },
  { bg: "#fff1f2", border: "#fb7185", text: "#9f1239", shadow: "#fecdd3" },
];

const RARITY_GLOW_COLORS = [
  "rgba(148,163,184,0.4)",
  "rgba(96,165,250,0.5)",
  "rgba(168,85,247,0.6)",
  "rgba(232,121,249,0.7)",
  "rgba(251,191,36,0.7)",
  "rgba(251,113,133,0.8)",
];

// ─── All Styles ────────────────────────────────────────────────────────────────
const ALL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Nunito:wght@300;400;600;700;800&display=swap');

  /* ── Marketplace base ── */
  .mkt-page {
    min-height: 100vh;
    background: #fafaf8;
    font-family: 'Nunito', sans-serif;
    position: relative;
  }
  .mkt-page::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      radial-gradient(circle at 15% 30%, rgba(201,184,255,0.12) 0%, transparent 50%),
      radial-gradient(circle at 85% 70%, rgba(255,184,217,0.10) 0%, transparent 50%);
    pointer-events: none; z-index: 0;
  }
  .mkt-container { max-width: 1280px; margin: 0 auto; padding: 32px 24px; position: relative; z-index: 1; }

  .mkt-header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 36px; }
  .mkt-title { font-family: 'Caveat', cursive; font-size: 44px; font-weight: 700; color: #1a1a1a; line-height: 1; margin-bottom: 4px; }
  .mkt-subtitle { font-size: 13px; color: #64748b; font-weight: 600; }
  .mkt-header-actions { display: flex; align-items: center; gap: 10px; }

  .mkt-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 18px;
    border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px;
    border: 2px solid #1a1a1a;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 13px; font-weight: 800; color: #1a1a1a;
    box-shadow: 3px 3px 0px #c9b8ff;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
  }
  .mkt-btn:hover { transform: translateY(-2px); box-shadow: 5px 5px 0px #c9b8ff; }
  .mkt-btn:active { transform: translateY(1px); box-shadow: 1px 1px 0px #c9b8ff; }
  .mkt-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .mkt-btn.icon-only { padding: 10px 12px; }

  .mkt-search-wrap { position: relative; }
  .mkt-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 15px; height: 15px; }
  .mkt-search {
    padding: 10px 14px 10px 36px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 13px; font-weight: 600;
    box-shadow: 3px 3px 0px #c9b8ff;
    outline: none; width: 220px;
    transition: box-shadow 0.2s ease; color: #1a1a1a;
  }
  .mkt-search:focus { box-shadow: 5px 5px 0px #c9b8ff; }
  .mkt-search::placeholder { color: #94a3b8; }

  .mkt-layout { display: grid; grid-template-columns: 260px 1fr; gap: 28px; align-items: start; }
  @media (max-width: 900px) { .mkt-layout { grid-template-columns: 1fr; } }

  .mkt-sidebar {
    position: sticky; top: 88px;
    background: white;
    border: 2px solid #1a1a1a;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 5px 5px 0px #c9b8ff;
    box-sizing: border-box; width: 100%; overflow: hidden;
  }
  .sidebar-title { font-family: 'Caveat', cursive; font-size: 22px; font-weight: 700; color: #1a1a1a; display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
  .sidebar-reset { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; cursor: pointer; background: none; border: none; font-family: 'Nunito', sans-serif; padding: 4px 8px; border-radius: 6px; transition: color 0.15s ease; }
  .sidebar-reset:hover { color: #7e22ce; }
  .sidebar-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 10px; display: flex; align-items: center; gap: 4px; }
  .sidebar-divider { height: 1px; background: #f1f5f9; margin: 16px 0; }

  .rarity-pills { display: flex; flex-direction: column; gap: 6px; }
  .rarity-pill { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; border: 2px solid #e2e8f0; background: white; font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800; color: #64748b; cursor: pointer; transition: all 0.15s ease; width: 100%; box-sizing: border-box; text-align: left; }
  .rarity-pill:hover { border-color: #c9b8ff; color: #7e22ce; }
  .rarity-pill.active { background: linear-gradient(135deg, #f3e8ff, #fce7f3); border-color: #1a1a1a; color: #1a1a1a; box-shadow: 2px 2px 0px #c9b8ff; }
  .rarity-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; border: 1.5px solid; }

  .stat-section { margin-bottom: 14px; }
  .stat-range-row { display: flex; gap: 6px; width: 100%; }
  .stat-range-input { flex: 1; min-width: 0; padding: 7px 8px; border: 2px solid #e2e8f0; border-radius: 12px; font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 700; color: #1a1a1a; outline: none; transition: border-color 0.15s, box-shadow 0.15s; background: #fafaf8; box-sizing: border-box; width: 100%; }
  .stat-range-input:focus { border-color: #c9b8ff; box-shadow: 1px 1px 0px #c9b8ff; }

  .sidebar-info { margin-top: 16px; padding: 11px 12px; background: #fdf4ff; border: 1.5px solid #e9d5ff; border-radius: 12px; display: flex; gap: 8px; }
  .sidebar-info p { font-size: 10px; color: #64748b; line-height: 1.6; margin: 0; }

  .listing-count { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
  .listing-item { display: flex; flex-direction: column; gap: 8px; }
  .listing-card-area { position: relative; }
  .listing-shadow { position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 20px; transform: translate(5px, 5px); z-index: 0; pointer-events: none; }
  .listing-card { border: 2px solid; border-radius: 20px; overflow: hidden; cursor: pointer; transition: transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275); position: relative; z-index: 1; background: white; }
  .listing-card:hover { transform: translateY(-3px) rotate(-0.3deg); }
  .listing-price-row { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
  .listing-price-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .listing-price-value { font-family: 'Caveat', cursive; font-size: 18px; font-weight: 700; color: #7e22ce; }

  .buy-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px; width: 100%; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; border: 2px solid #1a1a1a; background: linear-gradient(135deg, #f3e8ff, #fce7f3); font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 800; color: #1a1a1a; box-shadow: 3px 3px 0px #c9b8ff; cursor: pointer; transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275); box-sizing: border-box; }
  .buy-btn:hover { transform: translateY(-2px); box-shadow: 5px 5px 0px #c9b8ff; }
  .buy-btn:active { transform: translateY(1px); box-shadow: 1px 1px 0px #c9b8ff; }
  .buy-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .buy-btn.yours { background: #f8f8f8; color: #94a3b8; border-color: #e2e8f0; box-shadow: 3px 3px 0px #e2e8f0; cursor: default; }
  .buy-btn.yours:hover { transform: none; box-shadow: 3px 3px 0px #e2e8f0; }

  .listing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
  .mkt-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0; gap: 16px; }
  .mkt-loading-text { font-family: 'Caveat', cursive; font-size: 22px; color: #94a3b8; }
  .mkt-empty { text-align: center; padding: 80px 24px; background: white; border: 2px dashed #e2e8f0; border-radius: 24px; }
  .mkt-empty-icon { font-size: 48px; margin-bottom: 16px; }
  .mkt-empty-title { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .mkt-empty-desc { font-size: 13px; color: #64748b; margin-bottom: 20px; }

  @media (max-width: 768px) {
    .mkt-title { font-size: 32px; }
    .mkt-header { flex-direction: column; align-items: flex-start; }
    .mkt-search { width: 180px; }
    .listing-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  }

  /* ════════════════════════════════════════════════════════════
     PURCHASE ANIMATION OVERLAY
  ════════════════════════════════════════════════════════════ */

  /* Full-screen dimmed backdrop */
  .purchase-overlay {
    position: fixed; inset: 0; z-index: 9000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(10, 5, 20, 0.92);
    backdrop-filter: blur(12px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.4s ease;
  }
  .purchase-overlay.active {
    opacity: 1;
    pointer-events: all;
  }

  /* Floating particle canvas behind the box */
  .purchase-particles {
    position: absolute; inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .purchase-particle {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    animation: particleDrift linear infinite;
  }
  @keyframes particleDrift {
    0%   { transform: translateY(100vh) rotate(0deg); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 0.6; }
    100% { transform: translateY(-20vh) rotate(720deg); opacity: 0; }
  }

  /* Stage that holds the 3D box */
  .purchase-stage {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 480px;
    padding: 40px;
  }

  /* ─── 3D Box (identical to landing page) ─── */
  .p-scene {
    perspective: 800px; perspective-origin: 50% 35%;
    width: 260px; height: 240px; position: relative;
  }
  .p-box-wrapper {
    position: absolute; width: 200px; height: 200px; top: 80px; left: 30px;
    transform-style: preserve-3d; transform: rotateX(-22deg) rotateY(-38deg);
    animation: pFloatBox 5s ease-in-out infinite; cursor: pointer; will-change: transform;
  }
  .p-body-group { position: absolute; inset: 0; transform-style: preserve-3d; }
  .p-face {
    position: absolute; width: 200px; height: 200px; border: 3px solid #1a1a1a;
    display: flex; align-items: center; justify-content: center; overflow: hidden;
  }
  .p-face-front  { transform: rotateY(0deg)   translateZ(100px); background: linear-gradient(160deg,#fffde8,#fff5b8); }
  .p-face-back   { transform: rotateY(180deg) translateZ(100px); background: linear-gradient(160deg,#d0edff,#b8eeff); }
  .p-face-right  { transform: rotateY(90deg)  translateZ(100px); background: linear-gradient(160deg,#ffe0ef,#ffb8d9); }
  .p-face-left   { transform: rotateY(-90deg) translateZ(100px); background: linear-gradient(160deg,#d8fff0,#b8ffe8); }
  .p-face-bottom { transform: rotateX(-90deg) translateZ(100px); background: linear-gradient(160deg,#fff5cc,#fffae0); }

  .p-lid-group {
    position: absolute; top: 0; left: 0; width: 200px; height: 200px;
    transform-style: preserve-3d; transform: translateY(-200px);
    transform-origin: 50% 100%; transition: transform 0.7s cubic-bezier(0.34,1.05,0.64,1);
  }
  .p-box-wrapper.is-open .p-lid-group { transform: translateY(-200px) translateX(280px); }
  .p-lid-top {
    position: absolute; width: 200px; height: 200px; border: 3px solid #1a1a1a;
    background: linear-gradient(145deg,#fffde8,#fff5b8);
    display: flex; align-items: center; justify-content: center; overflow: hidden;
    transform: rotateX(90deg) translateZ(-70px);
  }
  .p-lid-skirt { position: absolute; top: 170px; width: 200px; height: 30px; border: 3px solid #1a1a1a; overflow: hidden; }
  .p-lid-skirt-front { transform: rotateY(0deg)   translateZ(100px); background: linear-gradient(180deg,#fffde8,#fff5b8); }
  .p-lid-skirt-back  { transform: rotateY(180deg) translateZ(100px); background: linear-gradient(180deg,#d0edff,#b8eeff); }
  .p-lid-skirt-right { transform: rotateY(90deg)  translateZ(100px); background: linear-gradient(180deg,#ffe0ef,#ffb8d9); }
  .p-lid-skirt-left  { transform: rotateY(-90deg) translateZ(100px); background: linear-gradient(180deg,#d8fff0,#b8ffe8); }

  .p-rib-v { position: absolute; left: 50%; top: 0; bottom: 0; width: 26px; transform: translateX(-50%); background: linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left: 2px solid #c4006e; border-right: 2px solid #c4006e; z-index: 1; pointer-events: none; }
  .p-rib-h { position: absolute; top: 50%; left: 0; right: 0; height: 26px; transform: translateY(-50%); background: linear-gradient(to bottom,#ffb8e0,#ff3d9a,#ffb8e0); border-top: 2px solid #c4006e; border-bottom: 2px solid #c4006e; z-index: 1; pointer-events: none; }
  .p-lid-rib-v { position: absolute; left: 50%; top: 0; bottom: 0; width: 26px; transform: translateX(-50%); background: linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left: 2px solid #c4006e; border-right: 2px solid #c4006e; pointer-events: none; z-index: 1; }
  .p-lid-rib-h { position: absolute; top: 50%; left: 0; right: 0; height: 26px; transform: translateY(-50%); background: linear-gradient(to bottom,#ffb8e0,#ff3d9a,#ffb8e0); border-top: 2px solid #c4006e; border-bottom: 2px solid #c4006e; pointer-events: none; z-index: 1; }
  .p-skirt-rib-v { position: absolute; left: 50%; top: 0; bottom: 0; width: 26px; transform: translateX(-50%); background: linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left: 2px solid #c4006e; border-right: 2px solid #c4006e; pointer-events: none; }

  .p-bow { position: absolute; width: 68px; height: 44px; top: 50%; left: 50%; transform: translate(-50%,-58%); z-index: 10; }
  .p-bow-ear { position: absolute; width: 28px; height: 22px; background: linear-gradient(135deg,#ffb8e0,#ff3d9a); border: 2.5px solid #c4006e; top: 0; }
  .p-bow-ear.L { left: 0; border-radius: 50% 0 50% 0; transform: rotate(-26deg); transform-origin: right center; }
  .p-bow-ear.R { right: 0; border-radius: 0 50% 0 50%; transform: rotate(26deg); transform-origin: left center; }
  .p-bow-knot { position: absolute; width: 15px; height: 15px; background: #ff3d9a; border: 2.5px solid #c4006e; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 6; }
  .p-bow-tail { position: absolute; bottom: -6px; width: 15px; height: 14px; background: linear-gradient(135deg,#ffb8e0,#ff3d9a); border: 2px solid #c4006e; }
  .p-bow-tail.L { left: 16px; border-radius: 0 0 0 8px; transform: rotate(12deg); }
  .p-bow-tail.R { right: 16px; border-radius: 0 0 8px 0; transform: rotate(-12deg); }

  .p-ground-shadow {
    position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 170px; height: 22px; background: radial-gradient(ellipse,#b87eff44 0%,transparent 72%);
    border-radius: 50%; pointer-events: none; animation: pShadowSync 5s ease-in-out infinite;
  }
  @keyframes pShadowSync { 0%,100%{transform:translateX(-50%) scaleX(1);opacity:0.6} 50%{transform:translateX(-50%) scaleX(0.72);opacity:0.25} }

  /* Sparks */
  .p-sparkles { position: absolute; inset: -80px; pointer-events: none; z-index: 200; }
  .p-spark { position: absolute; top: 50%; left: 50%; font-size: 20px; opacity: 0; transform: translate(-50%,-50%); }
  .p-box-wrapper.is-open .p-spark { animation: pSparkFly 1s ease forwards; }
  .p-spark:nth-child(1){--tx:-90px;--ty:-85px;animation-delay:0.36s}
  .p-spark:nth-child(2){--tx:90px;--ty:-85px;animation-delay:0.41s}
  .p-spark:nth-child(3){--tx:-112px;--ty:5px;animation-delay:0.38s}
  .p-spark:nth-child(4){--tx:112px;--ty:5px;animation-delay:0.44s}
  .p-spark:nth-child(5){--tx:-68px;--ty:100px;animation-delay:0.46s}
  .p-spark:nth-child(6){--tx:68px;--ty:100px;animation-delay:0.39s}
  .p-spark:nth-child(7){--tx:0;--ty:-118px;animation-delay:0.34s}
  @keyframes pSparkFly {
    0%{opacity:1;transform:translate(-50%,-50%) scale(0.4) rotate(0)}
    60%{opacity:1}
    100%{opacity:0;transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(1.4) rotate(210deg)}
  }

  /* NEW: Burst ring that appears on open */
  .p-burst-ring {
    position: absolute; top: 50%; left: 50%;
    width: 200px; height: 200px;
    margin: -100px 0 0 -100px;
    border-radius: 50%;
    border: 3px solid rgba(255,61,154,0.6);
    pointer-events: none;
    opacity: 0;
    z-index: 150;
    transform: scale(0.3);
  }
  .p-box-wrapper.is-open .p-burst-ring {
    animation: burstRing 0.9s cubic-bezier(0.22,1,0.36,1) 0.5s forwards;
  }
  .p-burst-ring:nth-child(2) { border-color: rgba(201,184,255,0.5); }
  .p-burst-ring:nth-child(2).p-box-wrapper.is-open { animation-delay: 0.65s; }
  @keyframes burstRing {
    0%  { opacity: 0.9; transform: scale(0.3); }
    100%{ opacity: 0;   transform: scale(3);   }
  }

  /* Floats */
  @keyframes pFloatBox { 0%,100%{transform:rotateX(-22deg) rotateY(-38deg) translateY(0)} 50%{transform:rotateX(-22deg) rotateY(-38deg) translateY(-16px)} }
  @keyframes pShake {
    0%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(0,0,0)}
    20%,80%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(-7px,0,0)}
    40%,60%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(9px,0,0)}
    100%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(0,0,0)}
  }
  .p-box-wrapper.is-shaking { animation: pShake 0.48s cubic-bezier(0.36,0.07,0.19,0.97) both !important; }

  /* NEW: Pulsing aura behind box while processing */
  .p-aura {
    position: absolute;
    width: 280px; height: 280px;
    top: 50%; left: 50%;
    margin: -140px 0 0 -140px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    animation: auraPulse 2s ease-in-out infinite;
  }
  @keyframes auraPulse {
    0%,100%{ transform: scale(0.85); opacity: 0.25; }
    50%{ transform: scale(1.15); opacity: 0.55; }
  }

  /* ─── Result Card (revealed after open) ─── */
  .result-card-wrapper {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0) rotate(-8deg);
    opacity: 0;
    transition: transform 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.5s, opacity 0.4s ease 0.5s;
    z-index: 300;
    pointer-events: none;
  }
  .result-card-wrapper.revealed {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
    opacity: 1;
    pointer-events: all;
  }

  /* ─── Status text ─── */
  .purchase-status {
    font-family: 'Caveat', cursive;
    font-size: 26px;
    font-weight: 700;
    color: white;
    text-align: center;
    margin-top: 24px;
    min-height: 36px;
    letter-spacing: 0.02em;
    text-shadow: 0 0 20px rgba(201,184,255,0.8);
    animation: statusPulse 1.6s ease-in-out infinite;
  }
  @keyframes statusPulse { 0%,100%{opacity:0.7} 50%{opacity:1} }

  .purchase-sub {
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.4);
    text-align: center;
    margin-top: 6px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* ─── Confetti burst ─── */
  .confetti-piece {
    position: absolute;
    width: 8px; height: 8px;
    border-radius: 2px;
    pointer-events: none;
    opacity: 0;
    animation: confettiFall linear forwards;
  }
  @keyframes confettiFall {
    0%  { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
    80% { opacity: 0.8; }
    100%{ opacity: 0; transform: translate(var(--cx), var(--cy)) rotate(var(--cr)) scale(0.4); }
  }

  /* ─── Success checkmark ─── */
  .success-ring {
    position: absolute;
    top: 50%; left: 50%;
    width: 120px; height: 120px;
    margin: -60px 0 0 -60px;
    border-radius: 50%;
    border: 3px solid #4ade80;
    display: flex; align-items: center; justify-content: center;
    font-size: 40px;
    opacity: 0;
    transform: scale(0.5);
    transition: opacity 0.4s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1);
    pointer-events: none;
    z-index: 400;
    box-shadow: 0 0 30px rgba(74,222,128,0.5);
  }
  .success-ring.show { opacity: 1; transform: scale(1); }

  /* ─── NFT reveal card (full detail) ─── */
  .reveal-modal-inner {
    position: relative;
    z-index: 350;
    background: white;
    border-radius: 24px;
    border: 3px solid #1a1a1a;
    padding: 28px;
    width: 340px;
    max-width: 90vw;
    box-shadow: 0 0 0 4px rgba(201,184,255,0.4), 12px 12px 0px rgba(201,184,255,0.6);
    transform: translateY(0);
  }
  .reveal-nft-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px;
  }
  .reveal-rarity-badge {
    padding: 4px 12px; border-radius: 99px;
    font-family: 'Nunito', sans-serif; font-size: 10px; font-weight: 900;
    text-transform: uppercase; letter-spacing: 0.1em;
    border: 2px solid currentColor;
  }
  .reveal-close-btn {
    width: 32px; height: 32px; border-radius: 50%;
    border: 2px solid #1a1a1a; background: #f8f8f8;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 16px; font-weight: 700; color: #1a1a1a;
    transition: all 0.15s ease;
  }
  .reveal-close-btn:hover { background: #1a1a1a; color: white; }

  .reveal-nft-img {
    width: 100%; aspect-ratio: 1;
    border-radius: 16px; overflow: hidden;
    border: 3px solid #1a1a1a;
    margin-bottom: 16px;
    position: relative;
  }
  .reveal-nft-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .reveal-nft-img-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.3), transparent 60%);
    pointer-events: none;
  }
  .reveal-nft-name {
    font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700;
    color: #1a1a1a; margin-bottom: 4px;
  }
  .reveal-nft-id {
    font-size: 11px; font-weight: 700; color: #94a3b8;
    letter-spacing: 0.1em; margin-bottom: 16px;
  }

  .reveal-stats-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
    margin-bottom: 16px;
  }
  .reveal-stat {
    background: #fafaf8; border: 2px solid #e2e8f0; border-radius: 12px;
    padding: 8px 4px; text-align: center;
  }
  .reveal-stat-val {
    font-family: 'Caveat', cursive; font-size: 22px; font-weight: 700;
    color: #1a1a1a; display: block; line-height: 1;
  }
  .reveal-stat-lbl {
    font-size: 9px; font-weight: 900; color: #94a3b8;
    text-transform: uppercase; letter-spacing: 0.08em;
    display: block; margin-top: 2px;
  }

  .reveal-price-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    border: 2px solid #1a1a1a; border-radius: 16px; margin-bottom: 16px;
  }
  .reveal-price-label { font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
  .reveal-price-value { font-family: 'Caveat', cursive; font-size: 24px; font-weight: 700; color: #7e22ce; }

  .reveal-buy-btn {
    width: 100%; padding: 14px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a;
    background: linear-gradient(135deg, #1a1a1a, #3d1a6e);
    color: white; font-family: 'Nunito', sans-serif;
    font-size: 14px; font-weight: 800;
    box-shadow: 4px 4px 0px #c9b8ff;
    cursor: pointer; transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .reveal-buy-btn:hover { transform: translateY(-2px); box-shadow: 6px 6px 0px #c9b8ff; }
  .reveal-buy-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* NEW: Holographic shimmer on the reveal card for high rarities */
  .holo-shimmer {
    position: absolute; inset: 0; border-radius: 22px;
    background: linear-gradient(105deg, transparent 20%, rgba(201,184,255,0.2) 38%, rgba(255,184,217,0.2) 50%, rgba(184,238,255,0.2) 62%, transparent 80%);
    background-size: 200% 200%;
    animation: holoSweep 2.5s ease-in-out infinite;
    pointer-events: none; z-index: 1;
  }
  @keyframes holoSweep { 0%,100%{background-position:-100% 0;opacity:0.5} 50%{background-position:200% 0;opacity:1} }

  /* ─── Shine / glow on the box for rarity ─── */
  .p-rarity-glow {
    position: absolute;
    top: 50%; left: 50%;
    width: 320px; height: 320px;
    margin: -160px 0 0 -160px;
    border-radius: 50%;
    pointer-events: none;
    z-index: -1;
    opacity: 0;
    transition: opacity 0.5s ease;
    filter: blur(40px);
  }
  .p-rarity-glow.show { opacity: 1; }
`;

// ─── Confetti Helper ─────────────────────────────────────────────────────────
function spawnConfetti(container: HTMLElement, colors: string[]) {
  for (let i = 0; i < 60; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
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

// ─── Purchase Animation Modal ────────────────────────────────────────────────
type PurchasePhase = "idle" | "confirming" | "opening" | "revealed" | "success" | "error";

interface PurchaseAnimationProps {
  item: (NFT & { priceMist?: string }) | null;
  phase: PurchasePhase;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  errorMessage?: string;
}

function PurchaseAnimation({ item, phase, onClose, onConfirm, isPending, errorMessage }: PurchaseAnimationProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const rarityIndex = item?.rarity ?? 0;
  const glowColor = RARITY_GLOW_COLORS[Math.min(rarityIndex, 5)];
  const rarityColor = RARITY_DOODLE_COLORS[Math.min(rarityIndex, 5)];

  // Trigger box animation when phase becomes "opening"
  useEffect(() => {
    const box = boxRef.current;
    if (!box || phase !== "opening") return;

    // Show rarity glow
    if (glowRef.current) glowRef.current.classList.add("show");

    // Shake then open
    box.style.animation = "none";
    void box.offsetWidth;
    box.classList.add("is-shaking");
    const t1 = setTimeout(() => {
      box.classList.remove("is-shaking");
      box.classList.add("is-open");
    }, 500);
    return () => clearTimeout(t1);
  }, [phase]);

  // Confetti on success reveal
  useEffect(() => {
    if (phase === "revealed" && confettiRef.current) {
      spawnConfetti(confettiRef.current, [
        glowColor.replace(/[^,]+\)/, "1)"),
        "#c9b8ff", "#ffb8d9", "#b8ffe8", "#fff5b8", "#ffffff",
      ]);
    }
  }, [phase, glowColor]);

  const isActive = phase !== "idle";
  const showBox = phase === "confirming" || phase === "opening";
  const showReveal = phase === "revealed" || phase === "success";

  const statusText: Record<PurchasePhase, string> = {
    idle: "",
    confirming: "Confirm in wallet...",
    opening: "Opening your box ✦",
    revealed: `${item?.name ?? "NFT"} revealed! ✨`,
    success: "Added to your Kiosk! 🎉",
    error: "Transaction failed",
  };

  return (
    <div className={`purchase-overlay ${isActive ? "active" : ""}`}>
      {/* Floating particles */}
      <div className="purchase-particles">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="purchase-particle"
            style={{
              left: `${Math.random() * 100}%`,
              width: `${3 + Math.random() * 6}px`,
              height: `${3 + Math.random() * 6}px`,
              background: ["#c9b8ff", "#ffb8d9", "#b8ffe8", "#fff5b8"][i % 4],
              animationDuration: `${3 + Math.random() * 4}s`,
              animationDelay: `${Math.random() * 3}s`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>

      {/* Confetti container */}
      <div ref={confettiRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 500 }} />

      <div className="purchase-stage" ref={stageRef}>
        {/* Pulsing aura */}
        {showBox && (
          <div className="p-aura" style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }} />
        )}

        {/* ── 3D BOX ── */}
        {showBox && (
          <div style={{ position: "relative" }}>
            {/* Rarity glow (shows during open) */}
            <div
              ref={glowRef}
              className="p-rarity-glow"
              style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }}
            />

            <div className="p-scene">
              <div className="p-ground-shadow" />
              <div className="p-box-wrapper" ref={boxRef}>
                {/* Sparkles */}
                <div className="p-sparkles">
                  {["✦","✧","⭐","💫","✨","🌸","💎"].map((s, i) => (
                    <span key={i} className="p-spark">{s}</span>
                  ))}
                  {/* NEW: Burst rings */}
                  <div className="p-burst-ring" />
                  <div className="p-burst-ring" style={{ width: 280, height: 280, margin: "-140px 0 0 -140px", animationDelay: "0.65s" }} />
                </div>

                {/* Body */}
                <div className="p-body-group">
                  <div className="p-face p-face-front">
                    <div className="p-rib-v" /><div className="p-rib-h" />
                    <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontSize: 40, opacity: 0.15 }}>❓</div>
                      <span style={{ fontFamily: "'Caveat',cursive", fontSize: 16, fontWeight: 700, color: "#1a1a1a25" }}>GYATE BOX</span>
                    </div>
                  </div>
                  <div className="p-face p-face-back" />
                  <div className="p-face p-face-right"><div className="p-rib-v" /><div className="p-rib-h" /></div>
                  <div className="p-face p-face-left" />
                  <div className="p-face p-face-bottom" />
                </div>

                {/* Lid */}
                <div className="p-lid-group">
                  <div className="p-lid-top">
                    <div className="p-lid-rib-v" /><div className="p-lid-rib-h" />
                    <div className="p-bow">
                      <div className="p-bow-ear L" /><div className="p-bow-ear R" />
                      <div className="p-bow-knot" />
                      <div className="p-bow-tail L" /><div className="p-bow-tail R" />
                    </div>
                  </div>
                  <div className="p-lid-skirt p-lid-skirt-front"><div className="p-skirt-rib-v" /></div>
                  <div className="p-lid-skirt p-lid-skirt-back" />
                  <div className="p-lid-skirt p-lid-skirt-right"><div className="p-skirt-rib-v" /></div>
                  <div className="p-lid-skirt p-lid-skirt-left" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── REVEALED CARD ── */}
        {showReveal && item && (
          <div
            className="reveal-modal-inner"
            style={{
              borderColor: rarityColor.border,
              boxShadow: `0 0 0 3px ${rarityColor.shadow}, 10px 10px 0px ${rarityColor.shadow}`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Holographic shimmer for rare+ */}
            {rarityIndex >= 2 && <div className="holo-shimmer" />}

            <div className="reveal-nft-header">
              <div
                className="reveal-rarity-badge"
                style={{ color: rarityColor.text, borderColor: rarityColor.border, background: rarityColor.bg }}
              >
                {RARITY_LABELS[rarityIndex] ?? "Common"}
              </div>
              <button className="reveal-close-btn" onClick={onClose}>✕</button>
            </div>

            <div className="reveal-nft-img">
              {item.image ? (
                <img src={item.image} alt={item.name} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${rarityColor.bg}, ${rarityColor.shadow})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60 }}>📦</div>
              )}
              <div className="reveal-nft-img-overlay" />
              {/* NEW: Rarity shimmer on image for SR+ */}
              {rarityIndex >= 3 && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(135deg, ${rarityColor.shadow}44, transparent, ${rarityColor.shadow}44)`,
                  backgroundSize: "200% 200%",
                  animation: "holoSweep 2s ease-in-out infinite",
                  pointerEvents: "none", zIndex: 2
                }} />
              )}
            </div>

            <div className="reveal-nft-name">{item.name}</div>
            <div className="reveal-nft-id">#{item.globalId ?? "????"} · {item.variantType ?? "Standard"}</div>

            <div className="reveal-stats-row">
              {[["HP", item.hp], ["ATK", item.atk], ["SPD", item.spd]].map(([label, val]) => (
                <div key={label as string} className="reveal-stat" style={{ borderColor: rarityColor.shadow }}>
                  <span className="reveal-stat-val" style={{ color: rarityColor.text }}>{val}</span>
                  <span className="reveal-stat-lbl">{label}</span>
                </div>
              ))}
            </div>

            <div className="reveal-price-row" style={{ background: `linear-gradient(135deg, ${rarityColor.bg}, white)`, borderColor: rarityColor.border }}>
              <span className="reveal-price-label">Listed Price</span>
              <span className="reveal-price-value" style={{ color: rarityColor.text }}>
                {item.price?.toFixed(2) ?? "—"} SUI
              </span>
            </div>

            {phase === "revealed" ? (
              <button
                className="reveal-buy-btn"
                onClick={onConfirm}
                disabled={isPending}
                style={{ background: `linear-gradient(135deg, #1a1a1a, ${rarityColor.text})` }}
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isPending ? "Confirming..." : "Confirm Purchase"}
              </button>
            ) : (
              <div style={{
                padding: "14px", borderRadius: "255px 15px 225px 15px / 15px 225px 15px 255px",
                background: `linear-gradient(135deg, #dcfce7, #bbf7d0)`,
                border: "2px solid #22c55e", textAlign: "center",
                fontFamily: "'Nunito', sans-serif", fontWeight: 800, color: "#15803d",
                fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}>
                <span>✓</span> Added to your Kiosk!
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {phase === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>😢</div>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: 28, color: "#fb7185", marginBottom: 8 }}>
              Transaction Failed
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 24, maxWidth: 280 }}>
              {errorMessage ?? "Something went wrong. Please try again."}
            </div>
            <button className="mkt-btn" onClick={onClose}>Try Again</button>
          </div>
        )}

        {/* Status text */}
        {showBox && (
          <>
            <div className="purchase-status">{statusText[phase]}</div>
            <div className="purchase-sub">Sui Blockchain · On-Chain Verifiable</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Marketplace Component ──────────────────────────────────────────────
export default function MarketplacePage() {
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [purchaseItem, setPurchaseItem] = useState<(NFT & { priceMist?: string }) | null>(null);
  const [purchasePhase, setPurchasePhase] = useState<PurchasePhase>("idle");
  const [purchaseError, setPurchaseError] = useState<string>("");
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [listings, setListings] = useState<NFT[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRarities, setSelectedRarities] = useState<number[]>([]);
  const [hpRange, setHpRange] = useState({ min: "0", max: "9999" });
  const [atkRange, setAtkRange] = useState({ min: "0", max: "9999" });
  const [spdRange, setSpdRange] = useState({ min: "0", max: "9999" });

  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();
  const NFT_TYPE = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listedRes, purchasedRes, delistedRes] = await Promise.all([
        suiClient.queryEvents({ query: { MoveEventType: `0x2::kiosk::ItemListed<${NFT_TYPE}>` }, limit: 100, order: "descending" }),
        suiClient.queryEvents({ query: { MoveEventType: `0x2::kiosk::ItemPurchased<${NFT_TYPE}>` }, limit: 100, order: "descending" }),
        suiClient.queryEvents({ query: { MoveEventType: `0x2::kiosk::ItemDelisted<${NFT_TYPE}>` }, limit: 100, order: "descending" }),
      ]);
      const soldIds = new Set(purchasedRes.data.map((e: any) => normalizeSuiId(e.parsedJson?.id)));
      const delistedIds = new Set(delistedRes.data.map((e: any) => normalizeSuiId(e.parsedJson?.id)));
      const seen = new Set<string>();
      const activeListings: ActiveListing[] = [];
      for (const e of listedRes.data) {
        const nftId = normalizeSuiId(e.parsedJson?.id);
        const kioskId = normalizeSuiId(e.parsedJson?.kiosk);
        const priceMist = e.parsedJson?.price?.toString() ?? "0";
        if (!nftId || seen.has(nftId)) continue;
        seen.add(nftId);
        if (soldIds.has(nftId) || delistedIds.has(nftId)) continue;
        activeListings.push({ nftId, kioskId, priceMist });
      }
      if (activeListings.length === 0) { setListings([]); return; }
      const verifiedListings: NFT[] = [];
      await Promise.all(activeListings.map(async (listing) => {
        try {
          const dynField = await suiClient.getDynamicFieldObject({ parentId: listing.kioskId, name: { type: "0x2::kiosk::Item", value: { id: listing.nftId } } });
          if (!dynField?.data?.content) return;
          const listedField = await suiClient.getDynamicFieldObject({ parentId: listing.kioskId, name: { type: "0x2::kiosk::Listing", value: { id: listing.nftId, is_exclusive: false } } }).catch(() => null);
          if (!listedField?.data) return;
          const nftObj = await suiClient.getObject({ id: listing.nftId, options: { showContent: true } });
          const fields = (nftObj.data?.content as any)?.fields;
          if (!fields) return;
          verifiedListings.push({
            id: listing.nftId, name: fields.name ?? "Unknown", rarity: Number(fields.rarity ?? 0),
            variantType: fields.variant_type ?? "Normal", image: fields.image_url ?? "",
            hp: Number(fields.hp ?? 0), atk: Number(fields.atk ?? 0), spd: Number(fields.spd ?? 0),
            baseValue: Number(fields.base_value ?? 0), actualValue: Number(fields.actual_value ?? 0),
            lootboxSource: fields.lootbox_source ?? "", globalId: Number(fields.global_sequential_id ?? 0),
            price: mistToSui(listing.priceMist), priceMist: listing.priceMist,
            seller: "On-Chain Listing", kioskId: listing.kioskId,
          } as NFT & { priceMist: string });
        } catch { }
      }));
      setListings(verifiedListings);
    } catch (err) {
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not load marketplace listings." });
    } finally { setIsLoading(false); }
  }, [suiClient, NFT_TYPE, toast]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  // ── Initiate purchase: show the box animation first ────────────────────────
  const initiatePurchase = (item: NFT & { priceMist?: string }) => {
    if (!account) {
      toast({ variant: "destructive", title: "Connect your wallet first" });
      return;
    }
    setPurchaseItem(item);
    setPurchasePhase("opening"); // show box animation immediately
  };

  // ── Confirm purchase: called after reveal ──────────────────────────────────
  const executePurchase = async () => {
    const item = purchaseItem;
    if (!item || !account) return;
    if (!item.kioskId) { toast({ variant: "destructive", title: "Missing kiosk data" }); return; }

    setIsPending(true);
    setPurchasePhase("confirming");

    try {
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });
      if (capsRes.data.length === 0) {
        toast({ variant: "destructive", title: "No Kiosk Found", description: "Create a kiosk first." });
        setPurchasePhase("error");
        setPurchaseError("No Kiosk found on your wallet.");
        setIsPending(false);
        return;
      }
      const buyerCapId = capsRes.data[0].data!.objectId;
      const rawFor = (capsRes.data[0].data?.content as any)?.fields?.for;
      const buyerKioskId: string | undefined = typeof rawFor === "string" ? rawFor : typeof rawFor?.id === "string" ? rawFor.id : undefined;
      if (!buyerKioskId) {
        toast({ variant: "destructive", title: "Could not resolve your Kiosk ID." });
        setPurchasePhase("error"); setPurchaseError("Kiosk ID resolution failed.");
        setIsPending(false); return;
      }

      const listedMist = BigInt(item.priceMist ?? Math.round((item.price ?? 0) * 1_000_000_000));
      const feeMist = listedMist / 10n;
      const totalMist = listedMist + feeMist;
      const txb = new Transaction();
      const [paymentCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(totalMist)]);
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.BUY_NFT}`,
        typeArguments: [],
        arguments: [
          txb.object(normalizeSuiId(item.kioskId)),
          txb.object(TRANSFER_POLICY),
          txb.object(TREASURY_POOL),
          txb.pure.address(normalizeSuiId(item.id)),
          paymentCoin,
          txb.object(normalizeSuiId(buyerKioskId)),
          txb.object(normalizeSuiId(buyerCapId)),
        ],
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: () => {
            setPurchasePhase("success");
            setIsPending(false);
            setTimeout(fetchListings, 3000);
          },
          onError: (err) => {
            setPurchasePhase("error");
            setPurchaseError(err.message);
            setIsPending(false);
          },
        },
      );
    } catch (err: any) {
      setPurchasePhase("error");
      setPurchaseError(err.message);
      setIsPending(false);
    }
  };

  // Auto-advance from "opening" → "revealed" after animation
  useEffect(() => {
    if (purchasePhase !== "opening") return;
    // Wait for box shake + open animation, then show reveal
    const t = setTimeout(() => {
      setPurchasePhase("revealed");
    }, 3800); // shake(480ms) + open(700ms) + card reveal(1000ms) + buffer
    return () => clearTimeout(t);
  }, [purchasePhase]);

  const closePurchaseModal = () => {
    setPurchasePhase("idle");
    setPurchaseItem(null);
    setPurchaseError("");
    setIsPending(false);
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const filteredListings = useMemo(() => {
    const minHp = parseInt(hpRange.min) || 0, maxHp = parseInt(hpRange.max) || 999999;
    const minAtk = parseInt(atkRange.min) || 0, maxAtk = parseInt(atkRange.max) || 999999;
    const minSpd = parseInt(spdRange.min) || 0, maxSpd = parseInt(spdRange.max) || 999999;
    return listings.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.id.includes(searchTerm);
      const matchesRarity = selectedRarities.length === 0 || selectedRarities.includes(l.rarity);
      return matchesSearch && matchesRarity && l.hp >= minHp && l.hp <= maxHp && l.atk >= minAtk && l.atk <= maxAtk && l.spd >= minSpd && l.spd <= maxSpd;
    });
  }, [listings, searchTerm, selectedRarities, hpRange, atkRange, spdRange]);

  const toggleRarity = (r: number) => setSelectedRarities(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  const resetFilters = () => {
    setSearchTerm(""); setSelectedRarities([]);
    setHpRange({ min:"0", max:"9999" }); setAtkRange({ min:"0", max:"9999" }); setSpdRange({ min:"0", max:"9999" });
  };

  return (
    <div className="mkt-page">
      <style dangerouslySetInnerHTML={{ __html: ALL_STYLES }} />
      <Navigation />

      {/* ── Purchase Animation Overlay ── */}
      <PurchaseAnimation
        item={purchaseItem}
        phase={purchasePhase}
        onClose={closePurchaseModal}
        onConfirm={executePurchase}
        isPending={isPending}
        errorMessage={purchaseError}
      />

      <div className="mkt-container">
        {/* ── Header ── */}
        <div className="mkt-header">
          <div>
            <div className="mkt-title">Marketplace ✦</div>
            <div className="mkt-subtitle">Verified on-chain listings · 10% kiosk-enforced royalty</div>
          </div>
          <div className="mkt-header-actions">
            <button className="mkt-btn icon-only" onClick={() => fetchListings()} disabled={isLoading}>
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
            <div className="mkt-search-wrap">
              <Search size={15} className="mkt-search-icon" />
              <input
                className="mkt-search" placeholder="Search heroes..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mkt-layout">
          {/* ── Sidebar ── */}
          <aside>
            <div className="mkt-sidebar">
              <div className="sidebar-title">
                <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Filter size={16} /> Filters
                </span>
                <button className="sidebar-reset" onClick={resetFilters}>Reset</button>
              </div>
              <div className="sidebar-label">Rarity</div>
              <div className="rarity-pills">
                {([0,1,2,3,4,5] as const).map(r => {
                  const color = RARITY_DOODLE_COLORS[r];
                  const active = selectedRarities.includes(r);
                  return (
                    <button key={r} className={`rarity-pill ${active ? "active" : ""}`} onClick={() => toggleRarity(r)}>
                      <span className="rarity-dot" style={{ background: active ? color.text : color.bg, borderColor: color.border }} />
                      {RARITY_LABELS[r]}
                    </button>
                  );
                })}
              </div>
              <div className="sidebar-divider" />
              <div className="sidebar-label">Stats</div>
              {(["HP","ATK","SPD"] as const).map(label => {
                const rangeMap = { HP: hpRange, ATK: atkRange, SPD: spdRange };
                const setMap = { HP: setHpRange, ATK: setAtkRange, SPD: setSpdRange };
                const range = rangeMap[label];
                const setRange = setMap[label];
                return (
                  <div className="stat-section" key={label}>
                    <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
                    <div className="stat-range-row">
                      <input type="number" className="stat-range-input" placeholder="Min" value={range.min} onChange={e => setRange((p: any) => ({ ...p, min: e.target.value }))} />
                      <input type="number" className="stat-range-input" placeholder="Max" value={range.max} onChange={e => setRange((p: any) => ({ ...p, max: e.target.value }))} />
                    </div>
                  </div>
                );
              })}
              <div className="sidebar-info">
                <Info size={13} style={{ color:"#a855f7", flexShrink:0, marginTop:1 }} />
                <p>Listings verified in real-time via on-chain kiosk state. Stale items auto-hidden.</p>
              </div>
            </div>
          </aside>

          {/* ── Main ── */}
          <main>
            {isLoading ? (
              <div className="mkt-loading">
                <div style={{ fontSize:40 }}>🔍</div>
                <div className="mkt-loading-text">Scanning the marketplace...</div>
              </div>
            ) : filteredListings.length > 0 ? (
              <>
                <div className="listing-count">
                  <span>{filteredListings.length} listing{filteredListings.length !== 1 ? "s" : ""} found</span>
                  {selectedRarities.length > 0 && (
                    <button
                      onClick={() => setSelectedRarities([])}
                      style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 8px", borderRadius:20, border:"1.5px solid #e2e8f0", background:"white", fontSize:10, fontWeight:800, color:"#94a3b8", cursor:"pointer" }}
                    >
                      <X size={9} /> Clear rarity
                    </button>
                  )}
                </div>
                <div className="listing-grid">
                  {filteredListings.map(item => {
                    const color = RARITY_DOODLE_COLORS[Math.min(item.rarity ?? 0, 5)];
                    const isYours = item.kioskId === account?.address;
                    return (
                      <div key={item.id} className="listing-item">
                        <div className="listing-card-area">
                          <div className="listing-shadow" style={{ background: color.shadow }} />
                          <div
                            className="listing-card"
                            style={{ borderColor: color.border }}
                            onClick={() => setSelectedNft(item)}
                          >
                            <NFTCard nft={item} />
                          </div>
                        </div>
                        {item.price != null && (
                          <div className="listing-price-row">
                            <span className="listing-price-label">Price</span>
                            <span className="listing-price-value">{item.price.toFixed(2)} SUI</span>
                          </div>
                        )}
                        <button
                          className={`buy-btn ${isYours ? "yours" : ""}`}
                          onClick={() => !isYours && initiatePurchase(item as any)}
                          disabled={isPending || isYours}
                        >
                          {isYours ? "Your Listing" : "✦ Buy & Reveal →"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="mkt-empty">
                <div className="mkt-empty-icon">📭</div>
                <div className="mkt-empty-title">No Heroes Found</div>
                <div className="mkt-empty-desc">Try adjusting your filters, or check back soon for new listings.</div>
                <button className="mkt-btn" onClick={resetFilters}>Clear Filters</button>
              </div>
            )}
          </main>
        </div>
      </div>

      <NFTDetailDialog
        nft={selectedNft}
        open={!!selectedNft}
        onOpenChange={open => !open && setSelectedNft(null)}
      />
    </div>
  );
}