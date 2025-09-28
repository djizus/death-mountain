import { NUM_ITEMS, SUFFIX_UNLOCK_GREATNESS } from '@/constants/game';
import { ItemType, ItemUtils, Tier } from './loot';

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

export type StatDisplayName = 'Strength' | 'Vitality' | 'Dexterity' | 'Intelligence' | 'Wisdom' | 'Charisma';

export const STAT_FILTER_OPTIONS: StatDisplayName[] = ['Strength', 'Vitality', 'Dexterity', 'Intelligence', 'Wisdom', 'Charisma'];

type ArmorCategory = Extract<ItemType, ItemType.Cloth | ItemType.Hide | ItemType.Metal>;

export interface ArmorSetItemStats {
  id: number;
  slot: string;
  statBonus: string | null;
}

export interface ArmorSetStatSummary {
  type: ArmorCategory;
  items: ArmorSetItemStats[];
  totals: Record<StatDisplayName, number>;
}

const ARMOR_TYPES: ArmorCategory[] = [ItemType.Cloth, ItemType.Hide, ItemType.Metal];
const ARMOR_SLOTS = ['Head', 'Chest', 'Waist', 'Foot', 'Hand'];

const STAT_CODE_TO_NAME: Record<string, StatDisplayName> = {
  STR: 'Strength',
  VIT: 'Vitality',
  DEX: 'Dexterity',
  INT: 'Intelligence',
  WIS: 'Wisdom',
  CHA: 'Charisma',
};

const createEmptyTotals = (): Record<StatDisplayName, number> => ({
  Strength: 0,
  Vitality: 0,
  Dexterity: 0,
  Intelligence: 0,
  Wisdom: 0,
  Charisma: 0,
});

const parseStatBonus = (bonus: string | null): Partial<Record<StatDisplayName, number>> => {
  if (!bonus) {
    return {};
  }

  const totals: Partial<Record<StatDisplayName, number>> = {};
  const regex = /([+-]?\d+)\s*(STR|DEX|VIT|INT|WIS|CHA)/g;
  const matches = bonus.matchAll(regex);

  for (const match of matches) {
    const value = Number(match[1]);
    const statName = STAT_CODE_TO_NAME[match[2]];

    if (statName) {
      totals[statName] = (totals[statName] ?? 0) + value;
    }
  }

  return totals;
};

export function getTierOneArmorSetStats(itemSpecialsSeed: number): ArmorSetStatSummary[] {
  if (!itemSpecialsSeed) {
    return [];
  }

  const summaries: Record<ArmorCategory, ArmorSetStatSummary> = ARMOR_TYPES.reduce((acc, type) => {
    acc[type] = {
      type,
      items: ARMOR_SLOTS.map((slot) => ({ id: 0, slot, statBonus: null })),
      totals: createEmptyTotals(),
    };
    return acc;
  }, {} as Record<ArmorCategory, ArmorSetStatSummary>);

  for (let id = 1; id <= NUM_ITEMS; id += 1) {
    const itemType = ItemUtils.getItemType(id) as ItemType;

    if (!ARMOR_TYPES.includes(itemType as ArmorCategory)) {
      continue;
    }

    if (ItemUtils.getItemTier(id) !== Tier.T1) {
      continue;
    }

    const slot = ItemUtils.getItemSlot(id);

    if (!ARMOR_SLOTS.includes(slot)) {
      continue;
    }

    const specials = ItemUtils.getSpecials(id, SUFFIX_UNLOCK_GREATNESS, itemSpecialsSeed);
    const statBonus = specials.special1 ? ItemUtils.getStatBonus(specials.special1) ?? null : null;
    const summary = summaries[itemType as ArmorCategory];
    const slotIndex = ARMOR_SLOTS.indexOf(slot);

    if (slotIndex >= 0) {
      summary.items[slotIndex] = {
        id,
        slot,
        statBonus,
      };
    }

    const bonusTotals = parseStatBonus(statBonus);

    Object.entries(bonusTotals).forEach(([stat, value]) => {
      summary.totals[stat as StatDisplayName] += value;
    });
  }

  return ARMOR_TYPES.map((type) => summaries[type]);
}
