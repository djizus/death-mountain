import { BEAST_NAMES } from "@/constants/beast";
import { OBSTACLE_NAMES } from "@/constants/obstacle";
import { ability_based_damage_reduction, ability_based_percentage, calculateBeastDamageDetails, calculateLevel, elementalAdjustedDamage } from "@/utils/game";
import { getAttackType, getBeastTier } from "@/utils/beast";
import { ItemUtils, ItemType, Tier as ItemTier } from "@/utils/loot";
import type { Adventurer, Beast, Equipment, Item } from "@/types/game";
import type { Settings } from "@/dojo/useGameSettings";

const BEAST_IDS = Array.from({ length: 75 }, (_, index) => index + 1);
const OBSTACLE_IDS = Array.from({ length: 75 }, (_, index) => index + 1);
const SLOT_ORDER: Array<keyof Equipment> = ['chest', 'head', 'waist', 'hand', 'foot'];
const MIN_DAMAGE_FROM_BEASTS = 2;
const MIN_DAMAGE_FROM_OBSTACLES = 4;
const NECKLACE_ARMOR_BONUS = 3;

const ENCOUNTER_BASE_MIX = {
  beast: 100 / 3,
  obstacle: 100 / 3,
  discovery: 100 - (2 * (100 / 3)),
};

const OBSTACLE_TYPE_MAP: Record<number, 'Magic' | 'Blade' | 'Bludgeon'> = {};
const OBSTACLE_TIER_MAP: Record<number, number> = {};

const BEAST_TYPE_MAP: Record<number, 'Magic' | 'Blade' | 'Bludgeon'> = {};
const BEAST_TIER_MAP: Record<number, number> = {};

const initialiseLookups = () => {
  if (Object.keys(OBSTACLE_TYPE_MAP).length > 0) return;

  for (const id of OBSTACLE_IDS) {
    if ((id >= 1 && id < 26)) {
      OBSTACLE_TYPE_MAP[id] = 'Magic';
    } else if (id < 51) {
      OBSTACLE_TYPE_MAP[id] = 'Blade';
    } else {
      OBSTACLE_TYPE_MAP[id] = 'Bludgeon';
    }

    if ((id >= 1 && id < 6) || (id >= 26 && id < 31) || (id >= 51 && id < 56)) {
      OBSTACLE_TIER_MAP[id] = 1;
    } else if ((id >= 6 && id < 11) || (id >= 31 && id < 36) || (id >= 56 && id < 61)) {
      OBSTACLE_TIER_MAP[id] = 2;
    } else if ((id >= 11 && id < 16) || (id >= 36 && id < 41) || (id >= 61 && id < 66)) {
      OBSTACLE_TIER_MAP[id] = 3;
    } else if ((id >= 16 && id < 21) || (id >= 41 && id < 46) || (id >= 66 && id < 71)) {
      OBSTACLE_TIER_MAP[id] = 4;
    } else {
      OBSTACLE_TIER_MAP[id] = 5;
    }
  }

  for (const id of BEAST_IDS) {
    BEAST_TYPE_MAP[id] = getAttackType(id) as 'Magic' | 'Blade' | 'Bludgeon';
    BEAST_TIER_MAP[id] = getBeastTier(id);
  }
};

const getEncounterLevelRange = (adventurerLevel: number) => {
  const baseMin = 1;
  const baseMax = Math.max(1, adventurerLevel * 3);

  let offset = 0;
  if (adventurerLevel >= 50) offset = 80;
  else if (adventurerLevel >= 40) offset = 40;
  else if (adventurerLevel >= 30) offset = 20;
  else if (adventurerLevel >= 20) offset = 10;

  return {
    min: baseMin + offset,
    max: baseMax + offset,
  };
};

const applyDamageReduction = (damage: number, reduction: number) => {
  if (damage <= 0 || reduction <= 0) {
    return Math.max(0, Math.floor(damage));
  }
  return Math.max(0, Math.floor(damage * (100 - reduction) / 100));
};

