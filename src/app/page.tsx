"use client";

import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Store, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { LOOTBOX_REGISTRY } from "@/lib/sui-constants";

// ─── Types ───────────────────────────────────────────────────────────────────
interface GlobalStats {
  totalMinted: string;
  totalRevenue: string;
  totalOpened: string;
  activeCount: number;
}

interface ActiveBox {
  id: string;
  name: string;
  price: string;
  currency: string;
}

// ─── All styles (ported 1-to-1 from the HTML source) ────────────────────────
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Nunito:wght@300;400;600;700&display=swap');

  :root {
    --paper: #fafafa;
    --ink: #1a1a1a;
    --lavender: #c9b8ff;
    --pink: #ffb8d9;
    --mint: #b8ffe8;
    --yellow: #fff5b8;
    --blue: #b8eeff;
  }

  .gyate-root {
    font-family: 'Nunito', sans-serif;
    background-color: var(--paper);
    color: var(--ink);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  .gyate-root h1,.gyate-root h2,.gyate-root h3,
  .gyate-root h4,.gyate-root h5,.gyate-root h6,
  .gyate-root .font-hand { font-family: 'Caveat', cursive; }

  /* Paper texture overlay */
  .paper-texture {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 0; opacity: 0.4;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E");
  }

  /* ── Scroll animations ── */
  .scroll-hidden { opacity:0; transform:translateY(40px); transition:opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.16,1,0.3,1); will-change:transform,opacity; }
  .scroll-visible { opacity:1; transform:translateY(0); }

  /* ── Doodle border ── */
  .doodle-border {
    border: 2px solid var(--ink);
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    box-shadow: 4px 4px 0px rgba(201,184,255,0.4);
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
  }
  .doodle-border:hover { transform:scale(1.02) translateY(-2px); box-shadow:6px 6px 0px rgba(201,184,255,0.6); }

  /* ── Global keyframes ── */
  @keyframes holographic {
    0%   { background-position:0% 50%;   filter:hue-rotate(0deg); }
    50%  { background-position:100% 50%; }
    100% { background-position:0% 50%;   filter:hue-rotate(360deg); }
  }
  @keyframes float { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-12px) rotate(1deg)} }
  @keyframes wobble { 0%{transform:rotate(-2deg)} 100%{transform:rotate(2deg)} }
  @keyframes hintPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }

  /* ── 3D Lootbox ── */
  .scene {
    perspective: 800px; perspective-origin: 50% 35%;
    width: 260px; height: 240px; position: relative;
  }
  .box-wrapper {
    position: absolute; width: 200px; height: 200px; top: 80px; left: 30px;
    transform-style: preserve-3d; transform: rotateX(-22deg) rotateY(-38deg);
    animation: floatBox 5s ease-in-out infinite; cursor: pointer; will-change: transform;
  }
  .body-group { position:absolute; inset:0; transform-style:preserve-3d; }
  .face {
    position:absolute; width:200px; height:200px; border:3px solid #1a1a1a;
    display:flex; align-items:center; justify-content:center; overflow:hidden;
  }
  .face-front  { transform:rotateY(0deg)   translateZ(100px); background:linear-gradient(160deg,#fffde8,#fff5b8); }
  .face-back   { transform:rotateY(180deg) translateZ(100px); background:linear-gradient(160deg,#d0edff,#b8eeff); }
  .face-right  { transform:rotateY(90deg)  translateZ(100px); background:linear-gradient(160deg,#ffe0ef,#ffb8d9); }
  .face-left   { transform:rotateY(-90deg) translateZ(100px); background:linear-gradient(160deg,#d8fff0,#b8ffe8); }
  .face-bottom { transform:rotateX(-90deg) translateZ(100px); background:linear-gradient(160deg,#fff5cc,#fffae0); }

  .lid-group {
    position:absolute; top:0; left:0; width:200px; height:200px;
    transform-style:preserve-3d; transform:translateY(-200px);
    transform-origin:50% 100%; transition:transform 0.7s cubic-bezier(0.34,1.05,0.64,1);
  }
  .box-wrapper.is-open .lid-group { transform:translateY(-200px) translateX(280px); }

  .lid-top {
    position:absolute; width:200px; height:200px; border:3px solid #1a1a1a;
    background:linear-gradient(145deg,#fffde8,#fff5b8);
    display:flex; align-items:center; justify-content:center; overflow:hidden;
    transform:rotateX(90deg) translateZ(-70px);
  }
  .lid-skirt { position:absolute; top:170px; width:200px; height:30px; border:3px solid #1a1a1a; overflow:hidden; }
  .lid-skirt-front { transform:rotateY(0deg)   translateZ(100px); background:linear-gradient(180deg,#fffde8,#fff5b8); }
  .lid-skirt-back  { transform:rotateY(180deg) translateZ(100px); background:linear-gradient(180deg,#d0edff,#b8eeff); }
  .lid-skirt-right { transform:rotateY(90deg)  translateZ(100px); background:linear-gradient(180deg,#ffe0ef,#ffb8d9); }
  .lid-skirt-left  { transform:rotateY(-90deg) translateZ(100px); background:linear-gradient(180deg,#d8fff0,#b8ffe8); }

  .rib-v { position:absolute; left:50%; top:0; bottom:0; width:26px; transform:translateX(-50%); background:linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left:2px solid #c4006e; border-right:2px solid #c4006e; z-index:1; pointer-events:none; }
  .rib-h { position:absolute; top:50%; left:0; right:0; height:26px; transform:translateY(-50%); background:linear-gradient(to bottom,#ffb8e0,#ff3d9a,#ffb8e0); border-top:2px solid #c4006e; border-bottom:2px solid #c4006e; z-index:1; pointer-events:none; }
  .lid-rib-v { position:absolute; left:50%; top:0; bottom:0; width:26px; transform:translateX(-50%); background:linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left:2px solid #c4006e; border-right:2px solid #c4006e; pointer-events:none; z-index:1; }
  .lid-rib-h { position:absolute; top:50%; left:0; right:0; height:26px; transform:translateY(-50%); background:linear-gradient(to bottom,#ffb8e0,#ff3d9a,#ffb8e0); border-top:2px solid #c4006e; border-bottom:2px solid #c4006e; pointer-events:none; z-index:1; }
  .skirt-rib-v { position:absolute; left:50%; top:0; bottom:0; width:26px; transform:translateX(-50%); background:linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left:2px solid #c4006e; border-right:2px solid #c4006e; pointer-events:none; }

  .bow { position:absolute; width:68px; height:44px; top:50%; left:50%; transform:translate(-50%,-58%); z-index:10; }
  .bow-ear { position:absolute; width:28px; height:22px; background:linear-gradient(135deg,#ffb8e0,#ff3d9a); border:2.5px solid #c4006e; top:0; }
  .bow-ear.L { left:0; border-radius:50% 0 50% 0; transform:rotate(-26deg); transform-origin:right center; }
  .bow-ear.R { right:0; border-radius:0 50% 0 50%; transform:rotate(26deg); transform-origin:left center; }
  .bow-knot { position:absolute; width:15px; height:15px; background:#ff3d9a; border:2.5px solid #c4006e; border-radius:50%; top:50%; left:50%; transform:translate(-50%,-50%); z-index:6; }
  .bow-tail { position:absolute; bottom:-6px; width:15px; height:14px; background:linear-gradient(135deg,#ffb8e0,#ff3d9a); border:2px solid #c4006e; }
  .bow-tail.L { left:16px; border-radius:0 0 0 8px; transform:rotate(12deg); }
  .bow-tail.R { right:16px; border-radius:0 0 8px 0; transform:rotate(-12deg); }

  /* Inner NFT card (Rare — light blue) */
  .inner-nft {
    position:absolute; width:128px; height:178px; top:12px; left:36px;
    border-radius:16px; z-index:100; pointer-events:none;
    transform:translateZ(100px) scale(0) rotate(-5deg); opacity:0;
    transition:transform 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.4s, opacity 0.35s ease 0.4s;
    overflow:visible;
  }
  .box-wrapper.is-open .inner-nft { transform:translateZ(100px) translateY(-255px) rotate(7deg) scale(1.1); opacity:1; }
  .inner-nft-border {
    position:absolute; inset:-2px; border-radius:18px;
    background:linear-gradient(135deg,#74c0fc,#228be6,#4dabf7,#74c0fc); background-size:300% 300%;
    animation:rareBorderShift 3s ease infinite; z-index:0;
    box-shadow:0 4px 20px rgba(116,192,252,0.5), 0 12px 40px rgba(34,139,230,0.3);
  }
  @keyframes rareBorderShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  .inner-nft-body {
    position:relative; z-index:1; width:100%; height:100%; border-radius:14px;
    background:linear-gradient(145deg,#e8f4fd,#cce5ff); overflow:hidden;
    display:flex; flex-direction:column; padding:8px; box-sizing:border-box;
  }
  .inner-nft-body::before {
    content:""; position:absolute; inset:0;
    background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.5) 50%,transparent 65%);
    background-size:200% 200%; animation:rareShimmer 2.5s ease-in-out infinite;
    z-index:10; pointer-events:none; border-radius:14px;
  }
  @keyframes rareShimmer { 0%,100%{background-position:-100% 0} 50%{background-position:200% 0} }
  .nft-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; position:relative; z-index:5; }
  .nft-rarity-pip { background:linear-gradient(135deg,#228be6,#1971c2); border-radius:5px; padding:2px 7px; display:flex; align-items:center; gap:3px; }
  .nft-rarity-dot { width:4px; height:4px; border-radius:50%; background:white; box-shadow:0 0 4px rgba(255,255,255,0.8); animation:dotPulse 1.5s ease-in-out infinite; }
  @keyframes dotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.8)} }
  .nft-rarity-text { font-family:'Nunito',sans-serif; font-size:6.5px; font-weight:800; letter-spacing:0.08em; color:white; text-transform:uppercase; }
  .nft-id-tag { font-family:'Nunito',sans-serif; font-size:6.5px; color:#74c0fc; font-weight:700; }
  .nft-accent-bar { height:2px; background:linear-gradient(90deg,#74c0fc,#228be6,#74c0fc); border-radius:99px; margin-bottom:6px; position:relative; z-index:5; }
  .nft-art { position:relative; z-index:5; border-radius:9px; overflow:hidden; border:1.5px solid rgba(116,192,252,0.5); flex-shrink:0; background:linear-gradient(135deg,#74c0fc,#4dabf7,#228be6); width:100%; height:88px; display:flex; align-items:center; justify-content:center; }
  .nft-art img { width:100%; height:100%; object-fit:cover; display:block; border-radius:7px; }
  .nft-art-overlay { position:absolute; inset:0; background:linear-gradient(180deg,transparent 60%,rgba(14,99,189,0.25) 100%); pointer-events:none; z-index:2; }
  .nft-art-badge { position:absolute; bottom:4px; left:4px; background:rgba(34,139,230,0.85); border-radius:4px; font-family:'Nunito',sans-serif; font-size:5.5px; font-weight:800; color:white; padding:1px 4px; letter-spacing:0.08em; text-transform:uppercase; z-index:3; }
  .nft-info { padding-top:5px; position:relative; z-index:5; flex:1; display:flex; flex-direction:column; }
  .nft-name { font-family:'Caveat',cursive; font-size:13px; font-weight:700; color:#1971c2; line-height:1.1; margin-bottom:4px; }
  .nft-stats { display:flex; gap:3px; margin-bottom:4px; }
  .nft-stat { flex:1; background:rgba(116,192,252,0.2); border:1px solid rgba(116,192,252,0.4); border-radius:4px; padding:2px; text-align:center; }
  .nft-stat-val { font-family:'Nunito',sans-serif; font-size:8px; font-weight:800; color:#228be6; display:block; line-height:1; }
  .nft-stat-lbl { font-family:'Nunito',sans-serif; font-size:5px; color:#74c0fc; text-transform:uppercase; letter-spacing:0.05em; display:block; margin-top:1px; }
  .nft-bottom { position:relative; z-index:5; margin-top:auto; }
  .nft-bar-wrap { width:100%; height:3px; background:rgba(116,192,252,0.25); border-radius:99px; overflow:hidden; margin-bottom:4px; }
  .nft-bar { height:100%; width:30%; background:linear-gradient(90deg,#74c0fc,#228be6); border-radius:99px; }
  .nft-footer-row { display:flex; align-items:center; justify-content:space-between; }
  .nft-label { font-family:'Caveat',cursive; font-size:12px; font-weight:700; color:#1971c2; }
  .nft-chain-badge { font-family:'Nunito',sans-serif; font-size:6px; font-weight:800; color:#74c0fc; letter-spacing:0.1em; text-transform:uppercase; }

  .ground-shadow {
    position:absolute; bottom:0; left:50%; transform:translateX(-50%);
    width:170px; height:22px; background:radial-gradient(ellipse,#b87eff44 0%,transparent 72%);
    border-radius:50%; pointer-events:none; animation:shadowSync 5s ease-in-out infinite;
  }
  @keyframes shadowSync { 0%,100%{transform:translateX(-50%) scaleX(1);opacity:0.6} 50%{transform:translateX(-50%) scaleX(0.72);opacity:0.25} }

  .sparkles { position:absolute; inset:-80px; pointer-events:none; z-index:200; }
  .spark { position:absolute; top:50%; left:50%; font-size:20px; opacity:0; transform:translate(-50%,-50%); }
  .box-wrapper.is-open .spark { animation:sparkFly 1s ease forwards; }
  .spark:nth-child(1){--tx:-90px;--ty:-85px;animation-delay:0.36s}
  .spark:nth-child(2){--tx:90px;--ty:-85px;animation-delay:0.41s}
  .spark:nth-child(3){--tx:-112px;--ty:5px;animation-delay:0.38s}
  .spark:nth-child(4){--tx:112px;--ty:5px;animation-delay:0.44s}
  .spark:nth-child(5){--tx:-68px;--ty:100px;animation-delay:0.46s}
  .spark:nth-child(6){--tx:68px;--ty:100px;animation-delay:0.39s}
  .spark:nth-child(7){--tx:0;--ty:-118px;animation-delay:0.34s}
  @keyframes sparkFly {
    0%{opacity:1;transform:translate(-50%,-50%) scale(0.4) rotate(0)}
    60%{opacity:1}
    100%{opacity:0;transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(1.4) rotate(210deg)}
  }
  @keyframes floatBox { 0%,100%{transform:rotateX(-22deg) rotateY(-38deg) translateY(0)} 50%{transform:rotateX(-22deg) rotateY(-38deg) translateY(-16px)} }
  @keyframes shake {
    0%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(0,0,0)}
    20%,80%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(-7px,0,0)}
    40%,60%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(9px,0,0)}
    100%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(0,0,0)}
  }
  .box-wrapper.is-shaking { animation:shake 0.48s cubic-bezier(0.36,0.07,0.19,0.97) both !important; }
  .hint-label { font-family:'Caveat',cursive; font-size:21px; color:#9a88c0; animation:hintPulse 2.5s ease-in-out infinite; }

  /* ── NFT Rarity Cards ── */
  .nft-card {
    position:relative; border-radius:20px; overflow:hidden; cursor:pointer;
    transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease;
  }
  .nft-card:hover { transform:translateY(-10px) scale(1.03); }

  /* COMMON */
  .nft-card-common { background:linear-gradient(145deg,#f8f9fa,#e9ecef); border:2px solid #dee2e6; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
  .nft-card-common:hover { box-shadow:0 20px 40px rgba(0,0,0,0.15); }
  .nft-card-common .card-art { background:linear-gradient(135deg,#e9ecef,#ced4da,#adb5bd); }
  .nft-card-common .card-badge { background:#6c757d; color:white; }
  .nft-card-common .card-border-accent { background:linear-gradient(90deg,#adb5bd,#6c757d,#adb5bd); }
  .nft-card-common .card-percent { color:#495057; }
  .nft-card-common .card-prob-fill { background:linear-gradient(90deg,#adb5bd,#6c757d); }

  /* RARE */
  .nft-card-rare { background:linear-gradient(145deg,#e8f4fd,#cce5ff); border:2px solid #74c0fc; box-shadow:0 4px 20px rgba(116,192,252,0.3); }
  .nft-card-rare:hover { box-shadow:0 20px 50px rgba(116,192,252,0.5); }
  .nft-card-rare .card-art { background:linear-gradient(135deg,#74c0fc,#4dabf7,#228be6); }
  .nft-card-rare .card-badge { background:linear-gradient(135deg,#228be6,#1971c2); color:white; }
  .nft-card-rare .card-border-accent { background:linear-gradient(90deg,#74c0fc,#228be6,#74c0fc); }
  .nft-card-rare .card-percent { color:#1971c2; }
  .nft-card-rare .card-prob-fill { background:linear-gradient(90deg,#74c0fc,#228be6); }

  /* SUPER RARE */
  .nft-card-sr { background:linear-gradient(145deg,#f3e8ff,#e9d5ff); border:2px solid #c084fc; box-shadow:0 4px 20px rgba(192,132,252,0.35); }
  .nft-card-sr:hover { box-shadow:0 20px 50px rgba(192,132,252,0.55); }
  .nft-card-sr .card-art { background:linear-gradient(135deg,#c084fc,#a855f7,#7c3aed); }
  .nft-card-sr .card-badge { background:linear-gradient(135deg,#9333ea,#6d28d9); color:white; }
  .nft-card-sr .card-border-accent { background:linear-gradient(90deg,#c084fc,#7c3aed,#c084fc); }
  .nft-card-sr .card-percent { color:#7c3aed; }
  .nft-card-sr .card-prob-fill { background:linear-gradient(90deg,#c084fc,#7c3aed); }

  /* SSR */
  .nft-card-ssr {
    background:linear-gradient(145deg,#1a0524,#2d0a3e,#1a0524); border:none;
    box-shadow:0 4px 30px rgba(192,38,211,0.4), 0 0 0 1.5px rgba(232,121,249,0.25);
  }
  .nft-card-ssr:hover {
    box-shadow:0 20px 60px rgba(192,38,211,0.6), 0 0 0 1.5px rgba(232,121,249,0.5), 0 0 80px rgba(192,38,211,0.25);
    transform:translateY(-10px) scale(1.03);
  }
  .nft-card-ssr .card-art {
    background:linear-gradient(135deg,#3b0764,#7e22ce,#a855f7,#ec4899); background-size:300% 300%;
    animation:ssrArtShift 3s ease infinite; border:1.5px solid rgba(232,121,249,0.3);
  }
  @keyframes ssrArtShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  .nft-card-ssr .card-badge { background:linear-gradient(135deg,#7e22ce,#a21caf,#be185d); color:#f0abfc; letter-spacing:0.12em; text-shadow:0 0 8px rgba(240,171,252,0.8); border:1px solid rgba(232,121,249,0.3); }
  .nft-card-ssr .card-border-accent { background:linear-gradient(90deg,transparent,#e879f9,#a855f7,#e879f9,transparent); box-shadow:0 0 8px rgba(232,121,249,0.7); animation:ssrAccentPulse 2s ease-in-out infinite; }
  @keyframes ssrAccentPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
  .nft-card-ssr .card-percent { background:linear-gradient(135deg,#f0abfc,#e879f9,#a855f7); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; filter:drop-shadow(0 0 6px rgba(232,121,249,0.6)); }
  .nft-card-ssr .card-prob-bar { background:rgba(232,121,249,0.1); }
  .nft-card-ssr .card-prob-fill { background:linear-gradient(90deg,#7e22ce,#e879f9,#a855f7); box-shadow:0 0 8px rgba(232,121,249,0.9); animation:ssrBarGlow 1.8s ease-in-out infinite; }
  @keyframes ssrBarGlow { 0%,100%{box-shadow:0 0 4px rgba(232,121,249,0.6)} 50%{box-shadow:0 0 14px rgba(232,121,249,1),0 0 22px rgba(168,85,247,0.5)} }
  .nft-card-ssr .card-id { color:rgba(232,121,249,0.5); }
  .nft-card-ssr .card-recycle { color:rgba(232,121,249,0.35); }

  .ssr-border { position:absolute; inset:-2px; border-radius:22px; background:linear-gradient(135deg,#7e22ce,#e879f9,#a855f7,#ec4899,#7e22ce); background-size:400% 400%; animation:ssrBorderShift 3s ease infinite; z-index:0; box-shadow:0 0 20px rgba(232,121,249,0.4); }
  @keyframes ssrBorderShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  .ssr-stars { position:absolute; inset:0; pointer-events:none; border-radius:18px; overflow:hidden; background-image:radial-gradient(1px 1px at 10% 15%,rgba(232,121,249,0.9) 0%,transparent 100%),radial-gradient(1px 1px at 85% 10%,rgba(255,255,255,0.5) 0%,transparent 100%),radial-gradient(1.5px 1.5px at 45% 65%,rgba(232,121,249,0.8) 0%,transparent 100%),radial-gradient(1px 1px at 92% 75%,rgba(168,85,247,0.7) 0%,transparent 100%),radial-gradient(1px 1px at 20% 88%,rgba(232,121,249,0.6) 0%,transparent 100%),radial-gradient(1.5px 1.5px at 65% 35%,rgba(255,255,255,0.4) 0%,transparent 100%); z-index:0; }
  .ssr-shine { position:absolute; inset:0; border-radius:18px; background:linear-gradient(105deg,transparent 30%,rgba(232,121,249,0.12) 50%,transparent 70%); background-size:200% 200%; animation:ssrShimmer 2.5s ease-in-out infinite; pointer-events:none; z-index:1; }
  @keyframes ssrShimmer { 0%,100%{background-position:-100% 0;opacity:0.6} 50%{background-position:200% 0;opacity:1} }
  .ssr-corner { position:absolute; font-size:8px; color:rgba(232,121,249,0.6); pointer-events:none; z-index:5; }
  .ssr-corner.tl { top:6px; left:6px; }
  .ssr-corner.tr { top:6px; right:6px; }
  .ssr-animated-tag { font-size:8px; color:rgba(232,121,249,0.5); text-align:center; position:relative; z-index:2; margin-top:2px; letter-spacing:0.05em; animation:ssrTagPulse 2s ease-in-out infinite; }
  @keyframes ssrTagPulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }

  /* ULTRA RARE */
  .nft-card-ur { background:linear-gradient(145deg,#0a0a0f,#0f0f1e,#0a0a14); border:none; box-shadow:0 4px 30px rgba(251,191,36,0.35), 0 0 0 1.5px rgba(251,191,36,0.25); }
  .nft-card-ur:hover { box-shadow:0 20px 60px rgba(251,191,36,0.55), 0 0 0 1.5px rgba(251,191,36,0.5), 0 0 80px rgba(251,191,36,0.2); transform:translateY(-10px) scale(1.03); }
  .nft-card-ur .card-art { background:linear-gradient(135deg,#1a1200,#3d2c00,#1a1200); border:1.5px solid rgba(251,191,36,0.3); }
  .nft-card-ur .card-badge { background:linear-gradient(135deg,#92400e,#78350f,#451a03); color:#fbbf24; border:1px solid rgba(251,191,36,0.4); letter-spacing:0.12em; text-shadow:0 0 8px rgba(251,191,36,0.8); }
  .nft-card-ur .card-border-accent { background:linear-gradient(90deg,transparent,#fbbf24,#f59e0b,#fbbf24,transparent); box-shadow:0 0 8px rgba(251,191,36,0.6); animation:urAccentPulse 2s ease-in-out infinite; }
  @keyframes urAccentPulse { 0%,100%{opacity:0.7} 50%{opacity:1} }
  .nft-card-ur .card-id { color:rgba(251,191,36,0.5); }
  .nft-card-ur .card-percent { background:linear-gradient(135deg,#fde68a,#f59e0b,#fbbf24); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; filter:drop-shadow(0 0 6px rgba(251,191,36,0.6)); }
  .nft-card-ur .card-prob-bar { background:rgba(251,191,36,0.1); }
  .nft-card-ur .card-prob-fill { background:linear-gradient(90deg,#92400e,#fbbf24,#f59e0b); box-shadow:0 0 6px rgba(251,191,36,0.8); animation:urBarPulse 1.8s ease-in-out infinite; }
  @keyframes urBarPulse { 0%,100%{box-shadow:0 0 4px rgba(251,191,36,0.6)} 50%{box-shadow:0 0 12px rgba(251,191,36,1),0 0 20px rgba(245,158,11,0.5)} }
  .nft-card-ur .card-recycle { color:rgba(251,191,36,0.35); }

  .ur-corner { position:absolute; font-size:8px; color:rgba(251,191,36,0.5); pointer-events:none; }
  .ur-corner.tl { top:6px; left:6px; }
  .ur-corner.tr { top:6px; right:6px; }
  .ur-stars { position:absolute; inset:0; pointer-events:none; border-radius:18px; overflow:hidden; background-image:radial-gradient(1px 1px at 15% 20%,rgba(251,191,36,0.7) 0%,transparent 100%),radial-gradient(1px 1px at 80% 15%,rgba(255,255,255,0.4) 0%,transparent 100%),radial-gradient(1.5px 1.5px at 50% 60%,rgba(251,191,36,0.8) 0%,transparent 100%),radial-gradient(1px 1px at 90% 70%,rgba(255,255,255,0.3) 0%,transparent 100%),radial-gradient(1px 1px at 25% 85%,rgba(251,191,36,0.5) 0%,transparent 100%),radial-gradient(1.5px 1.5px at 70% 40%,rgba(251,191,36,0.6) 0%,transparent 100%); z-index:0; }
  .ur-shimmer { position:absolute; inset:0; border-radius:18px; background:linear-gradient(105deg,transparent 30%,rgba(251,191,36,0.08) 50%,transparent 70%); background-size:200% 200%; animation:urShimmer 3s ease-in-out infinite; pointer-events:none; z-index:1; }
  @keyframes urShimmer { 0%,100%{background-position:-100% 0} 50%{background-position:200% 0} }
  .ur-glow { position:absolute; inset:-2px; border-radius:22px; background:linear-gradient(135deg,#92400e,#fbbf24,#f59e0b,#fde68a,#f59e0b,#fbbf24,#92400e); background-size:300% 300%; animation:urGlowShift 3s ease infinite; z-index:0; box-shadow:0 0 20px rgba(251,191,36,0.5),0 0 40px rgba(245,158,11,0.25); }
  @keyframes urGlowShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }

  /* LEGEND RARE */
  .nft-card-legend { border:none; animation:legendFloat 4s ease-in-out infinite; position:relative; overflow:visible !important; }
  @keyframes legendFloat { 0%,100%{transform:translateY(0) rotate(0.4deg)} 50%{transform:translateY(-5px) rotate(-0.4deg)} }
  .legend-rainbow-border { position:absolute; inset:-2.5px; border-radius:23px; background:linear-gradient(135deg,#ff9de2,#ffd6a5,#caffbf,#9bf6ff,#a0c4ff,#bdb2ff,#ff9de2); background-size:400% 400%; animation:holographic 1.8s ease infinite; z-index:1; box-shadow:0 0 18px rgba(255,157,226,0.7),0 0 40px rgba(189,178,255,0.4),0 0 70px rgba(155,246,255,0.3); }
  .legend-halo { position:absolute; inset:-6px; border-radius:26px; background:linear-gradient(135deg,#ff9de2,#ffd6a5,#caffbf,#9bf6ff,#a0c4ff,#bdb2ff,#ff9de2); background-size:400% 400%; animation:holographic 1.5s ease infinite; filter:blur(6px); opacity:0.55; z-index:0; }
  .nft-card-legend .card-art { background:linear-gradient(135deg,#2d004d,#1a0030,#000820); border:1.5px solid transparent; position:relative; }
  .legend-art-prism { position:absolute; inset:0; border-radius:10px; background:linear-gradient(135deg,#ff9de2,#ffd6a5,#caffbf,#9bf6ff,#a0c4ff,#bdb2ff,#ff9de2); background-size:400% 400%; animation:holographic 1.5s ease infinite; opacity:0.18; pointer-events:none; }
  .nft-card-legend .card-badge { background:linear-gradient(135deg,#1a0030,#0a001a); color:transparent; font-weight:900; letter-spacing:0.14em; border:1px solid rgba(255,157,226,0.5); position:relative; overflow:hidden; }
  .legend-badge-text { background:linear-gradient(90deg,#ff9de2,#ffd6a5,#caffbf,#9bf6ff,#bdb2ff,#ff9de2); background-size:300% 100%; animation:holographic 1.8s linear infinite; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; font-weight:900; font-size:9px; letter-spacing:0.14em; text-transform:uppercase; }
  .nft-card-legend .card-border-accent { background:linear-gradient(90deg,#ff9de2,#ffd6a5,#caffbf,#9bf6ff,#bdb2ff,#ff9de2); background-size:400% 100%; animation:holographic 1.5s linear infinite; height:2px; box-shadow:0 0 10px rgba(255,157,226,0.8),0 0 20px rgba(155,246,255,0.4); }
  .nft-card-legend .card-percent { background:linear-gradient(135deg,#ff9de2,#ffd6a5,#caffbf,#9bf6ff,#bdb2ff); background-size:300% 300%; animation:holographic 2s ease infinite; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; filter:drop-shadow(0 0 8px rgba(255,157,226,0.7)); font-size:30px; }
  .nft-card-legend .card-prob-bar { background:rgba(255,255,255,0.07); }
  .nft-card-legend .card-prob-fill { background:linear-gradient(90deg,#ff9de2,#ffd6a5,#9bf6ff,#bdb2ff); background-size:400% 100%; animation:holographic 1.5s linear infinite; box-shadow:0 0 10px rgba(255,157,226,0.9),0 0 20px rgba(155,246,255,0.5); }
  .nft-card-legend .card-id { color:rgba(155,246,255,0.45); letter-spacing:0.1em; }
  .nft-card-legend .card-recycle { color:rgba(155,246,255,0.3); }
  .legend-hologram { position:absolute; inset:0; border-radius:20px; overflow:hidden; background:linear-gradient(105deg,transparent 20%,rgba(255,157,226,0.18) 38%,rgba(155,246,255,0.22) 50%,rgba(189,178,255,0.18) 62%,transparent 80%); background-size:200% 200%; animation:lgdHoloSweep 2.2s ease-in-out infinite; pointer-events:none; z-index:4; }
  @keyframes lgdHoloSweep { 0%,100%{background-position:-120% 0;opacity:0.5} 50%{background-position:220% 0;opacity:1} }
  .legend-hologram2 { position:absolute; inset:0; border-radius:20px; overflow:hidden; background:linear-gradient(75deg,transparent 25%,rgba(160,196,255,0.14) 45%,rgba(255,214,165,0.16) 55%,transparent 75%); background-size:200% 200%; animation:lgdHoloSweep2 3s ease-in-out infinite; pointer-events:none; z-index:4; }
  @keyframes lgdHoloSweep2 { 0%,100%{background-position:220% 0;opacity:0.4} 50%{background-position:-120% 0;opacity:0.8} }
  .legend-stars { position:absolute; inset:0; pointer-events:none; border-radius:18px; overflow:hidden; background-image:radial-gradient(1px 1px at 8% 12%,rgba(255,255,255,1) 0%,transparent 100%),radial-gradient(1px 1px at 88% 8%,rgba(255,255,255,0.9) 0%,transparent 100%),radial-gradient(1.5px 1.5px at 52% 22%,rgba(189,178,255,1) 0%,transparent 100%),radial-gradient(1px 1px at 18% 45%,rgba(255,255,255,0.7) 0%,transparent 100%),radial-gradient(1px 1px at 75% 38%,rgba(155,246,255,0.9) 0%,transparent 100%),radial-gradient(2px 2px at 35% 68%,rgba(255,255,255,1) 0%,transparent 100%),radial-gradient(1px 1px at 92% 55%,rgba(255,157,226,0.9) 0%,transparent 100%),radial-gradient(1px 1px at 12% 78%,rgba(189,178,255,0.8) 0%,transparent 100%),radial-gradient(1.5px 1.5px at 62% 85%,rgba(255,255,255,0.9) 0%,transparent 100%); z-index:1; }
  .legend-stars-twinkle { position:absolute; inset:0; pointer-events:none; border-radius:20px; background-image:radial-gradient(1px 1px at 22% 18%,rgba(255,255,255,0.9) 0%,transparent 100%),radial-gradient(1.5px 1.5px at 68% 28%,rgba(189,178,255,0.9) 0%,transparent 100%),radial-gradient(1px 1px at 42% 55%,rgba(255,157,226,0.8) 0%,transparent 100%),radial-gradient(1px 1px at 85% 65%,rgba(255,255,255,0.7) 0%,transparent 100%),radial-gradient(1.5px 1.5px at 15% 88%,rgba(155,246,255,0.9) 0%,transparent 100%); animation:lgdTwinkle 2s ease-in-out infinite alternate; z-index:2; }
  @keyframes lgdTwinkle { 0%{opacity:0.3} 100%{opacity:1} }
  .lgd-corner { position:absolute; pointer-events:none; z-index:10; font-size:9px; background:linear-gradient(135deg,#ff9de2,#9bf6ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:lgdTwinkle 1.5s ease-in-out infinite alternate; }
  .lgd-corner.tl { top:6px; left:6px; }
  .lgd-corner.tr { top:6px; right:6px; }
  .lgd-corner.bl { bottom:22px; left:6px; }
  .lgd-corner.br { bottom:22px; right:6px; }

  /* Card shared parts */
  .card-art { width:100%; aspect-ratio:1; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:2.5rem; position:relative; overflow:hidden; margin-bottom:12px; }
  .card-art-icon { position:relative; z-index:2; filter:drop-shadow(0 4px 8px rgba(0,0,0,0.25)); transition:transform 0.3s ease; }
  .nft-card:hover .card-art-icon { transform:scale(1.15) rotate(-5deg); }
  .card-art-shimmer { position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.25) 0%,transparent 50%,rgba(255,255,255,0.1) 100%); pointer-events:none; }
  .card-badge { display:inline-block; padding:3px 10px; border-radius:6px; font-size:9px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:10px; width:100%; text-align:center; }
  .card-border-accent { height:3px; border-radius:99px; margin-bottom:10px; }
  .card-id { font-size:9px; color:#94a3b8; font-weight:700; letter-spacing:0.1em; margin-bottom:4px; }
  .card-percent { font-family:'Caveat',cursive; font-size:28px; font-weight:700; line-height:1; }
  .card-prob-bar { width:100%; height:4px; background:rgba(0,0,0,0.1); border-radius:99px; overflow:hidden; margin-top:6px; margin-bottom:8px; }
  .card-prob-fill { height:100%; border-radius:99px; }
  .card-recycle { font-size:9px; color:#94a3b8; display:flex; align-items:center; justify-content:center; gap:3px; opacity:0; transition:opacity 0.2s; }
  .nft-card:hover .card-recycle { opacity:1; }

  /* ── Mini 3D Gift Box (How It Works) ── */
  .mini-scene { perspective:300px; perspective-origin:50% 30%; width:44px; height:44px; position:relative; }
  .mini-box-wrapper { position:absolute; width:32px; height:32px; top:6px; left:6px; transform-style:preserve-3d; transform:rotateX(-20deg) rotateY(-35deg); animation:miniFloatBox 4s ease-in-out infinite; will-change:transform; }
  .group:hover .mini-box-wrapper { animation:miniShake 0.5s ease infinite; }
  @keyframes miniFloatBox { 0%,100%{transform:rotateX(-20deg) rotateY(-35deg) translateY(0)} 50%{transform:rotateX(-20deg) rotateY(-35deg) translateY(-4px)} }
  @keyframes miniShake { 0%{transform:rotateX(-20deg) rotateY(-35deg) translateX(0)} 25%{transform:rotateX(-20deg) rotateY(-35deg) translateX(-3px)} 75%{transform:rotateX(-20deg) rotateY(-35deg) translateX(3px)} 100%{transform:rotateX(-20deg) rotateY(-35deg) translateX(0)} }
  .mini-body { position:absolute; inset:0; transform-style:preserve-3d; }
  .mini-face { position:absolute; width:32px; height:32px; border:2px solid #1a1a1a; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .mini-face-front  { transform:rotateY(0deg)   translateZ(16px); background:linear-gradient(160deg,#fffde8,#fff5b8); }
  .mini-face-back   { transform:rotateY(180deg) translateZ(16px); background:linear-gradient(160deg,#d0edff,#b8eeff); }
  .mini-face-right  { transform:rotateY(90deg)  translateZ(16px); background:linear-gradient(160deg,#ffe0ef,#ffb8d9); }
  .mini-face-left   { transform:rotateY(-90deg) translateZ(16px); background:linear-gradient(160deg,#d8fff0,#b8ffe8); }
  .mini-face-bottom { transform:rotateX(-90deg) translateZ(16px); background:linear-gradient(160deg,#fff5cc,#fffae0); }
  .mini-lid { position:absolute; top:0; left:0; width:32px; height:32px; transform-style:preserve-3d; transform:translateY(-32px); transform-origin:50% 100%; }
  .mini-lid-top { position:absolute; width:32px; height:32px; border:2px solid #1a1a1a; background:linear-gradient(145deg,#fffde8,#fff5b8); display:flex; align-items:center; justify-content:center; overflow:hidden; transform:rotateX(90deg) translateZ(-11px); }
  .mini-lid-skirt { position:absolute; top:27px; width:32px; height:5px; border:2px solid #1a1a1a; overflow:hidden; }
  .mini-lid-sf { transform:rotateY(0deg)   translateZ(16px); background:linear-gradient(180deg,#fffde8,#fff5b8); }
  .mini-lid-sb { transform:rotateY(180deg) translateZ(16px); background:linear-gradient(180deg,#d0edff,#b8eeff); }
  .mini-lid-sr { transform:rotateY(90deg)  translateZ(16px); background:linear-gradient(180deg,#ffe0ef,#ffb8d9); }
  .mini-lid-sl { transform:rotateY(-90deg) translateZ(16px); background:linear-gradient(180deg,#d8fff0,#b8ffe8); }
  .mini-rib-v { position:absolute; left:50%; top:0; bottom:0; width:5px; transform:translateX(-50%); background:linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left:1px solid #c4006e; border-right:1px solid #c4006e; z-index:1; pointer-events:none; }
  .mini-rib-h { position:absolute; top:50%; left:0; right:0; height:5px; transform:translateY(-50%); background:linear-gradient(to bottom,#ffb8e0,#ff3d9a,#ffb8e0); border-top:1px solid #c4006e; border-bottom:1px solid #c4006e; z-index:1; pointer-events:none; }
  .mini-bow { position:absolute; width:14px; height:9px; top:50%; left:50%; transform:translate(-50%,-60%); z-index:10; }
  .mini-bow-ear { position:absolute; width:6px; height:5px; background:linear-gradient(135deg,#ffb8e0,#ff3d9a); border:1px solid #c4006e; top:0; }
  .mini-bow-ear.L { left:0; border-radius:50% 0 50% 0; transform:rotate(-26deg); transform-origin:right center; }
  .mini-bow-ear.R { right:0; border-radius:0 50% 0 50%; transform:rotate(26deg); transform-origin:left center; }
  .mini-bow-knot { position:absolute; width:4px; height:4px; background:#ff3d9a; border:1px solid #c4006e; border-radius:50%; top:50%; left:50%; transform:translate(-50%,-50%); z-index:6; }

  /* Spinning random box */
  .mini-spin-box { animation:miniSpinRoll 3s linear infinite !important; }
  .group:hover .mini-spin-box { animation:miniSpinRollFast 0.6s linear infinite !important; }
  @keyframes miniSpinRoll     { 0%{transform:rotateX(-20deg) rotateY(0deg)}   100%{transform:rotateX(-20deg) rotateY(360deg)} }
  @keyframes miniSpinRollFast { 0%{transform:rotateX(-20deg) rotateY(0deg)}   100%{transform:rotateX(-20deg) rotateY(360deg)} }

  /* Mini NFT card */
  .mini-nft-card { position:relative; width:34px; height:46px; animation:miniNftFloat 3s ease-in-out infinite; flex-shrink:0; }
  @keyframes miniNftFloat { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-4px) rotate(-4deg)} }
  .group:hover .mini-nft-card { animation:miniNftPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  @keyframes miniNftPop { to{transform:translateY(-6px) rotate(3deg) scale(1.15)} }
  .mini-nft-border { position:absolute; inset:-1.5px; border-radius:7px; background:linear-gradient(135deg,#f9a8d4,#db2777,#f9a8d4); background-size:300% 300%; animation:rareBorderShift 2s ease infinite; box-shadow:0 4px 14px rgba(244,114,182,0.5); z-index:0; }
  .mini-nft-body { position:relative; z-index:1; width:100%; height:100%; border-radius:6px; background:linear-gradient(145deg,#fdf2f8,#fce7f3); overflow:hidden; display:flex; flex-direction:column; align-items:center; padding:3px; box-sizing:border-box; }
  .mini-nft-body::before { content:""; position:absolute; inset:0; background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.55) 50%,transparent 65%); background-size:200% 200%; animation:rareShimmer 2s ease-in-out infinite; z-index:5; pointer-events:none; }
  .mini-nft-badge { width:100%; background:linear-gradient(135deg,#db2777,#be185d); border-radius:3px; padding:1px 0; text-align:center; font-family:'Nunito',sans-serif; font-size:5px; font-weight:900; color:white; letter-spacing:0.06em; text-transform:uppercase; position:relative; z-index:2; margin-bottom:2px; }
  .mini-nft-art { width:100%; flex:1; background:linear-gradient(135deg,#f9a8d4,#f472b6,#db2777); border-radius:3px; display:flex; align-items:center; justify-content:center; margin-bottom:2px; position:relative; z-index:2; overflow:hidden; }
  .mini-nft-bar-wrap { width:100%; height:2px; background:rgba(244,114,182,0.2); border-radius:99px; overflow:hidden; margin-bottom:2px; position:relative; z-index:2; }
  .mini-nft-bar { height:100%; width:60%; background:linear-gradient(90deg,#f9a8d4,#db2777); border-radius:99px; }
  .mini-nft-label { font-family:'Caveat',cursive; font-size:8px; font-weight:700; color:#db2777; position:relative; z-index:2; line-height:1; }

  /* ── Roadmap ── */
  @keyframes urGlowShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
`;

// ─── 3D Lootbox ──────────────────────────────────────────────────────────────
function LootboxHero() {
  const boxRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  const triggerOpen = () => {
    const box = boxRef.current;
    if (!box || busyRef.current) return;
    busyRef.current = true;
    box.style.animation = "none";
    void box.offsetWidth;
    box.classList.add("is-shaking");
    setTimeout(() => {
      box.classList.remove("is-shaking");
      box.classList.add("is-open");
      setTimeout(() => {
        box.classList.remove("is-open");
        setTimeout(() => {
          box.style.animation = "";
          busyRef.current = false;
        }, 900);
      }, 3200);
    }, 480);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div className="scene">
        <div className="ground-shadow" />
        <div className="box-wrapper" ref={boxRef} onClick={triggerOpen}>
          {/* Sparks */}
          <div className="sparkles">
            {["✦","✧","⭐","💫","✨","🌸","💎"].map((s, i) => (
              <span key={i} className="spark">{s}</span>
            ))}
          </div>

          {/* Body */}
          <div className="body-group">
            <div className="face face-front">
              <div className="rib-v" /><div className="rib-h" />
              <div style={{ position:"relative", zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ fontSize:40, opacity:0.15 }}>❓</div>
                <span style={{ fontFamily:"'Caveat',cursive", fontSize:16, fontWeight:700, color:"#1a1a1a25" }}>GYATE BOX</span>
              </div>
            </div>
            <div className="face face-back" />
            <div className="face face-right"><div className="rib-v" /><div className="rib-h" /></div>
            <div className="face face-left" />
            <div className="face face-bottom" />
          </div>

          {/* Lid */}
          <div className="lid-group">
            <div className="lid-top">
              <div className="lid-rib-v" /><div className="lid-rib-h" />
              <div className="bow">
                <div className="bow-ear L" /><div className="bow-ear R" />
                <div className="bow-knot" />
                <div className="bow-tail L" /><div className="bow-tail R" />
              </div>
            </div>
            <div className="lid-skirt lid-skirt-front"><div className="skirt-rib-v" /></div>
            <div className="lid-skirt lid-skirt-back" />
            <div className="lid-skirt lid-skirt-right"><div className="skirt-rib-v" /></div>
            <div className="lid-skirt lid-skirt-left" />
          </div>

          {/* Inner NFT Card */}
          <div className="inner-nft">
            <div className="inner-nft-border" />
            <div className="inner-nft-body">
              <div className="nft-header">
                <div className="nft-rarity-pip">
                  <div className="nft-rarity-dot" />
                  <span className="nft-rarity-text">Rare</span>
                </div>
                <span className="nft-id-tag">#0342</span>
              </div>
              <div className="nft-accent-bar" />
              <div className="nft-art">
                <img src="https://copper-efficient-felidae-814.mypinata.cloud/ipfs/bafkreiarommzmxprjpmfduuotcuqdj3kealzqh4ta62z6w7kpm5nbilave" alt="" />
                <div className="nft-art-overlay" />
                <span className="nft-art-badge">SUI NFT</span>
              </div>
              <div className="nft-info">
                <div className="nft-name">Celestial Cat</div>
                <div className="nft-stats">
                  {[["72","PWR"],["56","SPD"],["88","LCK"]].map(([v,l]) => (
                    <div key={l} className="nft-stat">
                      <span className="nft-stat-val">{v}</span>
                      <span className="nft-stat-lbl">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="nft-bottom">
                <div className="nft-bar-wrap"><div className="nft-bar" /></div>
                <div className="nft-footer-row">
                  <span className="nft-label">✦ Rare</span>
                  <span className="nft-chain-badge">SUI</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span className="hint-label" style={{ marginTop: 8 }}>✦ click to open ✦</span>
    </div>
  );
}

// ─── Mini Gift Box (static, floats) ─────────────────────────────────────────
function MiniBuyBox() {
  return (
    <div className="mini-scene">
      <div className="mini-box-wrapper">
        <div className="mini-body">
          <div className="mini-face mini-face-front"><div className="mini-rib-v" /><div className="mini-rib-h" /></div>
          <div className="mini-face mini-face-back" />
          <div className="mini-face mini-face-right"><div className="mini-rib-v" /><div className="mini-rib-h" /></div>
          <div className="mini-face mini-face-left" />
          <div className="mini-face mini-face-bottom" />
        </div>
        <div className="mini-lid">
          <div className="mini-lid-top">
            <div className="mini-rib-v" /><div className="mini-rib-h" />
            <div className="mini-bow">
              <div className="mini-bow-ear L" /><div className="mini-bow-ear R" />
              <div className="mini-bow-knot" />
            </div>
          </div>
          <div className="mini-lid-skirt mini-lid-sf" />
          <div className="mini-lid-skirt mini-lid-sb" />
          <div className="mini-lid-skirt mini-lid-sr" />
          <div className="mini-lid-skirt mini-lid-sl" />
        </div>
      </div>
    </div>
  );
}

// ─── Mini Spinning Random Box ────────────────────────────────────────────────
function MiniSpinBox() {
  return (
    <div className="mini-scene">
      <div className="mini-box-wrapper mini-spin-box">
        <div className="mini-body">
          {[
            { cls:"mini-face-front",  bg:"linear-gradient(160deg,#fffde8,#fff5b8)" },
            { cls:"mini-face-back",   bg:"linear-gradient(160deg,#fef9c3,#fde68a)" },
            { cls:"mini-face-right",  bg:"linear-gradient(160deg,#fef3c7,#fde68a)" },
            { cls:"mini-face-left",   bg:"linear-gradient(160deg,#fffbeb,#fef3c7)" },
            { cls:"mini-face-bottom", bg:"linear-gradient(160deg,#fff5cc,#fffae0)" },
          ].map(({ cls, bg }) => (
            <div key={cls} className={`mini-face ${cls}`} style={{ background: bg }}>
              {cls !== "mini-face-bottom" && (
                <span style={{ fontSize: cls.includes("right") || cls.includes("left") ? 9 : 11, zIndex:2, position:"relative", fontWeight:900, color:"#b45309", opacity:0.7 }}>?</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Mini NFT Card ───────────────────────────────────────────────────────────
function MiniNftCard() {
  return (
    <div className="mini-nft-card">
      <div className="mini-nft-border" />
      <div className="mini-nft-body">
        <div className="mini-nft-badge">NFT</div>
        <div className="mini-nft-art">
          <span style={{ fontSize: 14, color: "#f472b6", filter: "drop-shadow(0 0 4px rgba(244,114,182,0.6))" }}>🐱</span>
        </div>
        <div className="mini-nft-bar-wrap"><div className="mini-nft-bar" /></div>
        <div className="mini-nft-label">✦ SSR</div>
      </div>
    </div>
  );
}

// ─── Rarity data ─────────────────────────────────────────────────────────────
const RARITIES = [
  { key:"common",  label:"Common",      emoji:"", chance:"40%", barW:"40%", img:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR_T-t1f46JJ1OEmztkG7cjFe-QB9mUV5Wfig&s",  recycle:"0.01" },
  { key:"rare",    label:"Rare",        emoji:"", chance:"30%", barW:"30%", img:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTcSlCQ7h5F1OG5VGDLBY8UHU4mZETZhwFUwg&s", recycle:"0.03" },
  { key:"sr",      label:"Super Rare",  emoji:"", chance:"15%", barW:"15%", img:"https://i.pinimg.com/236x/ee/3b/ae/ee3bae29f332b0cd8ab0b6dc84c7b2ea.jpg",                        recycle:"0.05" },
  { key:"ssr",     label:"💫 SSR",      emoji:"", chance:"9%",  barW:"9%",  img:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRaB_-Dl2XjgXajEn_kdAHB2iFSDRm1cM-_rQ&s",  recycle:"0.08" },
  { key:"ur",      label:"⚡ Ultra Rare",emoji:"",chance:"5%",  barW:"5%",  img:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1_WgzH_i2AMY0-3F88wo6IHxgwTx0v6Mkzw&s",  recycle:"0.15" },
  { key:"legend",  label:"★ Legend",   emoji:"", chance:"1%",  barW:"1%",  img:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSPKSQUAUsjgz4CDWa2oT1CK7ymSXcwqvnijQ&s", recycle:"0.50" },
];

// ─── Rarity Card ─────────────────────────────────────────────────────────────
function RarityCard({ r }: { r: typeof RARITIES[0] }) {
  const delays: Record<string,string> = { common:"0ms", rare:"100ms", sr:"200ms", ssr:"300ms", ur:"400ms", legend:"500ms" };

  const cardContent = (
    <div className={`nft-card nft-card-${r.key} p-4 h-full flex flex-col`} style={{ position:"relative", zIndex:1 }}>
      {/* SSR/UR/Legend specific bg layers */}
      {r.key === "ssr" && <><div className="ssr-stars" /><div className="ssr-shine" /><span className="ssr-corner tl">✦</span><span className="ssr-corner tr">✦</span></>}
      {r.key === "ur"  && <><div className="ur-stars"  /><div className="ur-shimmer" /><span className="ur-corner tl">✦</span><span className="ur-corner tr">✦</span></>}
      {r.key === "legend" && <><div className="legend-hologram" /><div className="legend-hologram2" /><div className="legend-stars" /><div className="legend-stars-twinkle" /><span className="lgd-corner tl">✦</span><span className="lgd-corner tr">✦</span><span className="lgd-corner bl">✦</span><span className="lgd-corner br">✦</span></>}

      {/* Badge */}
      <div className="card-badge" style={{ position:"relative", zIndex:2 }}>
        {r.key === "legend" ? <span className="legend-badge-text">{r.label}</span> : r.label}
      </div>

      {/* Accent bar */}
      <div className="card-border-accent" style={{ position:"relative", zIndex:2 }} />

      {/* Art */}
      <div className="card-art" style={{ position:"relative", zIndex:2 }}>
        {r.key === "legend" && <div className="legend-art-prism" />}
        <div className="card-art-shimmer" />
        <img src={r.img} alt={r.label} style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:10, display:"block", position:"relative", zIndex:2 }} />
      </div>

      {/* ID */}
      <div className="card-id" style={{ position:"relative", zIndex:2 }}>
        GYATE-{r.key.toUpperCase()} #???
      </div>

      {/* Percent + chance */}
      <div className="flex justify-between items-end" style={{ position:"relative", zIndex:2 }}>
        <span className="card-percent">{r.chance}</span>
        <span style={{ fontSize:9, color: r.key==="ur" ? "rgba(251,191,36,0.5)" : r.key==="ssr" ? "rgba(232,121,249,0.5)" : r.key==="legend" ? "rgba(255,255,255,0.4)" : "#94a3b8" }}>Chance</span>
      </div>

      {/* Bar */}
      <div className="card-prob-bar" style={{ position:"relative", zIndex:2 }}>
        <div className="card-prob-fill" style={{ width: r.barW }} />
      </div>

      {/* SSR animated tag */}
      {r.key === "ssr" && <div className="ssr-animated-tag">✦ ANIMATED VARIANT</div>}
      {r.key === "ur"  && <div style={{ fontSize:8, color:"rgba(251,191,36,0.45)", textAlign:"center", position:"relative", zIndex:2, marginTop:2, letterSpacing:"0.05em" }}>SEQUENTIAL ID TRACKED</div>}
      {r.key === "legend" && <div style={{ fontSize:7, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", textAlign:"center", position:"relative", zIndex:2, marginTop:2, background:"linear-gradient(90deg,#ff9de2,#9bf6ff,#bdb2ff,#ff9de2)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>✦ HOLOGRAPHIC EDITION</div>}

      {/* Recycle */}
      <div className="card-recycle" style={{ position:"relative", zIndex:2 }}>
        ↻ Recycle: {r.recycle} SUI
      </div>
    </div>
  );

  if (r.key === "ssr") return (
    <div className="scroll-hidden" style={{ transitionDelay: delays[r.key], position:"relative", borderRadius:22 }}>
      <div className="ssr-border" />
      {cardContent}
    </div>
  );
  if (r.key === "ur") return (
    <div className="scroll-hidden" style={{ transitionDelay: delays[r.key], position:"relative", borderRadius:22 }}>
      <div className="ur-glow" />
      {cardContent}
    </div>
  );
  if (r.key === "legend") return (
    <div className="scroll-hidden" style={{ transitionDelay: delays[r.key], position:"relative" }}>
      <div className="legend-halo" />
      <div className="legend-rainbow-border" />
      <div style={{ position:"relative", zIndex:2, borderRadius:20, background:"linear-gradient(145deg,#0d0d0d,#1a1a2e)", overflow:"hidden" }}>
        {cardContent}
      </div>
    </div>
  );

  return (
    <div className="scroll-hidden" style={{ transitionDelay: delays[r.key] }}>
      {cardContent}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const suiClient = useSuiClient();
  const [stats, setStats] = useState<GlobalStats>({ totalMinted:"0", totalRevenue:"0", totalOpened:"0", activeCount:0 });
  const [boxes, setBoxes] = useState<ActiveBox[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("scroll-visible"); observer.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );
    const timer = setTimeout(() => {
      document.querySelectorAll(".scroll-hidden").forEach(el => observer.observe(el));
    }, 100);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [isLoading]);

  // Parallax
  useEffect(() => {
    if (window.innerWidth < 768) return;
    let lerpX = 0, lerpY = 0, mouseX = 0, mouseY = 0;
    const onMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    document.addEventListener("mousemove", onMove);
    let rafId: number;
    const tick = () => {
      lerpX += (mouseX - lerpX) * 0.08;
      lerpY += (mouseY - lerpY) * 0.08;
      document.querySelectorAll<HTMLElement>(".parallax-layer").forEach(layer => {
        const d = parseFloat(layer.dataset.depth || "0");
        layer.style.transform = `translate3d(${lerpX * d * 100}px,${lerpY * d * 100}px,0)`;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => { document.removeEventListener("mousemove", onMove); cancelAnimationFrame(rafId); };
  }, []);

  // Scroll progress bar
  useEffect(() => {
    const onScroll = () => {
      const winScroll = document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const bar = document.getElementById("scroll-progress");
      if (bar) bar.style.width = (winScroll / height) * 100 + "%";
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Data fetch
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const obj = await suiClient.getObject({ id: LOOTBOX_REGISTRY, options: { showContent: true } });
      const fields = (obj.data?.content as any)?.fields;
      if (fields) {
        const s = fields.stats?.fields;
        setStats({ totalMinted: s?.total_nfts_minted || "0", totalRevenue: s?.total_revenue || "0", totalOpened: s?.total_opened || "0", activeCount: fields.active_ids?.length || 0 });
        const ids = fields.active_ids || [];
        if (ids.length > 0) {
          const data = await suiClient.multiGetObjects({ ids: ids.slice(0,3), options: { showContent: true } });
          setBoxes(data.map((o: any) => {
            const b = o.data?.content?.fields;
            return { id: o.data?.objectId, name: b?.name || "Premium Crate", price: b?.price || "0", currency: "SUI" };
          }));
        }
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, [suiClient]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />

      <div className="gyate-root relative">
        <div className="paper-texture" />

        {/* Parallax background */}
        <div id="parallax-container" className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="parallax-layer" data-depth="0.02">
            <div className="absolute top-20 left-10 w-64 h-64 bg-[#B8EEFF] rounded-full mix-blend-multiply filter blur-3xl opacity-60" />
            <div className="absolute top-1/2 right-20 w-96 h-96 bg-[#FFB8D9] rounded-full mix-blend-multiply filter blur-3xl opacity-50" />
            <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-[#FFF5B8] rounded-full mix-blend-multiply filter blur-3xl opacity-60" />
          </div>
          <div className="parallax-layer" data-depth="0.05">
            <div className="absolute top-1/4 right-1/4 text-yellow-400 opacity-80" style={{ animation:"wobble 2s ease-in-out infinite alternate" }}>⭐</div>
            <div className="absolute bottom-1/3 left-20 text-pink-400 opacity-70" style={{ animation:"float 4s ease-in-out infinite", animationDelay:"1s" }}>✦</div>
            <div className="absolute top-32 left-1/2 text-blue-400 opacity-60" style={{ animation:"float 6s ease-in-out infinite" }}>✧</div>
          </div>
        </div>

        <Navigation />

        {/* Scroll progress bar */}
        <div className="fixed top-0 left-0 z-50 h-1 bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300 transition-all duration-100" id="scroll-progress" style={{ width:0 }} />

        {/* ── HERO ── */}
        <main className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden z-10">
          <div className="max-w-7xl mx-auto px-4 md:px-6 grid md:grid-cols-2 gap-12 items-center">

            {/* Left: Text */}
            <div className="relative z-10 space-y-6 md:space-y-8 scroll-hidden">
              <div className="inline-block bg-yellow-100 border border-slate-800 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-[2px_2px_0px_#1a1a1a]">
                v1.0.0 Live on Sui Mainnet
              </div>

              <h1 className="font-hand text-6xl md:text-8xl font-bold leading-[0.9] tracking-tighter drop-shadow-sm">
                Open Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 relative">
                  Fate '
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-purple-300 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="3" fill="none" />
                  </svg>
                </span>{" "}✦
              </h1>

              <p className="text-lg md:text-xl text-slate-600 font-light max-w-md leading-relaxed">
                Randomized GyateGyate NFTs on the Sui Blockchain. Six rarity tiers, fully on-chain verifiable randomness, and a pity system that guarantees your luck.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Button asChild size="lg" className="bg-slate-900 text-white px-8 h-14 rounded-2xl font-bold text-base border-2 border-slate-900 shadow-[4px_4px_0px_#C9B8FF] hover:-translate-y-1 hover:shadow-[6px_6px_0px_#C9B8FF] transition-all">
                  <Link href="/shop" className="flex items-center gap-3">
                    Open a Lootbox <span>→</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="h-14 px-6 rounded-2xl font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2">
                  <Link href="/marketplace">View Marketplace</Link>
                </Button>
              </div>

              {/* Live stats */}
              <div className="flex flex-wrap gap-6 pt-6 border-t-2 border-slate-100">
                {[
                  { label:"Minted NFTs",   value: stats.totalMinted },
                  { label:"Total Summons", value: stats.totalOpened },
                  { label:"SUI Volume",    value: isLoading ? "—" : (Number(stats.totalRevenue)/1e9).toFixed(1) },
                  { label:"Active Boxes",  value: isLoading ? "—" : String(stats.activeCount) },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="font-hand font-bold text-2xl">
                      {isLoading ? <RefreshCw className="w-5 h-5 animate-spin inline-block text-purple-400" /> : s.value}
                    </div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />10% Marketplace Fee</div>
                <div className="flex items-center gap-1"><span>🔒</span>Kiosk-Enforced Royalties</div>
              </div>
            </div>

            {/* Right: 3D Box + floating cards */}
            <div className="relative flex items-center justify-center scroll-hidden" style={{ transitionDelay:"200ms", height:420 }}>
              {/* SSR floating card */}
              <div className="absolute top-0 right-10 w-24 h-32 rounded-xl overflow-hidden" style={{ animation:"float 4s ease-in-out infinite", background:"linear-gradient(145deg,#fdf2f8,#fce7f3)", border:"2px solid #f472b6", boxShadow:"0 4px 20px rgba(244,114,182,0.45)", opacity:0.9 }}>
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.5) 50%,transparent 65%)", backgroundSize:"200% 200%", animation:"rareShimmer 2.5s ease-in-out infinite", zIndex:3 }} />
                <div style={{ position:"absolute", top:5, left:5, right:5, background:"linear-gradient(135deg,#db2777,#be185d)", borderRadius:5, padding:"2px 0", textAlign:"center", fontFamily:"sans-serif", fontSize:6, fontWeight:800, color:"white", letterSpacing:"0.08em", textTransform:"uppercase", zIndex:4 }}>SSR</div>
                <div style={{ position:"absolute", top:22, left:5, right:5, height:2, background:"linear-gradient(90deg,#f9a8d4,#db2777,#f9a8d4)", borderRadius:99, zIndex:4 }} />
                <img src="https://copper-efficient-felidae-814.mypinata.cloud/ipfs/bafkreif7323zptn3vw4yjettkzdloakqwd5jhdysmf2yiqtltkm3sk5ove" alt="" style={{ position:"absolute", top:27, left:5, width:"calc(100% - 10px)", height:62, objectFit:"cover", borderRadius:7, border:"1.5px solid rgba(244,114,182,0.4)", zIndex:2 }} />
                <div style={{ position:"absolute", bottom:5, left:0, right:0, textAlign:"center", fontSize:11, fontWeight:700, color:"#db2777", zIndex:4 }}>✦ SSR</div>
              </div>

              {/* Legend floating card */}
              <div className="absolute bottom-10 left-10 w-24 h-32 rounded-xl" style={{ animation:"float 5s ease-in-out infinite", animationDelay:"0.5s", opacity:0.92, overflow:"visible", position:"absolute" }}>
                <div style={{ position:"absolute", inset:-2, borderRadius:16, background:"linear-gradient(135deg,#ff9de2,#ffd6a5,#caffbf,#9bf6ff,#a0c4ff,#bdb2ff,#ff9de2)", backgroundSize:"400% 400%", animation:"holographic 2s ease infinite", zIndex:0 }} />
                <div style={{ position:"absolute", inset:2, borderRadius:12, background:"linear-gradient(145deg,#0d0d0d,#1a1a2e)", overflow:"hidden", zIndex:1 }}>
                  <div style={{ position:"absolute", inset:0, background:"linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.12) 50%,transparent 70%)", backgroundSize:"300% 300%", animation:"lgdHoloSweep 2s ease-in-out infinite", zIndex:3, pointerEvents:"none", borderRadius:12 }} />
                  <div style={{ position:"absolute", top:5, left:5, right:5, background:"linear-gradient(135deg,#ff9de2,#bdb2ff)", borderRadius:5, padding:"2px 0", textAlign:"center", fontFamily:"sans-serif", fontSize:6, fontWeight:900, color:"#0d0d0d", letterSpacing:"0.08em", textTransform:"uppercase", zIndex:5 }}>★ Legend</div>
                  <div style={{ position:"absolute", top:22, left:5, right:5, height:2, background:"linear-gradient(90deg,#ff9de2,#bdb2ff,#9bf6ff)", backgroundSize:"400% 100%", animation:"holographic 2s linear infinite", borderRadius:99, zIndex:5 }} />
                  <img src="https://copper-efficient-felidae-814.mypinata.cloud/ipfs/bafkreiarommzmxprjpmfduuotcuqdj3kealzqh4ta62z6w7kpm5nbilave" alt="" style={{ position:"absolute", top:27, left:5, width:"calc(100% - 10px)", height:62, objectFit:"cover", borderRadius:7, border:"1.5px solid rgba(255,157,226,0.4)", zIndex:4 }} />
                  <div style={{ position:"absolute", bottom:5, left:0, right:0, textAlign:"center", fontSize:11, fontWeight:700, background:"linear-gradient(135deg,#ff9de2,#bdb2ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", zIndex:5 }}>✦ Legend</div>
                </div>
              </div>

              <LootboxHero />
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-60">
            <span className="font-hand text-sm text-slate-500">scroll to discover</span>
            <div className="w-[1px] h-8 bg-gradient-to-b from-slate-300 to-transparent" />
          </div>
        </main>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="py-20 relative z-10">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className="text-center mb-16 scroll-hidden">
              <h2 className="font-hand text-4xl md:text-5xl font-bold mb-4 relative inline-block">
                How It Works
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-green-300 opacity-60" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 15 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Step 1: Buy a Box */}
              <div className="group scroll-hidden" data-stagger="1">
                <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm group-hover:shadow-[8px_8px_0px_#B8FFE8] group-hover:-translate-y-2 group-hover:border-slate-800 transition-all duration-300 text-center relative overflow-hidden">
                  <div className="w-16 h-16 mx-auto bg-green-50 rounded-2xl flex items-center justify-center mb-6 relative">
                    <MiniBuyBox />
                  </div>
                  <h3 className="font-hand text-2xl font-bold mb-2">Buy a Box</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Pay in SUI. Your payment goes directly to the TreasuryPool via the smart contract — no middlemen.</p>
                  <div className="absolute -top-6 -right-6 w-12 h-12 bg-[#B8FFE8] rounded-full opacity-20" />
                </div>
              </div>

              {/* Step 2: Random Roll */}
              <div className="group scroll-hidden" data-stagger="2" style={{ transitionDelay:"100ms" }}>
                <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm group-hover:shadow-[8px_8px_0px_#FFF5B8] group-hover:-translate-y-2 group-hover:border-slate-800 transition-all duration-300 text-center relative overflow-hidden">
                  <div className="w-16 h-16 mx-auto bg-yellow-50 rounded-2xl flex items-center justify-center mb-6 relative">
                    <MiniSpinBox />
                  </div>
                  <h3 className="font-hand text-2xl font-bold mb-2">Random Roll</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Sui's native on-chain Random module rolls your rarity tier and variant. No server-side RNG — results are provable.</p>
                  <div className="absolute -top-6 -right-6 w-12 h-12 bg-yellow-200 rounded-full opacity-20" />
                </div>
              </div>

              {/* Step 3: Get Your NFT */}
              <div className="group scroll-hidden" data-stagger="3" style={{ transitionDelay:"200ms" }}>
                <div className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm group-hover:shadow-[8px_8px_0px_#FFB8D9] group-hover:-translate-y-2 group-hover:border-slate-800 transition-all duration-300 text-center relative overflow-hidden">
                  <div className="w-16 h-16 mx-auto bg-pink-50 rounded-2xl flex items-center justify-center mb-6 relative overflow-visible">
                    <MiniNftCard />
                  </div>
                  <h3 className="font-hand text-2xl font-bold mb-2">Get Your NFT</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">Your GyateNFT is minted straight into your Kiosk. List it on the marketplace, trade it, or hold for future game rewards.</p>
                  <div className="absolute -top-6 -right-6 w-12 h-12 bg-pink-200 rounded-full opacity-20" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── RARITY TIERS ── */}
        <section id="rarities" className="py-20 bg-white/50 relative z-10">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="text-center mb-14 scroll-hidden">
              <h2 className="font-hand text-4xl md:text-5xl font-bold mb-3">Six Tiers of Destiny</h2>
              <p className="text-slate-500 font-hand text-xl">Fair probability distribution</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {RARITIES.map(r => <RarityCard key={r.key} r={r} />)}
            </div>
          </div>
        </section>

        {/* ── PITY COMPARISON ── */}
        <section className="py-20 relative z-10">
          <div className="max-w-4xl mx-auto px-4 md:px-6">
            <div className="doodle-border p-8 md:p-12 relative bg-white scroll-hidden" style={{ background:"white" }}>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-300 border-2 border-slate-800 px-6 py-2 rounded-full font-bold shadow-[2px_2px_0px_#1a1a1a] whitespace-nowrap font-hand text-lg">
                Open With or Without Pity
              </div>
              <div className="grid md:grid-cols-2 gap-12 mt-4">
                <div className="text-center opacity-60 hover:opacity-100 transition-opacity">
                  <h3 className="font-hand text-3xl font-bold mb-4 text-slate-400">Standard Open</h3>
                  <ul className="space-y-3 text-sm text-slate-500 mb-6">
                    {["No pity counter tracking","Pure RNG every roll","No guaranteed escalation"].map(t => (
                      <li key={t} className="flex items-center justify-center gap-2"><span className="text-red-400">✕</span>{t}</li>
                    ))}
                  </ul>
                  <button className="w-full border-2 border-slate-800 text-slate-700 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">Open Without Pity</button>
                </div>
                <div className="text-center relative">
                  <div className="absolute -right-4 -top-4 text-yellow-500 text-2xl">⭐</div>
                  <h3 className="font-hand text-3xl font-bold mb-4 text-purple-600">Pity Open ✦</h3>
                  <ul className="space-y-3 text-sm text-slate-600 mb-6 font-semibold">
                    {["Pity counter tracks your pulls","Guaranteed UR/SR/Rare at thresholds","Non-transferable — tied to your wallet"].map(t => (
                      <li key={t} className="flex items-center justify-center gap-2"><span className="text-green-500">✓</span>{t}</li>
                    ))}
                  </ul>
                  <Button asChild className="w-full bg-slate-800 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-700 transition-colors h-auto">
                    <Link href="/shop">Open a GyateBox ✦</Link>
                  </Button>
                </div>
              </div>
              <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4/5 w-[2px] bg-slate-100" />
            </div>
          </div>
        </section>

        {/* ── AVAILABLE BOXES (live from chain) ── */}
        <section id="marketplace" className="py-20 bg-slate-50 relative z-10 border-t-2 border-slate-100 border-dashed">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="flex justify-between items-end mb-10 scroll-hidden">
              <div>
                <h2 className="font-hand text-4xl font-bold mb-1">Available Boxes</h2>
                <p className="text-sm text-slate-500">Kiosk-enforced royalties · 10% fee on every trade</p>
              </div>
              <Button variant="link" asChild className="text-purple-600 font-bold">
                <Link href="/shop" className="flex items-center gap-1">View all <ChevronRight className="w-4 h-4" /></Link>
              </Button>
            </div>

            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3].map(i => (
                  <div key={i} className="h-48 rounded-2xl border-2 border-slate-100 bg-white animate-pulse flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
                  </div>
                ))}
              </div>
            ) : boxes.length === 0 ? (
              <div className="py-20 text-center rounded-3xl border-2 border-dashed border-slate-200">
                <Store className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-400 font-hand text-xl">No active lootboxes found in protocol.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {boxes.map((box, i) => (
                  <div key={box.id} className="bg-white p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-800 hover:shadow-[6px_6px_0px_#C9B8FF] transition-all group scroll-hidden" style={{ transitionDelay:`${i*100}ms` }}>
                    <div className="aspect-video bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
                      <div className="text-6xl group-hover:scale-110 transition-transform duration-300">📦</div>
                      <span className="absolute top-2 left-2 bg-white/80 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold">LIVE</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <h4 className="font-hand font-bold text-xl">{box.name}</h4>
                        <p className="text-xs text-slate-400">On-chain verifiable randomness</p>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Price</div>
                        <div className="font-hand font-bold text-lg">{Number(box.price)/1e9} <span className="text-purple-500">SUI</span></div>
                      </div>
                    </div>
                    <Button asChild className="w-full mt-4 bg-slate-900 text-white border-2 border-slate-900 hover:shadow-[3px_3px_0px_#C9B8FF] transition-all h-auto py-2 rounded-xl font-bold">
                      <Link href="/shop">Buy Now →</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── ROADMAP ── */}
        <section id="roadmap" className="py-20 relative z-10">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <div className="text-center mb-14 scroll-hidden">
              <h2 className="font-hand text-4xl md:text-5xl font-bold mb-3">Roadmap</h2>
              <p className="text-slate-500 font-hand text-xl">Three phases to a full on-chain game ecosystem</p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2" style={{ background:"linear-gradient(to bottom,#b8ffe8,#c9b8ff,#ffb8d9)", opacity:0.4 }} />

              {/* Phase 1 */}
              <div className="scroll-hidden relative flex flex-col md:flex-row items-center gap-8 mb-16">
                <div className="md:w-1/2 md:pr-12 md:text-right">
                  <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1 rounded-full mb-3 text-xs font-bold text-green-600 uppercase tracking-wider">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />Complete
                  </div>
                  <h3 className="font-hand text-3xl font-bold mb-3 text-slate-800">Phase 1 — Backend</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">All four Move modules deployed and tested on Sui. The full smart contract layer is live and mainnet-ready.</p>
                  <ul className="space-y-2 text-sm text-slate-600 md:flex md:flex-col md:items-end">
                    {["nft.move — GyateNFT struct & mint logic","pool.move — TreasuryPool & revenue flows","lootbox.move — Variant system & pity tracker","marketplace.move — Kiosk + 10% enforced fee","Global registry & on-chain stats"].map(item => (
                      <li key={item} className="flex items-center gap-2 md:flex-row-reverse">
                        <span className="text-green-500 flex-shrink-0">✓</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="hidden md:flex w-12 h-12 rounded-full items-center justify-center flex-shrink-0 relative z-10 text-xl" style={{ background:"linear-gradient(135deg,#b8ffe8,#4ade80)", border:"3px solid white", boxShadow:"0 0 20px rgba(74,222,128,0.5)" }}>✓</div>
                <div className="md:w-1/2 md:pl-12">
                  <div className="bg-white rounded-2xl border-2 border-green-100 p-5 shadow-sm" style={{ boxShadow:"6px 6px 0px #b8ffe8" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-500 text-xl">💻</div>
                      <div>
                        <div className="font-bold text-sm text-slate-800">Smart Contract Layer</div>
                        <div className="text-xs text-slate-400">Sui Mainnet-Ready · Move 2024</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[["4 Modules","Deployed"],["6 Rarities","On-chain"],["Pity System","Non-transferable"],["10% Fee","Enforced structurally"]].map(([title,sub]) => (
                        <div key={title} className="bg-green-50 rounded-lg p-2 text-center">
                          <div className="text-xs font-bold text-green-600">{title}</div>
                          <div className="text-[10px] text-slate-400">{sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="scroll-hidden relative flex flex-col md:flex-row-reverse items-center gap-8 mb-16" style={{ transitionDelay:"150ms" }}>
                <div className="md:w-1/2 md:pl-12 md:text-left">
                  <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full mb-3 text-xs font-bold text-purple-600 uppercase tracking-wider">
                    <div className="w-2 h-2 rounded-full bg-purple-400" style={{ animation:"hintPulse 1.5s ease-in-out infinite" }} />In Progress
                  </div>
                  <h3 className="font-hand text-3xl font-bold mb-3 text-slate-800">Phase 2 — Frontend</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">Full Next.js + Tailwind interface with animated lootbox opening, wallet integration, marketplace UI, and admin dashboard.</p>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {["Sui Wallet adapter (Sui Wallet, Phantom, Suiet)","Animated lootbox opening sequence","Collection viewer & marketplace UI","Admin dashboard for lootbox management","Pity counter progress bar per user"].map(item => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="text-purple-400 flex-shrink-0">⏳</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="hidden md:flex w-12 h-12 rounded-full items-center justify-center flex-shrink-0 relative z-10 text-xl font-bold" style={{ background:"linear-gradient(135deg,#e9d5ff,#c084fc)", border:"3px solid white", boxShadow:"0 0 20px rgba(192,132,252,0.5)" }}>2</div>
                <div className="md:w-1/2 md:pr-12">
                  <div className="bg-white rounded-2xl border-2 border-purple-100 p-5 shadow-sm" style={{ boxShadow:"6px 6px 0px #e9d5ff" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500 text-xl">🎨</div>
                      <div>
                        <div className="font-bold text-sm text-slate-800">User Interface</div>
                        <div className="text-xs text-slate-400">Next.js · Tailwind · Sui SDK</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[["Wallet Connect","Multi-provider"],["Box Opening","Animated reveal"],["Marketplace","List & trade"],["Admin Panel","Manage lootboxes"]].map(([title,sub]) => (
                        <div key={title} className="bg-purple-50 rounded-lg p-2 text-center">
                          <div className="text-xs font-bold text-purple-600">{title}</div>
                          <div className="text-[10px] text-slate-400">{sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase 3 */}
              <div className="scroll-hidden relative flex flex-col md:flex-row items-center gap-8" style={{ transitionDelay:"300ms" }}>
                <div className="md:w-1/2 md:pr-12 md:text-right">
                  <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-full mb-3 text-xs font-bold text-yellow-600 uppercase tracking-wider">
                    <span style={{ fontSize:10 }}>⭐</span>Future
                  </div>
                  <h3 className="font-hand text-3xl font-bold mb-3 text-slate-800">Phase 3 — Game Layer</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">GyateNFT metadata is intentionally game-ready. Rarity maps to character tier, variant_multiplier maps to stat bonuses, and each NFT has a unique sequential ID.</p>
                  <ul className="space-y-2 text-sm text-slate-600 md:flex md:flex-col md:items-end">
                    {["Turn-based or idle game using GyateNFTs as characters","Rarity & variant determine base stats & abilities","Seasonal event NFTs unlock limited game content","Potential $GYATE token for staking & governance"].map(item => (
                      <li key={item} className="flex items-center gap-2 md:flex-row-reverse">
                        <span className="text-yellow-400 flex-shrink-0">⭐</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="hidden md:flex w-12 h-12 rounded-full items-center justify-center flex-shrink-0 relative z-10 text-lg" style={{ background:"linear-gradient(135deg,#fff5b8,#fbbf24)", border:"3px solid white", boxShadow:"0 0 20px rgba(251,191,36,0.4)" }}>⭐</div>
                <div className="md:w-1/2 md:pl-12">
                  <div className="bg-white rounded-2xl border-2 border-yellow-100 p-5 shadow-sm" style={{ boxShadow:"6px 6px 0px #fff5b8" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-500 text-xl">🎮</div>
                      <div>
                        <div className="font-bold text-sm text-slate-800">GyateGyate Game</div>
                        <div className="text-xs text-slate-400">NFTs as playable characters</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[["Rarity = Tier","Character power"],["Variant = Stats","Bonus multiplier"],["Seasonal NFTs","Unlock content"],["$GYATE Token","Stake & govern"]].map(([title,sub]) => (
                        <div key={title} className="bg-yellow-50 rounded-lg p-2 text-center">
                          <div className="text-xs font-bold text-yellow-600">{title}</div>
                          <div className="text-[10px] text-slate-400">{sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TEAM ── */}
        <section id="team" className="py-20 relative z-10">
          <div className="max-w-4xl mx-auto px-4 md:px-6">
            <div className="text-center mb-14 scroll-hidden">
              <h2 className="font-hand text-4xl md:text-5xl font-bold mb-3">Meet the Team</h2>
              <p className="text-slate-500 font-hand text-xl">The people building GyateGyate</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              {/* Raven — UR gold style */}
              <div className="scroll-hidden group" style={{ transitionDelay:"0ms" }}>
                <div className="relative rounded-3xl p-6 text-center overflow-hidden transition-all duration-300 group-hover:-translate-y-2" style={{ background:"linear-gradient(145deg,#0a0a14,#0f0f1e)", border:"2px solid rgba(251,191,36,0.2)", boxShadow:"0 4px 24px rgba(251,191,36,0.12)" }}>
                  <div style={{ position:"absolute", inset:0, borderRadius:22, backgroundImage:"radial-gradient(1px 1px at 15% 20%,rgba(251,191,36,0.6) 0%,transparent 100%),radial-gradient(1px 1px at 80% 15%,rgba(255,255,255,0.3) 0%,transparent 100%),radial-gradient(1.5px 1.5px at 50% 65%,rgba(251,191,36,0.5) 0%,transparent 100%),radial-gradient(1px 1px at 90% 70%,rgba(255,255,255,0.2) 0%,transparent 100%),radial-gradient(1px 1px at 25% 85%,rgba(251,191,36,0.4) 0%,transparent 100%)", pointerEvents:"none", zIndex:0 }} />
                  <div style={{ position:"absolute", inset:0, borderRadius:22, background:"linear-gradient(105deg,transparent 30%,rgba(251,191,36,0.06) 50%,transparent 70%)", backgroundSize:"200% 200%", animation:"urShimmer 3s ease-in-out infinite", pointerEvents:"none", zIndex:1 }} />
                  <div style={{ position:"absolute", inset:-2, borderRadius:26, background:"linear-gradient(135deg,#92400e,#fbbf24,#f59e0b,#fde68a,#f59e0b,#fbbf24,#92400e)", backgroundSize:"300% 300%", animation:"urGlowShift 3s ease infinite", zIndex:0, opacity:0.6 }} />
                  <div style={{ position:"relative", zIndex:2 }}>
                    <div className="mx-auto mb-4 flex items-center justify-center text-3xl" style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#92400e,#fbbf24,#f59e0b)", border:"3px solid rgba(251,191,36,0.5)", boxShadow:"0 0 20px rgba(251,191,36,0.4)" }}>💻</div>
                    <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3" style={{ background:"linear-gradient(135deg,#92400e,#78350f)", color:"#fbbf24", border:"1px solid rgba(251,191,36,0.3)", letterSpacing:"0.1em", textShadow:"0 0 6px rgba(251,191,36,0.6)" }}>⚡ Backend Developer</div>
                    <h3 className="font-hand text-2xl font-bold mb-1" style={{ background:"linear-gradient(135deg,#fde68a,#f59e0b,#fbbf24)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Raven Caguioa</h3>
                    <p className="text-sm leading-relaxed mb-4" style={{ color:"rgba(251,191,36,0.5)" }}>Architected all four Move modules — nft, pool, lootbox, and marketplace. Built the pity system, variant engine, and Kiosk enforcement on Sui.</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {["Move 2024","Sui Blockchain","Smart Contracts"].map(tag => (
                        <span key={tag} className="px-2 py-1 rounded-md text-xs font-bold" style={{ background:"rgba(251,191,36,0.1)", color:"rgba(251,191,36,0.7)", border:"1px solid rgba(251,191,36,0.2)" }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Clarence — SSR purple style */}
              <div className="scroll-hidden group" style={{ transitionDelay:"150ms" }}>
                <div className="relative rounded-3xl p-6 text-center overflow-hidden transition-all duration-300 group-hover:-translate-y-2" style={{ background:"linear-gradient(145deg,#1a0524,#2d0a3e,#1a0524)", border:"2px solid rgba(232,121,249,0.2)", boxShadow:"0 4px 24px rgba(192,38,211,0.15)" }}>
                  <div style={{ position:"absolute", inset:0, borderRadius:22, backgroundImage:"radial-gradient(1px 1px at 10% 15%,rgba(232,121,249,0.7) 0%,transparent 100%),radial-gradient(1px 1px at 85% 10%,rgba(255,255,255,0.3) 0%,transparent 100%),radial-gradient(1.5px 1.5px at 45% 65%,rgba(232,121,249,0.6) 0%,transparent 100%),radial-gradient(1px 1px at 90% 72%,rgba(168,85,247,0.5) 0%,transparent 100%),radial-gradient(1px 1px at 20% 88%,rgba(232,121,249,0.4) 0%,transparent 100%)", pointerEvents:"none", zIndex:0 }} />
                  <div style={{ position:"absolute", inset:0, borderRadius:22, background:"linear-gradient(105deg,transparent 30%,rgba(232,121,249,0.07) 50%,transparent 70%)", backgroundSize:"200% 200%", animation:"ssrShimmer 2.5s ease-in-out infinite", pointerEvents:"none", zIndex:1 }} />
                  <div style={{ position:"absolute", inset:-2, borderRadius:26, background:"linear-gradient(135deg,#7e22ce,#e879f9,#a855f7,#ec4899,#7e22ce)", backgroundSize:"400% 400%", animation:"ssrBorderShift 3s ease infinite", zIndex:0, opacity:0.6 }} />
                  <div style={{ position:"relative", zIndex:2 }}>
                    <div className="mx-auto mb-4 flex items-center justify-center text-3xl" style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#7e22ce,#a855f7,#e879f9)", border:"3px solid rgba(232,121,249,0.4)", boxShadow:"0 0 20px rgba(232,121,249,0.4)" }}>🎨</div>
                    <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3" style={{ background:"linear-gradient(135deg,#7e22ce,#a21caf)", color:"#f0abfc", border:"1px solid rgba(232,121,249,0.3)", letterSpacing:"0.1em", textShadow:"0 0 6px rgba(232,121,249,0.6)" }}>💫 Frontend Developer</div>
                    <h3 className="font-hand text-2xl font-bold mb-1" style={{ background:"linear-gradient(135deg,#f0abfc,#e879f9,#a855f7)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Clarence Vince Razo</h3>
                    <p className="text-sm leading-relaxed mb-4" style={{ color:"rgba(232,121,249,0.5)" }}>Crafting the full user experience — animated lootbox reveals, wallet integration, marketplace UI, and the admin dashboard for GyateGyate.</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {["Next.js","Tailwind CSS","Sui SDK"].map(tag => (
                        <span key={tag} className="px-2 py-1 rounded-md text-xs font-bold" style={{ background:"rgba(232,121,249,0.1)", color:"rgba(232,121,249,0.7)", border:"1px solid rgba(232,121,249,0.2)" }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="py-16 relative z-10">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:"Status",       value: isLoading ? "…" : "Live" },
                { label:"Rarity Tiers", value: "6 Tiers" },
                { label:"Randomness",   value: "On-Chain" },
                { label:"Pity System",  value: "Pity ✦" },
              ].map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border-2 border-slate-100 text-center scroll-hidden" style={{ transitionDelay:`${i*100}ms` }}>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{s.label}</p>
                  <h3 className="font-hand text-3xl font-bold text-slate-800">{s.value}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="relative z-10 pt-20 pb-10 overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 mb-20 text-center scroll-hidden">
            <h2 className="font-hand text-5xl md:text-7xl font-bold mb-6 text-slate-800">Ready to open your fate?</h2>
            <div className="flex flex-col md:flex-row justify-center gap-4">
              <Button asChild size="lg" className="bg-black text-white px-8 py-3 rounded-xl font-bold border-2 border-black hover:bg-slate-800 transition-all hover:scale-105 h-auto">
                <Link href="/shop">Connect Wallet</Link>
              </Button>
              <button className="bg-white text-black px-8 py-3 rounded-xl font-bold border-2 border-slate-200 hover:border-black transition-all">
                Read Docs
              </button>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 md:px-6 border-t-2 border-slate-100 pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl text-slate-400">📦</span>
              <span className="font-hand font-bold text-xl text-slate-600">GyateGyate</span>
            </div>
            <div className="flex gap-6 text-sm text-slate-500 font-semibold">
              {["Twitter","Discord","Docs"].map(l => <a key={l} href="#" className="hover:text-black transition-colors">{l}</a>)}
            </div>
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Built on Sui</span>
            </div>
          </div>

          {/* Bottom wave */}
          <div className="absolute bottom-0 left-0 w-full h-2 opacity-50" style={{ backgroundImage:"url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMCIgdmlld0JveD0iMCAwIDIwIDEwIiBmaWxsPSJub25lIiBzdHJva2U9IiNlMmU4ZjAiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTAgMTBRNSAwIDEwIDEwVDEwIDEwVDIwIDEwIiAvPjwvc3ZnPg==\")" }} />
        </footer>
      </div>
    </>
  );
}