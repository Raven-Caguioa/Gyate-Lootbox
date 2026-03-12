"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Search, RefreshCw, Info, Loader2, Filter, X, Sparkles, TrendingUp, Tag, Clock, AlertCircle, Inbox, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import {
  PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_POOL, TRANSFER_POLICY,
  PRICE_HISTORY_REGISTRY, OFFER_REGISTRY, KIOSK_REGISTRY,
} from "@/lib/sui-constants";
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
function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * 1_000_000_000));
}

interface ActiveListing { nftId: string; kioskId: string; priceMist: string; }
interface OfferData {
  id: string;
  nftId: string;
  nftName: string;
  buyer: string;
  seller: string;
  amount: number; // in SUI
  amountMist: string;
  expiresAt: number;
  createdAt: number;
}
interface PriceHistoryEntry { price: number; epoch: number; }

const RARITY_DOODLE_COLORS = [
  { bg: "#f8f8f8", border: "#94a3b8", text: "#475569", shadow: "#cbd5e1" },
  { bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", shadow: "#bfdbfe" },
  { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", shadow: "#e9d5ff" },
  { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", shadow: "#f0abfc" },
  { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", shadow: "#fde68a" },
  { bg: "#fff1f2", border: "#fb7185", text: "#9f1239", shadow: "#fecdd3" },
];

// ─── All Styles ────────────────────────────────────────────────────────────────
const ALL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Nunito:wght@300;400;600;700;800&display=swap');

  .mkt-page {
    min-height: 100vh; background: #fafaf8;
    font-family: 'Nunito', sans-serif; position: relative;
  }
  .mkt-page::before {
    content: ''; position: fixed; inset: 0;
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
    border: 2px solid #1a1a1a; background: white;
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; color: #1a1a1a;
    box-shadow: 3px 3px 0px #c9b8ff; cursor: pointer;
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
    border: 2px solid #1a1a1a; background: white;
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 600;
    box-shadow: 3px 3px 0px #c9b8ff; outline: none; width: 220px;
    transition: box-shadow 0.2s ease; color: #1a1a1a;
  }
  .mkt-search:focus { box-shadow: 5px 5px 0px #c9b8ff; }
  .mkt-search::placeholder { color: #94a3b8; }

  .mkt-layout { display: grid; grid-template-columns: 260px 1fr; gap: 28px; align-items: start; }
  @media (max-width: 900px) { .mkt-layout { grid-template-columns: 1fr; } }

  .mkt-sidebar {
    position: sticky; top: 88px; background: white;
    border: 2px solid #1a1a1a; border-radius: 20px; padding: 20px;
    box-shadow: 5px 5px 0px #c9b8ff; box-sizing: border-box; width: 100%; overflow: hidden;
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

  /* ─── Price History Bar ─── */
  .price-history-bar {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px; background: #f8f4ff;
    border: 1.5px solid #e9d5ff; border-radius: 10px;
  }
  .price-history-bar-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; white-space: nowrap; }
  .price-history-sparkline { display: flex; align-items: flex-end; gap: 2px; height: 18px; flex: 1; }
  .price-history-bar-item {
    flex: 1; min-width: 3px; border-radius: 2px 2px 0 0;
    background: linear-gradient(to top, #c9b8ff, #a855f7);
    transition: height 0.3s ease;
  }
  .price-history-avg { font-family: 'Caveat', cursive; font-size: 14px; font-weight: 700; color: #7e22ce; white-space: nowrap; }

  /* ─── Action buttons ─── */
  .buy-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 14px; width: 100%; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; border: 2px solid #1a1a1a; background: linear-gradient(135deg, #f3e8ff, #fce7f3); font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 800; color: #1a1a1a; box-shadow: 3px 3px 0px #c9b8ff; cursor: pointer; transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275); box-sizing: border-box; }
  .buy-btn:hover { transform: translateY(-2px); box-shadow: 5px 5px 0px #c9b8ff; }
  .buy-btn:active { transform: translateY(1px); box-shadow: 1px 1px 0px #c9b8ff; }
  .buy-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .buy-btn.yours { background: #f8f8f8; color: #94a3b8; border-color: #e2e8f0; box-shadow: 3px 3px 0px #e2e8f0; cursor: default; }
  .buy-btn.yours:hover { transform: none; box-shadow: 3px 3px 0px #e2e8f0; }

  .offer-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 14px; width: 100%; border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px; border: 2px solid #e2e8f0; background: white; font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800; color: #64748b; box-shadow: 2px 2px 0px #e2e8f0; cursor: pointer; transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275); box-sizing: border-box; }
  .offer-btn:hover { border-color: #c9b8ff; color: #7e22ce; box-shadow: 3px 3px 0px #c9b8ff; transform: translateY(-1px); }
  .offer-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .listing-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
  .mkt-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0; gap: 16px; }
  .mkt-loading-text { font-family: 'Caveat', cursive; font-size: 22px; color: #94a3b8; }
  .mkt-empty { text-align: center; padding: 80px 24px; background: white; border: 2px dashed #e2e8f0; border-radius: 24px; }
  .mkt-empty-icon { font-size: 48px; margin-bottom: 16px; }
  .mkt-empty-title { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .mkt-empty-desc { font-size: 13px; color: #64748b; margin-bottom: 20px; }

  /* ─── OFFER MODAL ─── */
  .modal-backdrop {
    position: fixed; inset: 0; z-index: 8000;
    background: rgba(10, 5, 20, 0.5);
    backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none;
    transition: opacity 0.25s ease;
  }
  .modal-backdrop.active { opacity: 1; pointer-events: all; }

  .offer-modal {
    background: white; border-radius: 28px;
    border: 2px solid #1a1a1a;
    box-shadow: 10px 10px 0px #c9b8ff;
    width: 440px; max-width: 94vw;
    padding: 28px;
    transform: scale(0.95) translateY(10px);
    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  .modal-backdrop.active .offer-modal { transform: scale(1) translateY(0); }

  .offer-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .offer-modal-title { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; }
  .offer-modal-close { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #1a1a1a; background: #f8f8f8; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; font-weight: 700; color: #1a1a1a; transition: all 0.15s ease; }
  .offer-modal-close:hover { background: #1a1a1a; color: white; }

  .offer-nft-preview { display: flex; align-items: center; gap: 14px; padding: 14px; background: #fafaf8; border: 2px solid #e2e8f0; border-radius: 16px; margin-bottom: 20px; }
  .offer-nft-img { width: 56px; height: 56px; border-radius: 10px; overflow: hidden; border: 2px solid; flex-shrink: 0; }
  .offer-nft-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .offer-nft-info { flex: 1; min-width: 0; }
  .offer-nft-name { font-family: 'Caveat', cursive; font-size: 20px; font-weight: 700; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .offer-nft-listed { font-size: 11px; color: #64748b; font-weight: 600; }
  .offer-nft-listed span { color: #7e22ce; font-weight: 800; }

  .offer-price-history { margin-bottom: 18px; padding: 12px 14px; background: #f8f4ff; border: 1.5px solid #e9d5ff; border-radius: 14px; }
  .offer-price-history-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
  .offer-price-history-entries { display: flex; gap: 4px; }
  .offer-price-history-item { flex: 1; text-align: center; }
  .offer-price-history-val { font-family: 'Caveat', cursive; font-size: 16px; font-weight: 700; color: #7e22ce; display: block; line-height: 1; }
  .offer-price-history-epoch { font-size: 9px; color: #94a3b8; font-weight: 700; }

  .offer-input-section { margin-bottom: 16px; }
  .offer-input-label { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin-bottom: 8px; display: block; }
  .offer-amount-row { display: flex; align-items: center; gap: 8px; }
  .offer-amount-input {
    flex: 1; padding: 12px 16px; border: 2px solid #1a1a1a;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    font-family: 'Caveat', cursive; font-size: 22px; font-weight: 700;
    color: #1a1a1a; outline: none; background: white;
    box-shadow: 3px 3px 0px #c9b8ff;
    transition: box-shadow 0.2s ease;
  }
  .offer-amount-input:focus { box-shadow: 5px 5px 0px #c9b8ff; }
  .offer-amount-currency { font-family: 'Caveat', cursive; font-size: 20px; font-weight: 700; color: #7e22ce; flex-shrink: 0; }

  .offer-expiry-row { display: flex; gap: 6px; margin-bottom: 16px; }
  .offer-expiry-btn { flex: 1; padding: 7px 4px; border-radius: 12px; border: 2px solid #e2e8f0; background: white; font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800; color: #64748b; cursor: pointer; transition: all 0.15s ease; text-align: center; }
  .offer-expiry-btn:hover { border-color: #c9b8ff; color: #7e22ce; }
  .offer-expiry-btn.active { background: linear-gradient(135deg, #f3e8ff, #fce7f3); border-color: #1a1a1a; color: #1a1a1a; box-shadow: 2px 2px 0px #c9b8ff; }

  .offer-warning { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; margin-bottom: 16px; }
  .offer-warning p { font-size: 11px; color: #92400e; line-height: 1.5; margin: 0; font-weight: 600; }

  .offer-submit-btn {
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
  .offer-submit-btn:hover { transform: translateY(-2px); box-shadow: 6px 6px 0px #c9b8ff; }
  .offer-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ─── My Offers Panel ─── */
  .my-offers-panel {
    margin-bottom: 20px; background: white;
    border: 2px solid #1a1a1a; border-radius: 20px; padding: 20px;
    box-shadow: 4px 4px 0px #c9b8ff;
  }
  .my-offers-title { font-family: 'Caveat', cursive; font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  .my-offers-list { display: flex; flex-direction: column; gap: 8px; }
  .offer-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1.5px solid #e2e8f0; border-radius: 14px; background: #fafaf8; }
  .offer-row-name { font-family: 'Caveat', cursive; font-size: 17px; font-weight: 700; color: #1a1a1a; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .offer-row-amount { font-family: 'Caveat', cursive; font-size: 17px; font-weight: 700; color: #7e22ce; white-space: nowrap; }
  .offer-row-expiry { font-size: 10px; font-weight: 700; color: #94a3b8; white-space: nowrap; }
  .cancel-offer-btn { padding: 5px 12px; border-radius: 20px; border: 1.5px solid #fda4af; background: #fff1f2; font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800; color: #9f1239; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; }
  .cancel-offer-btn:hover { background: #9f1239; color: white; border-color: #9f1239; }
  .cancel-offer-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ─── Offers Received Panel ─── */
  .offers-received-panel {
    margin-bottom: 28px; background: white;
    border: 2px solid #1a1a1a; border-radius: 20px; padding: 20px;
    box-shadow: 4px 4px 0px #bbf7d0;
  }
  .offers-received-title {
    font-family: 'Caveat', cursive; font-size: 22px; font-weight: 700;
    color: #1a1a1a; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;
  }
  .offers-received-subtitle {
    font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 14px;
    padding: 8px 12px; background: #f0fdf4; border: 1.5px solid #bbf7d0;
    border-radius: 10px; display: flex; align-items: flex-start; gap: 6px; line-height: 1.5;
  }
  .offer-received-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border: 1.5px solid #e2e8f0;
    border-radius: 14px; background: #fafaf8;
    transition: border-color 0.15s ease;
  }
  .offer-received-row:hover { border-color: #bbf7d0; }
  .offer-received-row.expired { opacity: 0.5; }
  .offer-received-nft { flex: 1; min-width: 0; }
  .offer-received-nft-name {
    font-family: 'Caveat', cursive; font-size: 17px; font-weight: 700;
    color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .offer-received-buyer {
    font-size: 10px; color: #94a3b8; font-weight: 700; font-family: monospace;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;
  }
  .offer-received-amount {
    font-family: 'Caveat', cursive; font-size: 20px; font-weight: 700; color: #15803d;
    white-space: nowrap; flex-shrink: 0;
  }
  .offer-received-expiry { font-size: 10px; font-weight: 700; color: #94a3b8; white-space: nowrap; flex-shrink: 0; }
  .offer-received-expiry.expiring-soon { color: #f59e0b; }
  .offer-received-expiry.expired-label { color: #ef4444; }
  .accept-offer-btn {
    padding: 7px 14px; border-radius: 20px;
    border: 1.5px solid #22c55e; background: #f0fdf4;
    font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800;
    color: #15803d; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .accept-offer-btn:hover { background: #22c55e; color: white; border-color: #22c55e; }
  .accept-offer-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .offers-received-empty {
    text-align: center; padding: 24px; color: #94a3b8;
    font-size: 13px; font-weight: 600;
  }

  /* ─── Tab bar for panels ─── */
  .panels-tab-bar {
    display: flex; gap: 8px; margin-bottom: 16px;
  }
  .panel-tab {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #e2e8f0; background: white;
    font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 800; color: #64748b;
    cursor: pointer; transition: all 0.15s ease;
  }
  .panel-tab:hover { border-color: #c9b8ff; color: #7e22ce; }
  .panel-tab.active { background: linear-gradient(135deg, #f3e8ff, #fce7f3); border-color: #1a1a1a; color: #1a1a1a; box-shadow: 2px 2px 0px #c9b8ff; }
  .panel-tab .tab-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 50%;
    background: #1a1a1a; color: white; font-size: 10px; font-weight: 900;
  }
  .panel-tab.active .tab-badge { background: #7e22ce; }

  /* ─── Success toast ─── */
  .buy-success-toast {
    position: fixed; bottom: 32px; right: 32px; z-index: 9999;
    background: white; border: 2px solid #22c55e;
    border-radius: 18px; padding: 16px 20px;
    box-shadow: 5px 5px 0px #bbf7d0;
    display: flex; align-items: center; gap: 12px;
    transform: translateY(80px); opacity: 0;
    transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
    pointer-events: none;
  }
  .buy-success-toast.show { transform: translateY(0); opacity: 1; }
  .buy-success-icon { font-size: 28px; }
  .buy-success-text { font-family: 'Caveat', cursive; font-size: 20px; font-weight: 700; color: #15803d; }
  .buy-success-sub { font-size: 11px; color: #64748b; font-weight: 600; }

  @media (max-width: 768px) {
    .mkt-title { font-size: 32px; }
    .mkt-header { flex-direction: column; align-items: flex-start; }
    .mkt-search { width: 180px; }
    .listing-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
    .buy-success-toast { bottom: 16px; right: 16px; left: 16px; }
  }
`;

// ─── Price History Mini-Sparkline ─────────────────────────────────────────────
function PriceSparkline({ history }: { history: PriceHistoryEntry[] }) {
  if (!history.length) return null;
  const max = Math.max(...history.map(h => h.price));
  const avg = history.reduce((a, b) => a + b.price, 0) / history.length;
  return (
    <div className="price-history-bar">
      <span className="price-history-bar-label">Avg</span>
      <div className="price-history-sparkline">
        {history.slice(-8).map((h, i) => (
          <div
            key={i}
            className="price-history-bar-item"
            style={{ height: `${Math.max(15, (h.price / max) * 100)}%` }}
            title={`${h.price.toFixed(2)} SUI`}
          />
        ))}
      </div>
      <span className="price-history-avg">{avg.toFixed(2)} SUI</span>
    </div>
  );
}

// ─── Offer Modal ──────────────────────────────────────────────────────────────
interface OfferModalProps {
  item: (NFT & { priceMist?: string }) | null;
  priceHistory: PriceHistoryEntry[];
  onClose: () => void;
  onSubmit: (amountSui: number, expiryEpochs: number) => Promise<void>;
  isPending: boolean;
}

function OfferModal({ item, priceHistory, onClose, onSubmit, isPending }: OfferModalProps) {
  const [amount, setAmount] = useState("");
  const [expiryDays, setExpiryDays] = useState(7);
  const isActive = !!item;

  const EXPIRY_OPTIONS = [
    { label: "1d", epochs: 1 },
    { label: "3d", epochs: 3 },
    { label: "7d", epochs: 7 },
    { label: "30d", epochs: 30 },
    { label: "Never", epochs: 0 },
  ];

  const handleSubmit = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    await onSubmit(val, expiryDays);
  };

  const listedPrice = item?.price;
  const amountVal = parseFloat(amount);
  const isLow = amountVal > 0 && listedPrice && amountVal < listedPrice * 0.5;

  return (
    <div className={`modal-backdrop ${isActive ? "active" : ""}`} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="offer-modal">
        <div className="offer-modal-header">
          <span className="offer-modal-title">Make an Offer ✦</span>
          <button className="offer-modal-close" onClick={onClose}>✕</button>
        </div>

        {item && (
          <>
            <div className="offer-nft-preview">
              <div
                className="offer-nft-img"
                style={{ borderColor: RARITY_DOODLE_COLORS[Math.min(item.rarity ?? 0, 5)].border }}
              >
                {item.image
                  ? <img src={item.image} alt={item.name} />
                  : <div style={{ width: "100%", height: "100%", background: "#f3e8ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📦</div>
                }
              </div>
              <div className="offer-nft-info">
                <div className="offer-nft-name">{item.name}</div>
                <div className="offer-nft-listed">
                  Listed at <span>{item.price?.toFixed(2)} SUI</span>
                </div>
              </div>
            </div>

            {priceHistory.length > 0 && (
              <div className="offer-price-history">
                <div className="offer-price-history-title">
                  <TrendingUp size={11} /> Recent Sales
                </div>
                <div className="offer-price-history-entries">
                  {priceHistory.slice(-5).map((h, i) => (
                    <div key={i} className="offer-price-history-item">
                      <span className="offer-price-history-val">{h.price.toFixed(1)}</span>
                      <div className="offer-price-history-epoch">ep.{h.epoch}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="offer-input-section">
              <label className="offer-input-label">Your Offer Amount</label>
              <div className="offer-amount-row">
                <input
                  className="offer-amount-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <span className="offer-amount-currency">SUI</span>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="offer-input-label" style={{ display: "block", marginBottom: 8 }}>Offer Expires</label>
              <div className="offer-expiry-row">
                {EXPIRY_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    className={`offer-expiry-btn ${expiryDays === opt.epochs ? "active" : ""}`}
                    onClick={() => setExpiryDays(opt.epochs)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {isLow && (
              <div className="offer-warning">
                <AlertCircle size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                <p>Your offer is quite low. The seller may decline or ignore it.</p>
              </div>
            )}

            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}>
              Your SUI will be locked in the offer until accepted or cancelled. A 10% fee applies on acceptance.
            </div>

            <button
              className="offer-submit-btn"
              onClick={handleSubmit}
              disabled={isPending || !amount || parseFloat(amount) <= 0}
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />}
              {isPending ? "Submitting..." : `Offer ${amount || "—"} SUI`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Success Toast ─────────────────────────────────────────────────────────────
function SuccessToast({ show, message, sub }: { show: boolean; message: string; sub?: string }) {
  return (
    <div className={`buy-success-toast ${show ? "show" : ""}`}>
      <div className="buy-success-icon">🎉</div>
      <div>
        <div className="buy-success-text">{message}</div>
        {sub && <div className="buy-success-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main Marketplace Component ──────────────────────────────────────────────
export default function MarketplacePage() {
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [listings, setListings] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Offer system
  const [offerTarget, setOfferTarget] = useState<(NFT & { priceMist?: string }) | null>(null);
  const [offerTargetHistory, setOfferTargetHistory] = useState<PriceHistoryEntry[]>([]);
  const [priceHistories, setPriceHistories] = useState<Record<string, PriceHistoryEntry[]>>({});
  const [myOffers, setMyOffers] = useState<OfferData[]>([]);
  const [offersReceived, setOffersReceived] = useState<OfferData[]>([]);
  const [isAcceptingOffer, setIsAcceptingOffer] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"sent" | "received">("sent");

  // Success state
  const [successMsg, setSuccessMsg] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Filters
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

  const showToast = (msg: string, sub?: string) => {
    setSuccessMsg(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3500);
  };

  // ── Fetch listings ───────────────────────────────────────────────────────────
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

      const names = [...new Set(verifiedListings.map(l => l.name))];
      fetchPriceHistories(names);
    } catch (err) {
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not load marketplace listings." });
    } finally { setIsLoading(false); }
  }, [suiClient, NFT_TYPE, toast]);

  // ── Fetch price histories ────────────────────────────────────────────────────
  const fetchPriceHistories = useCallback(async (names: string[]) => {
    try {
      const registry = await suiClient.getObject({ id: PRICE_HISTORY_REGISTRY, options: { showContent: true } });
      const tableId = (registry.data?.content as any)?.fields?.histories?.fields?.id?.id;
      if (!tableId) return;

      const histories: Record<string, PriceHistoryEntry[]> = {};
      await Promise.all(names.map(async (name) => {
        try {
          const field = await suiClient.getDynamicFieldObject({
            parentId: tableId,
            name: { type: "0x1::string::String", value: name },
          });
          const hist = (field?.data?.content as any)?.fields?.value?.fields;
          if (!hist) return;
          const prices: number[] = hist.prices ?? [];
          const epochs: number[] = hist.epochs ?? [];
          const count = Number(hist.count ?? 0);
          const cursor = Number(hist.write_cursor ?? 0);
          const entries: PriceHistoryEntry[] = [];
          for (let i = 0; i < count; i++) {
            const idx = (cursor - count + i + 20) % 20;
            if (prices[idx] > 0) {
              entries.push({ price: mistToSui(prices[idx]), epoch: epochs[idx] });
            }
          }
          if (entries.length) histories[name] = entries;
        } catch { }
      }));
      setPriceHistories(histories);
    } catch { }
  }, [suiClient]);

  // ── Paginated event fetcher — fetches ALL pages until exhausted ─────────────
  const fetchAllEvents = useCallback(async (eventType: string): Promise<any[]> => {
    const all: any[] = [];
    let cursor: any = null;
    let page = 0;
    while (true) {
      const res: any = await suiClient.queryEvents({
        query: { MoveEventType: eventType },
        limit: 50,
        order: "descending",
        ...(cursor ? { cursor } : {}),
      });
      all.push(...res.data);
      page++;
      if (!res.hasNextPage || !res.nextCursor) break;
      cursor = res.nextCursor;
      // Safety: stop after 20 pages (1000 events) — adjust if needed
      if (page >= 20) break;
    }
    return all;
  }, [suiClient]);

  // ── Fetch my open offers (sent by me) ───────────────────────────────────────
  const fetchMyOffers = useCallback(async () => {
    if (!account) return;
    try {
      const myAddress = normalizeSuiId(account.address);
      // Paginate through ALL offer events — no limit blindspot
      const [allOfferEvents, allCancelledEvents, allAcceptedEvents] = await Promise.all([
        fetchAllEvents(`${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::OfferMadeEvent`),
        fetchAllEvents(`${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::OfferCancelledEvent`),
        fetchAllEvents(`${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::OfferAcceptedEvent`),
      ]);
      console.log("[fetchMyOffers] my address:", myAddress, "| total OfferMadeEvents:", allOfferEvents.length);
      allOfferEvents.forEach((e: any) => {
        console.log("  buyer:", normalizeSuiId(e.parsedJson?.buyer), "| nft:", e.parsedJson?.nft_name, "| offer_id:", e.parsedJson?.offer_id);
      });
      const myEvents = allOfferEvents.filter((e: any) => normalizeSuiId(e.parsedJson?.buyer) === myAddress);
      console.log("[fetchMyOffers] matched as buyer:", myEvents.length);
      const cancelledIds = new Set(allCancelledEvents.map((e: any) => normalizeSuiId(e.parsedJson?.offer_id)));
      const acceptedIds = new Set(allAcceptedEvents.map((e: any) => normalizeSuiId(e.parsedJson?.offer_id)));

      const activeOffers: OfferData[] = [];
      for (const e of myEvents) {
        const p = e.parsedJson as any;
        const offerId = normalizeSuiId(p.offer_id);
        console.log("[fetchMyOffers] offer:", offerId, "| cancelled:", cancelledIds.has(offerId), "| accepted:", acceptedIds.has(offerId));
        if (cancelledIds.has(offerId) || acceptedIds.has(offerId)) continue;
        activeOffers.push({
          id: offerId,
          nftId: normalizeSuiId(p.nft_id),
          nftName: p.nft_name ?? "Unknown",
          buyer: p.buyer,
          seller: p.seller,
          amount: mistToSui(p.amount),
          amountMist: p.amount?.toString() ?? "0",
          expiresAt: Number(p.expires_at ?? 0),
          createdAt: Number(p.created_at ?? 0),
        });
      }
      console.log("[fetchMyOffers] active offers to display:", activeOffers.length);
      setMyOffers(activeOffers);
    } catch (err) {
      console.error("[fetchMyOffers] error:", err);
    }
  }, [suiClient, account, fetchAllEvents]);

  // ── Fetch offers received (on my listed NFTs / targeting me as seller) ───────
  const fetchOffersReceived = useCallback(async () => {
    if (!account) return;
    try {
      const myAddress = normalizeSuiId(account.address);
      // Paginate through ALL events — no missed old offers
      const [allOfferEvents, allCancelledEvents, allAcceptedEvents] = await Promise.all([
        fetchAllEvents(`${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::OfferMadeEvent`),
        fetchAllEvents(`${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::OfferCancelledEvent`),
        fetchAllEvents(`${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::OfferAcceptedEvent`),
      ]);
      console.log("[fetchOffersReceived] my address:", myAddress, "| total events:", allOfferEvents.length);
      allOfferEvents.forEach((e: any) => {
        console.log("  [recv] seller in event:", e.parsedJson?.seller, "| buyer:", e.parsedJson?.buyer?.slice(0,10), "| nft:", e.parsedJson?.nft_name);
      });

      // The seller field may be the wallet address OR the kiosk object ID
      // (depends on what was passed as seller arg in make_offer).
      // Collect all kiosk IDs owned by this user to match against both.
      const myKioskIds = new Set<string>();
      myKioskIds.add(myAddress);
      try {
        const capsRes = await suiClient.getOwnedObjects({
          owner: account.address,
          filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
          options: { showContent: true },
        });
        for (const cap of capsRes.data) {
          const rawFor = (cap.data?.content as any)?.fields?.for;
          const kioskId = typeof rawFor === "string" ? rawFor
            : typeof rawFor?.id === "string" ? rawFor.id : null;
          if (kioskId) myKioskIds.add(normalizeSuiId(kioskId));
        }
      } catch { }
      console.log("[fetchOffersReceived] matching against ids:", [...myKioskIds]);

      const receivedEvents = allOfferEvents.filter(
        (e: any) => myKioskIds.has(normalizeSuiId(e.parsedJson?.seller))
      );
      console.log("[fetchOffersReceived] matched as seller:", receivedEvents.length);
      const cancelledIds = new Set(allCancelledEvents.map((e: any) => normalizeSuiId(e.parsedJson?.offer_id)));
      const acceptedIds_r = new Set(allAcceptedEvents.map((e: any) => normalizeSuiId(e.parsedJson?.offer_id)));
      const activeOffers: OfferData[] = [];
      for (const e of receivedEvents) {
        const p = e.parsedJson as any;
        const offerId = normalizeSuiId(p.offer_id);
        if (cancelledIds.has(offerId) || acceptedIds_r.has(offerId)) continue;
        activeOffers.push({
          id: offerId,
          nftId: normalizeSuiId(p.nft_id),
          nftName: p.nft_name ?? "Unknown",
          buyer: p.buyer,
          seller: p.seller,
          amount: mistToSui(p.amount),
          amountMist: p.amount?.toString() ?? "0",
          expiresAt: Number(p.expires_at ?? 0),
          createdAt: Number(p.created_at ?? 0),
        });
      }
      // Sort by amount descending (best offers first)
      activeOffers.sort((a, b) => b.amount - a.amount);
      setOffersReceived(activeOffers);
    } catch { }
  }, [suiClient, account, fetchAllEvents]);

  useEffect(() => { fetchListings(); }, [fetchListings]);
  useEffect(() => { fetchMyOffers(); fetchOffersReceived(); }, [fetchMyOffers, fetchOffersReceived]);

  // ── Buy NFT ──────────────────────────────────────────────────────────────────
  const executeBuy = async (item: NFT & { priceMist?: string }) => {
    if (!account) { toast({ variant: "destructive", title: "Connect your wallet first" }); return; }
    if (!item.kioskId) { toast({ variant: "destructive", title: "Missing kiosk data" }); return; }
    setIsPending(true);
    try {
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });
      if (capsRes.data.length === 0) {
        toast({ variant: "destructive", title: "No Kiosk Found", description: "Create a kiosk first." });
        setIsPending(false); return;
      }
      const buyerCapId = capsRes.data[0].data!.objectId;
      const rawFor = (capsRes.data[0].data?.content as any)?.fields?.for;
      const buyerKioskId: string | undefined = typeof rawFor === "string" ? rawFor : typeof rawFor?.id === "string" ? rawFor.id : undefined;
      if (!buyerKioskId) { toast({ variant: "destructive", title: "Could not resolve your Kiosk ID." }); setIsPending(false); return; }

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
          txb.object(PRICE_HISTORY_REGISTRY),
          txb.pure.address(normalizeSuiId(item.id)),
          txb.pure.string(item.name ?? ""),
          paymentCoin,
          txb.object(normalizeSuiId(buyerKioskId)),
          txb.object(normalizeSuiId(buyerCapId)),
        ],
      });
      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          showToast(`${item.name} is yours! ✨`, "Added to your Kiosk");
          setIsPending(false);
          setTimeout(fetchListings, 3000);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Purchase Failed", description: err.message });
          setIsPending(false);
        },
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Purchase Error", description: err.message });
      setIsPending(false);
    }
  };

  // ── Open offer modal ─────────────────────────────────────────────────────────
  const openOfferModal = async (item: NFT & { priceMist?: string }) => {
    if (!account) { toast({ variant: "destructive", title: "Connect your wallet first" }); return; }
    setOfferTarget(item);
    setOfferTargetHistory(priceHistories[item.name] ?? []);
  };

  // ── Submit offer ─────────────────────────────────────────────────────────────
  const submitOffer = async (amountSui: number, expiryEpochs: number) => {
    const item = offerTarget;
    if (!item || !account) return;
    setIsPending(true);
    try {
      const { epoch } = await suiClient.getLatestSuiSystemState();
      const expiresAt = expiryEpochs > 0 ? Number(epoch) + expiryEpochs : 0;
      const amountMist = suiToMist(amountSui);

      const txb = new Transaction();
      const [paymentCoin] = txb.splitCoins(txb.gas, [txb.pure.u64(amountMist)]);
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.MAKE_OFFER}`,
        arguments: [
          txb.object(OFFER_REGISTRY),
          txb.pure.address(normalizeSuiId(item.id)),
          txb.pure.string(item.name ?? ""),
          txb.pure.address(normalizeSuiId((item as any).kioskOwner ?? item.kioskId ?? "")),
          txb.pure.u64(expiresAt),
          paymentCoin,
        ],
      });
      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          showToast(`Offer of ${amountSui} SUI sent!`, `On ${item.name}`);
          setOfferTarget(null);
          setIsPending(false);
          setTimeout(fetchMyOffers, 2000);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Offer Failed", description: err.message });
          setIsPending(false);
        },
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Offer Error", description: err.message });
      setIsPending(false);
    }
  };

  // ── Cancel offer ─────────────────────────────────────────────────────────────
  const cancelOffer = async (offer: OfferData) => {
    if (!account) return;
    setIsPending(true);
    try {
      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.CANCEL_OFFER}`,
        arguments: [
          txb.object(OFFER_REGISTRY),
          txb.object(normalizeSuiId(offer.id)),
        ],
      });
      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          showToast("Offer cancelled", "SUI returned to your wallet");
          setIsPending(false);
          setTimeout(fetchMyOffers, 2000);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Cancel Failed", description: err.message });
          setIsPending(false);
        },
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Cancel Error", description: err.message });
      setIsPending(false);
    }
  };

  // ── Accept offer ─────────────────────────────────────────────────────────────
  const acceptOffer = async (offer: OfferData) => {
    if (!account) return;
    setIsAcceptingOffer(offer.id);
    try {
      // Get seller (my) kiosk cap
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });
      if (capsRes.data.length === 0) {
        toast({ variant: "destructive", title: "No Kiosk Found" });
        setIsAcceptingOffer(null); return;
      }
      const sellerCapId = capsRes.data[0].data!.objectId;
      const rawFor = (capsRes.data[0].data?.content as any)?.fields?.for;
      const sellerKioskId: string | undefined = typeof rawFor === "string" ? rawFor : typeof rawFor?.id === "string" ? rawFor.id : undefined;
      if (!sellerKioskId) {
        toast({ variant: "destructive", title: "Could not resolve your Kiosk ID." });
        setIsAcceptingOffer(null); return;
      }

      // We need to find the buyer's kiosk too
      // Query KioskCreatedEvent for the buyer to find their kiosk
      const buyerKioskEvents = await suiClient.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::KioskCreatedEvent` },
        limit: 200, order: "descending",
      });
      const buyerKioskEvent = buyerKioskEvents.data.find(
        (e: any) => e.parsedJson?.owner === offer.buyer
      );
      if (!buyerKioskEvent) {
        toast({ variant: "destructive", title: "Buyer has no kiosk", description: "The buyer must have a kiosk to receive the NFT." });
        setIsAcceptingOffer(null); return;
      }
      const buyerKioskId = normalizeSuiId((buyerKioskEvent.parsedJson as any)?.kiosk_id);

      // Get buyer's KioskOwnerCap — buyer must pass their cap
      // NOTE: In practice, accept_offer requires buyer_cap. This is a limitation:
      // the seller can't accept on behalf of the buyer without their cap.
      // A common pattern is to use a shared/escrow approach or require buyer involvement.
      // For now we show a helpful error message pointing this out.
      toast({
        variant: "destructive",
        title: "Accept Offer Limitation",
        description: "Accepting offers requires the buyer to co-sign (provide their KioskOwnerCap). This feature requires a contract update to support single-signer acceptance.",
      });
      setIsAcceptingOffer(null);

      // ─── If your contract is updated to not require buyer_cap, use this: ───
      // const txb = new Transaction();
      // txb.moveCall({
      //   target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.ACCEPT_OFFER}`,
      //   arguments: [
      //     txb.object(OFFER_REGISTRY),
      //     txb.object(normalizeSuiId(offer.id)),
      //     txb.object(normalizeSuiId(sellerKioskId)),
      //     txb.object(normalizeSuiId(sellerCapId)),
      //     txb.object(normalizeSuiId(buyerKioskId)),
      //     txb.object(BUYER_CAP_ID),  // <— can't get this without buyer signing
      //     txb.object(TREASURY_POOL),
      //     txb.object(PRICE_HISTORY_REGISTRY),
      //   ],
      // });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Accept Error", description: err.message });
      setIsAcceptingOffer(null);
    }
  };

  // ── Filters ──────────────────────────────────────────────────────────────────
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
    setHpRange({ min: "0", max: "9999" }); setAtkRange({ min: "0", max: "9999" }); setSpdRange({ min: "0", max: "9999" });
  };

  const showOffersPanel = !!account;

  return (
    <div className="mkt-page">
      <style dangerouslySetInnerHTML={{ __html: ALL_STYLES }} />
      <Navigation />

      {/* ── Offer Modal ── */}
      <OfferModal
        item={offerTarget}
        priceHistory={offerTargetHistory}
        onClose={() => setOfferTarget(null)}
        onSubmit={submitOffer}
        isPending={isPending}
      />

      {/* ── Success Toast ── */}
      <SuccessToast show={showSuccess} message={successMsg} />

      <div className="mkt-container">
        {/* ── Header ── */}
        <div className="mkt-header">
          <div>
            <div className="mkt-title">Marketplace ✦</div>
            <div className="mkt-subtitle">Verified on-chain listings · 10% kiosk-enforced royalty · Offers system live</div>
          </div>
          <div className="mkt-header-actions">
            <button className="mkt-btn icon-only" onClick={() => { fetchListings(); fetchMyOffers(); fetchOffersReceived(); }} disabled={isLoading}>
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

        {/* ── My Offers + Offers Received ── */}
        {showOffersPanel && (
          <div>
            {/* Tab bar */}
            <div className="panels-tab-bar">
              <button
                className={`panel-tab ${activePanel === "sent" ? "active" : ""}`}
                onClick={() => setActivePanel("sent")}
              >
                <Tag size={13} />
                My Offers
                {myOffers.length > 0 && <span className="tab-badge">{myOffers.length}</span>}
              </button>
              <button
                className={`panel-tab ${activePanel === "received" ? "active" : ""}`}
                onClick={() => setActivePanel("received")}
              >
                <Inbox size={13} />
                Offers Received
                {offersReceived.length > 0 && <span className="tab-badge">{offersReceived.length}</span>}
              </button>
            </div>

            {/* My Offers Panel */}
            {activePanel === "sent" && (
              <div className="my-offers-panel">
                <div className="my-offers-title">
                  <Tag size={18} /> My Open Offers
                </div>
                {myOffers.length > 0 && (
                <div
                  style={{
                    fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 12,
                    padding: "8px 12px", background: "#fffbeb", border: "1.5px solid #fde68a",
                    borderRadius: 10, display: "flex", gap: 6, lineHeight: 1.5, alignItems: "flex-start"
                  }}
                >
                  <AlertCircle size={13} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                  <span>
                    Cancelling returns your <strong>full SUI immediately</strong>. Expired offers also return your SUI — just press Cancel to reclaim it.
                  </span>
                </div>
                )}
                {myOffers.length === 0 ? (
                  <div className="offers-received-empty">
                    No open offers. Hit "Make Offer" on any listing to bid below the asking price!
                  </div>
                ) : null}
                <div className="my-offers-list">
                  {myOffers.map(offer => (
                    <div key={offer.id} className="offer-row">
                      <span className="offer-row-name">{offer.nftName}</span>
                      <span className="offer-row-amount">{offer.amount.toFixed(2)} SUI</span>
                      <span className="offer-row-expiry">
                        {offer.expiresAt > 0 ? `exp. ep.${offer.expiresAt}` : "No expiry"}
                      </span>
                      <button
                        className="cancel-offer-btn"
                        onClick={() => cancelOffer(offer)}
                        disabled={isPending}
                      >
                        {isPending ? <Loader2 size={10} className="animate-spin" /> : "Cancel & Reclaim"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offers Received Panel */}
            {activePanel === "received" && (
              <div className="offers-received-panel">
                <div className="offers-received-title">
                  <Inbox size={18} /> Offers Received
                </div>
                <div className="offers-received-subtitle">
                  <Info size={13} style={{ color: "#15803d", flexShrink: 0, marginTop: 1 }} />
                  <span>
                    These are offers made on your listed NFTs. You receive <strong>90% of the offer amount</strong> (10% protocol fee). 
                    Note: accepting requires a contract update for single-signer flow — see comments in code.
                  </span>
                </div>
                {offersReceived.length === 0 ? (
                  <div className="offers-received-empty">
                    No offers received yet. List some NFTs to start getting bids!
                  </div>
                ) : (
                  <div className="my-offers-list">
                    {offersReceived.map(offer => {
                      const isExpired = offer.expiresAt > 0; // we don't know current epoch here easily
                      const netAmount = offer.amount * 0.9;
                      return (
                        <div key={offer.id} className="offer-received-row">
                          <div className="offer-received-nft">
                            <div className="offer-received-nft-name">{offer.nftName}</div>
                            <div className="offer-received-buyer" title={offer.buyer}>
                              from {offer.buyer.slice(0, 6)}…{offer.buyer.slice(-4)}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div className="offer-received-amount">{offer.amount.toFixed(2)} SUI</div>
                            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                              you get ~{netAmount.toFixed(2)} SUI
                            </div>
                          </div>
                          <div className="offer-received-expiry">
                            {offer.expiresAt > 0 ? `exp. ep.${offer.expiresAt}` : "No expiry"}
                          </div>
                          <button
                            className="accept-offer-btn"
                            onClick={() => acceptOffer(offer)}
                            disabled={isAcceptingOffer !== null}
                            title="Accept this offer"
                          >
                            {isAcceptingOffer === offer.id
                              ? <Loader2 size={11} className="animate-spin" />
                              : <CheckCircle2 size={11} />
                            }
                            Accept
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mkt-layout">
          {/* ── Sidebar ── */}
          <aside>
            <div className="mkt-sidebar">
              <div className="sidebar-title">
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Filter size={16} /> Filters
                </span>
                <button className="sidebar-reset" onClick={resetFilters}>Reset</button>
              </div>
              <div className="sidebar-label">Rarity</div>
              <div className="rarity-pills">
                {([0, 1, 2, 3, 4, 5] as const).map(r => {
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
              {(["HP", "ATK", "SPD"] as const).map(label => {
                const rangeMap = { HP: hpRange, ATK: atkRange, SPD: spdRange };
                const setMap = { HP: setHpRange, ATK: setAtkRange, SPD: setSpdRange };
                const range = rangeMap[label];
                const setRange = setMap[label];
                return (
                  <div className="stat-section" key={label}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
                    <div className="stat-range-row">
                      <input type="number" className="stat-range-input" placeholder="Min" value={range.min} onChange={e => setRange((p: any) => ({ ...p, min: e.target.value }))} />
                      <input type="number" className="stat-range-input" placeholder="Max" value={range.max} onChange={e => setRange((p: any) => ({ ...p, max: e.target.value }))} />
                    </div>
                  </div>
                );
              })}
              <div className="sidebar-info">
                <Info size={13} style={{ color: "#a855f7", flexShrink: 0, marginTop: 1 }} />
                <p>Listings verified in real-time. Make offers on any listing — SUI is locked until accepted or cancelled.</p>
              </div>
            </div>
          </aside>

          {/* ── Main ── */}
          <main>
            {isLoading ? (
              <div className="mkt-loading">
                <div style={{ fontSize: 40 }}>🔍</div>
                <div className="mkt-loading-text">Scanning the marketplace...</div>
              </div>
            ) : filteredListings.length > 0 ? (
              <>
                <div className="listing-count">
                  <span>{filteredListings.length} listing{filteredListings.length !== 1 ? "s" : ""} found</span>
                  {selectedRarities.length > 0 && (
                    <button
                      onClick={() => setSelectedRarities([])}
                      style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 20, border: "1.5px solid #e2e8f0", background: "white", fontSize: 10, fontWeight: 800, color: "#94a3b8", cursor: "pointer" }}
                    >
                      <X size={9} /> Clear rarity
                    </button>
                  )}
                </div>
                <div className="listing-grid">
                  {filteredListings.map(item => {
                    const color = RARITY_DOODLE_COLORS[Math.min(item.rarity ?? 0, 5)];
                    const isYours = item.kioskId === account?.address;
                    const history = priceHistories[item.name];
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

                        {history && history.length > 0 && (
                          <PriceSparkline history={history} />
                        )}

                        <button
                          className={`buy-btn ${isYours ? "yours" : ""}`}
                          onClick={() => !isYours && executeBuy(item as any)}
                          disabled={isPending || isYours}
                        >
                          {isPending ? <Loader2 size={13} className="animate-spin" /> : null}
                          {isYours ? "Your Listing" : "✦ Buy Now"}
                        </button>

                        {!isYours && (
                          <button
                            className="offer-btn"
                            onClick={() => openOfferModal(item as any)}
                            disabled={isPending}
                          >
                            <Tag size={12} /> Make Offer
                          </button>
                        )}
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