const applyNecklaceMitigation = (
  baseDamage: number,
  armorBase: number,
  armorType: string,
  neck: Item,
): number => {
  if (!neck || !neck.id || !armorBase) return Math.max(0, Math.floor(baseDamage));

  const neckName = ItemUtils.getItemName(neck.id);
  const neckLevel = calculateLevel(neck.xp);
  if (neckLevel === 0) return Math.max(0, Math.floor(baseDamage));

  const matches = (
    (armorType === 'Cloth' && neckName === 'Amulet') ||
    (armorType === 'Hide' && neckName === 'Pendant') ||
    (armorType === 'Metal' && neckName === 'Necklace')
  );

  if (!matches) {
    return Math.max(0, Math.floor(baseDamage));
  }

  const bonus = Math.floor(armorBase * neckLevel * NECKLACE_ARMOR_BONUS / 100);
  if (baseDamage > bonus + MIN_DAMAGE_FROM_OBSTACLES) {
    return Math.max(MIN_DAMAGE_FROM_OBSTACLES, Math.floor(baseDamage - bonus));
  }
  return MIN_DAMAGE_FROM_OBSTACLES;
};

const finaliseBeastDamage = (
  rawDamage: number,
  baseReduction: number,
  statsMode: Settings['stats_mode'],
  adventurer: Adventurer,
) => {
  let damage = applyDamageReduction(rawDamage, baseReduction);
  if (statsMode === 'Reduction') {
    const reduction = ability_based_damage_reduction(adventurer.xp, adventurer.stats.wisdom);
    damage = applyDamageReduction(damage, reduction);
  }
  return Math.max(MIN_DAMAGE_FROM_BEASTS, damage);
};

const finaliseObstacleDamage = (
  rawDamage: number,
  baseReduction: number,
  statsMode: Settings['stats_mode'],
  adventurer: Adventurer,
) => {
  let damage = applyDamageReduction(rawDamage, baseReduction);
  if (statsMode === 'Reduction') {
    const reduction = ability_based_damage_reduction(adventurer.xp, adventurer.stats.intelligence);
    damage = applyDamageReduction(damage, reduction);
  }
  return Math.max(MIN_DAMAGE_FROM_OBSTACLES, damage);
};

const getItemTierNumeric = (tier: ItemTier): number => {
  if (typeof tier === 'number') return tier;
  return Number(tier);
};

const ensureItem = (item?: Item): Item => {
  if (!item) {
    return { id: 0, xp: 0 };
  }
  return item;
};

export interface SlotDamageSummary {
  slot: keyof Equipment;
  slotLabel: string;
  armorName: string;
  hasArmor: boolean;
  minBase: number;
  maxBase: number;
  minCrit: number;
  maxCrit: number;
}

export interface BeastRiskSummary {
  ambushChance: number;
  critChance: number;
  tierDistribution: Record<'T1' | 'T2' | 'T3' | 'T4' | 'T5', number>;
  typeDistribution: Record<'Magic' | 'Blade' | 'Bludgeon', number>;
  slotDamages: SlotDamageSummary[];
  highestThreat?: {
    beastId: number;
    name: string;
    slot: keyof Equipment;
    damage: number;
  };
}

export interface ObstacleRiskSummary {
  dodgeChance: number;
  critChance: number;
  tierDistribution: Record<'T1' | 'T2' | 'T3' | 'T4' | 'T5', number>;
  typeDistribution: Record<'Magic' | 'Blade' | 'Bludgeon', number>;
  slotDamages: SlotDamageSummary[];
  highestThreat?: {
    obstacleId: number;
    name: string;
    slot: keyof Equipment;
    damage: number;
  };
}

export interface DiscoverySummary {
  goldChance: number;
  healthChance: number;
  lootChance: number;
  goldRange: { min: number; max: number };
  healthRange: { min: number; max: number };
}

export interface EncounterDistribution {
  baseMix: typeof ENCOUNTER_BASE_MIX;
  beastByTier: Record<'T1' | 'T2' | 'T3' | 'T4' | 'T5', number>;
  beastByType: Record<'Magic' | 'Blade' | 'Bludgeon', number>;
  obstacleByTier: Record<'T1' | 'T2' | 'T3' | 'T4' | 'T5', number>;
  obstacleByType: Record<'Magic' | 'Blade' | 'Bludgeon', number>;
}

