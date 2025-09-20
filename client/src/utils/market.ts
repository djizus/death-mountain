import { SUFFIX_UNLOCK_GREATNESS } from '@/constants/game';
import { ItemUtils, Tier } from './loot';

export interface MarketItem {
  id: number;
  name: string;
  tier: Tier;
  type: string;
  slot: string;
  imageUrl: string;
  price: number;
  futureStatBonus: string | null;
  futureStatTags: string[];
}

function createMarketItem(id: number, charisma: number, itemSpecialsSeed = 0): MarketItem {
  const tier = ItemUtils.getItemTier(id);
  const price = ItemUtils.getItemPrice(tier, charisma);
  const name = ItemUtils.getItemName(id);
  const type = ItemUtils.getItemType(id);
  const slot = ItemUtils.getItemSlot(id);
  const imageUrl = ItemUtils.getItemImage(id);
  let futureStatBonus: string | null = null;
  let futureStatTags: string[] = [];

  if (itemSpecialsSeed) {
    const specialsAtLevel15 = ItemUtils.getSpecials(id, SUFFIX_UNLOCK_GREATNESS, itemSpecialsSeed);

    if (specialsAtLevel15.special1) {
      futureStatBonus = ItemUtils.getStatBonus(specialsAtLevel15.special1) ?? null;
      futureStatTags = ItemUtils.getStatBonusStats(specialsAtLevel15.special1);
    }
  }

  return {
    id,
    name,
    tier,
    type,
    slot,
    imageUrl,
    price,
    futureStatBonus,
    futureStatTags,
  };
}

export function generateMarketItems(marketItemIds: number[], charisma: number, itemSpecialsSeed = 0): MarketItem[] {
  const items = marketItemIds.map(id => createMarketItem(id, charisma, itemSpecialsSeed))
  return items;
}

export function potionPrice(level: number, charisma: number): number {
  return Math.max(1, level - (charisma * 2));
}
