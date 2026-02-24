"use client";

import { NFT, BURN_REWARDS } from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Image from "next/image";
import { Loader2, Flame, Coins, Shield, Sword, Zap, X, Tag } from "lucide-react";

const RARITY_LABELS = ["Common", "Rare", "Super Rare", "SSR", "Ultra Rare", "Legend Rare"];
const RARITY_DOODLE_COLORS = [
  { bg: "#f8f8f8", border: "#94a3b8", text: "#475569", shadow: "#cbd5e1" },
  { bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", shadow: "#bfdbfe" },
  { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", shadow: "#e9d5ff" },
  { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", shadow: "#f0abfc" },
  { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", shadow: "#fde68a" },
  { bg: "#fff1f2", border: "#fb7185", text: "#9f1239", shadow: "#fecdd3" },
];

const DIALOG_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  .nd-wrap {
    font-family: 'Nunito', sans-serif;
    position: relative;
  }

  .nd-card {
    background: white;
    border: 2px solid #1a1a1a;
    border-radius: 20px;
    overflow: hidden;
    display: grid;
    grid-template-columns: 1fr 1fr;
    position: relative;
    z-index: 1;
  }
  @media (max-width: 580px) {
    .nd-card { grid-template-columns: 1fr; }
    .nd-img-col { height: 220px; }
  }

  /* Shadow offset — mirrors .group-card-shadow */
  .nd-shadow {
    position: absolute;
    inset: 0;
    border-radius: 20px;
    transform: translate(6px, 6px);
    z-index: 0;
  }

  /* Close button — mirrors .tok-btn */
  .nd-close {
    position: absolute; top: 12px; right: 12px; z-index: 30;
    display: inline-flex; align-items: center; gap: 4px;
    padding: 6px 10px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a;
    background: white;
    font-family: 'Nunito', sans-serif;
    font-size: 11px; font-weight: 800;
    color: #1a1a1a;
    box-shadow: 2px 2px 0px #c9b8ff;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .nd-close:hover { transform: translateY(-1px); box-shadow: 3px 3px 0px #c9b8ff; }
  .nd-close:active { transform: translateY(1px); box-shadow: none; }

  /* Image column */
  .nd-img-col {
    position: relative;
    overflow: hidden;
    min-height: 380px;
  }
  .nd-img-col img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
  .nd-img-col:hover img { transform: scale(1.04); }
  .nd-img-fade {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 55%);
    pointer-events: none;
  }

  /* Rarity ribbon — mirrors .group-card-count style pill */
  .nd-rarity-pill {
    position: absolute; top: 10px; left: 10px;
    font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em;
    padding: 3px 10px; border-radius: 20px; border: 1.5px solid;
    z-index: 10;
  }

  /* Global ID chip */
  .nd-global-id {
    position: absolute; bottom: 10px; right: 10px;
    background: rgba(0,0,0,0.65);
    color: white; font-size: 10px; font-weight: 800;
    padding: 3px 9px; border-radius: 20px;
    backdrop-filter: blur(4px);
    z-index: 10;
    letter-spacing: 0.06em;
  }

  /* Variant pill */
  .nd-variant-pill {
    position: absolute; bottom: 10px; left: 10px;
    background: rgba(201,184,255,0.9);
    color: #5b21b6; font-size: 9px; font-weight: 800;
    padding: 3px 9px; border-radius: 20px;
    backdrop-filter: blur(4px);
    z-index: 10;
  }

  /* Info column */
  .nd-info-col {
    display: flex; flex-direction: column;
    padding: 24px 22px 20px;
    overflow-y: auto;
    max-height: 520px;
    background: white;
  }

  /* Name — mirrors .group-card-name */
  .nd-name {
    font-family: 'Caveat', cursive;
    font-size: 36px; font-weight: 700;
    color: #1a1a1a; line-height: 1;
    margin-bottom: 14px;
  }

  /* Divider — matches inventory gradient dividers */
  .nd-divider {
    width: 100%; height: 2px;
    background: linear-gradient(90deg, #c9b8ff, #ffb8d9, #b8ffe8);
    border-radius: 99px;
    margin: 14px 0;
    opacity: 0.5;
  }

  /* Stats grid — mirrors .token-stats style but as cards */
  .nd-stats-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
    margin-bottom: 2px;
  }
  .nd-stat {
    background: #fafafa;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    padding: 10px 6px;
    text-align: center;
    transition: border-color 0.15s ease;
  }
  .nd-stat:hover { border-color: #c9b8ff; }
  .nd-stat-icon {
    display: flex; align-items: center; justify-content: center; gap: 3px;
    font-size: 9px; font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 3px;
  }
  .nd-stat-val {
    font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700;
    color: #1a1a1a; line-height: 1;
  }
  .nd-stat-bar-wrap { width: 100%; height: 3px; background: #f1f5f9; border-radius: 99px; overflow: hidden; margin-top: 5px; }
  .nd-stat-bar { height: 100%; border-radius: 99px; }

  /* Metadata box — mirrors .token-row style */
  .nd-meta {
    background: #fafafa;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    padding: 12px 14px;
    transition: border-color 0.15s ease;
  }
  .nd-meta:hover { border-color: #c9b8ff; }
  .nd-meta-label {
    font-size: 9px; font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 5px;
  }
  .nd-meta-text { font-size: 12px; color: #64748b; line-height: 1.6; }
  .nd-meta-text strong { color: #1a1a1a; font-weight: 800; }

  /* Burn box — mirrors .inv-btn.danger style */
  .nd-burn {
    background: #fff0f0;
    border: 2px solid #fca5a5;
    border-radius: 14px;
    padding: 14px;
    margin-top: auto;
  }
  .nd-burn-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 6px;
  }
  .nd-burn-title {
    font-size: 9px; font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.08em; color: #ef4444;
    display: flex; align-items: center; gap: 4px;
  }
  .nd-burn-reward {
    display: flex; align-items: center; gap: 4px;
    font-size: 12px; font-weight: 900; color: #ef4444;
  }
  .nd-burn-desc { font-size: 11px; color: #94a3b8; margin-bottom: 12px; line-height: 1.5; }
  .nd-burn-desc strong { color: #ef4444; font-weight: 800; }

  /* Burn button — mirrors .inv-btn.danger */
  .nd-burn-btn {
    width: 100%; padding: 10px 14px;
    border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px;
    border: 2px solid #1a1a1a;
    background: #fff0f0;
    font-family: 'Nunito', sans-serif;
    font-size: 13px; font-weight: 800;
    color: #1a1a1a;
    box-shadow: 3px 3px 0px #fca5a5;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .nd-burn-btn:hover { transform: translateY(-2px); box-shadow: 5px 5px 0px #fca5a5; }
  .nd-burn-btn:active { transform: translateY(1px); box-shadow: 1px 1px 0px #fca5a5; }
  .nd-burn-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
`;

interface NFTDetailDialogProps {
  nft: NFT | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInventory?: boolean;
  onBurn?: () => void;
  isBurning?: boolean;
}

export function NFTDetailDialog({
  nft, open, onOpenChange, isInventory, onBurn, isBurning,
}: NFTDetailDialogProps) {
  if (!nft) return null;

  const rarity     = Math.min(nft.rarity ?? 0, 5);
  const color      = RARITY_DOODLE_COLORS[rarity];
  const burnReward = BURN_REWARDS[rarity] || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <style dangerouslySetInnerHTML={{ __html: DIALOG_STYLES }} />

      <DialogContent className="max-w-[800px] p-0 border-0 bg-transparent shadow-none overflow-visible">
        <VisuallyHidden>
          <DialogTitle>{nft.name} — NFT Detail</DialogTitle>
        </VisuallyHidden>

        <div className="nd-wrap">
          {/* Offset shadow — same as group card */}
          <div className="nd-shadow" style={{ background: color.shadow }} />

          <div className="nd-card" style={{ borderColor: color.border }}>

            {/* Close */}
            <button className="nd-close" onClick={() => onOpenChange(false)}>
              <X size={12} />
            </button>

            {/* ── Image ── */}
            <div className="nd-img-col" style={{ background: color.bg }}>
              <Image src={nft.image} alt={nft.name} fill className="object-cover" />
              <div className="nd-img-fade" />

              {/* Rarity pill — mirrors .rarity-badge */}
              <div
                className="nd-rarity-pill"
                style={{ background: color.bg, borderColor: color.border, color: color.text }}
              >
                {RARITY_LABELS[rarity]}
              </div>

              {/* Global ID */}
              <div className="nd-global-id">#{String(nft.globalId).padStart(4, "0")}</div>

              {/* Variant */}
              {nft.variantType && nft.variantType !== "Normal" && (
                <div className="nd-variant-pill">{nft.variantType}</div>
              )}
            </div>

            {/* ── Info ── */}
            <div className="nd-info-col">

              <div className="nd-name">{nft.name}</div>

              {/* Stats — mirrors .token-stats but as visual cards */}
              <div className="nd-stats-row">
                <StatCard
                  icon={<Shield size={10} className="text-blue-400" />}
                  label="HP" value={nft.hp} max={2500}
                  bar="linear-gradient(90deg,#60a5fa,#3b82f6)"
                />
                <StatCard
                  icon={<Sword size={10} className="text-red-400" />}
                  label="ATK" value={nft.atk} max={600}
                  bar="linear-gradient(90deg,#f87171,#ef4444)"
                />
                <StatCard
                  icon={<Zap size={10} className="text-yellow-400" />}
                  label="SPD" value={nft.spd} max={400}
                  bar="linear-gradient(90deg,#fbbf24,#f59e0b)"
                />
              </div>

              <div className="nd-divider" />

              {/* Metadata */}
              <div className="nd-meta">
                <div className="nd-meta-label">Protocol Metadata</div>
                <div className="nd-meta-text">
                  Summoned from <strong>{nft.lootboxSource}</strong>.{" "}
                  Each attribute is cryptographically rolled using verifiable randomness.{" "}
                  Current value:{" "}
                  <strong style={{ color: color.text }}>
                    {(nft.actualValue / 1_000_000_000).toFixed(2)} SUI
                  </strong>
                </div>
              </div>

              {/* Burn */}
              {isInventory && (
                <>
                  <div className="nd-divider" />
                  <div className="nd-burn">
                    <div className="nd-burn-header">
                      <div className="nd-burn-title"><Flame size={10} /> Burn Station</div>
                      <div className="nd-burn-reward">+{burnReward} <Coins size={12} /></div>
                    </div>
                    <div className="nd-burn-desc">
                      Sacrifice this hero to receive <strong>{burnReward} $GYATE</strong> tokens.
                      These tokens are integer units used in the summon shop.
                    </div>
                    <button className="nd-burn-btn" onClick={onBurn} disabled={isBurning}>
                      {isBurning
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Flame size={13} />
                      }
                      Burn for {burnReward} $GYATE
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon, label, value, max, bar }: {
  icon: React.ReactNode; label: string; value: number; max: number; bar: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="nd-stat">
      <div className="nd-stat-icon">{icon} {label}</div>
      <div className="nd-stat-val">{value}</div>
      <div className="nd-stat-bar-wrap">
        <div className="nd-stat-bar" style={{ width: `${pct}%`, background: bar }} />
      </div>
    </div>
  );
}