export interface ExplorationInsights {
  ready: boolean;
  encounterDistribution: EncounterDistribution;
  beasts: BeastRiskSummary;
  obstacles: ObstacleRiskSummary;
  discoveries: DiscoverySummary;
}

const makeEmptySlotSummary = (slot: keyof Equipment): SlotDamageSummary => ({
  slot,
  slotLabel: slot.charAt(0).toUpperCase() + slot.slice(1),
  armorName: 'None',
  hasArmor: false,
  minBase: 0,
  maxBase: 0,
  minCrit: 0,
  maxCrit: 0,
});

const computeBeastSlotSummary = (
  slot: keyof Equipment,
  adventurer: Adventurer,
  levelRange: { min: number; max: number },
  baseReduction: number,
  statsMode: Settings['stats_mode'],
): { summary: SlotDamageSummary; threat?: { id: number; damage: number; slot: keyof Equipment } } => {
  const armor = ensureItem(adventurer.equipment[slot]);
  const armorName = armor.id ? ItemUtils.getItemName(armor.id) : 'None';
  const armorLevel = calculateLevel(armor.xp);
  const armorSpecials = armor.id && adventurer.item_specials_seed
    ? ItemUtils.getSpecials(armor.id, armorLevel, adventurer.item_specials_seed)
    : { prefix: null, suffix: null };

  let minBase = Number.POSITIVE_INFINITY;
  let maxBase = 0;
  let minCrit = Number.POSITIVE_INFINITY;
  let maxCrit = 0;
  let worst: { id: number; damage: number; slot: keyof Equipment } | undefined;

  for (const beastId of BEAST_IDS) {
    const tier = BEAST_TIER_MAP[beastId];

    const baseBeast: Beast = {
      id: beastId,
      seed: 0n,
      baseName: BEAST_NAMES[beastId] || 'Beast',
      name: BEAST_NAMES[beastId] || 'Beast',
      health: 0,
      level: levelRange.min,
      type: '',
      tier,
      specialPrefix: null,
      specialSuffix: null,
      isCollectable: false,
    };

    const maxBeast: Beast = {
      id: beastId,
      seed: 0n,
      baseName: BEAST_NAMES[beastId] || 'Beast',
      name: BEAST_NAMES[beastId] || 'Beast',
      health: 0,
      level: levelRange.max,
      type: '',
      tier,
      specialPrefix: armorSpecials.prefix ?? null,
      specialSuffix: armorSpecials.suffix ?? null,
      isCollectable: false,
    };

    const baseDamageDetails = calculateBeastDamageDetails(baseBeast, adventurer, armor);
    const maxDamageDetails = calculateBeastDamageDetails(maxBeast, adventurer, armor);

    const baseDamage = finaliseBeastDamage(baseDamageDetails.baseDamage, baseReduction, statsMode, adventurer);
    const baseCrit = finaliseBeastDamage(baseDamageDetails.criticalDamage, baseReduction, statsMode, adventurer);
    const maxDamage = finaliseBeastDamage(maxDamageDetails.baseDamage, baseReduction, statsMode, adventurer);
    const maxCritDamage = finaliseBeastDamage(maxDamageDetails.criticalDamage, baseReduction, statsMode, adventurer);

    minBase = Math.min(minBase, baseDamage);
    minCrit = Math.min(minCrit, baseCrit);
    maxBase = Math.max(maxBase, maxDamage);
    maxCrit = Math.max(maxCrit, maxCritDamage);

    if (!worst || maxDamage > worst.damage) {
      worst = { id: beastId, damage: maxDamage, slot };
    }
  }

  if (!Number.isFinite(minBase)) {
    minBase = MIN_DAMAGE_FROM_BEASTS;
    minCrit = MIN_DAMAGE_FROM_BEASTS;
  }

  return {
    summary: {
      slot,
      slotLabel: slot.charAt(0).toUpperCase() + slot.slice(1),
      armorName,
      hasArmor: Boolean(armor.id),
      minBase,
      maxBase,
      minCrit,
      maxCrit,
    },
    threat: worst,
  };
};

