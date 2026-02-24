import { useState, useEffect, useCallback, useMemo } from "react";
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import {
  PACKAGE_ID, TREASURY_POOL, LOOTBOX_REGISTRY,
  MODULE_NAMES, ACHIEVEMENT_REGISTRY, PUBLISHER
} from "@/lib/sui-constants";

// ─────────────────────────────────────────────
// Types (exported so tabs can import them)
// ─────────────────────────────────────────────

export interface LootboxOption {
  id: string;
  name: string;
  isSetup: boolean;
  isActive: boolean;
  price: string;
  gyatePrice: string;
  totalOpens: string;
  totalRevenueMist: string;
  totalGyateSpent: string;
  pityEnabled: boolean;
  multiOpenEnabled: boolean;
  multiOpenSize: string;
}

export interface VariantData {
  variant_name: string;
  drop_rate: string;
  value_multiplier: string;
  custom_image_url: string;
  enabled: boolean;
  has_sequential_id: boolean;
  sequential_id_counter: string;
  available_from: string;
  available_until: string;
  max_mints: string;
}

export interface NFTTypeData {
  name: string;
  base_value: string;
  base_image_url: string;
  variant_configs: { fields: VariantData }[];
  min_hp: string;
  max_hp: string;
  min_atk: string;
  max_atk: string;
  min_spd: string;
  max_spd: string;
  rarity?: number;
}

export interface LootboxFullData {
  id: string;
  name: string;
  price: string;
  gyate_price: string;
  admin: string;
  is_active: boolean;
  is_setup_mode: boolean;
  pity_enabled: boolean;
  multi_open_enabled: boolean;
  multi_open_size: string;
  total_opens: string;
  total_revenue_mist: string;
  total_gyate_spent: string;
  common_configs: NFTTypeData[];
  rare_configs: NFTTypeData[];
  super_rare_configs: NFTTypeData[];
  ssr_configs: NFTTypeData[];
  ultra_rare_configs: NFTTypeData[];
  legend_rare_configs: NFTTypeData[];
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  badge_image_url: string;
  gyate_reward: string;
  requirement_type: number;
  requirement_value: string;
  requirement_rarity: number;
  enabled: boolean;
  total_claimed: string;
}

export interface TreasuryStats {
  balance: string;
  totalFromLootboxes: string;
  totalFromMarketplace: string;
  totalWithdrawn: string;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useAdminData() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  const [myLootboxes, setMyLootboxes] = useState<LootboxOption[]>([]);
  const [isLoadingBoxes, setIsLoadingBoxes] = useState(false);

  const [achievements, setAchievements] = useState<AchievementDef[]>([]);
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(false);

  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats | null>(null);
  const [isFetchingTreasury, setIsFetchingTreasury] = useState(false);

  const [policyExists, setPolicyExists] = useState<boolean | null>(null);
  const [isCheckingPolicy, setIsCheckingPolicy] = useState(false);

  // ── Derived splits ─────────────────────────────────────────────────
  const liveBoxes  = useMemo(() => myLootboxes.filter(b => !b.isSetup), [myLootboxes]);
  const draftBoxes = useMemo(() => myLootboxes.filter(b => b.isSetup),  [myLootboxes]);

  // ── Full box data fetcher (shared, used by multiple tabs) ──────────
  const fetchFullBoxData = useCallback(async (
    id: string,
    setter: (data: LootboxFullData | null) => void,
    setLoading?: (v: boolean) => void
  ) => {
    if (!id) { setter(null); return; }
    setLoading?.(true);
    try {
      const obj = await suiClient.getObject({ id, options: { showContent: true } });
      const fields = (obj.data?.content as any)?.fields;
      if (fields) {
        setter({
          id,
          name:               fields.name,
          price:              fields.price,
          gyate_price:        fields.gyate_price,
          admin:              fields.admin,
          is_active:          fields.is_active,
          is_setup_mode:      fields.is_setup_mode,
          pity_enabled:       fields.pity_enabled,
          multi_open_enabled: fields.multi_open_enabled,
          multi_open_size:    fields.multi_open_size,
          // FIX: Move uses `total_opened`, not `total_opens`
          total_opens:        fields.total_opened        ?? "0",
          total_revenue_mist: fields.total_revenue_mist  ?? "0",
          total_gyate_spent:  fields.total_gyate_spent   ?? "0",
          common_configs:     (fields.common_configs      ?? []).map((c: any) => ({ ...c.fields, rarity: 0 })),
          rare_configs:       (fields.rare_configs        ?? []).map((c: any) => ({ ...c.fields, rarity: 1 })),
          super_rare_configs: (fields.super_rare_configs  ?? []).map((c: any) => ({ ...c.fields, rarity: 2 })),
          ssr_configs:        (fields.ssr_configs         ?? []).map((c: any) => ({ ...c.fields, rarity: 3 })),
          ultra_rare_configs: (fields.ultra_rare_configs  ?? []).map((c: any) => ({ ...c.fields, rarity: 4 })),
          legend_rare_configs:(fields.legend_rare_configs ?? []).map((c: any) => ({ ...c.fields, rarity: 5 })),
        });
      }
    } catch (err) {
      console.error("Failed to fetch full box data:", err);
      setter(null);
    } finally {
      setLoading?.(false);
    }
  }, [suiClient]);

