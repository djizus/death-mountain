import { calculateDeterministicCombatResult } from '@/utils/combatSimulationCore';
import { calculateAttackDamage, calculateBeastDamage } from '@/utils/game';
import { ItemUtils } from '@/utils/loot';
import type { Adventurer, Beast, Equipment, Item } from '@/types/game';

type EquipmentSlot = keyof Equipment;

interface GearSuggestionScore {
  winRate: number;
  modeDamageTaken: number;
  modeDamageDealt: number;
  maxDamageTaken: number;
  maxDamageDealt: number;
}

interface GearSuggestionResult {
  adventurer: Adventurer;
  bag: Item[];
  score: GearSuggestionScore;
  changes: EquipmentSlot[];
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'head', 'chest', 'waist', 'hand', 'foot', 'neck', 'ring'];

const logSuggestion = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.info('[GearSuggestion]', ...args);
  }
};

const describeSelection = (selection: Partial<Record<EquipmentSlot, Item>>) => (
  Object.entries(selection).map(([slot, item]) => `${slot}:${item?.id ?? 0}`)
);

const ARMOR_SLOTS: EquipmentSlot[] = ['head', 'chest', 'waist', 'hand', 'foot'];

const MAX_WEAPON_CANDIDATES = 4;
const MAX_ARMOR_CANDIDATES = 3;
const MAX_JEWELRY_CANDIDATES = 4;

const cloneItem = (item: Item): Item => ({ id: item.id, xp: item.xp });

const cloneAdventurer = (adventurer: Adventurer): Adventurer => ({
  ...adventurer,
  stats: { ...adventurer.stats },
  equipment: Object.entries(adventurer.equipment).reduce<Equipment>((acc, [slot, item]) => {
    acc[slot as EquipmentSlot] = cloneItem(item as Item);
    return acc;
  }, {} as Equipment),
});

const cloneBag = (bag: Item[]): Item[] => bag.map(cloneItem);

const itemsEqual = (a: Item, b: Item) => a.id === b.id && a.xp === b.xp;

const toScore = (result: ReturnType<typeof calculateDeterministicCombatResult>): GearSuggestionScore => ({
  winRate: result.winRate,
  modeDamageTaken: result.modeDamageTaken,
  modeDamageDealt: result.modeDamageDealt,
  maxDamageTaken: result.maxDamageTaken,
  maxDamageDealt: result.maxDamageDealt,
});

const isBetterScore = (candidate: GearSuggestionScore, current: GearSuggestionScore) => {
  if (candidate.winRate !== current.winRate) {
    return candidate.winRate > current.winRate;
  }

  if (candidate.modeDamageTaken !== current.modeDamageTaken) {
    return candidate.modeDamageTaken < current.modeDamageTaken;
  }

  if (candidate.modeDamageDealt !== current.modeDamageDealt) {
    return candidate.modeDamageDealt > current.modeDamageDealt;
  }

  if (candidate.maxDamageTaken !== current.maxDamageTaken) {
    return candidate.maxDamageTaken < current.maxDamageTaken;
  }

  if (candidate.maxDamageDealt !== current.maxDamageDealt) {
    return candidate.maxDamageDealt > current.maxDamageDealt;
  }

  return false;
};

const applyGearSet = (
  adventurer: Adventurer,
  selection: Partial<Record<EquipmentSlot, Item>>,
): Adventurer => {
  const updated = cloneAdventurer(adventurer);
  let updatedStats = { ...adventurer.stats };

  EQUIPMENT_SLOTS.forEach((slot) => {
    const desiredItem = selection[slot] ?? adventurer.equipment[slot];
    const currentItem = adventurer.equipment[slot];

    if (itemsEqual(desiredItem, currentItem)) {
      return;
    }

    const equippedItem = updated.equipment[slot];

    if (equippedItem.id !== 0) {
      updatedStats = ItemUtils.removeItemBoosts(equippedItem, adventurer.item_specials_seed, updatedStats);
    }

    if (desiredItem.id !== 0) {
      updatedStats = ItemUtils.addItemBoosts(desiredItem, adventurer.item_specials_seed, updatedStats);
    }

    updated.equipment[slot] = cloneItem(desiredItem);
  });

  updated.stats = updatedStats;
  return updated;
};

