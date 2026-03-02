"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NFTCard } from "./nft-card";
import { NFT } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface RevealLootboxDialogProps {
  box: any;
  results: NFT[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Rarity config ─────────────────────────────────────────────────────────
const RARITY_COLORS = [
  { glow:"rgba(148,163,184,0.35)", accent:"#94a3b8", border:"#cbd5e1", shadow:"#e2e8f0" },
  { glow:"rgba(96,165,250,0.35)",  accent:"#60a5fa", border:"#93c5fd", shadow:"#dbeafe" },
  { glow:"rgba(168,85,247,0.40)",  accent:"#a855f7", border:"#c084fc", shadow:"#ede9fe" },
  { glow:"rgba(232,121,249,0.42)", accent:"#e879f9", border:"#f0abfc", shadow:"#fdf4ff" },
  { glow:"rgba(251,191,36,0.45)",  accent:"#f59e0b", border:"#fcd34d", shadow:"#fef9c3" },
  { glow:"rgba(244,114,182,0.50)", accent:"#f472b6", border:"#f9a8d4", shadow:"#fce7f3" },
];

// ─── Confetti ───────────────────────────────────────────────────────────────
function spawnConfetti(el: HTMLElement, accent: string) {
  const pal = [accent,"#c9b8ff","#ffb8d9","#b8ffe8","#fff5b8","#ffd6e7","#d4f5e9"];
  for (let i = 0; i < 80; i++) {
    const d = document.createElement("div");
    const a = Math.random() * 360;
    const r = 90 + Math.random() * 210;
    d.style.cssText = `
      position:absolute;left:50%;top:50%;
      width:${4+Math.random()*8}px;height:${4+Math.random()*8}px;
      margin:-4px 0 0 -4px;
      background:${pal[Math.floor(Math.random()*pal.length)]};
      border-radius:${Math.random()>.5?"50%":"3px"};
      pointer-events:none;opacity:0;
      animation:rlbConf ${0.7+Math.random()*0.9}s ease ${Math.random()*0.45}s forwards;
      --cx:${Math.cos(a*Math.PI/180)*r}px;
      --cy:${Math.sin(a*Math.PI/180)*r-60}px;
      --cr:${Math.random()*720-360}deg;
    `;
    el.appendChild(d);
    d.addEventListener("animationend",()=>d.remove(),{once:true});
  }
}

// ─── CSS ────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@400;600;700;800;900&display=swap');

  @keyframes rlbConf       { 0%{opacity:1;transform:translate(0,0) rotate(0) scale(1)} 80%{opacity:.9} 100%{opacity:0;transform:translate(var(--cx),var(--cy)) rotate(var(--cr)) scale(.3)} }
  @keyframes rlbFloat      { 0%,100%{transform:rotateX(-22deg) rotateY(-38deg) translateY(0)} 50%{transform:rotateX(-22deg) rotateY(-38deg) translateY(-14px)} }
  @keyframes rlbShake      { 0%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(0,0,0)} 20%,80%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(-8px,0,0)} 40%,60%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(10px,0,0)} 100%{transform:rotateX(-22deg) rotateY(-38deg) translate3d(0,0,0)} }
  @keyframes rlbShadow     { 0%,100%{transform:translateX(-50%) scaleX(1);opacity:.45} 50%{transform:translateX(-50%) scaleX(.68);opacity:.18} }
  @keyframes rlbAura       { 0%,100%{transform:scale(.82);opacity:.3} 50%{transform:scale(1.22);opacity:.6} }
  @keyframes rlbSparkFly   { 0%{opacity:1;transform:translate(-50%,-50%) scale(.4) rotate(0)} 60%{opacity:1} 100%{opacity:0;transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(1.5) rotate(220deg)} }
  @keyframes rlbBurst      { 0%{opacity:.7;transform:translate(-50%,-50%) scale(.2)} 100%{opacity:0;transform:translate(-50%,-50%) scale(3.5)} }
  @keyframes rlbOrbit      { 0%{transform:rotate(0deg) translateX(108px) rotate(0deg)} 100%{transform:rotate(360deg) translateX(108px) rotate(-360deg)} }
  @keyframes rlbPulse      { 0%,100%{opacity:.65} 50%{opacity:1} }
  @keyframes rlbHint       { 0%,100%{opacity:.5;transform:translateY(0)} 50%{opacity:1;transform:translateY(-3px)} }
  @keyframes rlbParticle   { 0%{transform:translateY(110%) rotate(0);opacity:0} 10%{opacity:.7} 90%{opacity:.4} 100%{transform:translateY(-10%) rotate(540deg);opacity:0} }
  @keyframes rlbCardIn     { 0%{opacity:0;transform:translateY(28px) scale(.9) rotate(-3deg)} 100%{opacity:1;transform:translateY(0) scale(1) rotate(0)} }
  @keyframes rlbCardPop    { 0%{transform:scale(1)} 45%{transform:scale(1.07)} 75%{transform:scale(.98)} 100%{transform:scale(1)} }
  @keyframes rlbTitleIn    { 0%{opacity:0;transform:translateY(-14px)} 100%{opacity:1;transform:translateY(0)} }
  @keyframes rlbHolo       { 0%,100%{background-position:-200% 0;opacity:.35} 50%{background-position:200% 0;opacity:.85} }
  @keyframes rlbShimmer    { 0%{background-position:-300% 0} 100%{background-position:300% 0} }
  @keyframes rlbGlowBorder { 0%,100%{box-shadow:0 0 0 0 var(--gc,rgba(201,184,255,.3))} 50%{box-shadow:0 0 0 5px var(--gc,rgba(201,184,255,.3))} }

  /* ── Dialog wrapper: pastel paper ── */
  .rlb-wrap {
    background: linear-gradient(150deg, #fefbff 0%, #fff8fd 40%, #f8f4ff 100%) !important;
    border: 2px solid rgba(201,184,255,0.45) !important;
    border-radius: 28px !important;
    overflow: hidden !important;
    padding: 0 !important;
    max-width: min(95vw, 800px) !important;
    box-shadow:
      0 0 0 1px rgba(255,255,255,.9),
      0 20px 70px rgba(201,184,255,.28),
      0 6px 24px rgba(0,0,0,.06) !important;
  }
  /* Subtle paper grain */
  .rlb-wrap::after {
    content:''; position:absolute; inset:0; z-index:0; pointer-events:none;
    opacity:.18;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");
  }

  /* ── Stage: flex column, text always below box ── */
  .rlb-stage {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* No justify-content:center — let natural flow stack box then text */
    padding: 44px 32px 40px;
    font-family: 'Nunito', sans-serif;
    overflow: hidden;
    gap: 0;
  }

  /* background blobs */
  .rlb-blob {
    position:absolute; border-radius:50%;
    filter:blur(55px); pointer-events:none;
    mix-blend-mode:multiply;
  }
  /* floating particle dots */
  .rlb-pdot {
    position:absolute; border-radius:50%; pointer-events:none;
    animation:rlbParticle linear infinite; opacity:0;
  }

  /* ── Aura: centered behind the box ── */
  .rlb-aura {
    position:absolute;
    left:50%; top:44px;   /* aligns with box top */
    width:320px; height:320px;
    margin-left:-160px;
    border-radius:50%;
    filter:blur(60px);
    pointer-events:none; z-index:0;
    animation:rlbAura 2.4s ease-in-out infinite;
  }

  /* orbit dots — centered the same way */
  .rlb-orbit {
    position:absolute;
    left:50%; top:44px;
    width:10px; height:10px;
    margin-left:-5px; margin-top:125px; /* mid of 260px scene */
    border-radius:50%; pointer-events:none; z-index:2;
  }

  /* ── 3D Scene ── */
  .rlb-scene {
    perspective:800px; perspective-origin:50% 35%;
    width:260px; height:260px;
    position:relative; z-index:3;
    flex-shrink:0;
    /* Do NOT use position:absolute — let it sit in normal flow */
  }
  .rlb-box {
    position:absolute; width:200px; height:200px;
    top:50px; left:30px;
    transform-style:preserve-3d;
    transform:rotateX(-22deg) rotateY(-38deg);
    animation:rlbFloat 5s ease-in-out infinite;
    cursor:pointer; will-change:transform;
  }
  .rlb-box.shaking { animation:rlbShake .5s cubic-bezier(.36,.07,.19,.97) both !important; }
  .rlb-box.opened .rlb-lid { transform:translateY(-200px) translateX(290px) !important; }

  .rlb-body-g { position:absolute; inset:0; transform-style:preserve-3d; }
  .rlb-face { position:absolute; width:200px; height:200px; border:3px solid #1a1a1a; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .rlb-ff { transform:rotateY(0deg)   translateZ(100px); background:linear-gradient(160deg,#fffde8,#fff5b8); }
  .rlb-fb { transform:rotateY(180deg) translateZ(100px); background:linear-gradient(160deg,#d0edff,#b8eeff); }
  .rlb-fr { transform:rotateY(90deg)  translateZ(100px); background:linear-gradient(160deg,#ffe0ef,#ffb8d9); }
  .rlb-fl { transform:rotateY(-90deg) translateZ(100px); background:linear-gradient(160deg,#d8fff0,#b8ffe8); }
  .rlb-fd { transform:rotateX(-90deg) translateZ(100px); background:linear-gradient(160deg,#fff5cc,#fffae0); }

  .rlb-lid { position:absolute; top:0; left:0; width:200px; height:200px; transform-style:preserve-3d; transform:translateY(-200px); transform-origin:50% 100%; transition:transform .75s cubic-bezier(.34,1.05,.64,1); }
  .rlb-ltop { position:absolute; width:200px; height:200px; border:3px solid #1a1a1a; background:linear-gradient(145deg,#fffde8,#fff5b8); display:flex; align-items:center; justify-content:center; overflow:hidden; transform:rotateX(90deg) translateZ(-70px); }
  .rlb-lsk { position:absolute; top:170px; width:200px; height:30px; border:3px solid #1a1a1a; overflow:hidden; }
  .rlb-lsf { transform:rotateY(0deg)   translateZ(100px); background:linear-gradient(180deg,#fffde8,#fff5b8); }
  .rlb-lsb { transform:rotateY(180deg) translateZ(100px); background:linear-gradient(180deg,#d0edff,#b8eeff); }
  .rlb-lsr { transform:rotateY(90deg)  translateZ(100px); background:linear-gradient(180deg,#ffe0ef,#ffb8d9); }
  .rlb-lsl { transform:rotateY(-90deg) translateZ(100px); background:linear-gradient(180deg,#d8fff0,#b8ffe8); }

  .rv  { position:absolute; left:50%; top:0; bottom:0; width:26px; transform:translateX(-50%); background:linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left:2px solid #c4006e; border-right:2px solid #c4006e; z-index:1; pointer-events:none; }
  .rh  { position:absolute; top:50%; left:0; right:0; height:26px; transform:translateY(-50%); background:linear-gradient(to bottom,#ffb8e0,#ff3d9a,#ffb8e0); border-top:2px solid #c4006e; border-bottom:2px solid #c4006e; z-index:1; pointer-events:none; }
  .lrv { position:absolute; left:50%; top:0; bottom:0; width:26px; transform:translateX(-50%); background:linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left:2px solid #c4006e; border-right:2px solid #c4006e; pointer-events:none; z-index:1; }
  .lrh { position:absolute; top:50%; left:0; right:0; height:26px; transform:translateY(-50%); background:linear-gradient(to bottom,#ffb8e0,#ff3d9a,#ffb8e0); border-top:2px solid #c4006e; border-bottom:2px solid #c4006e; pointer-events:none; z-index:1; }
  .srv { position:absolute; left:50%; top:0; bottom:0; width:26px; transform:translateX(-50%); background:linear-gradient(to right,#ffb8e0,#ff3d9a,#ffb8e0); border-left:2px solid #c4006e; border-right:2px solid #c4006e; pointer-events:none; }

  .rlb-bow { position:absolute; width:68px; height:44px; top:50%; left:50%; transform:translate(-50%,-58%); z-index:10; }
  .rlb-ear { position:absolute; width:28px; height:22px; background:linear-gradient(135deg,#ffb8e0,#ff3d9a); border:2.5px solid #c4006e; top:0; }
  .rlb-ear.L { left:0; border-radius:50% 0 50% 0; transform:rotate(-26deg); transform-origin:right center; }
  .rlb-ear.R { right:0; border-radius:0 50% 0 50%; transform:rotate(26deg); transform-origin:left center; }
  .rlb-knot { position:absolute; width:15px; height:15px; background:#ff3d9a; border:2.5px solid #c4006e; border-radius:50%; top:50%; left:50%; transform:translate(-50%,-50%); z-index:6; }
  .rlb-tail { position:absolute; bottom:-6px; width:15px; height:14px; background:linear-gradient(135deg,#ffb8e0,#ff3d9a); border:2px solid #c4006e; }
  .rlb-tail.L { left:16px; border-radius:0 0 0 8px; transform:rotate(12deg); }
  .rlb-tail.R { right:16px; border-radius:0 0 8px 0; transform:rotate(-12deg); }

  .rlb-gnd { position:absolute; bottom:2px; left:50%; transform:translateX(-50%); width:160px; height:20px; background:radial-gradient(ellipse,rgba(201,184,255,.45) 0%,transparent 72%); border-radius:50%; pointer-events:none; animation:rlbShadow 5s ease-in-out infinite; }

  .rlb-sparks { position:absolute; inset:-80px; pointer-events:none; z-index:200; }
  .rlb-spark  { position:absolute; top:50%; left:50%; font-size:18px; opacity:0; transform:translate(-50%,-50%); }
  .rlb-box.opened .rlb-spark { animation:rlbSparkFly 1.1s ease forwards; }
  .rlb-spark:nth-child(1){--tx:-92px;--ty:-88px;animation-delay:.33s}
  .rlb-spark:nth-child(2){--tx:92px;--ty:-88px;animation-delay:.40s}
  .rlb-spark:nth-child(3){--tx:-115px;--ty:4px;animation-delay:.37s}
  .rlb-spark:nth-child(4){--tx:115px;--ty:4px;animation-delay:.43s}
  .rlb-spark:nth-child(5){--tx:-70px;--ty:102px;animation-delay:.46s}
  .rlb-spark:nth-child(6){--tx:70px;--ty:102px;animation-delay:.38s}
  .rlb-spark:nth-child(7){--tx:0;--ty:-120px;animation-delay:.31s}
  .rlb-spark:nth-child(8){--tx:-48px;--ty:-115px;animation-delay:.50s}
  .rlb-spark:nth-child(9){--tx:48px;--ty:-115px;animation-delay:.44s}

  .rlb-burst { position:absolute; top:50%; left:50%; border-radius:50%; pointer-events:none; z-index:150; opacity:0; border:2.5px solid; }
  .rlb-box.opened .rlb-burst { animation:rlbBurst 1s cubic-bezier(.22,1,.36,1) forwards; }
  .rlb-b1 { width:220px;height:220px;margin:-110px 0 0 -110px;border-color:rgba(255,61,154,.45);animation-delay:.46s!important }
  .rlb-b2 { width:310px;height:310px;margin:-155px 0 0 -155px;border-color:rgba(201,184,255,.35);animation-delay:.62s!important }
  .rlb-b3 { width:400px;height:400px;margin:-200px 0 0 -200px;border-color:rgba(184,238,255,.22);animation-delay:.78s!important }

  /* ── Text sits in normal flow BELOW the scene div ── */
  .rlb-textblock {
    position: relative; z-index: 4;
    display: flex; flex-direction: column; align-items: center;
    gap: 5px;
    margin-top: 14px;     /* gap between scene bottom and text */
    text-align: center;
    width: 100%;
  }
  .rlb-title {
    font-family:'Caveat',cursive; font-size:30px; font-weight:700;
    color:#2d1b4e; letter-spacing:.01em; line-height:1.1;
    animation:rlbPulse 2s ease-in-out infinite;
  }
  .rlb-hint {
    font-family:'Caveat',cursive; font-size:19px;
    color:#9b7ecb; animation:rlbHint 2.2s ease-in-out infinite;
  }
  .rlb-sub {
    font-family:'Nunito',sans-serif; font-size:10px; font-weight:800;
    color:#b8a8d4; letter-spacing:.14em; text-transform:uppercase; margin-top:2px;
  }

  /* ── Results ── */
  .rlb-results {
    width:100%; display:flex; flex-direction:column; align-items:center;
    animation:rlbTitleIn .5s cubic-bezier(.22,1,.36,1) forwards;
  }
  .rlb-res-title {
    font-family:'Caveat',cursive; font-size:44px; font-weight:700;
    color:#2d1b4e; line-height:1; text-align:center; margin-bottom:4px;
  }
  .rlb-res-title.holo {
    background:linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa,#34d399,#fbbf24,#f472b6);
    background-size:400% 100%;
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
    animation:rlbShimmer 2s linear infinite;
  }
  .rlb-res-sub { font-size:13px; font-weight:600; color:#7c6b99; text-align:center; margin-bottom:18px; }

  .rlb-grid {
    display:flex; flex-wrap:wrap; gap:14px; justify-content:center;
    padding:4px 8px 18px; max-height:52vh; overflow-y:auto; width:100%;
  }
  .rlb-grid::-webkit-scrollbar{width:4px}
  .rlb-grid::-webkit-scrollbar-track{background:transparent}
  .rlb-grid::-webkit-scrollbar-thumb{background:rgba(201,184,255,.4);border-radius:99px}

  .rlb-cw {
    position:relative; border-radius:18px;
    animation:rlbCardIn .5s cubic-bezier(.34,1.56,.64,1) forwards; opacity:0;
    transition:transform .25s cubic-bezier(.175,.885,.32,1.275);
  }
  .rlb-cw:hover { transform:translateY(-6px) rotate(-1deg) scale(1.04)!important; }
  .rlb-cw.single { animation:rlbCardIn .6s cubic-bezier(.34,1.56,.64,1) .05s forwards, rlbCardPop .6s ease .65s forwards!important; }
  .rlb-cshadow { position:absolute; inset:0; border-radius:18px; transform:translate(4px,5px); z-index:0; pointer-events:none; opacity:.45; }
  .rlb-cinner  { position:relative; z-index:1; border:2.5px solid; border-radius:18px; overflow:hidden; background:white; }
  .rlb-holo    { position:absolute; inset:0; border-radius:16px; pointer-events:none; z-index:10; background:linear-gradient(105deg,transparent 20%,rgba(201,184,255,.2) 38%,rgba(255,184,217,.18) 50%,rgba(184,238,255,.18) 62%,transparent 80%); background-size:200% 200%; animation:rlbHolo 2.5s ease-in-out infinite; }
  .rlb-cglow   { position:absolute; inset:-3px; border-radius:21px; pointer-events:none; z-index:0; animation:rlbGlowBorder 2s ease-in-out infinite; }

  /* ── Confirm button ── */
  .rlb-btn {
    display:inline-flex; align-items:center; justify-content:center; gap:8px;
    padding:14px 44px; margin-top:4px;
    border-radius:255px 15px 225px 15px / 15px 225px 15px 255px;
    border:2.5px solid #1a1a1a;
    background:linear-gradient(135deg,#2d1b4e,#4c1d95);
    font-family:'Nunito',sans-serif; font-size:15px; font-weight:800;
    color:white; letter-spacing:.04em;
    box-shadow:4px 4px 0px rgba(201,184,255,.55);
    cursor:pointer;
    transition:all .2s cubic-bezier(.175,.885,.32,1.275);
  }
  .rlb-btn:hover { transform:translateY(-3px); box-shadow:6px 6px 0px rgba(201,184,255,.75); }
  .rlb-btn:active{ transform:translateY(1px);  box-shadow:2px 2px 0px rgba(201,184,255,.3); }

  /* ── Close X ── */
  .rlb-x {
    position:absolute; top:14px; right:14px; z-index:50;
    width:34px; height:34px; border-radius:50%;
    border:2px solid rgba(45,27,78,.14);
    background:rgba(255,255,255,.75);
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; color:#9b7ecb; font-size:17px; font-weight:700; line-height:1;
    font-family:'Nunito',sans-serif;
    transition:all .15s ease; backdrop-filter:blur(4px);
  }
  .rlb-x:hover { background:white; color:#2d1b4e; border-color:rgba(45,27,78,.28); transform:scale(1.08); }
`;

// ─── Gift Box ───────────────────────────────────────────────────────────────
function GiftBox({ phase, onClick }: { phase:"idle"|"shaking"|"opened"; onClick:()=>void }) {
  return (
    <div className="rlb-scene" onClick={onClick} style={{cursor:phase==="idle"?"pointer":"default"}}>
      <div className="rlb-gnd"/>
      <div className={cn("rlb-box", phase==="shaking"&&"shaking", phase==="opened"&&"opened")}>
        <div className="rlb-sparks">
          {["✦","✧","⭐","💫","✨","🌸","💎","🎀","🌟"].map((s,i)=><span key={i} className="rlb-spark">{s}</span>)}
        </div>
        <div className="rlb-burst rlb-b1"/><div className="rlb-burst rlb-b2"/><div className="rlb-burst rlb-b3"/>

        <div className="rlb-body-g">
          <div className="rlb-face rlb-ff"><div className="rv"/><div className="rh"/>
            <div style={{position:"relative",zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <div style={{fontSize:42,opacity:.09}}>❓</div>
              <span style={{fontFamily:"'Caveat',cursive",fontSize:15,fontWeight:700,color:"#1a1a1a15",letterSpacing:".1em"}}>GYATE BOX</span>
            </div>
          </div>
          <div className="rlb-face rlb-fb"/>
          <div className="rlb-face rlb-fr"><div className="rv"/><div className="rh"/></div>
          <div className="rlb-face rlb-fl"/>
          <div className="rlb-face rlb-fd"/>
        </div>

        <div className="rlb-lid">
          <div className="rlb-ltop"><div className="lrv"/><div className="lrh"/>
            <div className="rlb-bow"><div className="rlb-ear L"/><div className="rlb-ear R"/><div className="rlb-knot"/><div className="rlb-tail L"/><div className="rlb-tail R"/></div>
          </div>
          <div className="rlb-lsk rlb-lsf"><div className="srv"/></div>
          <div className="rlb-lsk rlb-lsb"/>
          <div className="rlb-lsk rlb-lsr"><div className="srv"/></div>
          <div className="rlb-lsk rlb-lsl"/>
        </div>
      </div>
    </div>
  );
}

// ─── Dialog ─────────────────────────────────────────────────────────────────
export function RevealLootboxDialog({ box, results, open, onOpenChange }: RevealLootboxDialogProps) {
  type Step = "idle"|"shaking"|"opened"|"results";
  const [step, setStep]         = useState<Step>("idle");
  const confettiRef             = useRef<HTMLDivElement>(null);
  const stylesInjected          = useRef(false);

  // Inject CSS once globally
  useEffect(() => {
    if (stylesInjected.current) return;
    const tag = document.createElement("style");
    tag.textContent = STYLES;
    document.head.appendChild(tag);
    stylesInjected.current = true;
  }, []);

  // Reset on open
  useEffect(() => { if (open) setStep("idle"); }, [open]);

  const dominantRarity = results.length > 0
    ? Math.min(Math.max(...results.map(r => r.rarity ?? 0)), 5) : 0;
  const rc        = RARITY_COLORS[dominantRarity];
  const isLegend  = dominantRarity >= 4;

  const handleBoxClick = useCallback(() => {
    if (step !== "idle") return;
    setStep("shaking");
    setTimeout(() => setStep("opened"), 520);
    setTimeout(() => {
      setStep("results");
      if (confettiRef.current) spawnConfetti(confettiRef.current, rc.accent);
    }, 3500);
  }, [step, rc.accent]);

  const orbitDots = [
    {c:"#d4b8ff",delay:"0s",   dur:2.4},
    {c:"#ffb8d9",delay:".35s", dur:2.8},
    {c:"#b8ffe8",delay:".7s",  dur:3.1},
    {c:"#ffd6e7",delay:"1.1s", dur:2.6},
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rlb-wrap" style={{maxWidth:"min(95vw,800px)"}}>
        <DialogHeader className="sr-only">
          <DialogTitle>Lootbox Reveal</DialogTitle>
          <DialogDescription>Open your lootbox to reveal your hero.</DialogDescription>
        </DialogHeader>

        {/* Confetti */}
        <div ref={confettiRef} style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:500,borderRadius:28,overflow:"hidden"}}/>

        {/* Close */}
        <button className="rlb-x" onClick={()=>onOpenChange(false)}>✕</button>

        <div className="rlb-stage">

          {/* Pastel bg blobs */}
          <div className="rlb-blob" style={{width:300,height:300,top:-80,left:-80,background:"rgba(201,184,255,.22)"}}/>
          <div className="rlb-blob" style={{width:260,height:260,bottom:-60,right:-60,background:"rgba(255,184,217,.2)"}}/>
          <div className="rlb-blob" style={{width:200,height:200,top:"35%",left:"58%",background:"rgba(184,238,255,.18)"}}/>

          {/* Floating dots */}
          {Array.from({length:12}).map((_,i)=>(
            <div key={i} className="rlb-pdot" style={{
              left:`${(i*8.7+3)%100}%`,
              width:`${3+(i%3)}px`,height:`${3+(i%3)}px`,
              background:["#c9b8ff","#ffb8d9","#b8ffe8","#ffd6e7"][i%4],
              animationDuration:`${4+(i*0.32)}s`,
              animationDelay:`${i*0.25}s`,
            }}/>
          ))}

          {/* ── BOX PHASE ── */}
          {step !== "results" && (
            <>
              {/* Aura (absolutely positioned behind box) */}
              <div className="rlb-aura" style={{background:`radial-gradient(circle,${rc.glow} 0%,transparent 70%)`}}/>

              {/* Orbit dots (idle) */}
              {step === "idle" && orbitDots.map((d,i)=>(
                <div key={i} className="rlb-orbit" style={{
                  width:10,height:10,marginLeft:-5,marginTop:125,
                  background:d.c, boxShadow:`0 0 8px ${d.c}`,
                  animation:`rlbOrbit ${d.dur}s linear ${d.delay} infinite`,
                }}/>
              ))}

              {/* 3D Gift Box — in normal flow */}
              <GiftBox
                phase={step==="idle"?"idle":step==="shaking"?"shaking":"opened"}
                onClick={handleBoxClick}
              />

              {/* Text block — directly after scene in DOM flow, never overlaps */}
              <div className="rlb-textblock">
                {step==="idle" && <>
                  <div className="rlb-title">Your fate awaits ✦</div>
                  <div className="rlb-hint">✦ click to open ✦</div>
                  <div className="rlb-sub">Sui Blockchain · On-Chain Verifiable Randomness</div>
                </>}
                {step==="shaking" && <>
                  <div className="rlb-title">Summoning... ✨</div>
                  <div className="rlb-sub">Consulting On-Chain Oracle</div>
                </>}
                {step==="opened" && <>
                  <div className="rlb-title">Revealed! 🎀</div>
                  <div className="rlb-sub">Your hero has been summoned</div>
                </>}
              </div>
            </>
          )}

          {/* ── RESULTS PHASE ── */}
          {step==="results" && results.length > 0 && (
            <div className="rlb-results">
              <h2
                className={cn("rlb-res-title", isLegend && "holo")}
                style={!isLegend ? {
                  color: dominantRarity>=2 ? rc.accent : "#2d1b4e",
                  textShadow:`0 0 28px ${rc.glow}`,
                } : {}}
              >
                Summon Successful!
              </h2>
              <p className="rlb-res-sub">
                {results.length===1
                  ? `You have received ${results[0].name}.`
                  : `You have received ${results.length} new heroes.`}
              </p>

              <div className="rlb-grid">
                {results.map((nft, idx) => {
                  const ri = Math.min(nft.rarity??0, 5);
                  const rc2 = RARITY_COLORS[ri];
                  const single = results.length===1;
                  return (
                    <div
                      key={nft.id}
                      className={cn("rlb-cw", single&&"single")}
                      style={{
                        animationDelay:`${idx*0.09}s`,
                        width:single?210:158,
                        transform:`rotate(${idx%2===0?-0.5:0.5}deg)`,
                      }}
                    >
                      <div className="rlb-cglow" style={{"--gc":rc2.glow} as any}/>
                      <div className="rlb-cshadow" style={{background:rc2.shadow}}/>
                      <div className="rlb-cinner" style={{borderColor:rc2.border}}>
                        <NFTCard nft={nft} className={single?"w-52":"w-36 sm:w-40"}/>
                        {ri>=2 && <div className="rlb-holo"/>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                className="rlb-btn"
                onClick={()=>onOpenChange(false)}
                style={{
                  background:`linear-gradient(135deg,#2d1b4e,${rc.accent})`,
                  boxShadow:`4px 4px 0px ${rc.shadow}`,
                  borderColor:rc.border,
                }}
              >
                ✦ Confirm & Close
              </button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}