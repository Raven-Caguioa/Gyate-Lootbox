"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, ShoppingBag, Loader2, LayoutGrid, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { NFTDetailDialog } from "@/components/nft-detail-dialog";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID, MODULE_NAMES, FUNCTIONS, TREASURY_CAP } from "@/lib/sui-constants";
import { useToast } from "@/hooks/use-toast";
import { NFT } from "@/lib/mock-data";
import { Transaction } from "@mysten/sui/transactions";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeSuiId(id: string | any): string {
  if (!id) return "";
  const str =
    typeof id === "string" ? id : id?.id || id?.objectId || JSON.stringify(id);
  return str.toLowerCase().replace(/^(0x)?/, "0x");
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast } = useToast();

  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [userNfts, setUserNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listingNft, setListingNft] = useState<NFT | null>(null);
  const [listPriceSui, setListPriceSui] = useState("");

  // ── Fetch NFTs ──────────────────────────────────────────────────────────────
  const fetchUserNfts = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      // Step 1 — get KioskOwnerCap (includes kiosk ID in its fields)
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });

      if (capsRes.data.length === 0) {
        setUserNfts([]);
        return;
      }

      const kioskCapId = capsRes.data[0].data?.objectId!;
      const kioskId = (capsRes.data[0].data?.content as any)?.fields?.for;

      if (!kioskId) {
        setUserNfts([]);
        return;
      }

    // Step 2 — get ALL dynamic fields with pagination
    let allDynamicFields: any[] = [];
    let cursor: string | null | undefined = undefined;

    do {
      const page = await suiClient.getDynamicFields({
        parentId: kioskId,
        cursor: cursor ?? undefined,
        limit: 50,
      });
      allDynamicFields = [...allDynamicFields, ...page.data];
      cursor = page.hasNextPage ? page.nextCursor : null;
    } while (cursor);

    if (allDynamicFields.length === 0) {
      setUserNfts([]);
      return;
    }

    const dynamicFields = { data: allDynamicFields };

      const NFT_TYPE = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      const ITEM_TYPE = "0x2::kiosk::Item";
      const LISTING_TYPE = "0x2::kiosk::Listing";

      // Step 3 — separate Item fields from Listing fields
      // CRITICAL: f.name.value.id is the REAL NFT object ID
      // f.objectId is just the dynamic field wrapper — DO NOT use this for transactions
      const itemFields = dynamicFields.data.filter(
        (f) => typeof f.name.type === "string" && f.name.type.startsWith(ITEM_TYPE)
      );

      const listingFields = dynamicFields.data.filter(
        (f) => typeof f.name.type === "string" && f.name.type.startsWith(LISTING_TYPE)
      );

      if (itemFields.length === 0) {
        setUserNfts([]);
        return;
      }

      // Step 4 — extract real NFT IDs and build listed set
      const realNftIds: string[] = itemFields
        .map((f) => normalizeSuiId((f.name.value as any)?.id || f.name.value))
        .filter(Boolean);

      const listedNftIds = new Set(
        listingFields.map((f) =>
          normalizeSuiId((f.name.value as any)?.id || f.name.value)
        )
      );

      if (realNftIds.length === 0) {
        setUserNfts([]);
        return;
      }

      // Step 5 — fetch full NFT content using REAL object IDs
      const BATCH_SIZE = 50;
      const nftObjects: any[] = [];
      for (let i = 0; i < realNftIds.length; i += BATCH_SIZE) {
        const batch = realNftIds.slice(i, i + BATCH_SIZE);
        const results = await suiClient.multiGetObjects({
          ids: batch,
          options: { showContent: true, showType: true },
        });
        nftObjects.push(...results);
      }

      console.log("=== INVENTORY DEBUG ===");
      console.log("Total dynamic fields:", allDynamicFields.length);
      console.log("Item fields:", itemFields.length);
      console.log("Real NFT IDs:", realNftIds.length, realNftIds);
      console.log("NFT objects returned:", nftObjects.length);
      nftObjects.forEach((obj: any, i) => {
        console.log(`[${i}] id:`, obj.data?.objectId, "| type:", obj.data?.content?.type, "| error:", obj.error);
      });

      // Step 6 — map to NFT type
      const mappedNfts: (NFT & { isListed: boolean })[] = nftObjects
        .map((obj: any) => {
          if (!obj.data) return null;

          const objectId = normalizeSuiId(obj.data.objectId);
          const content = obj.data.content;

          if (content?.type !== NFT_TYPE) return null;
          
          const f = content?.fields;
          if (!f) return null;

          return {
            id: objectId, // The real NFT object ID — used for all transactions
            name: f.name ?? "Unknown",
            rarity: Number(f.rarity ?? 0),
            variantType: f.variant_type ?? "Normal",
            image:
              f.image_url ||
              "https://images.unsplash.com/photo-1743355694962-40376ef681da?q=80&w=400",
            hp: parseInt(f.hp ?? "0"),
            atk: parseInt(f.atk ?? "0"),
            spd: parseInt(f.spd ?? "0"),
            baseValue: parseInt(f.base_value ?? "0"),
            actualValue: parseInt(f.actual_value ?? "0"),
            lootboxSource: f.lootbox_source ?? "",
            globalId: parseInt(f.global_sequential_id ?? "0"),
            kioskId,
            kioskCapId,
            isListed: listedNftIds.has(objectId),
          };
        })
        .filter((n): n is NFT & { isListed: boolean } => n !== null);

      setUserNfts(mappedNfts);
    } catch (err) {
      console.error("Inventory fetch error:", err);
      toast({
        variant: "destructive",
        title: "Failed to load inventory",
        description: "Check your connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [account, suiClient, toast]);

  useEffect(() => {
    fetchUserNfts();
  }, [fetchUserNfts]);

  // ── Burn ────────────────────────────────────────────────────────────────────
  const handleBurnNft = async (nft: NFT) => {
    if (!account || !nft.kioskId || !nft.kioskCapId) return;
    setIsBurning(true);
    try {
      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.BURN_NFT_FOR_GYATE}`,
        arguments: [
          txb.object(nft.kioskId),
          txb.object(nft.kioskCapId),
          txb.object(TREASURY_CAP),
          txb.pure.id(nft.id), // pure.id not pure.address
        ],
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: () => {
            toast({ title: "Hero Sacrificed 🔥", description: "You received $GYATE tokens." });
            setIsBurning(false);
            setSelectedNft(null);
            setTimeout(fetchUserNfts, 3000);
          },
          onError: (err) => {
            toast({ variant: "destructive", title: "Burn failed", description: err.message });
            setIsBurning(false);
          },
        }
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup error", description: err.message });
      setIsBurning(false);
    }
  };

  // ── List for sale ───────────────────────────────────────────────────────────
  const openListDialog = (nft: NFT) => {
    setListingNft(nft);
    setListPriceSui("");
    setListDialogOpen(true);
  };

  const handleListNft = async () => {
    if (!listingNft || !account || !listingNft.kioskId || !listingNft.kioskCapId) return;

    const priceFloat = parseFloat(listPriceSui);
    if (isNaN(priceFloat) || priceFloat <= 0) {
      toast({ variant: "destructive", title: "Enter a valid price" });
      return;
    }

    // Keep as BigInt to avoid float precision loss
    const priceMist = BigInt(Math.round(priceFloat * 1_000_000_000));

    setIsListing(true);
    try {
      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.LIST_NFT}`,
        arguments: [
          txb.object(listingNft.kioskId),
          txb.object(listingNft.kioskCapId),
          txb.pure.id(listingNft.id), // real NFT ID — critical
          txb.pure.u64(priceMist),
        ],
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: () => {
            toast({
              title: "Listed! 🏷️",
              description: `${listingNft.name} listed for ${priceFloat} SUI.`,
            });
            setIsListing(false);
            setListDialogOpen(false);
            setListingNft(null);
            setTimeout(fetchUserNfts, 3000);
          },
          onError: (err) => {
            toast({ variant: "destructive", title: "Listing failed", description: err.message });
            setIsListing(false);
          },
        }
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup error", description: err.message });
      setIsListing(false);
    }
  };

  // ── Delist ──────────────────────────────────────────────────────────────────
  const handleDelistNft = async (nft: NFT) => {
    if (!account || !nft.kioskId || !nft.kioskCapId) return;
    try {
      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.DELIST_NFT}`,
        arguments: [
          txb.object(nft.kioskId),
          txb.object(nft.kioskCapId),
          txb.pure.id(nft.id),
        ],
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: () => {
            toast({ title: "Delisted", description: `${nft.name} removed from marketplace.` });
            setTimeout(fetchUserNfts, 3000);
          },
          onError: (err) => {
            toast({ variant: "destructive", title: "Delist failed", description: err.message });
          },
        }
      );
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup error", description: err.message });
    }
  };

  const filtered = userNfts.filter((n) =>
    n.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="font-headline text-4xl font-bold mb-2">Inventory</h1>
            <p className="text-muted-foreground">Manage your on-chain collection and $GYATE economy.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchUserNfts}
              className="border-white/10"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            <div className="relative md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search NFTs..."
                className="pl-10 bg-white/5 border-white/10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {!account ? (
          <div className="py-32 text-center glass-card rounded-3xl">
            <div className="max-w-xs mx-auto space-y-4">
              <ShoppingBag className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold font-headline">Connect Wallet</h2>
              <p className="text-sm text-muted-foreground">View your collection on the Sui network.</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
            <p className="font-headline tracking-widest text-muted-foreground">Accessing Kiosk...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-32 text-center glass-card rounded-3xl">
            <div className="max-w-xs mx-auto space-y-4">
              <LayoutGrid className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold">
                {searchTerm ? "No results" : "Collection Empty"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {searchTerm
                  ? "Try a different search."
                  : "Visit the Emporium to summon your first hero."}
              </p>
              {!searchTerm && (
                <Button asChild className="glow-purple">
                  <a href="/shop">Go to Shop</a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filtered.map((nft) => (
              <div key={nft.id} className="space-y-2">
                <NFTCard nft={nft} onClick={() => setSelectedNft(nft)} />
                <div className="flex gap-2">
                  {(nft as any).isListed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs border-white/10 text-muted-foreground"
                      onClick={() => handleDelistNft(nft)}
                    >
                      Delist
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs border-white/10"
                      onClick={() => openListDialog(nft)}
                    >
                      <Tag className="w-3 h-3 mr-1" /> List
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NFTDetailDialog
        nft={selectedNft}
        open={!!selectedNft}
        onOpenChange={(open) => !open && setSelectedNft(null)}
        isInventory={true}
        onBurn={() => selectedNft && handleBurnNft(selectedNft)}
        isBurning={isBurning}
      />

      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent className="glass-card border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-headline">
              List {listingNft?.name} for Sale
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Enter your asking price in SUI. Buyers pay a 10% marketplace fee on top.
            </p>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={listPriceSui}
                onChange={(e) => setListPriceSui(e.target.value)}
                className="bg-white/5 border-white/10 pr-14 text-lg font-bold"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                SUI
              </span>
            </div>
            {listPriceSui && !isNaN(parseFloat(listPriceSui)) && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>You receive: <span className="text-foreground font-bold">{parseFloat(listPriceSui).toFixed(4)} SUI</span></p>
                <p>Buyer pays: <span className="text-foreground font-bold">{(parseFloat(listPriceSui) * 1.1).toFixed(4)} SUI</span> (incl. 10% fee)</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => setListDialogOpen(false)}
              disabled={isListing}
            >
              Cancel
            </Button>
            <Button
              className="glow-purple"
              onClick={handleListNft}
              disabled={isListing || !listPriceSui}
            >
              {isListing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
