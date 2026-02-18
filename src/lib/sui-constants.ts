export const SUI_NETWORK = 'testnet';

export const PACKAGE_ID = "0x0565d4e63f46ff07d1799b1f55f5f3c4c6e9af093f30a395d9cb3057f0d4c7cc";
export const UPGRADE_CAP = "0x530b6829b033ab499f1c591c3d956bd76a35cb3a86c7791ba3069381399e34fe";
export const TREASURY_CAP = "0xcc27e5dda2b3c139f733b70024828ef774119794474d1b752f34b98103f813e2";
export const PUBLISHER = "0x8a00a0227d2bcec1bf3dfa86c312ae037bbd9518113cbc1d60253090ac7905d8";
export const COIN_METADATA = "0x86bedd00ce5cb78b8cf262d523fb3ba8beccad5ef33c887ff7e174ac66142cdf";
export const NFT_DISPLAY = "0xba7ff84ecfaaf32e14619ce27ba6b18deeb1053476933fdf169cfa31c28b94fa";
export const LOOTBOX_REGISTRY = "0x13d6c6bda2f590fa2cdc3e17dcce3ec7785149301c4e7ef4e65759230888592b";
export const TREASURY_POOL = "0x3243fc2a93516eb4197810f79c5ad3b8f60052c669c847b3f47678bc54f9b254";
export const KIOSK_REGISTRY = "0x561c34ed574e5d2f7293b22b5a57e36e83c5e97a2a5fe215d21082569a5987d1";
export const POLICY_ADMIN = "0x7b717e9a7d2c935d0f7193a1228958d1a8df5fc16e97e65b12644b644e905bdb";

// Function identifiers for TransactionBlock calls
export const MODULE_NAMES = {
  LOOTBOX: 'gyate', // Updated to the primary module name
  MARKETPLACE: 'marketplace',
  KIOSK: 'gyate_kiosk',
  TREASURY: 'treasury',
};

export const FUNCTIONS = {
  BUY_LOOTBOX: 'buy_lootbox',
  OPEN_LOOTBOX: 'open_lootbox',
  LIST_NFT: 'list_nft',
  BUY_NFT: 'buy_nft',
  CLAIM_FEES: 'claim_fees',
  CREATE_LOOTBOX: 'create_lootbox',
  UPDATE_PRICE: 'update_price',
  TOGGLE_STATUS: 'toggle_status',
};
