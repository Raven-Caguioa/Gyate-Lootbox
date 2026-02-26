"use client";

import { Navigation } from "@/components/navigation";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, OBJECT_IDS, STATS_REGISTRY } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Transaction } from "@mysten/sui/transactions";
import Image from "next/image";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PlayerStatsData {
  id: string; total_opens: string; total_burns: string;
  total_gyate_spent: string; rarity_mints: string[];
}
interface UserBadge { id: string; achievement_id: string; name: string; imageUrl: string; earnedAt: string; }
interface AchievementDef {
  id: string; name: string; description: string; badge_image_url: string;
  gyate_reward: string; requirement_type: string; requirement_value: string;
  requirement_rarity: string; enabled: boolean;
}
interface KioskEarnings { kioskId: string; kioskCapId: string; profitsMist: bigint; }

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const REQ_OPEN_COUNT = "0", REQ_BURN_COUNT = "1", REQ_RARITY_MINT_COUNT = "2", REQ_GYATE_SPENT = "3", REQ_ADMIN_GRANTED = "4";
const RARITY_LABELS = ["Common", "Rare", "Super Rare", "SSR", "Ultra Rare", "Legend Rare"];

// How long to poll after a tx before giving up (ms)
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 40000;

function mistToSui(mist: bigint): string {
  return (Number(mist) / 1_000_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function normAddr(addr: string): string {
  return addr.replace(/^0x/i, "").toLowerCase().replace(/^0+/, "");
}

function getProgress(ach: AchievementDef, stats: PlayerStatsData) {
  const required = parseInt(ach.requirement_value || "0");
  let current = 0;
  switch (ach.requirement_type) {
    case REQ_OPEN_COUNT: current = parseInt(stats.total_opens || "0"); break;
    case REQ_BURN_COUNT: current = parseInt(stats.total_burns || "0"); break;
    case REQ_GYATE_SPENT: current = parseInt(stats.total_gyate_spent || "0"); break;
    case REQ_RARITY_MINT_COUNT: {
      const idx = parseInt(ach.requirement_rarity || "0");
      current = parseInt(stats.rarity_mints?.[idx] || "0");
      break;
    }
    case REQ_ADMIN_GRANTED: default: return { current: 0, required: 0, pct: 0 };
  }
  return { current, required, pct: required > 0 ? Math.min((current / required) * 100, 100) : 0 };
}

function getRequirementLabel(ach: AchievementDef): string {
  const val = parseInt(ach.requirement_value || "0");
  switch (ach.requirement_type) {
    case REQ_OPEN_COUNT: return `Open ${val} lootbox${val !== 1 ? "es" : ""}`;
    case REQ_BURN_COUNT: return `Burn ${val} NFT${val !== 1 ? "s" : ""}`;
    case REQ_GYATE_SPENT: return `Spend ${val} $GYATE on lootboxes`;
    case REQ_RARITY_MINT_COUNT: return `Mint ${val} ${RARITY_LABELS[parseInt(ach.requirement_rarity || "0")] ?? "Unknown"} NFT${val !== 1 ? "s" : ""}`;
    case REQ_ADMIN_GRANTED: return "Granted by admin";
    default: return "Unknown requirement";
  }
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const PROFILE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  .prof-page { min-height: 100vh; background: #fafaf8; font-family: 'Nunito', sans-serif; }
  .prof-page::before {
    content: ''; position: fixed; inset: 0;
    background-image:
      radial-gradient(circle at 20% 10%, rgba(201,184,255,0.12) 0%, transparent 45%),
      radial-gradient(circle at 80% 90%, rgba(255,184,217,0.10) 0%, transparent 45%);
    pointer-events: none; z-index: 0;
  }
  .prof-container { max-width: 1100px; margin: 0 auto; padding: 36px 24px; position: relative; z-index: 1; }

  .prof-hero {
    background: white; border: 2px solid #1a1a1a; border-radius: 24px; padding: 28px;
    box-shadow: 6px 6px 0px #c9b8ff;
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px;
    margin-bottom: 32px;
  }
  .prof-hero-left { display: flex; align-items: center; gap: 20px; }
  .prof-avatar {
    width: 72px; height: 72px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a; background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 4px 4px 0px #c9b8ff; font-size: 32px; flex-shrink: 0;
  }
  .prof-name { font-family: 'Caveat', cursive; font-size: 34px; font-weight: 700; color: #1a1a1a; line-height: 1; margin-bottom: 6px; }
  .prof-addr { font-size: 11px; color: #94a3b8; font-family: monospace; font-weight: 600; }

  .sync-status {
    display: flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 700; color: #94a3b8;
  }
  .sync-status.syncing { color: #7e22ce; }
  .sync-status.done { color: #16a34a; }
  .sync-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #e2e8f0;
    transition: background 0.3s ease;
  }
  .sync-dot.active { background: #c9b8ff; animation: pulse-dot 1.2s ease-in-out infinite; }
  .sync-dot.done { background: #86efac; animation: none; }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.7); }
  }

  .prof-btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px;
    border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px;
    border: 2px solid #1a1a1a; background: white;
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; color: #1a1a1a;
    box-shadow: 3px 3px 0px #c9b8ff; cursor: pointer;
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
  }
  .prof-btn:hover { transform: translateY(-2px); box-shadow: 5px 5px 0px #c9b8ff; }
  .prof-btn:active { transform: translateY(1px); box-shadow: 1px 1px 0px #c9b8ff; }
  .prof-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .prof-btn.init {
    background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    font-size: 15px; padding: 14px 28px; box-shadow: 5px 5px 0px #c9b8ff;
  }
  .prof-btn.init:hover { box-shadow: 7px 7px 0px #c9b8ff; }
  .prof-btn.claim {
    background: linear-gradient(135deg, #fefce8, #fef9c3); border-color: #ca8a04;
    box-shadow: 3px 3px 0px #fcd34d; font-size: 12px; padding: 8px 14px;
  }
  .prof-btn.claim:hover { box-shadow: 5px 5px 0px #fcd34d; }
  .prof-btn.withdraw {
    background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-color: #16a34a;
    box-shadow: 4px 4px 0px #86efac; font-size: 14px; padding: 13px 24px;
  }
  .prof-btn.withdraw:hover { box-shadow: 6px 6px 0px #86efac; }
  .prof-btn.withdraw:disabled { background: #f8fafc; border-color: #e2e8f0; box-shadow: 3px 3px 0px #f1f5f9; color: #94a3b8; }

  .prof-tabs { display: flex; gap: 4px; border-bottom: 2px solid #f1f5f9; margin-bottom: 28px; }
  .prof-tab {
    display: flex; align-items: center; gap: 6px; padding: 10px 18px;
    border-bottom: 3px solid transparent;
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; color: #94a3b8;
    cursor: pointer; background: none; border-left:none; border-right:none; border-top:none;
    transition: color 0.15s ease; margin-bottom: -2px;
  }
  .prof-tab:hover { color: #1a1a1a; }
  .prof-tab.active { color: #1a1a1a; border-bottom-color: #1a1a1a; }
  .prof-tab-badge { font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 20px; border: 1.5px solid; }
  .prof-tab-badge.yellow { background: #fefce8; color: #92400e; border-color: #fcd34d; }
  .prof-tab-badge.green { background: #f0fdf4; color: #15803d; border-color: #86efac; }

  .stat-cards-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 28px; }
  @media (max-width: 700px) { .stat-cards-row { grid-template-columns: repeat(2,1fr); } }
  .stat-card { background: white; border: 2px solid #e2e8f0; border-radius: 18px; padding: 16px; transition: border-color 0.15s ease; }
  .stat-card:hover { border-color: #c9b8ff; }
  .stat-card-icon { font-size: 22px; margin-bottom: 8px; }
  .stat-card-value { font-family: 'Caveat', cursive; font-size: 36px; font-weight: 700; color: #1a1a1a; line-height: 1; }
  .stat-card-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-top: 4px; }

  .stats-layout { display: grid; grid-template-columns: 1fr 360px; gap: 28px; }
  @media (max-width: 900px) { .stats-layout { grid-template-columns: 1fr; } }

  .rarity-card { background: white; border: 2px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 4px 4px 0px #f1f5f9; }
  .rarity-card-title { font-family: 'Caveat', cursive; font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
  .rarity-card-sub { font-size: 12px; color: #94a3b8; margin-bottom: 20px; }
  .rarity-bar-row { margin-bottom: 14px; }
  .rarity-bar-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
  .rarity-bar-name { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .rarity-bar-count { font-size: 12px; font-weight: 800; color: #1a1a1a; }
  .rarity-bar-track { height: 8px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
  .rarity-bar-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }

  .badges-section-title { font-family: 'Caveat', cursive; font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .badge-card { background: white; border: 2px solid #e2e8f0; border-radius: 16px; padding: 14px; display: flex; align-items: center; gap: 14px; margin-bottom: 10px; transition: border-color 0.15s ease; }
  .badge-card:hover { border-color: #c9b8ff; }
  .badge-img { width: 52px; height: 52px; border-radius: 99px; border: 2px solid #e9d5ff; background: #fdf4ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; position: relative; }
  .badge-name { font-size: 13px; font-weight: 800; color: #1a1a1a; }
  .badge-epoch { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
  .badges-empty { text-align: center; padding: 40px 16px; background: #fafaf8; border: 2px dashed #e2e8f0; border-radius: 16px; }
  .badges-empty-text { font-size: 13px; color: #94a3b8; margin-bottom: 8px; }

  .ach-section { margin-bottom: 28px; }
  .ach-section-label { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 12px; }
  .ach-section-line { flex: 1; height: 1px; background: #f1f5f9; }
  .ach-card { background: white; border: 2px solid #e2e8f0; border-radius: 18px; padding: 16px; display: flex; align-items: center; gap: 14px; margin-bottom: 8px; transition: border-color 0.2s ease; }
  .ach-card.claimable { border-color: #fcd34d; background: #fffbeb; box-shadow: 3px 3px 0px #fde68a; }
  .ach-card.done { border-color: #86efac; background: #f0fdf4; }
  .ach-img { width: 56px; height: 56px; border-radius: 14px; flex-shrink: 0; border: 2px solid #e2e8f0; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center; background: #f8f8f8; }
  .ach-img.claimable { border-color: #fcd34d; background: #fefce8; }
  .ach-img.done { border-color: #86efac; background: #f0fdf4; }
  .ach-info { flex: 1; min-width: 0; }
  .ach-name { font-size: 13px; font-weight: 800; color: #1a1a1a; margin-bottom: 2px; }
  .ach-desc { font-size: 11px; color: #64748b; margin-bottom: 4px; }
  .ach-req { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
  .ach-reward { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 900; background: #fdf4ff; color: #7e22ce; border: 1.5px solid #e9d5ff; border-radius: 20px; padding: 2px 8px; }
  .ach-progress-track { height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden; margin-top: 6px; }
  .ach-progress-fill { height: 100%; border-radius: 99px; transition: width 0.5s ease; }
  .ach-progress-text { font-size: 9px; font-weight: 800; color: #94a3b8; margin-top: 3px; }
  .ach-done-label { font-size: 10px; font-weight: 900; color: #16a34a; text-transform: uppercase; letter-spacing: 0.06em; display: flex; align-items: center; gap: 4px; }
  .ach-locked-label { font-size: 10px; font-weight: 800; color: #94a3b8; display: flex; align-items: center; gap: 4px; }
  .ach-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  .ach-header-counts { font-size: 13px; font-weight: 700; color: #64748b; display: flex; gap: 12px; align-items: center; }
  .ach-count-ready { color: #ca8a04; font-weight: 900; }
  .ach-count-earned { color: #7e22ce; font-weight: 900; }

  .earnings-card { background: white; border: 2px solid #e2e8f0; border-radius: 24px; padding: 32px; box-shadow: 5px 5px 0px #f1f5f9; display: flex; flex-wrap: wrap; align-items: center; gap: 28px; margin-bottom: 20px; }
  .earnings-card.has-earnings { border-color: #86efac; box-shadow: 5px 5px 0px #dcfce7; }
  .earnings-icon { width: 72px; height: 72px; border-radius: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 32px; border: 2px solid #e2e8f0; }
  .earnings-icon.has { border-color: #86efac; background: #f0fdf4; }
  .earnings-icon.none { background: #f8fafc; }
  .earnings-amount { font-family: 'Caveat', cursive; font-size: 52px; font-weight: 700; color: #94a3b8; line-height: 1; }
  .earnings-amount.has { color: #16a34a; }
  .earnings-currency { font-size: 18px; font-weight: 900; color: #94a3b8; margin-left: 6px; }
  .earnings-mist { font-size: 11px; color: #94a3b8; font-family: monospace; }
  .earnings-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 4px; }
  .info-tiles { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
  @media (max-width: 700px) { .info-tiles { grid-template-columns: 1fr; } }
  .info-tile { background: white; border: 1.5px solid #f1f5f9; border-radius: 14px; padding: 14px; }
  .info-tile-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .info-tile-icon { font-size: 16px; }
  .info-tile-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .info-tile-text { font-size: 11px; color: #64748b; line-height: 1.6; }

  .setup-card { background: white; border: 2px solid #c9b8ff; border-radius: 24px; padding: 48px; text-align: center; box-shadow: 6px 6px 0px #e9d5ff; }
  .setup-icon { font-size: 48px; margin-bottom: 16px; }
  .setup-title { font-family: 'Caveat', cursive; font-size: 32px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .setup-desc { font-size: 14px; color: #64748b; max-width: 400px; margin: 0 auto 24px; line-height: 1.7; }
  .setup-waiting { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 13px; font-weight: 700; color: #7e22ce; margin-top: 16px; }

  .connect-card { background: white; border: 2px solid #e2e8f0; border-radius: 24px; padding: 80px 48px; text-align: center; margin: 0 auto; max-width: 480px; box-shadow: 6px 6px 0px #f1f5f9; }
  .connect-icon { font-size: 56px; margin-bottom: 20px; }
  .connect-title { font-family: 'Caveat', cursive; font-size: 34px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .connect-desc { font-size: 14px; color: #64748b; }

  .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 12px; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  @media (max-width: 768px) {
    .prof-hero { flex-direction: column; align-items: flex-start; }
    .stats-layout { grid-template-columns: 1fr; }
    .prof-tabs { overflow-x: auto; }
  }
`;

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function ProfilePage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const [activeTab, setActiveTab]           = useState<"stats" | "achievements" | "earnings">("stats");
  const [stats, setStats]                   = useState<PlayerStatsData | null>(null);
  const [badges, setBadges]                 = useState<UserBadge[]>([]);
  const [achievements, setAchievements]     = useState<AchievementDef[]>([]);
  const [earnings, setEarnings]             = useState<KioskEarnings | null>(null);
  const [isLoading, setIsLoading]           = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  // true while we are polling for stats after an init tx
  const [isPollingInit, setIsPollingInit]   = useState(false);
  const [claimingId, setClaimingId]         = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing]   = useState(false);
  // timestamp of last successful full fetch — shown in hero
  const [lastSynced, setLastSynced]         = useState<Date | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); }, []);

  // ── Stats fetch (shared object — two lookup paths) ──────────────────
  const fetchStats = useCallback(async (address: string): Promise<PlayerStatsData | null> => {
    const myNorm = normAddr(address);

    const hydrateById = async (objectId: string): Promise<PlayerStatsData | null> => {
      try {
        const obj = await suiClient.getObject({ id: objectId, options: { showContent: true } });
        const f = (obj.data?.content as any)?.fields;
        if (!f) return null;
        return {
          id: objectId,
          total_opens: String(f.total_opens ?? "0"),
          total_burns: String(f.total_burns ?? "0"),
          total_gyate_spent: String(f.total_gyate_spent ?? "0"),
          rarity_mints: Array.isArray(f.rarity_mints)
            ? f.rarity_mints.map(String)
            : ["0", "0", "0", "0", "0", "0"],
        };
      } catch { return null; }
    };

    // Path 1: scan StatsRegistry table
    try {
      const regObj = await suiClient.getObject({ id: STATS_REGISTRY, options: { showContent: true } });
      const tableId = (regObj.data?.content as any)?.fields?.stats_by_owner?.fields?.id?.id;
      if (tableId) {
        let cursor: string | undefined = undefined;
        do {
          const page = await suiClient.getDynamicFields({ parentId: tableId, cursor, limit: 50 });
          for (const entry of page.data) {
            if (normAddr(String(entry.name?.value ?? "")) === myNorm) {
              const fieldObj = await suiClient.getObject({ id: entry.objectId, options: { showContent: true } });
              const rawValue = (fieldObj.data?.content as any)?.fields?.value;
              const statsId: string | null =
                typeof rawValue === "string" ? rawValue
                : typeof rawValue?.id === "string" ? rawValue.id
                : null;
              if (statsId) {
                const result = await hydrateById(statsId);
                if (result) return result;
              }
              break;
            }
          }
          cursor = page.hasNextPage ? (page.nextCursor ?? undefined) : undefined;
        } while (cursor);
      }
    } catch { /* fall through */ }

    // Path 2: query StatsInitializedEvent
    try {
      const events = await suiClient.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::StatsInitializedEvent` },
        limit: 50,
      });
      for (const ev of events.data) {
        const parsed = ev.parsedJson as any;
        if (normAddr(String(parsed?.player ?? "")) === myNorm) {
          const rawId = parsed?.stats_id;
          const statsId: string | null =
            typeof rawId === "string" ? rawId
            : typeof rawId?.id === "string" ? rawId.id
            : null;
          if (statsId) {
            const result = await hydrateById(statsId);
            if (result) return result;
          }
        }
      }
    } catch { /* both paths failed */ }

    return null;
  }, [suiClient]);

  // ── Full profile fetch ──────────────────────────────────────────────
  const fetchProfileData = useCallback(async (silent = false) => {
    if (!account) return;
    if (!silent) setIsLoading(true);
    try {
      const fetchedStats = await fetchStats(account.address);
      setStats(fetchedStats);

      const badgeObjects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::AchievementBadge` },
        options: { showContent: true },
      });
      setBadges(badgeObjects.data.map((obj: any) => {
        const f = obj.data?.content?.fields;
        return { id: obj.data?.objectId, achievement_id: String(f.achievement_id), name: f.achievement_name, imageUrl: f.badge_image_url, earnedAt: f.earned_at };
      }));

      if (OBJECT_IDS?.ACHIEVEMENT_REGISTRY) {
        const regObj = await suiClient.getObject({ id: OBJECT_IDS.ACHIEVEMENT_REGISTRY, options: { showContent: true } });
        const tableId = (regObj.data?.content as any)?.fields?.achievements?.fields?.id?.id;
        if (tableId) {
          let allDynFields: any[] = [];
          let cursor: string | null | undefined = undefined;
          do {
            const page = await suiClient.getDynamicFields({ parentId: tableId, cursor: cursor ?? undefined, limit: 50 });
            allDynFields = [...allDynFields, ...page.data];
            cursor = page.hasNextPage ? page.nextCursor : null;
          } while (cursor);
          if (allDynFields.length > 0) {
            const defObjects = await suiClient.multiGetObjects({ ids: allDynFields.map(f => f.objectId), options: { showContent: true } });
            setAchievements(defObjects.map((obj: any) => {
              const f = obj.data?.content?.fields?.value?.fields ?? obj.data?.content?.fields;
              if (!f || !f.enabled) return null;
              return { id: String(f.id), name: f.name, description: f.description, badge_image_url: f.badge_image_url, gyate_reward: f.gyate_reward, requirement_type: String(f.requirement_type), requirement_value: f.requirement_value, requirement_rarity: String(f.requirement_rarity), enabled: f.enabled } as AchievementDef;
            }).filter((a): a is AchievementDef => a !== null));
          }
        }
      }

      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });
      if (capsRes.data.length > 0) {
        const kioskCapId = capsRes.data[0].data?.objectId!;
        const kioskId = (capsRes.data[0].data?.content as any)?.fields?.for;
        if (kioskId) {
          const kioskObj = await suiClient.getObject({ id: kioskId, options: { showContent: true } });
          const kioskFields = (kioskObj.data?.content as any)?.fields;
          const rawProfits = kioskFields?.profits?.fields?.value ?? kioskFields?.profits ?? "0";
          setEarnings({ kioskId, kioskCapId, profitsMist: BigInt(rawProfits.toString()) });
        }
      }

      setLastSynced(new Date());
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [account, suiClient, fetchStats]);

  // ── Auto-load on mount and when account changes ─────────────────────
  useEffect(() => {
    if (account) fetchProfileData();
  }, [account, fetchProfileData]);

  // ── Poll for stats after initialize_stats tx ────────────────────────
  // Keeps trying every POLL_INTERVAL_MS until stats appear or timeout.
  // Once found, runs a full fetchProfileData so everything is fresh.
  const startPollingForInit = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollStartRef.current = Date.now();
    setIsPollingInit(true);

    pollTimerRef.current = setInterval(async () => {
      if (!account) return;

      // Timed out
      if (Date.now() - pollStartRef.current > POLL_MAX_MS) {
        clearInterval(pollTimerRef.current!);
        pollTimerRef.current = null;
        setIsPollingInit(false);
        setIsInitializing(false);
        toast({ variant: "destructive", title: "Indexing Slow", description: "Stats are taking a while to appear. Try syncing manually in a moment." });
        return;
      }

      const result = await fetchStats(account.address);
      if (result) {
        clearInterval(pollTimerRef.current!);
        pollTimerRef.current = null;
        setIsPollingInit(false);
        setIsInitializing(false);
        // Do a full fetch now that stats are confirmed indexed
        await fetchProfileData(true);
      }
    }, POLL_INTERVAL_MS);
  }, [account, fetchStats, fetchProfileData, toast]);

  // ── Poll until data changes after a tx ─────────────────────────────
  // Takes a "snapshot" of the current state, then polls every 2s until
  // something actually changes on-chain, then does one final full fetch.
  // No spinner shown — updates happen silently in the background.
  const pollUntilChanged = useCallback((snapshot: {
    opens: string; burns: string; badgeCount: number; earningsMist: string;
  }) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollStartRef.current = Date.now();

    pollTimerRef.current = setInterval(async () => {
      if (!account) return;

      // Give up after POLL_MAX_MS
      if (Date.now() - pollStartRef.current > POLL_MAX_MS) {
        clearInterval(pollTimerRef.current!);
        pollTimerRef.current = null;
        return;
      }

      try {
        // Quick lightweight check: just fetch stats and badge count
        const newStats = await fetchStats(account.address);

        // Check if anything changed from the snapshot
        const statsChanged =
          newStats &&
          (newStats.total_opens !== snapshot.opens ||
           newStats.total_burns !== snapshot.burns);

        const newBadges = await suiClient.getOwnedObjects({
          owner: account.address,
          filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::AchievementBadge` },
          options: {},
        });
        const badgeChanged = newBadges.data.length !== snapshot.badgeCount;

        // Check kiosk balance change
        const capsRes = await suiClient.getOwnedObjects({
          owner: account.address,
          filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
          options: { showContent: true },
        });
        let newMist = snapshot.earningsMist;
        if (capsRes.data.length > 0) {
          const kioskId = (capsRes.data[0].data?.content as any)?.fields?.for;
          if (kioskId) {
            const kObj = await suiClient.getObject({ id: kioskId, options: { showContent: true } });
            const kf = (kObj.data?.content as any)?.fields;
            newMist = String(kf?.profits?.fields?.value ?? kf?.profits ?? "0");
          }
        }
        const earningsChanged = newMist !== snapshot.earningsMist;

        if (statsChanged || badgeChanged || earningsChanged) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          // Data changed — do a full silent refresh to update everything
          await fetchProfileData(true);
        }
      } catch {
        // swallow — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [account, fetchStats, fetchProfileData, suiClient]);

  // ── Initialize stats ────────────────────────────────────────────────
  const handleInitializeStats = async () => {
    if (!account) return;
    setIsInitializing(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::${FUNCTIONS.INITIALIZE_STATS}`,
      arguments: [txb.object(STATS_REGISTRY)],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Profile Initialized!", description: "Setting up your on-chain profile..." });
        // Start polling — don't resolve immediately, wait for indexer
        startPollingForInit();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Initialization Failed", description: err.message });
        setIsInitializing(false);
      },
    });
  };

  // ── Claim achievement ────────────────────────────────────────────────
  const handleClaim = async (achievementId: string) => {
    if (!account || !stats) return;
    setClaimingId(achievementId);
    // Snapshot current state so we know when something actually changed
    const snapshot = {
      opens: stats.total_opens,
      burns: stats.total_burns,
      badgeCount: badges.length,
      earningsMist: earnings ? earnings.profitsMist.toString() : "0",
    };
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::${FUNCTIONS.CLAIM_ACHIEVEMENT}`,
      arguments: [
        txb.object(OBJECT_IDS.ACHIEVEMENT_REGISTRY),
        txb.object(stats.id),
        txb.pure.u64(parseInt(achievementId)),
        txb.object(OBJECT_IDS.TREASURY_CAP),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "🏆 Achievement Claimed!", description: "Badge and GYATE reward sent to your wallet." });
        setClaimingId(null);
        pollUntilChanged(snapshot);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Claim Failed", description: err.message });
        setClaimingId(null);
      },
    });
  };

  // ── Withdraw earnings ────────────────────────────────────────────────
  const handleWithdrawEarnings = async () => {
    if (!account || !earnings || earnings.profitsMist <= 0n) return;
    setIsWithdrawing(true);
    const snapshot = {
      opens: stats?.total_opens ?? "0",
      burns: stats?.total_burns ?? "0",
      badgeCount: badges.length,
      earningsMist: earnings.profitsMist.toString(),
    };
    try {
      const txb = new Transaction();
      const [profitCoin] = txb.moveCall({
        target: "0x2::kiosk::withdraw",
        arguments: [
          txb.object(earnings.kioskId),
          txb.object(earnings.kioskCapId),
          txb.pure.option("u64", null),
        ],
      });
      txb.transferObjects([profitCoin], account.address);
      signAndExecute({ transaction: txb }, {
        onSuccess: () => {
          toast({ title: "💰 Earnings Withdrawn!", description: `${mistToSui(earnings.profitsMist)} SUI sent to your wallet.` });
          setIsWithdrawing(false);
          pollUntilChanged(snapshot);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Withdrawal Failed", description: err.message });
          setIsWithdrawing(false);
        },
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
      setIsWithdrawing(false);
    }
  };

  const claimedIds = new Set(badges.map(b => b.achievement_id));
  const readyCount = achievements.filter(a =>
    !claimedIds.has(String(a.id)) &&
    a.requirement_type !== REQ_ADMIN_GRANTED &&
    stats && getProgress(a, stats).pct >= 100
  ).length;

  const syncStatusClass = isLoading ? "syncing" : lastSynced ? "done" : "";
  const syncDotClass = isLoading ? "active" : lastSynced ? "done" : "";

  if (!account) {
    return (
      <div className="prof-page">
        <style dangerouslySetInnerHTML={{ __html: PROFILE_STYLES }} />
        <Navigation />
        <div className="prof-container" style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div className="connect-card">
            <div className="connect-icon">👛</div>
            <div className="connect-title">Connect Your Wallet</div>
            <div className="connect-desc">Connect your Sui wallet to view your player profile, achievements, and earnings.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="prof-page">
      <style dangerouslySetInnerHTML={{ __html: PROFILE_STYLES }} />
      <Navigation />

      <div className="prof-container">
        {/* Hero */}
        <div className="prof-hero">
          <div className="prof-hero-left">
            <div className="prof-avatar">🎴</div>
            <div>
              <div className="prof-name">Player Profile</div>
              <div className="prof-addr">{account.address.slice(0, 10)}...{account.address.slice(-6)}</div>
            </div>
          </div>

          {/* Sync status + manual refresh */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className={`sync-status ${syncStatusClass}`}>
              <div className={`sync-dot ${syncDotClass}`} />
              {isLoading
                ? "Syncing..."
                : lastSynced
                ? `Updated ${lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Not synced"
              }
            </div>
            <button
              className="prof-btn"
              onClick={() => fetchProfileData(false)}
              disabled={isLoading}
              style={{ fontSize: 12, padding: "8px 14px" }}
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              Sync
            </button>
          </div>
        </div>

        {/* Loading skeleton — first load only */}
        {isLoading && !stats ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
              {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 96 }} />)}
            </div>
            <div className="skeleton" style={{ height: 300 }} />
          </div>
        ) : !stats ? (
          /* Not initialized yet */
          <div className="setup-card">
            <div className="setup-icon">{isPollingInit ? "⏳" : "⚙️"}</div>
            <div className="setup-title">
              {isPollingInit ? "Setting Up Your Profile..." : "Setup Required"}
            </div>
            <div className="setup-desc">
              {isPollingInit
                ? "Transaction confirmed! Waiting for the network to index your profile — usually just a few seconds."
                : "To track your on-chain summons, burns, and unlock rewards, initialize your player stats object."
              }
            </div>
            {isPollingInit ? (
              <div className="setup-waiting">
                <Loader2 size={16} className="animate-spin" />
                Indexing on-chain...
              </div>
            ) : (
              <button className="prof-btn init" onClick={handleInitializeStats} disabled={isInitializing}>
                {isInitializing
                  ? <><Loader2 size={16} className="animate-spin" /> Confirming...</>
                  : "✦ Initialize Player Stats"
                }
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="prof-tabs">
              <button className={`prof-tab ${activeTab === "stats" ? "active" : ""}`} onClick={() => setActiveTab("stats")}>
                🎴 Overview
              </button>
              <button className={`prof-tab ${activeTab === "achievements" ? "active" : ""}`} onClick={() => setActiveTab("achievements")}>
                🏆 Achievements
                {readyCount > 0 && <span className="prof-tab-badge yellow">{readyCount} ready</span>}
              </button>
              <button className={`prof-tab ${activeTab === "earnings" ? "active" : ""}`} onClick={() => setActiveTab("earnings")}>
                💰 Earnings
                {earnings && earnings.profitsMist > 0n && (
                  <span className="prof-tab-badge green">{mistToSui(earnings.profitsMist)} SUI</span>
                )}
              </button>
            </div>

            {/* Stats tab */}
            {activeTab === "stats" && (
              <div>
                <div className="stat-cards-row">
                  {[
                    { icon: "📦", label: "Total Summons", value: stats.total_opens },
                    { icon: "🔥", label: "NFTs Burned",   value: stats.total_burns },
                    { icon: "⚡", label: "$GYATE Spent",  value: stats.total_gyate_spent },
                    { icon: "🏆", label: "Badges",        value: String(badges.length) },
                  ].map(s => (
                    <div key={s.label} className="stat-card">
                      <div className="stat-card-icon">{s.icon}</div>
                      <div className="stat-card-value">{s.value}</div>
                      <div className="stat-card-label">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="stats-layout">
                  <div className="rarity-card">
                    <div className="rarity-card-title">Rarity Distribution</div>
                    <div className="rarity-card-sub">Breakdown of all heroes minted per tier</div>
                    {[
                      { label: "Legend Rare", count: stats.rarity_mints[5], color: "#fb7185" },
                      { label: "Ultra Rare",  count: stats.rarity_mints[4], color: "#f59e0b" },
                      { label: "SSR",         count: stats.rarity_mints[3], color: "#e879f9" },
                      { label: "Super Rare",  count: stats.rarity_mints[2], color: "#a855f7" },
                      { label: "Rare",        count: stats.rarity_mints[1], color: "#60a5fa" },
                      { label: "Common",      count: stats.rarity_mints[0], color: "#94a3b8" },
                    ].map(r => {
                      const num = parseInt(r.count || "0");
                      const pct = Math.min((num / 100) * 100, 100);
                      return (
                        <div key={r.label} className="rarity-bar-row">
                          <div className="rarity-bar-header">
                            <span className="rarity-bar-name">{r.label}</span>
                            <span className="rarity-bar-count">{num}</span>
                          </div>
                          <div className="rarity-bar-track">
                            <div className="rarity-bar-fill" style={{ width: `${num > 0 ? Math.max(pct, 2) : 0}%`, background: r.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <div className="badges-section-title">🏆 Soulbound Badges</div>
                    {badges.length > 0 ? badges.map(badge => (
                      <div key={badge.id} className="badge-card">
                        <div className="badge-img">
                          {badge.imageUrl
                            ? <Image src={badge.imageUrl} alt={badge.name} fill className="object-contain" />
                            : <span style={{ fontSize: 22 }}>🏆</span>
                          }
                        </div>
                        <div>
                          <div className="badge-name">{badge.name}</div>
                          <div className="badge-epoch">Earned in Epoch {badge.earnedAt}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="badges-empty">
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🎖️</div>
                        <div className="badges-empty-text">No badges earned yet.</div>
                        <a href="/shop" style={{ fontSize: 12, color: "#7e22ce", fontWeight: 800, textDecoration: "none" }}>Go summon heroes →</a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "achievements" && (
              <AchievementsTab
                achievements={achievements} stats={stats}
                claimedAchievementIds={claimedIds} claimingId={claimingId}
                onClaim={handleClaim} onRefresh={() => fetchProfileData(false)} isLoading={isLoading}
              />
            )}

            {activeTab === "earnings" && (
              <EarningsTab
                earnings={earnings} isLoading={isLoading}
                isWithdrawing={isWithdrawing}
                onWithdraw={handleWithdrawEarnings}
                onRefresh={() => fetchProfileData(false)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Earnings Tab
// ─────────────────────────────────────────────

function EarningsTab({ earnings, isLoading, isWithdrawing, onWithdraw, onRefresh }: {
  earnings: KioskEarnings | null; isLoading: boolean; isWithdrawing: boolean;
  onWithdraw: () => void; onRefresh: () => void;
}) {
  const hasEarnings = earnings && earnings.profitsMist > 0n;
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>SUI earned from marketplace sales sits in your Kiosk until you withdraw it.</p>
        <button className="prof-btn" onClick={onRefresh} disabled={isLoading} style={{ fontSize: 12, padding: "8px 14px" }}>
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      {!earnings ? (
        <div style={{ background: "white", border: "2px solid #e2e8f0", borderRadius: 20, padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🛍️</div>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>No Kiosk found. Create one in your Inventory to start selling.</p>
          <a href="/inventory" style={{ fontSize: 12, color: "#7e22ce", fontWeight: 800, textDecoration: "none" }}>Go to Inventory →</a>
        </div>
      ) : (
        <div>
          <div className={`earnings-card ${hasEarnings ? "has-earnings" : ""}`}>
            <div className={`earnings-icon ${hasEarnings ? "has" : "none"}`}>{hasEarnings ? "💰" : "🏦"}</div>
            <div style={{ flex: 1 }}>
              <div className="earnings-label">Pending Kiosk Earnings</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span className={`earnings-amount ${hasEarnings ? "has" : ""}`}>{mistToSui(earnings.profitsMist)}</span>
                <span className="earnings-currency">SUI</span>
              </div>
              <div className="earnings-mist">{earnings.profitsMist.toString()} MIST</div>
            </div>
            <button className="prof-btn withdraw" onClick={onWithdraw} disabled={!hasEarnings || isWithdrawing}>
              {isWithdrawing ? <Loader2 size={14} className="animate-spin" /> : "↓"}
              {isWithdrawing ? "Withdrawing..." : "Withdraw to Wallet"}
            </button>
          </div>
          <div className="info-tiles">
            {[
              { icon: "📈", label: "How earnings work", text: "When a buyer purchases your NFT, the sale price goes directly into your Kiosk balance. Withdraw anytime — no expiry." },
              { icon: "🪙", label: "Protocol fee", text: "10% of each sale is taken as a marketplace fee before the remainder lands in your Kiosk. You always receive 90% of the listing price." },
              { icon: "↓", label: "Withdraw cost", text: "Withdrawing costs one standard Sui gas fee (~0.003 SUI). The entire pending balance is sent to your wallet in one transaction." },
            ].map(t => (
              <div key={t.label} className="info-tile">
                <div className="info-tile-header"><span className="info-tile-icon">{t.icon}</span><span className="info-tile-label">{t.label}</span></div>
                <p className="info-tile-text">{t.text}</p>
              </div>
            ))}
          </div>
          {!hasEarnings && (
            <div style={{ textAlign: "center", padding: "32px 24px", background: "white", border: "2px dashed #e2e8f0", borderRadius: 16, marginTop: 16 }}>
              <p style={{ fontSize: 13, color: "#94a3b8" }}>
                No pending earnings yet. List some heroes in the{" "}
                <a href="/marketplace" style={{ color: "#7e22ce", fontWeight: 800, textDecoration: "none" }}>marketplace</a> to start earning.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Achievements Tab
// ─────────────────────────────────────────────

function AchievementsTab({ achievements, stats, claimedAchievementIds, claimingId, onClaim, onRefresh, isLoading }: {
  achievements: AchievementDef[]; stats: PlayerStatsData; claimedAchievementIds: Set<string>;
  claimingId: string | null; onClaim: (id: string) => void; onRefresh: () => void; isLoading: boolean;
}) {
  const claimable  = achievements.filter(a => !claimedAchievementIds.has(String(a.id)) && a.requirement_type !== REQ_ADMIN_GRANTED && getProgress(a, stats).pct >= 100);
  const inProgress = achievements.filter(a => !claimedAchievementIds.has(String(a.id)) && (a.requirement_type === REQ_ADMIN_GRANTED || getProgress(a, stats).pct < 100));
  const claimed    = achievements.filter(a => claimedAchievementIds.has(String(a.id)));

  return (
    <div>
      <div className="ach-header">
        <div className="ach-header-counts">
          <span className="ach-count-ready">{claimable.length} claimable</span>
          <span>·</span>
          <span>{inProgress.length} in progress</span>
          <span>·</span>
          <span className="ach-count-earned">{claimed.length} earned</span>
        </div>
        <button className="prof-btn" onClick={onRefresh} disabled={isLoading} style={{ fontSize: 12, padding: "8px 14px" }}>
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      {achievements.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", background: "white", border: "2px dashed #e2e8f0", borderRadius: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>No achievements published yet.</p>
        </div>
      ) : (
        <div>
          {claimable.length > 0 && (
            <div className="ach-section">
              <div className="ach-section-label">⭐ Ready to Claim <div className="ach-section-line" /></div>
              {claimable.map(a => <AchCard key={a.id} a={a} stats={stats} status="claimable" claimingId={claimingId} onClaim={onClaim} />)}
            </div>
          )}
          {inProgress.length > 0 && (
            <div className="ach-section">
              <div className="ach-section-label">⚔️ In Progress <div className="ach-section-line" /></div>
              {inProgress.map(a => <AchCard key={a.id} a={a} stats={stats} status="locked" claimingId={claimingId} onClaim={onClaim} />)}
            </div>
          )}
          {claimed.length > 0 && (
            <div className="ach-section">
              <div className="ach-section-label">✅ Earned <div className="ach-section-line" /></div>
              {claimed.map(a => <AchCard key={a.id} a={a} stats={stats} status="claimed" claimingId={claimingId} onClaim={onClaim} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AchCard({ a, stats, status, claimingId, onClaim }: {
  a: AchievementDef; stats: PlayerStatsData; status: "claimable" | "locked" | "claimed";
  claimingId: string | null; onClaim: (id: string) => void;
}) {
  const isAdmin = a.requirement_type === REQ_ADMIN_GRANTED;
  const { current, required, pct } = isAdmin ? { current: 0, required: 0, pct: 0 } : getProgress(a, stats);
  const isClaiming = claimingId === a.id;

  return (
    <div className={`ach-card ${status === "claimable" ? "claimable" : status === "claimed" ? "done" : ""}`}>
      <div className={`ach-img ${status === "claimable" ? "claimable" : status === "claimed" ? "done" : ""}`}>
        {a.badge_image_url
          ? <Image src={a.badge_image_url} alt={a.name} fill className="object-contain p-1" />
          : <span style={{ fontSize: 24 }}>🏆</span>
        }
      </div>
      <div className="ach-info">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
          <div className="ach-name">{a.name}</div>
          {parseInt(a.gyate_reward || "0") > 0 && <span className="ach-reward">⚡ {a.gyate_reward} GYATE</span>}
        </div>
        {a.description && <div className="ach-desc">{a.description}</div>}
        <div className="ach-req">{getRequirementLabel(a)}</div>
        {status === "claimed" && <div className="ach-done-label">✓ Earned</div>}
        {status === "locked" && isAdmin && <div className="ach-locked-label">🔒 Admin granted only</div>}
        {status !== "claimed" && !isAdmin && (
          <div>
            <div className="ach-progress-track">
              <div className="ach-progress-fill" style={{ width: `${pct >= 100 ? 100 : Math.max(pct, 0)}%`, background: pct >= 100 ? "#ca8a04" : "#c9b8ff" }} />
            </div>
            <div className="ach-progress-text">{current.toLocaleString()} / {required.toLocaleString()} ({Math.floor(pct)}%)</div>
          </div>
        )}
      </div>
      {status === "claimable" && (
        <button className="prof-btn claim" onClick={() => onClaim(a.id)} disabled={isClaiming}>
          {isClaiming ? <Loader2 size={12} className="animate-spin" /> : "🏆 Claim"}
        </button>
      )}
    </div>
  );
}