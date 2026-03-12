export const SUI_NETWORK = 'testnet';

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT — tx: CXs1SjasHagJ4UYfVaUpifZB8Yvgdma6Bd9yrJagX4if
// ─────────────────────────────────────────────────────────────────────────────

export const PACKAGE_ID           = "0x57df828a6b71f3e9c9ea57a8f1a463460ae3cc6e4fb4b00f70c926f76437c85f";
export const PUBLISHER            = "0xeb5bc2ad343745b55d001b086c07c913e71456035964a6854804cf7b71f14c2d";

// Wraps TreasuryCap inside a shared object — any player tx can pass it as &mut.
export const GATEKEEPER_CAP       = "0xc1ddc23917568f2ddf02bc5d5c4cef6178a02613fe461a9bc31f9ad75201a750";

export const COIN_METADATA        = "0xd6846f4e7bd676b8dc79fcb36d89af82adf81793f872fb281f5780818326dfd4";
export const NFT_DISPLAY          = "0xb37302f6ec98678d95c0fa35790ad7ad3a5f0a56481b436158b2765d71e9f160";
export const LOOTBOX_REGISTRY     = "0x1c7a611115f104eb634a439727ff5b1a1934fbb615ac7c47f2882aeb7583a734";
export const TREASURY_POOL        = "0xb30eb303dee1b8ce45cef2a97ce7009b1cb09f65a7197023bb996be88b6faf33";
export const KIOSK_REGISTRY       = "0xb337e13a88f5b50ed65e26d60072b7daa2400418d5f07ff4d86a69172bb010de";
export const ACHIEVEMENT_REGISTRY = "0xac65a7ce7f7f95ab5b77b33d1155b52fc31dccc5d7cbb32f853e9448ef960390";
export const STATS_REGISTRY       = "0xb355d8de22583961300a34dddb438c89b2ba88f74049696f94b9a5d0b6ad2bec";
export const POLICY_ADMIN         = "0xe82c497a6f33047add2769390f61eecd55b3e8d553c3d23bb389cb5847f03000";
export const UPGRADE_CAP          = "0x21bda6601d85c01a4fd9e030629771e421a10662e79065881110ed37ecb6953b";
export const RANDOM_STATE         = "0x8";

// Central admin role registry — super admin + managed admins list.
// Pass as first arg to all admin-gated functions.
export const ADMIN_REGISTRY       = "0xdd1bf88825bcb5c1afc6c6d6ecdeb7c5f98fecc09fad5aec47c042508209b4d3";

// ── New objects from updated marketplace.move ─────────────────────────────────

// Global offer registry — indexes all open offers by nft_id.
export const OFFER_REGISTRY        = "0xed87d700ea8c4cb23253c5de623e348d3d9a2761e13972f8af29ed617391822b";

// Rolling price history (last 20 sales) per NFT name.
export const PRICE_HISTORY_REGISTRY = "0x5a9e93cb639e79f241a4760b0f6c6e19c1e3561a1d1972127e7f18c3f16bf237";

/**
 * TransferPolicy<GyateNFT> — shared object for marketplace trades.
 * TODO: Run create_transfer_policy from admin wallet then replace this value.
 *
 * Command:
 *   sui client switch --address <admin_address>
 *   sui client call \
 *     --package 0x57df828a6b71f3e9c9ea57a8f1a463460ae3cc6e4fb4b00f70c926f76437c85f \
 *     --module marketplace \
 *     --function create_transfer_policy \
 *     --args 0xeb5bc2ad343745b55d001b086c07c913e71456035964a6854804cf7b71f14c2d \
 *     --gas-budget 10000000
 */
