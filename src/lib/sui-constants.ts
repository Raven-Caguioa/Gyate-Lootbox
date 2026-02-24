export const SUI_NETWORK = 'testnet';

export const PACKAGE_ID         = "0xba75b672a6667d618922dec437c2de3b43f082232390fae1fdb2f7cbc7d9a94e";
export const PUBLISHER          = "0x7d3f380518b701671820e9caca3d0193f972fdd04f4e7a6f3a14481d635a55c7";
export const TREASURY_CAP       = "0x8b614e740d2516c877befda35a0db8c16304b9862c6b842918cda8bd34d2f183";
export const COIN_METADATA      = "0x09064d8786310ffd08e366db9f2001db89fb1f5150bc5c2273b3d8cbcf58576f";
export const NFT_DISPLAY        = "0x45a0f0fbcc24c6372bc91fcd6e1afad2dd711facbd0d5dcc422995abfbe7b6f2";
export const LOOTBOX_REGISTRY   = "0x1507d0d2fc9ada2c76ed46fe4fa333891592842fbc66a019f45bb78e737c0e72";
export const TREASURY_POOL      = "0x5041954fec0603127c38f6d4443d668eb898a8822e664f231bdc364037bd30f8";
export const KIOSK_REGISTRY     = "0xf28807c3456d57004b62c2e64995dc3ae6f7497af434e1ebd30100716a844598";
export const ACHIEVEMENT_REGISTRY = "0x7316d0c2e5333f4572286764d1fcfcf77fb2c0a52058ee088f5ee842d7ba4174";
export const POLICY_ADMIN       = "0x5418f3f4d057e0f3033a3017971b12d5e1ab589416b44580b0f9189402a10c2d";
export const RANDOM_STATE       = "0x8";

/**
 * TransferPolicy<GyateNFT> — shared object for marketplace trades.
 * TODO: Run create_transfer_policy from admin wallet then replace this value.
 *
 * Command:
 *   sui client switch --address 0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a
 *   sui client call `
 *     --package 0xba75b672a6667d618922dec437c2de3b43f082232390fae1fdb2f7cbc7d9a94e `
 *     --module marketplace `
 *     --function create_transfer_policy `
 *     --args 0x7d3f380518b701671820e9caca3d0193f972fdd04f4e7a6f3a14481d635a55c7 `
 *     --gas-budget 10000000
 */
export const TRANSFER_POLICY = "TODO_run_create_transfer_policy";

// ─────────────────────────────────────────────────────────────────────────────
// OBJECT_IDS — grouped reference used by profile page + achievements tab
// Mirrors the individual exports above so you can use either style:
//   import { TREASURY_CAP } from "@/lib/sui-constants"
//   import { OBJECT_IDS } from "@/lib/sui-constants" → OBJECT_IDS.TREASURY_CAP
// ─────────────────────────────────────────────────────────────────────────────
export const OBJECT_IDS = {
  ACHIEVEMENT_REGISTRY,
  LOOTBOX_REGISTRY,
  TREASURY_POOL,
  TREASURY_CAP,
  KIOSK_REGISTRY,
  TRANSFER_POLICY,
  POLICY_ADMIN,
  RANDOM_STATE,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MODULE_NAMES
// ─────────────────────────────────────────────────────────────────────────────
export const MODULE_NAMES = {
  LOOTBOX:     'lootbox',
  MARKETPLACE: 'marketplace',
  KIOSK:       'marketplace',
  TREASURY:    'pool',
  NFT:         'nft',
  GYATE_COIN:  'gyate_coin',
  ACHIEVEMENT: 'achievement',
  COLLECTION:  'collection',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
export const FUNCTIONS = {
  // Lootbox
  CREATE_DRAFT:                 'create_draft',
  ADD_NFT_TYPE:                 'add_nft_type',
  ADD_NFT_TYPES_BATCH:          'add_nft_types_batch',
  FINALIZE_AND_ACTIVATE:        'finalize_and_activate',
  OPEN_LOOTBOX:                 'open_lootbox',
  OPEN_LOOTBOX_WITH_GYATE:      'open_lootbox_with_gyate',
  OPEN_LOOTBOX_WITH_PITY:       'open_lootbox_with_pity',
  OPEN_LOOTBOX_GYATE_WITH_PITY: 'open_lootbox_gyate_with_pity',
  MULTI_OPEN_LOOTBOX:           'multi_open_lootbox',
  MULTI_OPEN_LOOTBOX_GYATE:     'multi_open_lootbox_gyate',
  PAUSE:                        'pause',
  UNPAUSE:                      'unpause',
  ADD_VARIANT:                  'add_variant',
  INITIALIZE_PROGRESS:          'initialize_progress',
  BURN_NFT_FOR_GYATE:           'burn_nft_for_gyate',

  // Pool
  WITHDRAW: 'withdraw',
  FUND:     'fund',

  // Marketplace
  CREATE_KIOSK:           'create_kiosk',
  LIST_NFT:               'list_nft',
  DELIST_NFT:             'delist_nft',
  BUY_NFT:                'buy_nft',
  CREATE_TRANSFER_POLICY: 'create_transfer_policy',

  // Gyate Coin
  ADMIN_MINT: 'admin_mint',
  BURN:       'burn',

  // Achievement
  INITIALIZE_STATS:   'initialize_stats',
  CLAIM_ACHIEVEMENT:  'claim_achievement',
  CREATE_ACHIEVEMENT: 'create_achievement',

  // Collection
  CREATE_COLLECTION_SET:              'create_collection_set',
  ADD_TO_SET:                         'add_to_set',
  ADD_TO_SET_BATCH:                   'add_to_set_batch',
  FINALIZE_SET:                       'finalize_set',
  CLAIM_COLLECTION_REWARD:            'claim_collection_reward',
  CLAIM_COLLECTION_REWARD_WITH_NAMES: 'claim_collection_reward_with_names',
} as const;