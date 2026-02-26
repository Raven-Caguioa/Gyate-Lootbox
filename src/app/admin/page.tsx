"use client";

import { Navigation } from "@/components/navigation";
import { RefreshCw, Package, ShieldCheck, Trophy, Coins, Sparkles, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

import { useAdminData } from "./_hooks/use-admin-data";
import { LootboxFactoryTab }         from "./_components/lootbox-factory-tab";
import { LiveProtocolsTab }          from "./_components/live-protocols-tab";
import { VariantLabTab }             from "./_components/variant-lab-tab";
import { AchievementsTab }           from "./_components/achievements-tab";
import { TreasuryTab, MarketplaceTab } from "./_components/treasury-marketplace-tabs";
import { useState } from "react";

// ─── Design tokens (mirrors home page exactly) ────────────────────────────────
const ADMIN_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Nunito:wght@300;400;600;700;800&display=swap');

  .admin-root {
    font-family: 'Nunito', sans-serif;
    background-color: #ffffff;
    color: #1a1a1a;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  /* Page container */
  .admin-container {
    position: relative; z-index: 10;
    max-width: 1200px; margin: 0 auto;
    padding: 48px 24px 80px;
  }

  /* Header */
  .admin-eyebrow {
    display: inline-flex; align-items: center; gap: 6px;
    background: #fff5b8; border: 1.5px solid #1a1a1a;
    padding: 4px 12px; border-radius: 99px;
    font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
    box-shadow: 2px 2px 0px #c9b8ff; margin-bottom: 16px;
    font-family: 'Nunito', sans-serif;
  }
  .admin-title {
    font-family: 'Caveat', cursive;
    font-size: 56px; font-weight: 700; line-height: 0.95;
    color: #1a1a1a; margin-bottom: 8px;
  }
  .admin-subtitle {
    font-size: 15px; color: #64748b; font-weight: 500; margin-bottom: 0;
  }

  /* Sync button — matches home CTAs */
  .sync-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 22px;
    background: #1a1a1a; color: white;
    border: 2px solid #1a1a1a; border-radius: 14px;
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800;
    box-shadow: 4px 4px 0px #c9b8ff;
    cursor: pointer; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .sync-btn:hover { transform: translateY(-2px); box-shadow: 6px 6px 0px #c9b8ff; }
  .sync-btn:active { transform: translateY(1px); box-shadow: 2px 2px 0px #c9b8ff; }
  .sync-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* Tab list — home-style card */
  .admin-tabs-list {
    display: flex; gap: 4px; flex-wrap: wrap;
    background: white; border: 2px solid #e2e8f0; border-radius: 20px;
    padding: 6px; margin-bottom: 32px;
    box-shadow: 4px 4px 0px rgba(201,184,255,0.3);
  }

  /* Individual tab trigger */
  .admin-tab-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 18px; border-radius: 14px;
    border: none; background: transparent;
    font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 800;
    color: #94a3b8; cursor: pointer;
    transition: all 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    white-space: nowrap;
  }
  .admin-tab-btn:hover { background: #f8f8f8; color: #1a1a1a; }
  .admin-tab-btn.active {
    background: #1a1a1a; color: white;
    box-shadow: 2px 2px 0px #c9b8ff;
  }
  .admin-tab-btn.active svg { color: white; }

  /* Count badge on tabs */
  .tab-count {
    display: inline-flex; align-items: center; justify-content: center;
    background: #b8ffe8; color: #064e3b;
    font-size: 9px; font-weight: 900;
    padding: 2px 7px; border-radius: 99px;
    border: 1px solid #34d399;
  }
  .tab-count.active { background: #c9b8ff; color: #5b21b6; border-color: #a78bfa; }

  /* Section heading — Caveat with underline squiggle */
  .section-heading {
    font-family: 'Caveat', cursive;
    font-size: 32px; font-weight: 700; color: #1a1a1a;
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 24px;
  }
  .section-heading::after {
    content: ''; flex: 1; height: 2px;
    background: linear-gradient(to right, #c9b8ff, transparent);
    border-radius: 99px;
  }

  /* ── Card shells — replaces glass-card ── */
  /* All admin cards now use home-style white card with hard shadow */
  .admin-root .glass-card {
    background: white !important;
    border: 2px solid #e2e8f0 !important;
    border-radius: 20px !important;
    box-shadow: 5px 5px 0px rgba(201,184,255,0.35) !important;
    backdrop-filter: none !important;
    transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
  }
  .admin-root .glass-card:hover {
    border-color: #cbd5e1 !important;
    box-shadow: 7px 7px 0px rgba(201,184,255,0.45) !important;
    transform: translateY(-1px);
  }

  /* Border-color variants */
  .admin-root .glass-card.border-primary\\/20 { border-color: #c9b8ff !important; }
  .admin-root .glass-card.border-accent\\/20  { border-color: #ffb8d9 !important; }
  .admin-root .glass-card.border-green-500\\/20 { border-color: #86efac !important; box-shadow: 5px 5px 0px rgba(134,239,172,0.35) !important; }
  .admin-root .glass-card.border-orange-500\\/20 { border-color: #fdba74 !important; box-shadow: 5px 5px 0px rgba(253,186,116,0.35) !important; }
  .admin-root .glass-card.border-white\\/10  { border-color: #e2e8f0 !important; }
  .admin-root .glass-card.border-dashed     { border-style: dashed !important; }

  /* Card headers */
  .admin-root .glass-card .border-b {
    border-bottom-color: #f1f5f9 !important;
  }

  /* Card title text */
  .admin-root [class*="CardTitle"] {
    font-family: 'Caveat', cursive !important;
    font-size: 22px !important;
    font-weight: 700 !important;
    color: #1a1a1a !important;
  }
  .admin-root [class*="CardDescription"] {
    font-size: 12px !important;
    color: #64748b !important;
    font-family: 'Nunito', sans-serif !important;
  }

  /* ── Live Protocol Panel Fixes ── */
  /* Force white backgrounds on all live protocol cards */
  .admin-root .border-green-200,
  .admin-root .border-orange-200 {
    background: white !important;
  }

  /* StatPill backgrounds */
  .admin-root .bg-slate-50 {
    background: #f8fafc !important;
  }

  /* Inventory health grid items */
  .admin-root .bg-white {
    background: white !important;
  }

  /* Protocol card content areas */
  .admin-root [class*="CardContent"] {
    background: transparent !important;
  }

  /* Force card backgrounds to white */
  .admin-root .shadow-\[3px_3px_0px_rgba\(201\,184\,255\,0\.3\)\] {
    background: white !important;
  }

  /* Status indicator backgrounds */
  .admin-root .bg-green-100 {
    background: #dcfce7 !important;
    color: #15803d !important;
  }
  .admin-root .bg-orange-100 {
    background: #ffedd5 !important;
    color: #c2410c !important;
  }

  /* Expanded panels */
  .admin-root .animate-in {
    background: #f8fafc !important;
  }

  /* Live protocol summary cards at top */
  .admin-root .border-slate-200 {
    background: white !important;
  }

  /* Inventory health container */
  .admin-root .bg-slate-50.border.border-slate-200 {
    background: #f8fafc !important;
  }

  /* ── Buttons — override all to home style ── */
  .admin-root .glow-purple,
  .admin-root .glow-violet,
  .admin-root button[class*="bg-primary"],
  .admin-root button[class*="glow"] {
    background: #1a1a1a !important;
    color: white !important;
    border: 2px solid #1a1a1a !important;
    border-radius: 14px !important;
    font-family: 'Nunito', sans-serif !important;
    font-weight: 800 !important;
    box-shadow: 3px 3px 0px #c9b8ff !important;
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
    text-shadow: none !important;
    backdrop-filter: none !important;
  }
  .admin-root .glow-purple:hover,
  .admin-root .glow-violet:hover,
  .admin-root button[class*="bg-primary"]:hover,
  .admin-root button[class*="glow"]:hover {
    transform: translateY(-2px) !important;
    box-shadow: 5px 5px 0px #c9b8ff !important;
  }
  .admin-root .glow-purple:disabled,
  .admin-root .glow-violet:disabled {
    opacity: 0.5 !important; transform: none !important;
  }

  /* Outline/ghost buttons */
  .admin-root button[class*="border-white/10"],
  .admin-root button[class*="bg-white/5"] {
    background: white !important;
    border-color: #e2e8f0 !important;
    color: #1a1a1a !important;
    border-radius: 12px !important;
    font-family: 'Nunito', sans-serif !important;
    font-weight: 700 !important;
  }
  .admin-root button[class*="border-white/10"]:hover {
    border-color: #c9b8ff !important;
    background: #faf5ff !important;
  }

  /* Accent bg button (pink/accent) */
  .admin-root button[class*="bg-accent"] {
    background: linear-gradient(135deg, #fce7f3, #f3e8ff) !important;
    color: #1a1a1a !important;
    border: 2px solid #1a1a1a !important;
    border-radius: 14px !important;
    box-shadow: 3px 3px 0px #ffb8d9 !important;
    font-family: 'Nunito', sans-serif !important;
    font-weight: 800 !important;
  }

  /* Small stat pills inside live protocols */
  .admin-root .bg-white\\/5 {
    background: #f8fafc !important;
    border-color: #e2e8f0 !important;
  }
  .admin-root .bg-white\\/3 {
    background: #f8fafc !important;
  }

  /* Inputs — FIXED FOR VISIBILITY */
  .admin-root input,
  .admin-root textarea {
    background: white !important;
    border: 2px solid #e2e8f0 !important;
    color: #1a1a1a !important;
    border-radius: 12px !important;
    font-family: 'Nunito', sans-serif !important;
    font-weight: 600 !important;
    transition: border-color 0.15s, box-shadow 0.15s !important;
  }
  .admin-root input:focus,
  .admin-root textarea:focus {
    border-color: #c9b8ff !important;
    box-shadow: 0 0 0 3px rgba(201,184,255,0.2) !important;
    outline: none !important;
  }
  .admin-root input::placeholder { color: #94a3b8 !important; }

  /* Labels — FIXED TO BE DARKER */
  .admin-root label, .admin-root [class*="Label"] {
    color: #1a1a1a !important;
    font-family: 'Nunito', sans-serif !important;
    font-size: 12px !important;
    font-weight: 700 !important;
  }

  /* Select triggers — FIXED */
  .admin-root [class*="SelectTrigger"] {
    background: white !important;
    border: 2px solid #e2e8f0 !important;
    border-radius: 12px !important;
    color: #1a1a1a !important;
    font-family: 'Nunito', sans-serif !important;
    font-weight: 600 !important;
  }
  .admin-root [class*="SelectTrigger"]:hover {
    border-color: #c9b8ff !important;
  }
  
  /* Select content dropdown — FIXED */
  .admin-root [class*="SelectContent"] {
    background: white !important;
    border: 2px solid #e2e8f0 !important;
    border-radius: 12px !important;
    box-shadow: 4px 4px 0px rgba(201,184,255,0.3) !important;
  }
  
  /* Select items — FIXED */
  .admin-root [class*="SelectItem"] {
    color: #1a1a1a !important;
    font-family: 'Nunito', sans-serif !important;
    font-weight: 600 !important;
  }
  .admin-root [class*="SelectItem"]:hover {
    background: #f8fafc !important;
  }
  .admin-root [class*="SelectItem"][data-state="checked"] {
    background: #ede9fe !important;
    color: #5b21b6 !important;
  }

  /* Scroll area */
  .admin-root [class*="ScrollArea"] {
    background: transparent !important;
  }

  /* Badge overrides */
  .admin-root [class*="Badge"][class*="bg-primary/20"] {
    background: #ede9fe !important;
    color: #5b21b6 !important;
    border: 1.5px solid #c9b8ff !important;
    font-family: 'Nunito', sans-serif !important;
    font-weight: 800 !important;
    border-radius: 8px !important;
  }
  .admin-root [class*="Badge"][class*="border-accent"] {
    background: #fdf4ff !important;
    color: #86198f !important;
    border-color: #e879f9 !important;
  }
  .admin-root [class*="Badge"][class*="border-primary"] {
    background: #ede9fe !important;
    color: #5b21b6 !important;
    border-color: #c9b8ff !important;
  }

  /* Switch — FIXED TO BE VISIBLE */
  .admin-root [class*="Switch"] {
    background-color: #e2e8f0 !important;
    border-radius: 99px !important;
    border: 2px solid #cbd5e1 !important;
  }
  .admin-root [data-state="checked"][class*="Switch"] {
    background-color: #1a1a1a !important;
    border-color: #1a1a1a !important;
  }
  
  /* Switch thumb — FIXED */
  .admin-root [class*="Switch"] [class*="Thumb"] {
    background: white !important;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
  }

  /* Dividers */
  .admin-root .border-white\\/5 { border-color: #f1f5f9 !important; }
  .admin-root .border-white\\/10 { border-color: #e2e8f0 !important; }
  .admin-root .border-white\\/20 { border-color: #cbd5e1 !important; }

  /* ── Text color overrides — force all text readable on white ── */
  .admin-root .text-muted-foreground { color: #64748b !important; }
  .admin-root .text-foreground       { color: #1a1a1a !important; }
  .admin-root .text-primary          { color: #5b21b6 !important; }
  .admin-root .text-accent           { color: #86198f !important; }

  /* Any element that would be white/near-white text on white bg */
  .admin-root h1, .admin-root h2, .admin-root h3,
  .admin-root h4, .admin-root h5, .admin-root h6 { color: #1a1a1a !important; }

  .admin-root p   { color: #475569; }
  .admin-root span { color: inherit; }

  /* Tailwind white text classes — remap to dark */
  .admin-root .text-white            { color: #1a1a1a !important; }
  .admin-root .text-slate-100        { color: #334155 !important; }
  .admin-root .text-slate-200        { color: #475569 !important; }
  .admin-root .text-slate-300        { color: #475569 !important; }
  .admin-root .text-slate-400        { color: #64748b !important; }
  .admin-root .text-slate-500        { color: #64748b !important; }
  .admin-root .text-slate-600        { color: #475569 !important; }
  .admin-root .text-slate-700        { color: #334155 !important; }
  .admin-root .text-slate-800        { color: #1e293b !important; }
  .admin-root .text-slate-900        { color: #0f172a !important; }

  /* Opacity-based white text variants */
  .admin-root [class*="text-white/"]  { color: #475569 !important; }
  .admin-root [class*="text-slate-"]  { color: #475569 !important; }

  /* Specific utility text used in child components */
  .admin-root .text-xs    { color: inherit; }
  .admin-root .text-sm    { color: inherit; }
  .admin-root .text-base  { color: inherit; }
  .admin-root .text-lg    { color: inherit; }
  .admin-root .text-xl    { color: inherit; }
  .admin-root .text-2xl   { color: inherit; }
  .admin-root .text-3xl   { color: inherit; }

  /* Green/yellow/orange status text — keep colored but readable */
  .admin-root .text-green-400  { color: #16a34a !important; }
  .admin-root .text-green-300  { color: #15803d !important; }
  .admin-root .text-orange-400 { color: #ea580c !important; }
  .admin-root .text-orange-300 { color: #c2410c !important; }
  .admin-root .text-yellow-400 { color: #ca8a04 !important; }
  .admin-root .text-yellow-300 { color: #a16207 !important; }
  .admin-root .text-red-400    { color: #dc2626 !important; }
  .admin-root .text-red-300    { color: #b91c1c !important; }
  .admin-root .text-blue-400   { color: #2563eb !important; }
  .admin-root .text-blue-300   { color: #1d4ed8 !important; }
  .admin-root .text-purple-300 { color: #7c3aed !important; }
  .admin-root .text-pink-300   { color: #be185d !important; }
  .admin-root .text-cyan-300   { color: #0e7490 !important; }

  /* Rarity color classes used in RARITY_COLORS array */
  .admin-root .text-slate-300  { color: #475569 !important; }
  .admin-root .text-blue-300   { color: #1d4ed8 !important; }
  .admin-root .text-purple-300 { color: #7c3aed !important; }
  .admin-root .text-pink-300   { color: #be185d !important; }
  .admin-root .text-yellow-300 { color: #a16207 !important; }
  .admin-root .text-red-300    { color: #b91c1c !important; }

  /* font-headline (Caveat) used in stat values */
  .admin-root .font-headline   { color: #1a1a1a !important; }

  /* ── Inspector / RarityTier card text fixes ── */
  /* NFT name inside protocol inspector rows */
  .admin-root .font-bold.text-sm        { color: #1a1a1a !important; }
  .admin-root .font-bold.text-base      { color: #1a1a1a !important; }
  .admin-root .font-bold.text-lg        { color: #1a1a1a !important; }
  .admin-root .font-bold.text-xl        { color: #1a1a1a !important; }
  .admin-root .font-bold                { color: #1a1a1a; }
  .admin-root .font-semibold            { color: #1a1a1a; }

  /* Tier heading labels (LEGEND RARE, ULTRA RARE etc) */
  .admin-root .text-xs.font-bold.uppercase { color: #475569 !important; }

  /* "Base: X SUI" and stat text inside inspector NFT rows */
  .admin-root .text-\\[10px\\].text-muted-foreground { color: #64748b !important; }
  .admin-root .text-\\[10px\\]  { color: #64748b !important; }
  .admin-root .text-\\[11px\\]  { color: #475569 !important; }
  .admin-root .text-\\[9px\\]   { color: #64748b !important; }
  .admin-root .truncate        { color: #1a1a1a !important; }

  /* Variant name text inside inspector */
  .admin-root .flex.items-center.gap-2 span { color: #1a1a1a; }

  /* Badge inside inspector (HP/ATK ranges) */
  .admin-root [class*="border-white/10"][class*="text-"] { color: #475569 !important; }
  .admin-root .border-white\/10 { border-color: #e2e8f0 !important; }

  /* "disabled" red badge on variants */
  .admin-root .bg-red-500\/20.text-red-400 { color: #dc2626 !important; background: #fee2e2 !important; }

  /* Variant drop rate / multiplier mono text */
  .admin-root .font-mono { color: #475569 !important; }

  /* Red empty-tier message */
  .admin-root .text-red-400\/50 { color: #fca5a5 !important; }
  .admin-root .text-red-400     { color: #dc2626 !important; }

  /* "No characters registered" dashed box */
  .admin-root .border-dashed.border-red-400\/10 { border-color: #fecdd3 !important; }

  /* Achievement registry cards */
  .admin-root .text-sm.font-bold  { color: #1a1a1a !important; }
  .admin-root .line-clamp-2       { color: #64748b !important; }

  /* Stat pills in live protocols (Total Opens, Revenue etc) */
  .admin-root .text-lg.font-bold.font-headline { color: #1a1a1a !important; }
  .admin-root .text-3xl.font-bold.font-headline { color: #1a1a1a !important; }

  /* VariantToggleRow name */
  .admin-root .text-\\[11px\\].font-bold { color: #1a1a1a !important; }

  /* Gradient BG for page */
  .admin-root .gradient-bg {
    background: #ffffff !important;
  }

  /* Font headline for stats etc */
  .admin-root .font-headline {
    font-family: 'Caveat', cursive !important;
  }

  /* StatPill in live protocols */
  .admin-root .rounded-xl.bg-white\\/5.border.border-white\\/5 {
    background: #f8fafc !important;
    border: 2px solid #e2e8f0 !important;
    border-radius: 14px !important;
  }

  /* Live status dots */
  .admin-root .bg-green-400 { background-color: #4ade80 !important; }

  /* Protocol cards */
  .admin-root .glass-card.border-green-500\\/20 {
    border-left: 4px solid #4ade80 !important;
  }
  .admin-root .glass-card.border-orange-500\\/20 {
    border-left: 4px solid #fb923c !important;
  }

  /* Inventory health tiers inside live panel */
  .admin-root .rounded-lg.p-2.text-center.border {
    background: white !important;
    border-color: #e2e8f0 !important;
    border-radius: 10px !important;
  }
  .admin-root .bg-red-500\\/5 {
    background: #fff1f2 !important;
  }
  .admin-root .border-red-500\\/20 {
    border-color: #fecdd3 !important;
  }

  /* Price edit panel & variant panel */
  .admin-root .animate-in {
    background: #f8fafc !important;
    border-radius: 14px !important;
    border: 2px solid #e2e8f0 !important;
    padding: 16px !important;
  }

  /* Protocol inspector */
  .admin-root .h-\\[800px\\] {
    border: 2px solid #e2e8f0 !important;
    border-radius: 20px !important;
    background: white !important;
    box-shadow: 5px 5px 0px rgba(201,184,255,0.3) !important;
  }

  /* NFT tier rows inside inspector */
  .admin-root .rounded-xl.bg-white\\/5.border.border-white\\/5.space-y-3 {
    background: #f8fafc !important;
    border: 2px solid #e2e8f0 !important;
    border-radius: 14px !important;
  }

  /* Sidebar info box in marketplace */
  .admin-root .p-4.rounded-xl.bg-accent\\/5 {
    background: #fdf4ff !important;
    border-color: #e9d5ff !important;
    border-radius: 14px !important;
  }

  /* Summary bar cards on live protocols */
  .admin-root .glass-card.border-white\\/10.p-4 {
    padding: 20px !important;
  }

  /* Toggle row */
  .admin-root .rounded-lg.border.text-\\[11px\\] {
    background: white !important;
    border-color: #e2e8f0 !important;
    border-radius: 10px !important;
  }

  /* Pity / multi-open panel */
  .admin-root .rounded-xl.border.border-white\\/5.animate-in {
    background: #faf5ff !important;
    border-color: #e9d5ff !important;
  }

  /* Code/mono */
  .admin-root .font-mono { font-family: 'Courier New', monospace !important; }

  /* ScrollArea inside Inspector height */
  .admin-root .h-full.p-4 { background: white !important; }

  /* Empty states */
  .admin-root .border-dashed.border-white\\/10 {
    border-color: #e2e8f0 !important;
    background: white !important;
    border-radius: 24px !important;
  }

  /* Loading states */
  .admin-root .animate-spin { color: #c9b8ff; }

  /* Tabs content area */
  .admin-tab-content { animation: adminFadeIn 0.25s ease; }
  @keyframes adminFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  /* Hover lift on protocol panels */
  .admin-root .glass-card.border-green-500\\/20:hover,
  .admin-root .glass-card.border-orange-500\\/20:hover {
    transform: none !important; /* protocol panels shouldn't lift */
  }

  /* Section divider line */
  .admin-divider {
    height: 2px;
    background: linear-gradient(to right, #c9b8ff, #ffb8d9, transparent);
    border-radius: 99px;
    margin: 32px 0;
    opacity: 0.4;
  }

  @media (max-width: 768px) {
    .admin-title { font-size: 40px; }
    .admin-tabs-list { gap: 3px; }
    .admin-tab-btn { padding: 8px 12px; font-size: 11px; }
    .admin-container { padding: 32px 16px 60px; }
  }
    
`;

const TABS = [
  {
    id: "live",
    label: "Live Protocols",
    icon: Activity,
    color: "text-green-600",
  },
  {
    id: "lootbox",
    label: "Lootbox Factory",
    icon: Package,
    color: "text-purple-600",
  },
  {
    id: "variants",
    label: "Variant Lab",
    icon: Sparkles,
    color: "text-pink-600",
  },
  {
    id: "achievements",
    label: "Achievements",
    icon: Trophy,
    color: "text-yellow-600",
  },
  {
    id: "treasury",
    label: "Treasury",
    icon: Coins,
    color: "text-blue-600",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: ShieldCheck,
    color: "text-emerald-600",
  },
] as const;

type TabId = typeof TABS[number]["id"];

export default function AdminPage() {
  const {
    myLootboxes, liveBoxes, draftBoxes,
    achievements, treasuryStats,
    policyExists, isCheckingPolicy,
    isLoadingBoxes, isLoadingAchievements, isFetchingTreasury,
    fetchLootboxes, fetchAchievements, fetchTreasuryData, checkPolicy, syncAll,
    fetchFullBoxData,
  } = useAdminData();

  const [activeTab, setActiveTab] = useState<TabId>("live");
  const isSyncing = isLoadingBoxes || isFetchingTreasury || isLoadingAchievements;

  return (
    <div className="admin-root gradient-bg">
      <style dangerouslySetInnerHTML={{ __html: ADMIN_STYLES }} />

      <Navigation />

      <div className="admin-container">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <div className="admin-eyebrow">
              ⚙️ Admin Dashboard
            </div>
            <h1 className="admin-title">Protocol Admin ✦</h1>
            <p className="admin-subtitle">
              Manage lootboxes, variants &amp; the $GYATE economy.
            </p>
          </div>

          <button
            className="sync-btn"
            onClick={syncAll}
            disabled={isSyncing}
          >
            <RefreshCw
              size={15}
              className={isSyncing ? "animate-spin" : ""}
            />
            {isSyncing ? "Syncing…" : "Sync All"}
          </button>
        </div>

        <div className="admin-divider" />

        {/* ── Tabs ── */}
        <div className="admin-tabs-list">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const showBadge = tab.id === "live" && liveBoxes.length > 0;
            const badgeCount = liveBoxes.filter(b => b.isActive).length;

            return (
              <button
                key={tab.id}
                className={cn("admin-tab-btn", isActive && "active")}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={14} />
                {tab.label}
                {showBadge && (
                  <span className={cn("tab-count", isActive && "active")}>
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div className="admin-tab-content" key={activeTab}>
          {activeTab === "live" && (
            <>
              <div className="section-heading">
                <Activity size={22} /> Live Protocols
              </div>
              <LiveProtocolsTab
                liveBoxes={liveBoxes}
                isLoadingBoxes={isLoadingBoxes}
                fetchLootboxes={fetchLootboxes}
                fetchFullBoxData={fetchFullBoxData}
              />
            </>
          )}

          {activeTab === "lootbox" && (
            <>
              <div className="section-heading">
                <Package size={22} /> Lootbox Factory
              </div>
              <LootboxFactoryTab
                draftBoxes={draftBoxes}
                fetchLootboxes={fetchLootboxes}
                fetchFullBoxData={fetchFullBoxData}
              />
            </>
          )}

          {activeTab === "variants" && (
            <>
              <div className="section-heading">
                <Sparkles size={22} /> Variant Lab
              </div>
              <VariantLabTab
                draftBoxes={draftBoxes}
                fetchFullBoxData={fetchFullBoxData}
              />
            </>
          )}

          {activeTab === "achievements" && (
            <>
              <div className="section-heading">
                <Trophy size={22} /> Achievements
              </div>
              <AchievementsTab
                achievements={achievements}
                isLoadingAchievements={isLoadingAchievements}
                fetchAchievements={fetchAchievements}
              />
            </>
          )}

          {activeTab === "treasury" && (
            <>
              <div className="section-heading">
                <Coins size={22} /> Treasury
              </div>
              <TreasuryTab
                treasuryStats={treasuryStats}
                isFetchingTreasury={isFetchingTreasury}
                fetchTreasuryData={fetchTreasuryData}
              />
            </>
          )}

          {activeTab === "marketplace" && (
            <>
              <div className="section-heading">
                <ShieldCheck size={22} /> Marketplace Setup
              </div>
              <MarketplaceTab
                policyExists={policyExists}
                isCheckingPolicy={isCheckingPolicy}
                checkPolicy={checkPolicy}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}