const computeObstacleSlotSummary = (
  slot: keyof Equipment,
  adventurer: Adventurer,
  levelRange: { min: number; max: number },
  baseReduction: number,
  statsMode: Settings['stats_mode'],
): { summary: SlotDamageSummary; threat?: { id: number; damage: number; slot: keyof Equipment } } => {
  const armor = ensureItem(adventurer.equipment[slot]);
  const armorName = armor.id ? ItemUtils.getItemName(armor.id) : 'None';
  const armorLevel = calculateLevel(armor.xp);
  const armorTier = armor.id ? getItemTierNumeric(ItemUtils.getItemTier(armor.id)) : 0;
  const armorType = armor.id ? ItemUtils.getItemType(armor.id) : 'None';
  const armorBase = armor.id ? armorLevel * Math.max(0, 6 - armorTier) : 0;
  const neckItem = ensureItem(adventurer.equipment.neck);

  let minBase = Number.POSITIVE_INFINITY;
  let maxBase = 0;
  let minCrit = Number.POSITIVE_INFINITY;
  let maxCrit = 0;
  let worst: { id: number; damage: number; slot: keyof Equipment } | undefined;

  for (const obstacleId of OBSTACLE_IDS) {
    const tier = OBSTACLE_TIER_MAP[obstacleId];
    const type = OBSTACLE_TYPE_MAP[obstacleId];

    const attackValueMin = levelRange.min * Math.max(0, 6 - tier);
    const attackValueMax = levelRange.max * Math.max(0, 6 - tier);

    const elementalMin = elementalAdjustedDamage(attackValueMin, type, armorType);
    const elementalMax = elementalAdjustedDamage(attackValueMax, type, armorType);

    const baseDamage = Math.max(MIN_DAMAGE_FROM_OBSTACLES, elementalMin - armorBase);
    const critDamage = Math.max(MIN_DAMAGE_FROM_OBSTACLES, (elementalMin + elementalMin) - armorBase);

    const baseDamageMax = Math.max(MIN_DAMAGE_FROM_OBSTACLES, elementalMax - armorBase);
    const critDamageMax = Math.max(MIN_DAMAGE_FROM_OBSTACLES, (elementalMax + elementalMax) - armorBase);

    const adjustedBase = applyNecklaceMitigation(baseDamage, armorBase, armorType, neckItem);
    const adjustedCrit = applyNecklaceMitigation(critDamage, armorBase, armorType, neckItem);
    const adjustedBaseMax = applyNecklaceMitigation(baseDamageMax, armorBase, armorType, neckItem);
    const adjustedCritMax = applyNecklaceMitigation(critDamageMax, armorBase, armorType, neckItem);

    const finalBase = finaliseObstacleDamage(adjustedBase, baseReduction, statsMode, adventurer);
    const finalCrit = finaliseObstacleDamage(adjustedCrit, baseReduction, statsMode, adventurer);
    const finalBaseMax = finaliseObstacleDamage(adjustedBaseMax, baseReduction, statsMode, adventurer);
    const finalCritMax = finaliseObstacleDamage(adjustedCritMax, baseReduction, statsMode, adventurer);

    minBase = Math.min(minBase, finalBase);
    minCrit = Math.min(minCrit, finalCrit);
    maxBase = Math.max(maxBase, finalBaseMax);
    maxCrit = Math.max(maxCrit, finalCritMax);

    if (!worst || finalBaseMax > worst.damage) {
      worst = { id: obstacleId, damage: finalBaseMax, slot };
    }
  }

  if (!Number.isFinite(minBase)) {
    minBase = MIN_DAMAGE_FROM_OBSTACLES;
    minCrit = MIN_DAMAGE_FROM_OBSTACLES;
  }

  return {
    summary: {
      slot,
      slotLabel: slot.charAt(0).toUpperCase() + slot.slice(1),
      armorName,
      hasArmor: Boolean(armor.id),
      minBase,
      maxBase,
      minCrit,
      maxCrit,
    },
    threat: worst,
  };
};