const removeItemOnce = (items: Item[], target: Item) => {
  const index = items.findIndex((item) => itemsEqual(item, target));
  if (index === -1) {
    return items;
  }

  return [...items.slice(0, index), ...items.slice(index + 1)];
};

const buildUpdatedBag = (
  adventurer: Adventurer,
  bag: Item[],
  selection: Partial<Record<EquipmentSlot, Item>>,
): Item[] => {
  let updatedBag = cloneBag(bag);

  EQUIPMENT_SLOTS.forEach((slot) => {
    const desiredItem = selection[slot];
    const currentItem = adventurer.equipment[slot];

    if (!desiredItem || itemsEqual(desiredItem, currentItem)) {
      return;
    }

    if (desiredItem.id !== 0) {
      updatedBag = removeItemOnce(updatedBag, desiredItem);
    }

    if (currentItem.id !== 0) {
      updatedBag = [...updatedBag, cloneItem(currentItem)];
    }
  });

  return updatedBag;
};

const getSlotKey = (item: Item): EquipmentSlot => {
  const slot = ItemUtils.getItemSlot(item.id).toLowerCase();
  switch (slot) {
    case 'weapon':
    case 'head':
    case 'chest':
    case 'waist':
    case 'hand':
    case 'foot':
    case 'neck':
    case 'ring':
      return slot;
    default:
      return 'weapon';
  }
};

const candidateSorter = (
  slot: EquipmentSlot,
  adventurer: Adventurer,
  beast: Beast,
) => (a: Item, b: Item) => {
  if (itemsEqual(a, adventurer.equipment[slot]) && !itemsEqual(b, adventurer.equipment[slot])) {
    return -1;
  }

  if (!itemsEqual(a, adventurer.equipment[slot]) && itemsEqual(b, adventurer.equipment[slot])) {
    return 1;
  }

  if (slot === 'weapon') {
    const aDamage = calculateAttackDamage(a, adventurer, beast).baseDamage;
    const bDamage = calculateAttackDamage(b, adventurer, beast).baseDamage;
    return bDamage - aDamage;
  }

  if (ARMOR_SLOTS.includes(slot)) {
    const aDamageTaken = calculateBeastDamage(beast, adventurer, a).baseDamage;
    const bDamageTaken = calculateBeastDamage(beast, adventurer, b).baseDamage;
    return aDamageTaken - bDamageTaken;
  }

  const aLevel = ItemUtils.getItemTier(a.id);
  const bLevel = ItemUtils.getItemTier(b.id);

  if (bLevel !== aLevel) {
    return bLevel - aLevel;
  }

  return b.xp - a.xp;
};

const getCandidateLimit = (slot: EquipmentSlot) => {
  if (slot === 'weapon') {
    return MAX_WEAPON_CANDIDATES;
  }

  if (slot === 'neck' || slot === 'ring') {
    return MAX_JEWELRY_CANDIDATES;
  }

  if (ARMOR_SLOTS.includes(slot)) {
    return MAX_ARMOR_CANDIDATES;
  }

  return 2;
};

