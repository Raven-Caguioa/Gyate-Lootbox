"use client";

import { Navigation } from "@/components/navigation";
import { NFTCard } from "@/components/nft-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, RefreshCw, ShoppingBag, Loader2, LayoutGrid,
  Tag, ChevronRight, X, Layers, ArrowLeft, Flame, Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback, useMemo } from "react";
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

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface NFTWithListed extends NFT {
  isListed: boolean;
}

interface NFTGroup {
  name: string;
  rarity: number;
  baseImage: string;
  items: NFTWithListed[];
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const RARITY_LABELS  = ["Common", "Rare", "Super Rare", "SSR", "Ultra Rare", "Legend Rare"];
const RARITY_COLORS  = [
  "border-slate-400/40 bg-slate-400/5 text-slate-300",
  "border-blue-400/40 bg-blue-400/5 text-blue-300",
  "border-purple-400/40 bg-purple-400/5 text-purple-300",
  "border-pink-400/40 bg-pink-400/5 text-pink-300",
  "border-yellow-400/40 bg-yellow-400/5 text-yellow-300",
  "border-red-400/40 bg-red-400/5 text-red-300",
];
const RARITY_BADGE_COLORS = [
  "bg-slate-400/20 text-slate-300",
  "bg-blue-400/20 text-blue-300",
  "bg-purple-400/20 text-purple-300",
  "bg-pink-400/20 text-pink-300",
  "bg-yellow-400/20 text-yellow-300",
  "bg-red-400/20 text-red-300",
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function normalizeSuiId(id: string | any): string {
  if (!id) return "";
  const str = typeof id === "string" ? id : id?.id || id?.objectId || JSON.stringify(id);
  return str.toLowerCase().replace(/^(0x)?/, "0x");
}

function shortenId(id: string): string {
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function InventoryPage() {
  const account        = useCurrentAccount();
  const suiClient      = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { toast }      = useToast();

  // Data
  const [userNfts, setUserNfts]     = useState<NFTWithListed[]>([]);
  const [isLoading, setIsLoading]   = useState(false);

  // View state: null = group grid, string = expanded group name
  const [expandedGroup, setExpandedGroup]   = useState<string | null>(null);
  const [selectedNft, setSelectedNft]       = useState<NFT | null>(null);
  const [searchTerm, setSearchTerm]         = useState("");
  const [rarityFilter, setRarityFilter]     = useState<number | null>(null);

  // Burn / list state
  const [isBurning, setIsBurning]     = useState(false);
  const [isListing, setIsListing]     = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listingNft, setListingNft]   = useState<NFT | null>(null);
  const [listPriceSui, setListPriceSui] = useState("");

  // ── Fetch NFTs ──────────────────────────────────────────────────────
  const fetchUserNfts = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      const capsRes = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: "0x2::kiosk::KioskOwnerCap" },
        options: { showContent: true },
      });

      if (capsRes.data.length === 0) { setUserNfts([]); return; }

      const kioskCapId = capsRes.data[0].data?.objectId!;
      const kioskId    = (capsRes.data[0].data?.content as any)?.fields?.for;
      if (!kioskId)    { setUserNfts([]); return; }

      // Paginate all dynamic fields
      let allFields: any[] = [];
      let cursor: string | null | undefined = undefined;
      do {
        const page = await suiClient.getDynamicFields({ parentId: kioskId, cursor: cursor ?? undefined, limit: 50 });
        allFields = [...allFields, ...page.data];
        cursor = page.hasNextPage ? page.nextCursor : null;
      } while (cursor);

      if (allFields.length === 0) { setUserNfts([]); return; }

      const NFT_TYPE     = `${PACKAGE_ID}::${MODULE_NAMES.NFT}::GyateNFT`;
      const ITEM_TYPE    = "0x2::kiosk::Item";
      const LISTING_TYPE = "0x2::kiosk::Listing";

      const itemFields   = allFields.filter(f => typeof f.name.type === "string" && f.name.type.startsWith(ITEM_TYPE));
      const listingFields = allFields.filter(f => typeof f.name.type === "string" && f.name.type.startsWith(LISTING_TYPE));

      if (itemFields.length === 0) { setUserNfts([]); return; }

      const realNftIds: string[] = itemFields
        .map(f => normalizeSuiId((f.name.value as any)?.id || f.name.value))
        .filter(Boolean);

      const listedNftIds = new Set(
        listingFields.map(f => normalizeSuiId((f.name.value as any)?.id || f.name.value))
      );

      // Batch fetch
      const BATCH = 50;
      const nftObjects: any[] = [];
      for (let i = 0; i < realNftIds.length; i += BATCH) {
        const results = await suiClient.multiGetObjects({
          ids: realNftIds.slice(i, i + BATCH),
          options: { showContent: true, showType: true },
        });
        nftObjects.push(...results);
      }

      const mapped: NFTWithListed[] = nftObjects
        .map((obj: any) => {
          if (!obj.data) return null;
          const objectId = normalizeSuiId(obj.data.objectId);
          const content  = obj.data.content;
          if (content?.type !== NFT_TYPE) return null;
          const f = content?.fields;
          if (!f) return null;
          return {
            id:           objectId,
            name:         f.name ?? "Unknown",
            rarity:       Number(f.rarity ?? 0),
            variantType:  f.variant_type ?? "Normal",
            image:        f.image_url || "https://images.unsplash.com/photo-1743355694962-40376ef681da?q=80&w=400",
            hp:           parseInt(f.hp ?? "0"),
            atk:          parseInt(f.atk ?? "0"),
            spd:          parseInt(f.spd ?? "0"),
            baseValue:    parseInt(f.base_value ?? "0"),
            actualValue:  parseInt(f.actual_value ?? "0"),
            lootboxSource: f.lootbox_source ?? "",
            globalId:     parseInt(f.global_sequential_id ?? "0"),
            kioskId,
            kioskCapId,
            isListed:     listedNftIds.has(objectId),
          } as NFTWithListed;
        })
        .filter((n): n is NFTWithListed => n !== null);

      setUserNfts(mapped);
    } catch (err) {
      console.error("Inventory fetch error:", err);
      toast({ variant: "destructive", title: "Failed to load inventory", description: "Check your connection and try again." });
    } finally {
      setIsLoading(false);
    }
  }, [account, suiClient, toast]);

  useEffect(() => { fetchUserNfts(); }, [fetchUserNfts]);

  // ── Group NFTs by name ──────────────────────────────────────────────
  const groups = useMemo((): NFTGroup[] => {
    const map = new Map<string, NFTGroup>();
    for (const nft of userNfts) {
      const key = nft.name;
      if (!map.has(key)) {
        map.set(key, { name: nft.name, rarity: nft.rarity, baseImage: nft.image, items: [] });
      }
      map.get(key)!.items.push(nft);
    }
    return Array.from(map.values()).sort((a, b) => b.rarity - a.rarity);
  }, [userNfts]);

  // ── Filter groups ───────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const matchesSearch  = g.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRarity  = rarityFilter === null || g.rarity === rarityFilter;
      return matchesSearch && matchesRarity;
    });
  }, [groups, searchTerm, rarityFilter]);

  // Items inside the currently expanded group (also filterable)
  const expandedItems = useMemo(() => {
    if (!expandedGroup) return [];
    const group = groups.find(g => g.name === expandedGroup);
    return group?.items ?? [];
  }, [expandedGroup, groups]);

  // ── Burn ─────────────────────────────────────────────────────────────
  const handleBurnNft = async (nft: NFT) => {
    if (!account || !nft.kioskId || !nft.kioskCapId) return;
    setIsBurning(true);

    try {
      // FIX: burn_nft_for_gyate now requires PlayerStats — fetch it first
      const statsObjects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::${MODULE_NAMES.ACHIEVEMENT}::PlayerStats` },
      });

      if (statsObjects.data.length === 0) {
        toast({
          variant: "destructive",
          title: "Profile Required",
          description: "Initialize your profile in the Account section before burning.",
        });
        setIsBurning(false);
        return;
      }

      const statsId = statsObjects.data[0].data!.objectId;

      const txb = new Transaction();
      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAMES.LOOTBOX}::${FUNCTIONS.BURN_NFT_FOR_GYATE}`,
        arguments: [
          txb.object(nft.kioskId),
          txb.object(nft.kioskCapId),
          txb.object(TREASURY_CAP),
          txb.object(statsId),    // FIX: new required parameter added in updated contract
          txb.pure.id(nft.id),
        ],
      });

      signAndExecute({ transaction: txb }, {
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
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Burn error", description: err.message });
      setIsBurning(false);
    }
  };

  // ── List for sale ─────────────────────────────────────────────────────
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
    const priceMist = BigInt(Math.round(priceFloat * 1_000_000_000));
    setIsListing(true);
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.LIST_NFT}`,
      arguments: [
        txb.object(listingNft.kioskId),
        txb.object(listingNft.kioskCapId),
        txb.pure.id(listingNft.id),
        txb.pure.u64(priceMist),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Listed! 🏷️", description: `${listingNft.name} listed for ${priceFloat} SUI.` });
        setIsListing(false);
        setListDialogOpen(false);
        setListingNft(null);
        setTimeout(fetchUserNfts, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Listing failed", description: err.message });
        setIsListing(false);
      },
    });
  };

  // ── Delist ────────────────────────────────────────────────────────────
  const handleDelistNft = async (nft: NFT) => {
    if (!account || !nft.kioskId || !nft.kioskCapId) return;
    const txb = new Transaction();
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAMES.MARKETPLACE}::${FUNCTIONS.DELIST_NFT}`,
      arguments: [
        txb.object(nft.kioskId),
        txb.object(nft.kioskCapId),
        txb.pure.id(nft.id),
      ],
    });
    signAndExecute({ transaction: txb }, {
      onSuccess: () => {
        toast({ title: "Delisted", description: `${nft.name} removed from marketplace.` });
        setTimeout(fetchUserNfts, 3000);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Delist failed", description: err.message });
      },
    });
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />

      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h1 className="font-headline text-4xl font-bold mb-1">Inventory</h1>
            <p className="text-muted-foreground text-sm">
              {userNfts.length} hero{userNfts.length !== 1 ? "es" : ""} across {groups.length} type{groups.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={fetchUserNfts} className="border-white/10">
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            <div className="relative md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                className="pl-10 bg-white/5 border-white/10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {!account ? (
          <EmptyState icon={<ShoppingBag className="w-12 h-12 text-primary mx-auto" />} title="Connect Wallet" description="View your collection on the Sui network." />
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <RefreshCw className="w-12 h-12 text-primary animate-spin" />
            <p className="font-headline tracking-widest text-muted-foreground">Accessing Kiosk...</p>
          </div>
        ) : userNfts.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="w-12 h-12 text-primary mx-auto" />}
            title="Collection Empty"
            description="Visit the Emporium to summon your first hero."
            action={<Button asChild className="glow-purple"><a href="/shop">Go to Shop</a></Button>}
          />
        ) : expandedGroup ? (
          // ── Expanded group view ──────────────────────────────────────
          <ExpandedGroupView
            group={groups.find(g => g.name === expandedGroup)!}
            items={expandedItems}
            onBack={() => setExpandedGroup(null)}
            onSelectNft={setSelectedNft}
            onList={openListDialog}
            onDelist={handleDelistNft}
          />
        ) : (
          // ── Group grid view ──────────────────────────────────────────
          <>
            {/* Rarity filter pills */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-bold uppercase tracking-widest mr-1">
                <Filter className="w-3 h-3" /> Rarity
              </span>
              <FilterPill active={rarityFilter === null} onClick={() => setRarityFilter(null)}>
                All
              </FilterPill>
              {[0, 1, 2, 3, 4, 5].filter(r => groups.some(g => g.rarity === r)).map(r => (
                <FilterPill key={r} active={rarityFilter === r} onClick={() => setRarityFilter(rarityFilter === r ? null : r)}>
                  {RARITY_LABELS[r]}
                </FilterPill>
              ))}
            </div>

            {filteredGroups.length === 0 ? (
              <EmptyState
                icon={<Search className="w-12 h-12 text-primary mx-auto" />}
                title="No results"
                description="Try a different search or filter."
                action={<Button variant="link" onClick={() => { setSearchTerm(""); setRarityFilter(null); }} className="text-accent">Clear filters</Button>}
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredGroups.map(group => (
                  <GroupCard
                    key={group.name}
                    group={group}
                    onClick={() => setExpandedGroup(group.name)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* NFT detail dialog */}
      <NFTDetailDialog
        nft={selectedNft}
        open={!!selectedNft}
        onOpenChange={(open) => !open && setSelectedNft(null)}
        isInventory={true}
        onBurn={() => selectedNft && handleBurnNft(selectedNft)}
        isBurning={isBurning}
      />

      {/* List dialog */}
      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent className="glass-card border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-headline">List {listingNft?.name} for Sale</DialogTitle>
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
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">SUI</span>
            </div>
            {listPriceSui && !isNaN(parseFloat(listPriceSui)) && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>You receive: <span className="text-foreground font-bold">{parseFloat(listPriceSui).toFixed(4)} SUI</span></p>
                <p>Buyer pays: <span className="text-foreground font-bold">{(parseFloat(listPriceSui) * 1.1).toFixed(4)} SUI</span> (incl. 10% fee)</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-white/10" onClick={() => setListDialogOpen(false)} disabled={isListing}>
              Cancel
            </Button>
            <Button className="glow-purple" onClick={handleListNft} disabled={isListing || !listPriceSui}>
              {isListing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// Group Card — shown in the main grid
// ─────────────────────────────────────────────

function GroupCard({ group, onClick }: { group: NFTGroup; onClick: () => void }) {
  const listedCount   = group.items.filter(i => i.isListed).length;
  const unlistedCount = group.items.length - listedCount;
  const colorClass    = RARITY_COLORS[group.rarity] ?? RARITY_COLORS[0];
  const badgeColor    = RARITY_BADGE_COLORS[group.rarity] ?? RARITY_BADGE_COLORS[0];

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative rounded-2xl border overflow-hidden text-left transition-all duration-200",
        "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
        colorClass
      )}
    >
      {/* Stacked card effect — ghost cards behind */}
      {group.items.length > 2 && (
        <div className="absolute inset-x-3 top-1.5 h-full rounded-xl border border-white/5 bg-white/3 -z-10" />
      )}
      {group.items.length > 1 && (
        <div className="absolute inset-x-1.5 top-0.5 h-full rounded-xl border border-white/5 bg-white/5 -z-10" />
      )}

      {/* Image */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={group.baseImage}
          alt={group.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Count badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-bold">
          <Layers className="w-2.5 h-2.5" />
          {group.items.length}
        </div>

        {/* Listed badge */}
        {listedCount > 0 && (
          <div className="absolute top-2 left-2 bg-accent/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-white">
            {listedCount} listed
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-bold text-sm leading-tight">{group.name}</h3>
          <ChevronRight className="w-4 h-4 opacity-40 flex-shrink-0 mt-0.5 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="flex items-center justify-between">
          <span className={cn("text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5", badgeColor)}>
            {RARITY_LABELS[group.rarity]}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {unlistedCount} in wallet
          </span>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// Expanded Group View — shows individual tokens
// ─────────────────────────────────────────────

function ExpandedGroupView({
  group,
  items,
  onBack,
  onSelectNft,
  onList,
  onDelist,
}: {
  group: NFTGroup;
  items: NFTWithListed[];
  onBack: () => void;
  onSelectNft: (nft: NFT) => void;
  onList: (nft: NFT) => void;
  onDelist: (nft: NFT) => void;
}) {
  const badgeColor  = RARITY_BADGE_COLORS[group.rarity] ?? RARITY_BADGE_COLORS[0];
  const listedCount = items.filter(i => i.isListed).length;

  return (
    <div className="space-y-6">
      {/* Back header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="bg-white/5 border-white/10 gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
            <img src={group.baseImage} alt={group.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold">{group.name}</h2>
            <div className="flex items-center gap-2">
              <span className={cn("text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5", badgeColor)}>
                {RARITY_LABELS[group.rarity]}
              </span>
              <span className="text-xs text-muted-foreground">
                {items.length} owned · {listedCount} listed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Token list */}
      <div className="grid gap-3">
        {items.map((nft, idx) => (
          <TokenRow
            key={nft.id}
            nft={nft}
            index={idx + 1}
            onView={() => onSelectNft(nft)}
            onList={() => onList(nft)}
            onDelist={() => onDelist(nft)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Token Row — individual NFT inside expanded group
// ─────────────────────────────────────────────

function TokenRow({
  nft,
  index,
  onView,
  onList,
  onDelist,
}: {
  nft: NFTWithListed;
  index: number;
  onView: () => void;
  onList: () => void;
  onDelist: () => void;
}) {
  return (
    <Card className={cn(
      "bg-white/5 border transition-colors",
      nft.isListed ? "border-accent/30" : "border-white/5 hover:border-white/10"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">

          {/* Thumbnail */}
          <div
            className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 cursor-pointer"
            onClick={onView}
          >
            <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
          </div>

          {/* ID + stats */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-muted-foreground">
                #{String(index).padStart(3, "0")}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/60 truncate">
                {shortenId(nft.id)}
              </span>
              {nft.isListed && (
                <span className="text-[10px] font-bold bg-accent/10 text-accent border border-accent/20 rounded-full px-1.5 py-0.5 flex-shrink-0">
                  Listed
                </span>
              )}
              {nft.variantType && nft.variantType !== "Normal" && (
                <span className="text-[10px] font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 rounded-full px-1.5 py-0.5 flex-shrink-0">
                  {nft.variantType}
                </span>
              )}
            </div>
            {/* Combat stats */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
              <span>HP <span className="text-foreground font-bold">{nft.hp}</span></span>
              <span>ATK <span className="text-foreground font-bold">{nft.atk}</span></span>
              <span>SPD <span className="text-foreground font-bold">{nft.spd}</span></span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              className="text-xs border-white/10 bg-white/5 h-8 px-3"
            >
              View
            </Button>
            {nft.isListed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelist}
                className="text-xs border-white/10 text-muted-foreground h-8 px-3"
              >
                <X className="w-3 h-3 mr-1" /> Delist
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onList}
                className="text-xs border-white/10 h-8 px-3"
              >
                <Tag className="w-3 h-3 mr-1" /> List
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-bold transition-colors border",
        active
          ? "bg-accent text-white border-accent"
          : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/20 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-32 text-center glass-card rounded-3xl">
      <div className="max-w-xs mx-auto space-y-4">
        {icon}
        <h2 className="text-xl font-bold font-headline">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action}
      </div>
    </div>
  );
}