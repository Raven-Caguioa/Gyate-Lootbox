"use client";

import { NFT, RARITY_LABELS } from "@/lib/mock-data";
import { Sword, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Rarity palette — mirrors inventory RARITY_DOODLE_COLORS
// ─────────────────────────────────────────────
const RARITY_DOODLE_COLORS = [
  { bg: "#f8f8f8", border: "#94a3b8", text: "#475569", shadow: "#cbd5e1" }, // Common
  { bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", shadow: "#bfdbfe" }, // Rare
  { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", shadow: "#e9d5ff" }, // Super Rare
  { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", shadow: "#f0abfc" }, // SSR
  { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", shadow: "#fde68a" }, // Ultra Rare
  { bg: "#fff1f2", border: "#fb7185", text: "#9f1239", shadow: "#fecdd3" }, // Legend Rare
];

const NFT_CARD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  .nft-doodle-card-wrap {
    position: relative;
    cursor: pointer;
    font-family: 'Nunito', sans-serif;
  }

  /* Hard offset shadow layer — scoped only to the card, not the full wrap height */
  .nft-doodle-shadow {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border-radius: 20px;
    z-index: 0;
    transform: translate(5px, 5px);
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    pointer-events: none;
  }

  /* Main card */
  .nft-doodle-card {
    position: relative;
    z-index: 1;
    border: 2px solid;
    border-radius: 20px;
    overflow: hidden;
    background: white;
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .nft-doodle-card-wrap:hover .nft-doodle-card {
    transform: translateY(-4px) rotate(-0.5deg);
  }
  .nft-doodle-card-wrap:hover .nft-doodle-shadow {
    transform: translate(7px, 8px);
  }

  /* Image area — overflow visible so stats overlay isn't clipped */
  .nft-doodle-img-wrap {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
  }
  .nft-doodle-img-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.35s ease;
  }
  .nft-doodle-card-wrap:hover .nft-doodle-img-wrap img {
    transform: scale(1.06);
  }

  /* Stats overlay — sits inside image area, slides up on hover */
  .nft-doodle-stats {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    padding: 24px 12px 10px;
    background: linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
    display: flex;
    justify-content: space-around;
    align-items: center;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.22s ease, transform 0.22s ease;
    pointer-events: none;
  }
  .nft-doodle-card-wrap:hover .nft-doodle-stats {
    opacity: 1;
    transform: translateY(0);
  }
  .nft-doodle-stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 800;
    color: white;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  }

  /* ID badge — top right */
  .nft-doodle-badge-id {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0,0,0,0.65);
    color: white;
    font-size: 10px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 20px;
    backdrop-filter: blur(4px);
    font-family: 'Nunito', sans-serif;
    z-index: 2;
  }
  /* Variant badge — top left */
  .nft-doodle-badge-variant {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(201, 184, 255, 0.9);
    color: #5b21b6;
    font-size: 10px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 20px;
    backdrop-filter: blur(4px);
    font-family: 'Nunito', sans-serif;
    z-index: 2;
  }

  /* Body */
  .nft-doodle-body {
    padding: 12px 14px 14px;
  }
  .nft-doodle-name {
    font-family: 'Caveat', cursive;
    font-size: 20px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 5px;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nft-doodle-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .nft-rarity-badge {
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    border-radius: 20px;
    border: 1.5px solid;
    display: inline-block;
  }
`;

interface NFTCardProps {
  nft: NFT;
  className?: string;
  onClick?: () => void;
  /** @deprecated price is now rendered by the parent (marketplace listing-price-tag). Do not pass showPrice. */
  showPrice?: boolean;
}

export function NFTCard({ nft, className, onClick }: NFTCardProps) {
  const color = RARITY_DOODLE_COLORS[Math.min(nft.rarity ?? 0, 5)];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: NFT_CARD_STYLES }} />

      <div className={cn("nft-doodle-card-wrap", className)} onClick={onClick}>
        {/* Shadow layer — matches card bounds only */}
        <div className="nft-doodle-shadow" style={{ background: color.shadow }} />

        {/* Card */}
        <div
          className="nft-doodle-card"
          style={{ background: color.bg, borderColor: color.border }}
        >
          {/* Image + overlays */}
          <div className="nft-doodle-img-wrap">
            <img src={nft.image} alt={nft.name} />

            {/* Hover stats overlay */}
            <div className="nft-doodle-stats">
              <span className="nft-doodle-stat">
                <Sword size={11} color="#f87171" /> {nft.atk}
              </span>
              <span className="nft-doodle-stat">
                <Shield size={11} color="#60a5fa" /> {nft.hp}
              </span>
              <span className="nft-doodle-stat">
                <Zap size={11} color="#fbbf24" /> {nft.spd}
              </span>
            </div>

            {/* ID badge */}
            <div className="nft-doodle-badge-id">#{nft.globalId}</div>

            {/* Variant badge */}
            {nft.variantType && nft.variantType !== "Normal" && (
              <div className="nft-doodle-badge-variant">{nft.variantType}</div>
            )}
          </div>

          {/* Body */}
          <div className="nft-doodle-body">
            <div className="nft-doodle-name">{nft.name}</div>
            <div className="nft-doodle-meta">
              <span
                className="nft-rarity-badge"
                style={{
                  background: color.bg,
                  borderColor: color.border,
                  color: color.text,
                }}
              >
                {RARITY_LABELS[nft.rarity]}
              </span>
            </div>
            {/* ✦ Price intentionally removed from card body.
                The marketplace renders its own .listing-price-tag overlay
                and a separate price row below the card. */}
          </div>
        </div>
      </div>
    </>
  );
}