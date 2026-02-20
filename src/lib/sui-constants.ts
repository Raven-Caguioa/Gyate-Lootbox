export const SUI_NETWORK = 'testnet';

export const PACKAGE_ID = "0xb57d011dd4c245cca994592fe4e550e9776c6bcfcf3730180f82a264727e8e4e";
export const PUBLISHER = "0x159bbfb4c0606406f7274737c1c354db50a5600b37d3f9eecd5d61f61c573cfc";
export const TREASURY_CAP = "0x840d4139e9668df115d14e902d0339dc5108e48ff1c79ae4ca85358bd0afbf24";
export const COIN_METADATA = "0xcc58278824eb382e96eae12cdde2ca99f689e0afd9a81ef1db351d5d4f9eadf4";
export const NFT_DISPLAY = "0xce7417892a874edd73f5fc21b14a4623441a488cc03ca99de9899c7ad729deb2";
export const LOOTBOX_REGISTRY = "0x2ccaa3e7717f617bc65f289b4ae05a9409a5947e680b714c85d83f044055a2f0";
export const TREASURY_POOL = "0x77b6d08e22f065a5c5fc099d9e417ac9936c7b33aeed465f87a818ccf5af1000";
export const KIOSK_REGISTRY = "0x54ec52886e6c118d6dd79b7302557cc1d61428d0ed8afe449849388ad4821441";
export const ACHIEVEMENT_REGISTRY = "0x576c2a2071fdb89b255079647928db74f97beef4bca9a11832d305ad5760db9f";
export const POLICY_ADMIN = "0x4f8fcd54e3db6499ec3aa0cb0b75c8dd38b95f7c0bc5e120396f8f24d3bd209b";
export const RANDOM_STATE = "0x8";

export const MODULE_NAMES = {
  LOOTBOX: 'lootbox', 
  MARKETPLACE: 'marketplace',
  KIOSK: 'marketplace',
  TREASURY: 'pool',
  NFT: 'nft',
  GYATE_COIN: 'gyate_coin',
  ACHIEVEMENT: 'achievement',
  COLLECTION: 'collection'
};

export const FUNCTIONS = {
  // Lootbox module
  CREATE_DRAFT: 'create_draft',
  ADD_NFT_TYPE: 'add_nft_type',
  ADD_NFT_TYPES_BATCH: 'add_nft_types_batch',
  FINALIZE_AND_ACTIVATE: 'finalize_and_activate',
  OPEN_LOOTBOX: 'open_lootbox',
  OPEN_LOOTBOX_WITH_GYATE: 'open_lootbox_with_gyate',
  OPEN_LOOTBOX_WITH_PITY: 'open_lootbox_with_pity',
  OPEN_LOOTBOX_GYATE_WITH_PITY: 'open_lootbox_gyate_with_pity',
  MULTI_OPEN_LOOTBOX: 'multi_open_lootbox',
  MULTI_OPEN_LOOTBOX_GYATE: 'multi_open_lootbox_gyate',
  PAUSE: 'pause',
  UNPAUSE: 'unpause',
  ADD_VARIANT: 'add_variant',
  INITIALIZE_PROGRESS: 'initialize_progress',
  BURN_NFT_FOR_GYATE: 'burn_nft_for_gyate',
  
  // Pool module
  WITHDRAW: 'withdraw',
  FUND: 'fund',

  // Marketplace module
  CREATE_KIOASK: 'create_kiosk',
  LIST_NFT: 'list_nft',
  BUY_NFT: 'buy_nft',
  CREATE_TRANSFER_POLICY: 'create_transfer_policy',

  // Gyate Coin module
  ADMIN_MINT: 'admin_mint',
  BURN: 'burn',

  // Achievement
  INITIALIZE_STATS: 'initialize_stats',
  CLAIM_ACHIEVEMENT: 'claim_achievement'
};