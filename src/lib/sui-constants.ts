export const SUI_NETWORK = 'testnet';

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT — tx: 3fhwNrrf9jv8KjBRjsxbH2u2Qju3t5D7bw6kffKmqKre
// ─────────────────────────────────────────────────────────────────────────────

export const PACKAGE_ID           = "0x7537db862cfc78cfd8961a8a92ada168d01c9c243c81d30baf110267d76fa332";
export const PUBLISHER            = "0x36650c7078424507c14e0900314f4d54614063b0594264938c3ebe52ecbd07d4";
export const TREASURY_CAP         = "0x890c4974f33a781cae053c9cba5b9abcd413f7965b4b3ac65be7dad2bd5f04bc";
export const COIN_METADATA        = "0x08c5af663868e52c39ea0f828f2a6189705dbc26023467676188a87acc0345bf";
export const NFT_DISPLAY          = "0xbe4524dee24024ec5f79518bef2b4bd552712fc0d6163bfe151853d2c0c0fec3";
export const LOOTBOX_REGISTRY     = "0x8b2bdc8e2292ddc64c14494cdf2f07f90fb0fdbabb331fba7ed263d9c11c9a37";
export const TREASURY_POOL        = "0x0d4390b99f15430414157d0f2190b49bc6c8ba38b1314417e6ff80585a148abd";
export const KIOSK_REGISTRY       = "0x3fae276b9177b0f97c622957ac0ba99e954d5505b7379c6d386e70cc01b1f22c";
export const ACHIEVEMENT_REGISTRY = "0xea10f2b80f404727cdd1ae804b2cc2d874e9c72af3221934cef4b3a98a9e61c3";
export const STATS_REGISTRY       = "0xcaa1758f37410694b4632f215e90cbb779ea82f7e7a0e1bfe335383a5bcecee2";
export const POLICY_ADMIN         = "0xe611aba748a837725401f003d99573b7a7e8844a23950a3ed16e8b28f9ba01b6";
export const UPGRADE_CAP          = "0x40aef07817a3f701a3b8bf28a23995212c9f17e858f57788fd190b431ce6bb6d";
export const RANDOM_STATE         = "0x8";

/**
 * TransferPolicy<GyateNFT> — shared object for marketplace trades.
 * TODO: Run create_transfer_policy from admin wallet then replace this value.
 *
 * Command:
 *   sui client switch --address 0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a
 *   sui client call \
 *     --package 0x7537db862cfc78cfd8961a8a92ada168d01c9c243c81d30baf110267d76fa332 \
 *     --module marketplace \
 *     --function create_transfer_policy \
 *     --args 0x36650c7078424507c14e0900314f4d54614063b0594264938c3ebe52ecbd07d4 \
 *     --gas-budget 10000000
 */
export const TRANSFER_POLICY = "TODO_run_create_transfer_policy";

// ─────────────────────────────────────────────────────────────────────────────
// OBJECT_IDS — grouped reference
// ─────────────────────────────────────────────────────────────────────────────
export const OBJECT_IDS = {
  ACHIEVEMENT_REGISTRY,
  STATS_REGISTRY,
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
  INITIALIZE_STATS:      'initialize_stats',
  CLAIM_ACHIEVEMENT:     'claim_achievement',
  CREATE_ACHIEVEMENT:    'create_achievement',
  ADMIN_GRANT_ACHIEVEMENT: 'admin_grant_achievement',

  // Collection
  CREATE_COLLECTION_SET:              'create_collection_set',
  ADD_TO_SET:                         'add_to_set',
  ADD_TO_SET_BATCH:                   'add_to_set_batch',
  FINALIZE_SET:                       'finalize_set',
  CLAIM_COLLECTION_REWARD:            'claim_collection_reward',
  CLAIM_COLLECTION_REWARD_WITH_NAMES: 'claim_collection_reward_with_names',
} as const;