export const TRANSFER_POLICY = "0xe0e296c4385886eced86fd183461864d622973632a32c4b783c3532ffb7f86f7";

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
  OFFER_REGISTRY,
  PRICE_HISTORY_REGISTRY,
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
  // ── Lootbox — admin (require ADMIN_REGISTRY as first arg) ─────────────────
  CREATE_DRAFT:                 'create_draft',         // +available_from, available_until, is_seasonal
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
  SET_SEASONAL:                 'set_seasonal',         // NEW — set/update seasonal window

  // ── Lootbox — player (no ADMIN_REGISTRY needed) ───────────────────────────
  OPEN_LOOTBOX:                 'open_lootbox',
  OPEN_LOOTBOX_WITH_GYATE:      'open_lootbox_with_gyate',
  OPEN_LOOTBOX_WITH_PITY:       'open_lootbox_with_pity',
  OPEN_LOOTBOX_GYATE_WITH_PITY: 'open_lootbox_gyate_with_pity',
  MULTI_OPEN_LOOTBOX:           'multi_open_lootbox',
  MULTI_OPEN_LOOTBOX_GYATE:     'multi_open_lootbox_gyate',
  INITIALIZE_PROGRESS:          'initialize_progress',
  BURN_PROGRESS:                'burn_progress',
  BURN_NFT_FOR_GYATE:           'burn_nft_for_gyate',

  // ── Pool (ADMIN_REGISTRY required for both) ───────────────────────────────
  WITHDRAW: 'withdraw',
  FUND:     'fund',

  // ── Marketplace — fixed-price (unchanged signatures) ──────────────────────
  CREATE_KIOSK:           'create_kiosk',
  LIST_NFT:               'list_nft',
  DELIST_NFT:             'delist_nft',
  BUY_NFT:                'buy_nft',                   // +price_registry arg
  CREATE_TRANSFER_POLICY: 'create_transfer_policy',

  // ── Marketplace — offers (NEW) ────────────────────────────────────────────
  // make_offer(offer_registry, nft_id, nft_name, seller, expires_at, payment)
  MAKE_OFFER:    'make_offer',
  // cancel_offer(offer_registry, offer)
  CANCEL_OFFER:  'cancel_offer',
  // accept_offer(offer_registry, offer, seller_kiosk, seller_cap,
  //              buyer_kiosk, buyer_cap, pool, price_registry)
  ACCEPT_OFFER:  'accept_offer',

  // ── Gyate Coin ────────────────────────────────────────────────────────────
  ADMIN_MINT: 'admin_mint',   // requires ADMIN_REGISTRY
  USER_BURN:  'user_burn',    // no ADMIN_REGISTRY
  ADMIN_BURN: 'admin_burn',   // requires ADMIN_REGISTRY

  // ── Achievement — admin (require ADMIN_REGISTRY) ──────────────────────────
  CREATE_ACHIEVEMENT:      'create_achievement',
  TOGGLE_ACHIEVEMENT:      'toggle_achievement',
  UPDATE_ACHIEVEMENT_META: 'update_achievement_meta',
  ADMIN_GRANT_ACHIEVEMENT: 'admin_grant_achievement',

  // ── Achievement — player (no ADMIN_REGISTRY) ──────────────────────────────
  INITIALIZE_STATS:  'initialize_stats',
  CLAIM_ACHIEVEMENT: 'claim_achievement',

  // ── Collection — admin (require ADMIN_REGISTRY) ───────────────────────────
  CREATE_COLLECTION_SET: 'create_collection_set',
  ADD_TO_SET:            'add_to_set',
  ADD_TO_SET_BATCH:      'add_to_set_batch',
  FINALIZE_SET:          'finalize_set',
  TOGGLE_SET:            'toggle_set',
  UPDATE_GYATE_REWARD:   'update_gyate_reward',
  UPDATE_BADGE_IMAGE:    'update_badge_image',

  // ── Collection — player (no ADMIN_REGISTRY) ───────────────────────────────
  CLAIM_COLLECTION_REWARD_WITH_NAMES: 'claim_collection_reward_with_names',

  // ── Admin Registry — super admin only ────────────────────────────────────
  ADD_ADMIN:                     'add_admin',
  REMOVE_ADMIN:                  'remove_admin',
  INITIATE_SUPER_ADMIN_TRANSFER: 'initiate_super_admin_transfer',
  ACCEPT_SUPER_ADMIN:            'accept_super_admin',
  CANCEL_SUPER_ADMIN_TRANSFER:   'cancel_super_admin_transfer',
} as const;