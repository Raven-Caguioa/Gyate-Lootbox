export const SUI_NETWORK = 'testnet';

export const PACKAGE_ID = "0x907538ee7309fe7a9fa06c963646d7213e3d80430e087886400910ed7d9c17cc";
export const PUBLISHER = "0xa76c6fe827d92f141c1d827e995862fcadde7a8eff2ec5ce2876cb11c7b29b29";
export const TREASURY_CAP = "0x0d51052f041a5bdbbee5e2584e333484b9df9fdd03c1e5dc3bfea2f2c18d7063";
export const COIN_METADATA = "0x3b022adba60aaa0064b13398f5dc38110b621ac68cc7cbe6680388b740fa6229";
export const NFT_DISPLAY = "0x8d0ed0439348c8af193c01ecfd51dd2a7bd3961e27b6b5820ae9151abbc380a3";
export const LOOTBOX_REGISTRY = "0xf3066dc8fd2b717561c140027b8bb9c77ed926c23c3aba243b3d9ff245177bef";
export const TREASURY_POOL = "0x17eba5defb080ca2467cfee7c877c05eed2f844b7454a45c52ebe4bb852945d8";
export const KIOSK_REGISTRY = "0x4bec157f496da95b4c85a207b8becd6d1379803d8ec878a6944d7ca246b6fb42";
export const ACHIEVEMENT_REGISTRY = "0x60499e1d911e7b6bc54517329e3ea968f2cc8b8796cccbdfd55b936115c1e579";
export const POLICY_ADMIN = "0x45537e489556091a29bd8d662020243edddfc641b4c4361e5b91f6cd92d47171";
export const RANDOM_STATE = "0x8";

/**
 * TransferPolicy<GyateNFT> — shared object for marketplace trades.
 * TODO: Run create_transfer_policy from admin wallet then replace this value.
 *
 * Command:
 *   sui client switch --address 0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a
 *   sui client call `
 *     --package 0x907538ee7309fe7a9fa06c963646d7213e3d80430e087886400910ed7d9c17cc `
 *     --module marketplace `
 *     --function create_transfer_policy `
 *     --args 0xa76c6fe827d92f141c1d827e995862fcadde7a8eff2ec5ce2876cb11c7b29b29 `
 *     --gas-budget 10000000
 */
export const TRANSFER_POLICY = "0xb7547348d297967557517a988af66c2f3b77b4492c9aa9226cd465d58bf63173";

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