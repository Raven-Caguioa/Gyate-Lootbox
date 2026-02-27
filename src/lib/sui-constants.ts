export const SUI_NETWORK = 'testnet';

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT — tx: J9RqCaLHxXZmRJy7eQkGnnfkWqwzTE9Bjit9Mc52qs7w
// ─────────────────────────────────────────────────────────────────────────────

export const PACKAGE_ID           = "0xa4c108d73fcc5058686cbc6949baf3a178afead56d36ad66664a5593b222b717";
export const PUBLISHER            = "0x6cfc56dd36a6f3104bb02104314c4cd1438bab1bb8b8cf9a085cbebf6d503b85";

// Wraps TreasuryCap inside a shared object — any player tx can pass it as &mut.
export const GATEKEEPER_CAP       = "0x3f60d227ae484bba10258e5898b05b8659caa79d06c0110eeba2dec5f53c7438";

export const COIN_METADATA        = "0x8a296209d02db69b8e6e9ff5c30e26cd60e3d638b8b376e66a5734a6e72beb65";
export const NFT_DISPLAY          = "0x3bbc1f4dc8bbc1c84bd54c4518a0b4d134d82b87ebb44e481bae2d5414f598bb";
export const LOOTBOX_REGISTRY     = "0x1d063ade03d74e3eeb270ce731219057b199af2f64b8a2df882a78b81ce67501";
export const TREASURY_POOL        = "0x09265e4c040d827839edbffa022236803c4f0aafd8c08bdb7c527dd5639c43a3";
export const KIOSK_REGISTRY       = "0xb070aedfd9c29d83d38477b113c29a20437639043f1c498839c70d07404e7d9a";
export const ACHIEVEMENT_REGISTRY = "0xf8b94589e068673fbc881c182aad06046b587aa748eb541a8801605542f7a8ca";
export const STATS_REGISTRY       = "0xe829945d7c1f59f6a9367c2bae55e99262c9a13c432962fc042ebb5ec486d59c";
export const POLICY_ADMIN         = "0xdfd213d6186645208fc45e859e28587f27747909f8e657be49e24a099446cf20";
export const UPGRADE_CAP          = "0xd76fce187c20ee2281b7b34af1b38b657e7e62ba93a2a3e73e8c4f05903bfc1e";
export const RANDOM_STATE         = "0x8";

// NEW: Central admin role registry — super admin + managed admins list.
// Pass this as first arg to all admin-gated functions.
export const ADMIN_REGISTRY = "0xe7cdb80ed169d4a93fa5554d66fb1d000942a3b191267431e7883c7051c11295";

/**
 * TransferPolicy<GyateNFT> — shared object for marketplace trades.
 * TODO: Run create_transfer_policy from admin wallet then replace this value.
 *
 * Command:
 *   sui client switch --address 0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a
 *   sui client call \
 *     --package 0xa4c108d73fcc5058686cbc6949baf3a178afead56d36ad66664a5593b222b717 \
 *     --module marketplace \
 *     --function create_transfer_policy \
 *     --args 0x6cfc56dd36a6f3104bb02104314c4cd1438bab1bb8b8cf9a085cbebf6d503b85 \
 *     --gas-budget 10000000
 */
export const TRANSFER_POLICY = "0x5d18b59c50534d1d4232b353c806be97c0f704961f0011d1d932ece292442bd6";