const computeBeastRisk = (
  adventurer: Adventurer,
  levelRange: { min: number; max: number },
  gameSettings: Settings,
): BeastRiskSummary => {
  const tierCounts = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 } as Record<'T1' | 'T2' | 'T3' | 'T4' | 'T5', number>;
  const typeCounts = { Magic: 0, Blade: 0, Bludgeon: 0 } as Record<'Magic' | 'Blade' | 'Bludgeon', number>;

  for (const beastId of BEAST_IDS) {
    const tier = BEAST_TIER_MAP[beastId];
    const type = BEAST_TYPE_MAP[beastId];
    tierCounts[`T${tier}` as keyof typeof tierCounts] += 1;
    typeCounts[type] += 1;
  }

  const baseReduction = gameSettings.base_damage_reduction ?? 0;
  const slotSummaries: SlotDamageSummary[] = [];
  let worstThreat: BeastRiskSummary['highestThreat'];

  for (const slot of SLOT_ORDER) {
    const { summary, threat } = computeBeastSlotSummary(slot, adventurer, levelRange, baseReduction, gameSettings.stats_mode);
    slotSummaries.push(summary);

    if (threat && (!worstThreat || threat.damage > worstThreat.damage)) {
      const beastName = BEAST_NAMES[threat.id] || 'Beast';
      worstThreat = {
        beastId: threat.id,
        name: beastName,
        slot: threat.slot,
        damage: threat.damage,
      };
    }
  }

  const avoidChance = ability_based_percentage(adventurer.xp, adventurer.stats.wisdom);
  const ambushChance = gameSettings.stats_mode === 'Dodge'
    ? Math.max(0, 100 - avoidChance)
    : 100;
  const critChance = Math.min(100, calculateLevel(adventurer.xp));

  return {
    ambushChance,
    critChance,
    tierDistribution: Object.fromEntries(Object.entries(tierCounts).map(([key, value]) => [key, Number(((value / BEAST_IDS.length) * 100).toFixed(2))])) as BeastRiskSummary['tierDistribution'],
    typeDistribution: Object.fromEntries(Object.entries(typeCounts).map(([key, value]) => [key, Number(((value / BEAST_IDS.length) * 100).toFixed(2))])) as BeastRiskSummary['typeDistribution'],
    slotDamages: slotSummaries,
    highestThreat: worstThreat,
  };
};

const computeObstacleRisk = (
  adventurer: Adventurer,
  levelRange: { min: number; max: number },
  gameSettings: Settings,
): ObstacleRiskSummary => {
  const tierCounts = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 } as Record<'T1' | 'T2' | 'T3' | 'T4' | 'T5', number>;
  const typeCounts = { Magic: 0, Blade: 0, Bludgeon: 0 } as Record<'Magic' | 'Blade' | 'Bludgeon', number>;

  for (const obstacleId of OBSTACLE_IDS) {
    const tier = OBSTACLE_TIER_MAP[obstacleId];
    const type = OBSTACLE_TYPE_MAP[obstacleId];
    tierCounts[`T${tier}` as keyof typeof tierCounts] += 1;
    typeCounts[type] += 1;
  }

  const baseReduction = gameSettings.base_damage_reduction ?? 0;
  const slotSummaries: SlotDamageSummary[] = [];
  let worstThreat: ObstacleRiskSummary['highestThreat'];

  for (const slot of SLOT_ORDER) {
    const { summary, threat } = computeObstacleSlotSummary(slot, adventurer, levelRange, baseReduction, gameSettings.stats_mode);
    slotSummaries.push(summary);

    if (threat && (!worstThreat || threat.damage > worstThreat.damage)) {
      const obstacleName = OBSTACLE_NAMES[threat.id as keyof typeof OBSTACLE_NAMES] || 'Obstacle';
      worstThreat = {
        obstacleId: threat.id,
        name: obstacleName,
        slot: threat.slot,
        damage: threat.damage,
      };
    }
  }

  const dodgeChance = gameSettings.stats_mode === 'Dodge'
    ? ability_based_percentage(adventurer.xp, adventurer.stats.intelligence)
    : 0;
  const critChance = Math.min(100, calculateLevel(adventurer.xp));

  return {
    dodgeChance,
    critChance,
    tierDistribution: Object.fromEntries(Object.entries(tierCounts).map(([key, value]) => [key, Number(((value / OBSTACLE_IDS.length) * 100).toFixed(2))])) as ObstacleRiskSummary['tierDistribution'],
    typeDistribution: Object.fromEntries(Object.entries(typeCounts).map(([key, value]) => [key, Number(((value / OBSTACLE_IDS.length) * 100).toFixed(2))])) as ObstacleRiskSummary['typeDistribution'],
    slotDamages: slotSummaries,
    highestThreat: worstThreat,
  };
};