  // ── Lootboxes ───────────────────────────────────────────────────────
  const fetchLootboxes = useCallback(async () => {
    setIsLoadingBoxes(true);
    try {
      const registryObj = await suiClient.getObject({
        id: LOOTBOX_REGISTRY,
        options: { showContent: true },
      });
      const allIds = (registryObj.data?.content as any)?.fields?.all_ids ?? [];
      if (allIds.length === 0) { setMyLootboxes([]); return; }

      const boxesData = await suiClient.multiGetObjects({ ids: allIds, options: { showContent: true } });
      const boxes: LootboxOption[] = boxesData
        .filter((obj: any) => obj.data?.content?.fields)
        .map((obj: any) => {
          const f = obj.data.content.fields;
          return {
            id:               obj.data.objectId,
            name:             f.name              ?? "Unnamed Box",
            isSetup:          f.is_setup_mode     ?? false,
            isActive:         f.is_active         ?? false,
            price:            f.price             ?? "0",
            gyatePrice:       f.gyate_price       ?? "0",
            // FIX: Move field is `total_opened`, not `total_opens`
            totalOpens:       f.total_opened      ?? "0",
            totalRevenueMist: f.total_revenue_mist ?? "0",
            totalGyateSpent:  f.total_gyate_spent  ?? "0",
            pityEnabled:      f.pity_enabled      ?? false,
            multiOpenEnabled: f.multi_open_enabled ?? false,
            multiOpenSize:    f.multi_open_size   ?? "10",
          };
        });
      setMyLootboxes(boxes);
    } catch (err) {
      console.error("Failed to fetch boxes:", err);
    } finally {
      setIsLoadingBoxes(false);
    }
  }, [suiClient]);

  // ── Achievements (Table-aware) ──────────────────────────────────────
  const fetchAchievements = useCallback(async () => {
    setIsLoadingAchievements(true);
    try {
      const regObj = await suiClient.getObject({ id: ACHIEVEMENT_REGISTRY, options: { showContent: true } });
      const regFields = (regObj.data?.content as any)?.fields;
      const tableId = regFields?.achievements?.fields?.id?.id;
      if (!tableId) { setAchievements([]); return; }

      let allDynFields: any[] = [];
      let cursor: string | null | undefined = undefined;
      do {
        const page = await suiClient.getDynamicFields({ parentId: tableId, cursor: cursor ?? undefined, limit: 50 });
        allDynFields = [...allDynFields, ...page.data];
        cursor = page.hasNextPage ? page.nextCursor : null;
      } while (cursor);

      if (allDynFields.length === 0) { setAchievements([]); return; }

      const defObjects = await suiClient.multiGetObjects({
        ids: allDynFields.map(f => f.objectId),
        options: { showContent: true },
      });

      const parsed: AchievementDef[] = defObjects
        .map((obj: any) => {
          const f = obj.data?.content?.fields?.value?.fields ?? obj.data?.content?.fields;
          if (!f) return null;
          return {
            id:                  String(f.id),
            name:                f.name,
            description:         f.description,
            badge_image_url:     f.badge_image_url,
            gyate_reward:        f.gyate_reward,
            requirement_type:    Number(f.requirement_type),
            requirement_value:   f.requirement_value,
            requirement_rarity:  Number(f.requirement_rarity),
            enabled:             f.enabled,
            total_claimed:       f.total_claimed ?? "0",
          } as AchievementDef;
        })
        .filter((a): a is AchievementDef => a !== null);

      setAchievements(parsed);
    } catch (err) {
      console.error("Failed to fetch achievements:", err);
    } finally {
      setIsLoadingAchievements(false);
    }
  }, [suiClient]);

  // ── Treasury ────────────────────────────────────────────────────────
  const fetchTreasuryData = useCallback(async () => {
    setIsFetchingTreasury(true);
    try {
      const obj = await suiClient.getObject({ id: TREASURY_POOL, options: { showContent: true } });
      const fields = (obj.data?.content as any)?.fields;
      if (fields) {
        setTreasuryStats({
          // Treasury balance is nested: fields.balance.fields.value
          balance:               fields.balance?.fields?.value ?? fields.balance ?? "0",
          totalFromLootboxes:    fields.total_from_lootboxes   ?? "0",
          totalFromMarketplace:  fields.total_from_marketplace  ?? "0",
          totalWithdrawn:        fields.total_withdrawn         ?? "0",
        });
      }
    } catch (err) {
      console.error("Failed to fetch treasury:", err);
    } finally {
      setIsFetchingTreasury(false);
    }
  }, [suiClient]);

  // ── TransferPolicy ──────────────────────────────────────────────────
  const checkPolicy = useCallback(async () => {
    if (!account) return;
    setIsCheckingPolicy(true);
    try {
      const NFT_TYPE = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      const capResponse = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `0x2::transfer_policy::TransferPolicyCap<${NFT_TYPE}>` },
      });
      setPolicyExists(capResponse.data.length > 0);
    } catch (err) {
      setPolicyExists(false);
    } finally {
      setIsCheckingPolicy(false);
    }
  }, [account, suiClient]);

  // ── Initial load ────────────────────────────────────────────────────
  const syncAll = useCallback(() => {
    fetchLootboxes();
    fetchTreasuryData();
    fetchAchievements();
    checkPolicy();
  }, [fetchLootboxes, fetchTreasuryData, fetchAchievements, checkPolicy]);

  useEffect(() => { syncAll(); }, [syncAll]);

  return {
    // Data
    myLootboxes, liveBoxes, draftBoxes,
    achievements, treasuryStats,
    policyExists, isCheckingPolicy,
    // Loading states
    isLoadingBoxes, isLoadingAchievements, isFetchingTreasury,
    // Actions
    fetchLootboxes, fetchAchievements, fetchTreasuryData, checkPolicy, syncAll,
    fetchFullBoxData,
    // Setters (for policy)
    setPolicyExists,
  };
}