// ─────────────────────────────────────────────────────────────────────────────
// OBJECT_IDS — grouped reference
// ─────────────────────────────────────────────────────────────────────────────
export const OBJECT_IDS = {
  ADMIN_REGISTRY,
  ACHIEVEMENT_REGISTRY,
  STATS_REGISTRY,
  LOOTBOX_REGISTRY,
  TREASURY_POOL,
  GATEKEEPER_CAP,
  KIOSK_REGISTRY,
  TRANSFER_POLICY,
  POLICY_ADMIN,
  RANDOM_STATE,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MODULE_NAMES
// ─────────────────────────────────────────────────────────────────────────────
export const MODULE_NAMES = {
  LOOTBOX:         'lootbox',
  MARKETPLACE:     'marketplace',
  KIOSK:           'marketplace',
  TREASURY:        'pool',
  NFT:             'nft',
  GYATE_COIN:      'gyate_coin',
  ACHIEVEMENT:     'achievement',
  COLLECTION:      'collection',
  ADMIN_REGISTRY:  'admin_registry',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
export const FUNCTIONS = {
  // Lootbox — admin functions now require ADMIN_REGISTRY as first arg
  CREATE_DRAFT:                 'create_draft',
  ADD_NFT_TYPE:                 'add_nft_type',
  ADD_NFT_TYPES_BATCH:          'add_nft_types_batch',
  FINALIZE_AND_ACTIVATE:        'finalize_and_activate',
  UPDATE_BURN_VALUE:            'update_burn_value',
  ADD_VARIANT:                  'add_variant',
  TOGGLE_VARIANT:               'toggle_variant',
  PAUSE:                        'pause',
  UNPAUSE:                      'unpause',
  UPDATE_PRICES:                'update_prices',
  UPDATE_GYATE_PRICE:           'update_gyate_price',
  // Lootbox — player functions, no ADMIN_REGISTRY needed
  OPEN_LOOTBOX:                 'open_lootbox',
  OPEN_LOOTBOX_WITH_GYATE:      'open_lootbox_with_gyate',
  OPEN_LOOTBOX_WITH_PITY:       'open_lootbox_with_pity',
  OPEN_LOOTBOX_GYATE_WITH_PITY: 'open_lootbox_gyate_with_pity',
  MULTI_OPEN_LOOTBOX:           'multi_open_lootbox',
  MULTI_OPEN_LOOTBOX_GYATE:     'multi_open_lootbox_gyate',
  INITIALIZE_PROGRESS:          'initialize_progress',
  BURN_PROGRESS:                'burn_progress',
  BURN_NFT_FOR_GYATE:           'burn_nft_for_gyate',

  // Pool — ADMIN_REGISTRY required for both
  WITHDRAW: 'withdraw',
  FUND:     'fund',

  // Marketplace — no admin changes
  CREATE_KIOSK:           'create_kiosk',
  LIST_NFT:               'list_nft',
  DELIST_NFT:             'delist_nft',
  BUY_NFT:                'buy_nft',
  CREATE_TRANSFER_POLICY: 'create_transfer_policy',

  // Gyate Coin — admin_mint and admin_burn require ADMIN_REGISTRY
  // user_burn does NOT require ADMIN_REGISTRY
  ADMIN_MINT: 'admin_mint',
  USER_BURN:  'user_burn',
  ADMIN_BURN: 'admin_burn',

  // Achievement — admin functions require ADMIN_REGISTRY
  // initialize_stats and claim_achievement do NOT
  INITIALIZE_STATS:        'initialize_stats',
  CLAIM_ACHIEVEMENT:       'claim_achievement',
  CREATE_ACHIEVEMENT:      'create_achievement',
  TOGGLE_ACHIEVEMENT:      'toggle_achievement',
  UPDATE_ACHIEVEMENT_META: 'update_achievement_meta',
  ADMIN_GRANT_ACHIEVEMENT: 'admin_grant_achievement',

  // Collection — admin functions require ADMIN_REGISTRY
  // claim_collection_reward_with_names does NOT
  CREATE_COLLECTION_SET:              'create_collection_set',
  ADD_TO_SET:                         'add_to_set',
  ADD_TO_SET_BATCH:                   'add_to_set_batch',
  FINALIZE_SET:                       'finalize_set',
  TOGGLE_SET:                         'toggle_set',
  UPDATE_GYATE_REWARD:                'update_gyate_reward',
  UPDATE_BADGE_IMAGE:                 'update_badge_image',
  CLAIM_COLLECTION_REWARD_WITH_NAMES: 'claim_collection_reward_with_names',

  // Admin Registry — super admin only
  ADD_ADMIN:                      'add_admin',
  REMOVE_ADMIN:                   'remove_admin',
  INITIATE_SUPER_ADMIN_TRANSFER:  'initiate_super_admin_transfer',
  ACCEPT_SUPER_ADMIN:             'accept_super_admin',
  CANCEL_SUPER_ADMIN_TRANSFER:    'cancel_super_admin_transfer',
} as const;