const computeDiscoveries = (adventurer: Adventurer): DiscoverySummary => {
  const level = Math.max(1, calculateLevel(adventurer.xp));
  return {
    goldChance: 45,
    healthChance: 45,
    lootChance: 10,
    goldRange: { min: 1, max: level },
    healthRange: { min: 2, max: level * 2 },
  };
};

const computeEncounterDistribution = (): EncounterDistribution => {
  const beastTierCounts = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 } as Record<'T1' | 'T2' | 'T3' | 'T4' | 'T5', number>;
  const beastTypeCounts = { Magic: 0, Blade: 0, Bludgeon: 0 } as Record<'Magic' | 'Blade' | 'Bludgeon', number>;
  for (const id of BEAST_IDS) {
    beastTierCounts[`T${BEAST_TIER_MAP[id]}` as keyof typeof beastTierCounts] += 1;
    beastTypeCounts[BEAST_TYPE_MAP[id]] += 1;
  }

  const obstacleTierCounts = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 } as Record<'T1' | 'T2' | 'T3' | 'T4' | 'T5', number>;
  const obstacleTypeCounts = { Magic: 0, Blade: 0, Bludgeon: 0 } as Record<'Magic' | 'Blade' | 'Bludgeon', number>;
  for (const id of OBSTACLE_IDS) {
    obstacleTierCounts[`T${OBSTACLE_TIER_MAP[id]}` as keyof typeof obstacleTierCounts] += 1;
    obstacleTypeCounts[OBSTACLE_TYPE_MAP[id]] += 1;
  }

  const normalise = <T extends Record<string, number>>(counts: T, total: number): T => (
    Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(((value / total) * 100).toFixed(2))])) as T
  );

  return {
    baseMix: ENCOUNTER_BASE_MIX,
    beastByTier: normalise(beastTierCounts, BEAST_IDS.length),
    beastByType: normalise(beastTypeCounts, BEAST_IDS.length),
    obstacleByTier: normalise(obstacleTierCounts, OBSTACLE_IDS.length),
    obstacleByType: normalise(obstacleTypeCounts, OBSTACLE_IDS.length),
  };
};

export const getExplorationInsights = (
  adventurer: Adventurer | null,
  gameSettings: Settings | null,
): ExplorationInsights => {
  initialiseLookups();

  if (!adventurer || !gameSettings) {
    return {
      ready: false,
      encounterDistribution: computeEncounterDistribution(),
      beasts: {
        ambushChance: 0,
        critChance: 0,
        tierDistribution: { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 },
        typeDistribution: { Magic: 0, Blade: 0, Bludgeon: 0 },
        slotDamages: SLOT_ORDER.map(makeEmptySlotSummary),
      },
      obstacles: {
        dodgeChance: 0,
        critChance: 0,
        tierDistribution: { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 },
        typeDistribution: { Magic: 0, Blade: 0, Bludgeon: 0 },
        slotDamages: SLOT_ORDER.map(makeEmptySlotSummary),
      },
      discoveries: {
        goldChance: 0,
        healthChance: 0,
        lootChance: 0,
        goldRange: { min: 0, max: 0 },
        healthRange: { min: 0, max: 0 },
      },
    };
  }

  const adventurerLevel = Math.max(1, calculateLevel(adventurer.xp));
  const levelRange = getEncounterLevelRange(adventurerLevel);

  const encounterDistribution = computeEncounterDistribution();
  const beasts = computeBeastRisk(adventurer, levelRange, gameSettings);
  const obstacles = computeObstacleRisk(adventurer, levelRange, gameSettings);
  const discoveries = computeDiscoveries(adventurer);

  return {
    ready: true,
    encounterDistribution,
    beasts,
    obstacles,
    discoveries,
  };
};

