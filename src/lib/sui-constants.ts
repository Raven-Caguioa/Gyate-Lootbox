export const SUI_NETWORK = 'testnet';

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT — tx: 2ufiE29Spf8zjYRmvZ4tPsWVqxqphFxz1uTNhvTQn69f
// ─────────────────────────────────────────────────────────────────────────────

export const PACKAGE_ID           = "0xb90ec9144cb92d9c6f0cd1650a35e47856fbe9cbe3fceaaca2738eb236999649";
export const PUBLISHER            = "0x3652061274824b49465d4b74e94066e7494615f12a7892b7bd5ba04949b304dc";

// CHANGED: replaces the old TREASURY_CAP (0x890c...).
// GatekeeperCap wraps TreasuryCap inside a SHARED object so any player
// transaction can pass it as &mut without the chain rejecting for wrong signer.
export const GATEKEEPER_CAP       = "0x853b74cd71014b80faf2508ce74eb27ab449bc657b9b08d073b23dd69b5d1fd6";

export const COIN_METADATA        = "0x284195496466fbc0064e2aa7907e85f34f670c7a6c6fd2c377a00f2401e2c0bb";
export const NFT_DISPLAY          = "0x06bf45f75bfb901fce18a0bf1489ca682726f2af19a8d33659f36368bdf9d2bd";
export const LOOTBOX_REGISTRY     = "0x849b557c6e1fb182247ab25ac1b837664abfe1b499edffc5070fefb53ea614a3";
export const TREASURY_POOL        = "0xdf9719742f42f7574d5c13afa203d5b03884cffb3713168a7003e1f999b800e5";
export const KIOSK_REGISTRY       = "0x027dc6fb30d4e3c7063eb3102c1ddb13f102559bfaa466124a66c06aee98cd7d";
export const ACHIEVEMENT_REGISTRY = "0x23fc8583b262f6d3c8a0afb955236aa3d0186206d62dbd7d9daa9bb680107ac7";
export const STATS_REGISTRY       = "0x3944a1862eb13bd69aa690d2763eb30e9e97f013b1b75cd0d27e03f048567d85";
export const POLICY_ADMIN         = "0xb333efc89495fed7c0d16ee5c039b399bf775505ad965b03c7d13ab8302c8d2f";
export const UPGRADE_CAP          = "0x42224f77ce7fdc728d534b935fdf5dfb4e57ee253bd5f6ccee37ee3c8e99bb0d";
export const RANDOM_STATE         = "0x8";

/**
 * TransferPolicy<GyateNFT> — shared object for marketplace trades.
 * TODO: Run create_transfer_policy from admin wallet then replace this value.
 *
 * Command:
 *   sui client switch --address 0x262da71b77b62fe106c8a0b7ffa6e3ad6bb2898ffda5db074107bf0bf5e6aa7a
 *   sui client call \
 *     --package 0xb90ec9144cb92d9c6f0cd1650a35e47856fbe9cbe3fceaaca2738eb236999649 \
 *     --module marketplace \
 *     --function create_transfer_policy \
 *     --args 0x3652061274824b49465d4b74e94066e7494615f12a7892b7bd5ba04949b304dc \
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
  USER_BURN:  'user_burn',
  ADMIN_BURN: 'admin_burn',

  // Achievement
  INITIALIZE_STATS:        'initialize_stats',
  CLAIM_ACHIEVEMENT:       'claim_achievement',
  CREATE_ACHIEVEMENT:      'create_achievement',
  ADMIN_GRANT_ACHIEVEMENT: 'admin_grant_achievement',

  // Collection
  CREATE_COLLECTION_SET:              'create_collection_set',
  ADD_TO_SET:                         'add_to_set',
  ADD_TO_SET_BATCH:                   'add_to_set_batch',
  FINALIZE_SET:                       'finalize_set',
  CLAIM_COLLECTION_REWARD:            'claim_collection_reward',
  CLAIM_COLLECTION_REWARD_WITH_NAMES: 'claim_collection_reward_with_names',
} as const;