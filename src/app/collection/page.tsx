"use client";

import { Navigation } from "@/components/navigation";
import { Search, RefreshCw, Lock, CheckCircle2, ChevronDown, ChevronUp, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID, LOOTBOX_REGISTRY, MODULE_NAMES } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IndexEntry {
  name: string;
  rarity: number;
  baseImageUrl: string;
  lootboxSource: string;
  owned: boolean | null; // null = wallet not connected
}

interface LootboxSet {
  id: string;
  name: string;
  entries: IndexEntry[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RARITY_LABELS = ["Common", "Rare", "Super Rare", "SSR", "Ultra Rare", "Legend"];
const RARITY_COLORS = [
  { bg: "#f8f8f8", border: "#94a3b8", text: "#475569", shadow: "#cbd5e1", glow: "rgba(148,163,184,0.25)" },
  { bg: "#eff6ff", border: "#60a5fa", text: "#1d4ed8", shadow: "#bfdbfe", glow: "rgba(96,165,250,0.25)" },
  { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", shadow: "#e9d5ff", glow: "rgba(168,85,247,0.25)" },
  { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", shadow: "#f0abfc", glow: "rgba(232,121,249,0.25)" },
  { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", shadow: "#fde68a", glow: "rgba(245,158,11,0.25)" },
  { bg: "#fff1f2", border: "#fb7185", text: "#9f1239", shadow: "#fecdd3", glow: "rgba(251,113,133,0.35)" },
];

const PAGE_SIZE = 24;

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;600;700;800&display=swap');

  .idx-page { min-height: 100vh; background: #fafaf8; font-family: 'Nunito', sans-serif; }
  .idx-page::before {
    content: ''; position: fixed; inset: 0;
    background-image:
      radial-gradient(circle at 15% 15%, rgba(201,184,255,0.14) 0%, transparent 50%),
      radial-gradient(circle at 85% 80%, rgba(255,184,217,0.10) 0%, transparent 50%);
    pointer-events: none; z-index: 0;
  }
  .idx-wrap { max-width: 1280px; margin: 0 auto; padding: 36px 24px; position: relative; z-index: 1; }

  /* ── Header ── */
  .idx-header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 32px; }
  .idx-title { font-family: 'Caveat', cursive; font-size: 48px; font-weight: 700; color: #1a1a1a; line-height: 1; margin-bottom: 4px; }
  .idx-subtitle { font-size: 13px; color: #64748b; font-weight: 600; }
  .idx-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

  /* ── Search ── */
  .idx-search-wrap { position: relative; }
  .idx-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
  .idx-search {
    padding: 10px 14px 10px 36px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #1a1a1a; background: white;
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 600;
    box-shadow: 3px 3px 0px #c9b8ff; outline: none; width: 220px; color: #1a1a1a;
    transition: box-shadow 0.2s;
  }
  .idx-search:focus { box-shadow: 5px 5px 0px #c9b8ff; }
  .idx-search::placeholder { color: #94a3b8; }

  /* ── Buttons ── */
  .idx-btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px;
    border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px;
    border: 2px solid #1a1a1a; background: white;
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; color: #1a1a1a;
    box-shadow: 3px 3px 0px #c9b8ff; cursor: pointer;
    transition: all 0.2s cubic-bezier(0.175,0.885,0.32,1.275);
  }
  .idx-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 5px 5px 0px #c9b8ff; }
  .idx-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .idx-btn.icon-only { padding: 10px 12px; }

  /* ── Tabs ── */
  .idx-tabs { display: flex; gap: 6px; margin-bottom: 28px; }
  .idx-tab {
    padding: 8px 20px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #e2e8f0; background: white;
    font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 800; color: #64748b;
    cursor: pointer; transition: all 0.15s ease;
  }
  .idx-tab:hover { border-color: #c9b8ff; color: #7e22ce; }
  .idx-tab.active {
    background: linear-gradient(135deg, #f3e8ff, #fce7f3);
    border-color: #1a1a1a; color: #1a1a1a;
    box-shadow: 2px 2px 0px #c9b8ff;
  }

  /* ── Rarity filter ── */
  .filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 28px; }
  .filter-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; display: flex; align-items: center; gap: 4px; margin-right: 4px; }
  .filter-pill {
    padding: 6px 14px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #e2e8f0; background: white;
    font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800; color: #64748b;
    cursor: pointer; transition: all 0.15s ease;
  }
  .filter-pill:hover { border-color: #c9b8ff; color: #7e22ce; }
  .filter-pill.active { background: linear-gradient(135deg,#f3e8ff,#fce7f3); border-color: #1a1a1a; color: #1a1a1a; box-shadow: 2px 2px 0px #c9b8ff; }

  /* ── Stats bar ── */
  .idx-stats {
    display: flex; gap: 16px; flex-wrap: wrap; align-items: center;
    padding: 20px 24px; background: white;
    border: 2px solid #1a1a1a; border-radius: 20px;
    margin-bottom: 28px; box-shadow: 4px 4px 0px #ffb8d9;
  }
  .idx-stat { display: flex; flex-direction: column; gap: 2px; }
  .idx-stat-val { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; line-height: 1; }
  .idx-stat-lbl { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .idx-stat-div { width: 1.5px; background: #f1f5f9; align-self: stretch; margin: 0 4px; }

  /* ── Lootbox section ──
     Use a 4-column grid so every column is always vertically centred and
     the progress bar / hero-count / chevron never wrap or drift.          */
  .lb-section { margin-bottom: 24px; border: 2px solid #1a1a1a; border-radius: 20px; overflow: hidden; background: white; box-shadow: 4px 4px 0px #c9b8ff; }
  .lb-header {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    align-items: center;
    column-gap: 16px;
    padding: 16px 20px;
    cursor: pointer;
    background: linear-gradient(135deg, rgba(201,184,255,0.12), rgba(255,184,217,0.08));
    border-bottom: 2px solid transparent;
    transition: background 0.2s;
    user-select: none;
  }
  .lb-header.open { border-bottom-color: #e2e8f0; }
  .lb-header:hover { background: linear-gradient(135deg, rgba(201,184,255,0.2), rgba(255,184,217,0.14)); }

  .lb-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .lb-icon { font-size: 22px; flex-shrink: 0; line-height: 1; }
  .lb-name { font-family: 'Caveat', cursive; font-size: 26px; font-weight: 700; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1; }

  .lb-prog { min-width: 150px; }
  .lb-prog-label { font-size: 10px; font-weight: 800; color: #64748b; margin-bottom: 5px; white-space: nowrap; }
  .lb-prog-bar { height: 8px; background: #f1f5f9; border-radius: 100px; border: 1.5px solid #e2e8f0; overflow: hidden; }
  .lb-prog-fill { height: 100%; border-radius: 100px; background: linear-gradient(90deg, #c9b8ff, #ff3d9a); transition: width 0.6s cubic-bezier(0.34,1.56,0.64,1); }

  .lb-count { font-size: 12px; font-weight: 700; color: #64748b; white-space: nowrap; }
  .lb-chevron { color: #94a3b8; display: flex; align-items: center; }

  /* ── Cards grid ── */
  .idx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 16px; padding: 20px; }
  .idx-all-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 16px; }

  /* ── Card ── */
  .idx-card { position: relative; border-radius: 16px; overflow: hidden; border: 2px solid; transition: all 0.25s cubic-bezier(0.175,0.885,0.32,1.275); }
  .idx-card.owned { cursor: pointer; }
  .idx-card.owned:hover { transform: translateY(-4px) rotate(-0.4deg); }
  .idx-card-shadow { position: absolute; inset: 0; border-radius: 14px; z-index: -1; transform: translate(4px,4px); }
  .idx-img-wrap { position: relative; aspect-ratio: 1; overflow: hidden; }
  .idx-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
  .idx-card.owned:hover .idx-img-wrap img { transform: scale(1.07); }
  .idx-mystery {
    width: 100%; aspect-ratio: 1;
    background: radial-gradient(ellipse at center, rgba(30,27,75,0.95) 0%, #0f0f1a 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  }
  .idx-mystery-q { font-family: 'Caveat', cursive; font-size: 44px; font-weight: 700; color: rgba(255,255,255,0.13); line-height: 1; user-select: none; }
  .idx-check { position: absolute; top: 7px; right: 7px; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
  .idx-rarity-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; }
  .idx-card-body { padding: 10px 12px 12px; }
  .idx-card-name { font-family: 'Caveat', cursive; font-size: 17px; font-weight: 700; color: #1a1a1a; margin-bottom: 5px; line-height: 1.15; }
  .idx-card-name.mystery { color: #94a3b8; }
  .idx-rarity-pill { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.07em; padding: 2px 7px; border-radius: 20px; border: 1.5px solid; display: inline-block; }

  /* ── All-tab sort row ── */
  .all-sort-row { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .all-sort-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; display: flex; align-items: center; gap: 4px; margin-right: 4px; }
  .sort-pill {
    padding: 6px 14px;
    border-radius: 15px 255px 15px 225px / 225px 15px 255px 15px;
    border: 2px solid #e2e8f0; background: white;
    font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800; color: #64748b;
    cursor: pointer; transition: all 0.15s ease;
  }
  .sort-pill:hover { border-color: #c9b8ff; color: #7e22ce; }
  .sort-pill.active { background: linear-gradient(135deg,#f3e8ff,#fce7f3); border-color: #1a1a1a; color: #1a1a1a; box-shadow: 2px 2px 0px #c9b8ff; }

  /* ── Pagination ── */
  .idx-pagination { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 32px; flex-wrap: wrap; }
  .idx-page-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 36px; height: 36px; padding: 0 10px;
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    border: 2px solid #e2e8f0; background: white;
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 800; color: #64748b;
    cursor: pointer; transition: all 0.15s ease;
  }
  .idx-page-btn:hover:not(:disabled) { border-color: #c9b8ff; color: #7e22ce; }
  .idx-page-btn.active { background: linear-gradient(135deg,#f3e8ff,#fce7f3); border-color: #1a1a1a; color: #1a1a1a; box-shadow: 2px 2px 0px #c9b8ff; }
  .idx-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .idx-page-info { font-size: 12px; font-weight: 700; color: #94a3b8; padding: 0 4px; }

  /* ── Empty / Loading ── */
  .idx-empty { text-align: center; padding: 80px 24px; background: white; border: 2px dashed #e2e8f0; border-radius: 24px; }
  .idx-empty-icon { font-size: 48px; margin-bottom: 16px; }
  .idx-empty-title { font-family: 'Caveat', cursive; font-size: 28px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .idx-empty-desc { font-size: 13px; color: #64748b; }
  .idx-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0; gap: 16px; }
  .idx-loading-text { font-family: 'Caveat', cursive; font-size: 22px; color: #94a3b8; }

  @media (max-width: 768px) {
    .idx-title { font-size: 34px; }
    .idx-grid, .idx-all-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
    .lb-header { grid-template-columns: 1fr auto; }
    .lb-prog { display: none; }
    .lb-count { display: none; }
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rarityGradient(rarity: number) {
  return [
    "linear-gradient(90deg,#94a3b8,#cbd5e1)",
    "linear-gradient(90deg,#60a5fa,#93c5fd)",
    "linear-gradient(90deg,#a855f7,#d8b4fe)",
    "linear-gradient(90deg,#e879f9,#f0abfc)",
    "linear-gradient(90deg,#f59e0b,#fde68a)",
    "linear-gradient(90deg,#fb7185,#fecdd3)",
  ][rarity] ?? "linear-gradient(90deg,#94a3b8,#cbd5e1)";
}

function buildPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function IndexCard({ entry }: { entry: IndexEntry }) {
  const c = RARITY_COLORS[entry.rarity] ?? RARITY_COLORS[0];
  return (
    <div style={{ position: "relative" }}>
      <div className="idx-card-shadow" style={{ background: c.shadow }} />
      <div
        className={`idx-card ${entry.owned ? "owned" : ""}`}
        style={{ borderColor: entry.owned ? c.border : "#d1d5db", background: entry.owned ? c.bg : "#f9fafb" }}
        onMouseEnter={e => { if (entry.owned) (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${c.glow}`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
      >
        <div className="idx-img-wrap">
          {entry.owned ? (
            <img src={entry.baseImageUrl} alt={entry.name} loading="lazy" />
          ) : (
            <div className="idx-mystery" style={{ boxShadow: `inset 0 0 28px ${c.glow}` }}>
              <div className="idx-mystery-q">?</div>
              <Lock size={15} color="rgba(255,255,255,0.22)" />
            </div>
          )}
          <div className="idx-rarity-bar" style={{ background: rarityGradient(entry.rarity) }} />
          {entry.owned && (
            <div className="idx-check"><CheckCircle2 size={13} color="#4ade80" /></div>
          )}
        </div>
        <div className="idx-card-body">
          <div className={`idx-card-name ${entry.owned ? "" : "mystery"}`}>
            {entry.owned ? entry.name : "???"}
          </div>
          <span className="idx-rarity-pill" style={{ background: c.bg, borderColor: c.border, color: c.text }}>
            {RARITY_LABELS[entry.rarity]}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function IndexPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { toast } = useToast();

  const [sets, setSets] = useState<LootboxSet[]>([]);
  const [ownedNames, setOwnedNames] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"sets" | "all">("sets");
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [allPage, setAllPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc"); // asc = Common → Legend

  // Reset page when filters/tab/sort change
  useEffect(() => { setAllPage(1); }, [search, rarityFilter, activeTab, sortOrder]);

  // ── Fetch lootbox roster ──────────────────────────────────────────────────
  const fetchIndex = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await suiClient.getObject({ id: LOOTBOX_REGISTRY, options: { showContent: true } });
      const allIds: string[] = (reg.data?.content as any)?.fields?.all_ids ?? [];
      if (allIds.length === 0) { setSets([]); setIsLoading(false); return; }

      const boxes = await suiClient.multiGetObjects({ ids: allIds, options: { showContent: true } });
      const newSets: LootboxSet[] = boxes
        .filter(o => o.data?.content)
        .map((obj: any) => {
          const f = obj.data.content.fields;
          const extract = (configs: any[], rarity: number): IndexEntry[] =>
            (configs ?? []).map((c: any) => ({
              name: c.fields.name,
              rarity,
              baseImageUrl: c.fields.base_image_url,
              lootboxSource: f.name,
              owned: null,
            }));
          return {
            id: obj.data.objectId,
            name: f.name,
            entries: [
              ...extract(f.common_configs, 0),
              ...extract(f.rare_configs, 1),
              ...extract(f.super_rare_configs, 2),
              ...extract(f.ssr_configs, 3),
              ...extract(f.ultra_rare_configs, 4),
              ...extract(f.legend_rare_configs, 5),
            ],
          };
        });

      setSets(newSets);
      setExpanded(new Set(newSets.map(s => s.id)));
    } catch (err) {
      console.error("fetchIndex:", err);
      toast({ variant: "destructive", title: "Failed to load index" });
    } finally {
      setIsLoading(false);
    }
  }, [suiClient, toast]);

  // ── Fetch owned names from kiosk ──────────────────────────────────────────
  const fetchOwned = useCallback(async () => {
    if (!account) { setOwnedNames(new Set()); return; }
    try {
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });
      if (capsRes.data.length === 0) { setOwnedNames(new Set()); return; }
      const kioskId = (capsRes.data[0].data?.content as any)?.fields?.for;
      if (!kioskId) return;

      let allFields: any[] = [];
      let cursor: string | null | undefined = undefined;
      do {
        const page = await suiClient.getDynamicFields({ parentId: kioskId, cursor: cursor ?? undefined, limit: 50 });
        allFields = [...allFields, ...page.data];
        cursor = page.hasNextPage ? page.nextCursor : null;
      } while (cursor);

      const NFT_TYPE = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      const itemFields = allFields.filter(f => typeof f.name.type === "string" && f.name.type.startsWith("0x2::kiosk::Item"));
      if (itemFields.length === 0) { setOwnedNames(new Set()); return; }

      const ids = itemFields.map(f => {
        const raw = (f.name.value as any)?.id || f.name.value;
        const str = typeof raw === "string" ? raw : raw?.id || "";
        return str.toLowerCase().startsWith("0x") ? str : `0x${str}`;
      }).filter(Boolean);

      const names = new Set<string>();
      for (let i = 0; i < ids.length; i += 50) {
        const objs = await suiClient.multiGetObjects({ ids: ids.slice(i, i + 50), options: { showContent: true, showType: true } });
        for (const obj of objs) {
          if (obj.data?.content?.type === NFT_TYPE) {
            const n = (obj.data.content as any).fields?.name;
            if (n) names.add(n);
          }
        }
      }
      setOwnedNames(names);
    } catch (err) {
      console.error("fetchOwned:", err);
    }
  }, [account, suiClient]);

  useEffect(() => { fetchIndex(); }, [fetchIndex]);
  useEffect(() => { fetchOwned(); }, [fetchOwned]);

  // ── Merge owned state ─────────────────────────────────────────────────────
  const setsWithOwned = useMemo((): LootboxSet[] =>
    sets.map(s => ({
      ...s,
      entries: s.entries.map(e => ({ ...e, owned: account ? ownedNames.has(e.name) : null })),
    })),
  [sets, ownedNames, account]);

  const allEntries = useMemo(() => setsWithOwned.flatMap(s => s.entries), [setsWithOwned]);

  const applyFilters = useCallback((entries: IndexEntry[]) =>
    entries.filter(e => {
      if (rarityFilter !== null && e.rarity !== rarityFilter) return false;
      if (search) {
        if (!e.owned) return false;
        return e.name.toLowerCase().includes(search.toLowerCase());
      }
      return true;
    }),
  [rarityFilter, search]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalEntries = allEntries.length;
  const totalOwned   = allEntries.filter(e => e.owned).length;
  const completion   = totalEntries > 0 ? Math.round((totalOwned / totalEntries) * 100) : 0;

  // ── All tab pagination ────────────────────────────────────────────────────
  const filteredAll  = useMemo(() => {
    const filtered = applyFilters(allEntries);
    return [...filtered].sort((a, b) => sortOrder === "asc" ? a.rarity - b.rarity : b.rarity - a.rarity);
  }, [applyFilters, allEntries, sortOrder]);
  const totalPages   = Math.max(1, Math.ceil(filteredAll.length / PAGE_SIZE));
  const safePage     = Math.min(allPage, totalPages);
  const pagedEntries = filteredAll.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers  = buildPageNumbers(safePage, totalPages);

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="idx-page">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <Navigation />

      <div className="idx-wrap">
        {/* Header */}
        <div className="idx-header">
          <div>
            <div className="idx-title">📖 Hero Index</div>
            <div className="idx-subtitle">Every hero available across all lootboxes — discover what you&apos;re missing</div>
          </div>
          <div className="idx-actions">
            <button className="idx-btn icon-only" onClick={() => { fetchIndex(); fetchOwned(); }} disabled={isLoading}>
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
            <div className="idx-search-wrap">
              <Search size={15} className="idx-search-icon" />
              <input className="idx-search" placeholder="Search heroes..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="idx-loading">
            <div style={{ fontSize: 40 }}>📖</div>
            <div className="idx-loading-text">Loading the index...</div>
          </div>
        ) : sets.length === 0 ? (
          <div className="idx-empty">
            <div className="idx-empty-icon">📭</div>
            <div className="idx-empty-title">No Lootboxes Found</div>
            <div className="idx-empty-desc">No lootboxes are registered on-chain yet.</div>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="idx-stats">
              <div className="idx-stat">
                <span className="idx-stat-val">{totalEntries}</span>
                <span className="idx-stat-lbl">Total Heroes</span>
              </div>
              <div className="idx-stat-div" />
              <div className="idx-stat">
                <span className="idx-stat-val">{sets.length}</span>
                <span className="idx-stat-lbl">Lootboxes</span>
              </div>
              {account && (
                <>
                  <div className="idx-stat-div" />
                  <div className="idx-stat">
                    <span className="idx-stat-val">{totalOwned}</span>
                    <span className="idx-stat-lbl">You Own</span>
                  </div>
                  <div className="idx-stat-div" />
                  <div className="idx-stat">
                    <span className="idx-stat-val">{completion}%</span>
                    <span className="idx-stat-lbl">Complete</span>
                  </div>
                </>
              )}
            </div>

            {/* Rarity filter */}
            <div className="filter-row">
              <span className="filter-label"><Filter size={10} /> Rarity</span>
              <button className={`filter-pill ${rarityFilter === null ? "active" : ""}`} onClick={() => setRarityFilter(null)}>All</button>
              {[0,1,2,3,4,5].map(r => (
                <button key={r} className={`filter-pill ${rarityFilter === r ? "active" : ""}`} onClick={() => setRarityFilter(rarityFilter === r ? null : r)}>
                  {RARITY_LABELS[r]}
                </button>
              ))}
            </div>

            {/* Tabs: Sets | All */}
            <div className="idx-tabs">
              <button className={`idx-tab ${activeTab === "sets" ? "active" : ""}`} onClick={() => setActiveTab("sets")}>
                Sets
              </button>
              <button className={`idx-tab ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>
                All ({totalEntries})
              </button>
            </div>

            {/* ── SETS TAB ── */}
            {activeTab === "sets" && (
              <div>
                {setsWithOwned.map(s => {
                  const filtered = applyFilters(s.entries);
                  if (filtered.length === 0) return null;
                  const isOpen = expanded.has(s.id);
                  const ownedCount = s.entries.filter(e => e.owned).length;
                  const pct = s.entries.length > 0 ? Math.round((ownedCount / s.entries.length) * 100) : 0;
                  return (
                    <div key={s.id} className="lb-section">
                      <div className={`lb-header ${isOpen ? "open" : ""}`} onClick={() => toggleExpand(s.id)}>
                        <div className="lb-left">
                          <span className="lb-icon">📦</span>
                          <span className="lb-name">{s.name}</span>
                        </div>
                        <div className="lb-prog">
                          <div className="lb-prog-label">{ownedCount} / {s.entries.length} discovered</div>
                          <div className="lb-prog-bar">
                            <div className="lb-prog-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="lb-count">{s.entries.length} heroes</span>
                        <span className="lb-chevron">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                      </div>
                      {isOpen && (
                        <div className="idx-grid">
                          {filtered.map((entry, i) => <IndexCard key={`${entry.name}-${i}`} entry={entry} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── ALL TAB (flat + paginated) ── */}
            {activeTab === "all" && (
              <div>
                {/* Sort controls */}
                <div className="all-sort-row">
                  <span className="all-sort-label">Sort</span>
                  <button className={`sort-pill ${sortOrder === "asc" ? "active" : ""}`} onClick={() => setSortOrder("asc")}>
                    Common → Legend
                  </button>
                  <button className={`sort-pill ${sortOrder === "desc" ? "active" : ""}`} onClick={() => setSortOrder("desc")}>
                    Legend → Common
                  </button>
                </div>
                {filteredAll.length === 0 ? (
                  <div className="idx-empty">
                    <div className="idx-empty-icon">🔍</div>
                    <div className="idx-empty-title">No Results</div>
                    <div className="idx-empty-desc">Try a different search or rarity filter.</div>
                  </div>
                ) : (
                  <>
                    <div className="idx-all-grid">
                      {pagedEntries.map((entry, i) => (
                        <IndexCard key={`${entry.name}-${(safePage - 1) * PAGE_SIZE + i}`} entry={entry} />
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="idx-pagination">
                        <button className="idx-page-btn" disabled={safePage === 1} onClick={() => setAllPage(p => p - 1)}>
                          <ChevronLeft size={14} />
                        </button>

                        {pageNumbers.map((p, i) =>
                          p === "…" ? (
                            <span key={`ell-${i}`} className="idx-page-info">…</span>
                          ) : (
                            <button
                              key={p}
                              className={`idx-page-btn ${safePage === p ? "active" : ""}`}
                              onClick={() => setAllPage(p as number)}
                            >
                              {p}
                            </button>
                          )
                        )}

                        <button className="idx-page-btn" disabled={safePage === totalPages} onClick={() => setAllPage(p => p + 1)}>
                          <ChevronRight size={14} />
                        </button>

                        <span className="idx-page-info">
                          {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredAll.length)} of {filteredAll.length}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}