const buildCandidates = (
  adventurer: Adventurer,
  bag: Item[],
  beast: Beast,
) => {
  const candidates: Record<EquipmentSlot, Item[]> = {
    weapon: [],
    head: [],
    chest: [],
    waist: [],
    hand: [],
    foot: [],
    neck: [],
    ring: [],
  };

  EQUIPMENT_SLOTS.forEach((slot) => {
    candidates[slot].push(cloneItem(adventurer.equipment[slot]));
  });

  bag.forEach((item) => {
    const slot = getSlotKey(item);
    candidates[slot].push(cloneItem(item));
  });

  EQUIPMENT_SLOTS.forEach((slot) => {
    const unique = candidates[slot].filter((candidate, index, array) => (
      array.findIndex((other) => itemsEqual(candidate, other)) === index
    ));

    const sorted = unique.sort(candidateSorter(slot, adventurer, beast));
    const limit = getCandidateLimit(slot);
    candidates[slot] = sorted.slice(0, Math.max(1, limit));
  });

  return candidates;
};

export const suggestBestCombatGear = (
  adventurer: Adventurer | null,
  bag: Item[] | null,
  beast: Beast | null,
): GearSuggestionResult | null => {
  if (!adventurer || !bag || !beast) {
    logSuggestion('Missing data', { hasAdventurer: !!adventurer, hasBag: !!bag, hasBeast: !!beast });
    return null;
  }

  const candidates = buildCandidates(adventurer, bag, beast);

  logSuggestion('Candidate pool sizes', EQUIPMENT_SLOTS.reduce<Record<string, number>>((acc, slot) => {
    acc[slot] = candidates[slot].length;
    return acc;
  }, {}));

  const baseResult = calculateDeterministicCombatResult(adventurer, beast, { initialBeastStrike: false });
  let bestScore = toScore(baseResult);
  let bestSelection: Partial<Record<EquipmentSlot, Item>> | null = null;
  let bestChangeCount = 0;

  const selection: Partial<Record<EquipmentSlot, Item>> = {};
  const slots = EQUIPMENT_SLOTS;

  const explore = (index: number) => {
    if (index >= slots.length) {
      const changeCount = slots.reduce((acc, slot) => (
        selection[slot] && !itemsEqual(selection[slot]!, adventurer.equipment[slot])
          ? acc + 1
          : acc
      ), 0);

      if (changeCount === 0) {
        return;
      }

      const candidateAdventurer = applyGearSet(adventurer, selection);
      const result = calculateDeterministicCombatResult(candidateAdventurer, beast, { initialBeastStrike: true });
      const score = toScore(result);

      logSuggestion('Evaluated selection', {
        selection: describeSelection(selection),
        changeCount,
        score,
        initialBeastStrike: true,
      });

      if (
        isBetterScore(score, bestScore)
        || (changeCount < bestChangeCount && !isBetterScore(bestScore, score))
      ) {
        bestScore = score;
        bestSelection = EQUIPMENT_SLOTS.reduce<Partial<Record<EquipmentSlot, Item>>>((acc, slot) => {
          if (selection[slot]) {
            acc[slot] = cloneItem(selection[slot]!);
          }
          return acc;
        }, {});
        bestChangeCount = changeCount;

        logSuggestion('New best selection', {
          score: bestScore,
          changeCount,
          selection: describeSelection(bestSelection),
        });
      }

      return;
    }

    const slot = slots[index];
    const slotCandidates = candidates[slot];

    slotCandidates.forEach((candidate) => {
      if (!itemsEqual(candidate, adventurer.equipment[slot])) {
        selection[slot] = candidate;
      } else {
        delete selection[slot];
      }

      explore(index + 1);
    });

    delete selection[slot];
  };

  explore(0);

  if (!bestSelection) {
    logSuggestion('No improvement found', { baseScore: bestScore });
    return null;
  }

  const updatedAdventurer = applyGearSet(adventurer, bestSelection);
  const updatedBag = buildUpdatedBag(adventurer, bag, bestSelection);

  logSuggestion('Final suggestion', {
    score: bestScore,
    changes: describeSelection(bestSelection),
  });

  const changedSlots = Object.keys(bestSelection) as EquipmentSlot[];

  return {
    adventurer: updatedAdventurer,
    bag: updatedBag,
    score: bestScore,
    changes: changedSlots,
  };
};
