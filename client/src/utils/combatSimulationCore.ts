import { calculateAttackDamage, calculateBeastDamageDetails, calculateLevel } from '@/utils/game';
import type { Adventurer, Beast, Equipment } from '@/types/game';

export const ARMOR_TARGET_SLOTS: Array<keyof Equipment> = ['chest', 'head', 'waist', 'foot', 'hand'];
export const MAX_ROUNDS_PER_FIGHT = 500;

export interface CombatSimulationResult {
  totalFights: number;
  wins: number;
  losses: number;
  winRate: number;
  lossRate: number;
  averageRounds: number;
  averageDamageDealt: number;
  averageDamageTaken: number;
  modeDamageTaken: number;
  modeDamageDealt: number;
  modeRounds: number;
  minRounds: number;
  maxRounds: number;
  minDamageDealt: number;
  maxDamageDealt: number;
  minDamageTaken: number;
  maxDamageTaken: number;
  goldRiskRatio: number;
}

export const defaultSimulationResult: CombatSimulationResult = {
  totalFights: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  lossRate: 0,
  averageRounds: 0,
  averageDamageDealt: 0,
  averageDamageTaken: 0,
  modeDamageTaken: 0,
  modeDamageDealt: 0,
  modeRounds: 0,
  minRounds: 0,
  maxRounds: 0,
  minDamageDealt: 0,
  maxDamageDealt: 0,
  minDamageTaken: 0,
  maxDamageTaken: 0,
  goldRiskRatio: 0,
};

export interface SimulationTotals {
  fightsSimulated: number;
  wins: number;
  totalRounds: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  minDamageDealt: number;
  maxDamageDealt: number;
  minDamageTaken: number;
  maxDamageTaken: number;
  minRounds: number;
  maxRounds: number;
  damageTakenCounts: Record<string, number>;
  damageDealtCounts: Record<string, number>;
  roundsCounts: Record<string, number>;
}

export interface SimulationChunkArgs {
  adventurer: Adventurer;
  beast: Beast;
  iterations: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const rollCritical = (chance: number) => Math.random() * 100 < chance;
const pickRandomArmorSlot = () => ARMOR_TARGET_SLOTS[Math.floor(Math.random() * ARMOR_TARGET_SLOTS.length)];

// Approximate beast critical chance using adventurer level as the driver.
const getBeastCriticalChance = (adventurer: Adventurer) => clamp(calculateLevel(adventurer.xp) * 2, 5, 35);

export const createEmptyTotals = (): SimulationTotals => ({
  fightsSimulated: 0,
  wins: 0,
  totalRounds: 0,
  totalDamageDealt: 0,
  totalDamageTaken: 0,
  minDamageDealt: Number.POSITIVE_INFINITY,
  maxDamageDealt: 0,
  minDamageTaken: Number.POSITIVE_INFINITY,
  maxDamageTaken: 0,
  minRounds: Number.POSITIVE_INFINITY,
  maxRounds: 0,
  damageTakenCounts: {},
  damageDealtCounts: {},
  roundsCounts: {},
});

const incrementCount = (counts: Record<string, number>, value: number) => {
  const key = value.toString();
  counts[key] = (counts[key] ?? 0) + 1;
};

export const runSimulationChunk = ({ adventurer, beast, iterations }: SimulationChunkArgs): SimulationTotals => {
  if (!adventurer || !beast || adventurer.health <= 0 || beast.health <= 0 || iterations <= 0) {
    return createEmptyTotals();
  }

  const weaponDamage = calculateAttackDamage(adventurer.equipment.weapon, adventurer, beast);
  const playerCritChance = clamp(adventurer.stats.luck ?? 0, 0, 100);
  const beastCritChance = getBeastCriticalChance(adventurer);
  const startingBeastHp = Math.max(0, adventurer.beast_health ?? 0);
  const effectiveBeastHp = startingBeastHp > 0 ? startingBeastHp : beast.health;

  if (effectiveBeastHp <= 0) {
    return createEmptyTotals();
  }

  const beastDamageBySlot = ARMOR_TARGET_SLOTS.reduce<Record<string, ReturnType<typeof calculateBeastDamageDetails>>>(
    (acc, slot) => {
      const armor = adventurer.equipment[slot];
      acc[slot] = calculateBeastDamageDetails(beast, adventurer, armor);
      return acc;
    },
    {},
  );
  const defaultBeastDamage = beastDamageBySlot[ARMOR_TARGET_SLOTS[0]];

  const totals = createEmptyTotals();

  const runFight = () => {
    let heroHp = adventurer.health;
    let beastHp = effectiveBeastHp;
    let rounds = 0;
    let damageDealt = 0;
    let damageTaken = 0;

    while (heroHp > 0 && beastHp > 0 && rounds < MAX_ROUNDS_PER_FIGHT) {
      rounds += 1;

      const heroCritical = rollCritical(playerCritChance);
      const heroDamage = heroCritical ? weaponDamage.criticalDamage : weaponDamage.baseDamage;
      beastHp -= heroDamage;
      damageDealt += heroDamage;

      if (beastHp <= 0) {
        break;
      }

      const slot = pickRandomArmorSlot();
      const beastDamageSummary = beastDamageBySlot[slot] ?? defaultBeastDamage ?? weaponDamage;
      const beastCritical = rollCritical(beastCritChance);
      const beastDamage = beastCritical ? beastDamageSummary.criticalDamage : beastDamageSummary.baseDamage;
      heroHp -= beastDamage;
      damageTaken += beastDamage;
    }

    return { rounds, damageDealt, damageTaken, heroHp, beastHp };
  };

  for (let i = 0; i < iterations; i += 1) {
    const { rounds, damageDealt, damageTaken, heroHp, beastHp } = runFight();

    totals.fightsSimulated += 1;
    totals.totalRounds += rounds;
    totals.totalDamageDealt += damageDealt;
    totals.totalDamageTaken += damageTaken;
    totals.minDamageDealt = Math.min(totals.minDamageDealt, damageDealt);
    totals.maxDamageDealt = Math.max(totals.maxDamageDealt, damageDealt);
    totals.minDamageTaken = Math.min(totals.minDamageTaken, damageTaken);
    totals.maxDamageTaken = Math.max(totals.maxDamageTaken, damageTaken);
    totals.minRounds = Math.min(totals.minRounds, rounds);
    totals.maxRounds = Math.max(totals.maxRounds, rounds);

    incrementCount(totals.damageTakenCounts, damageTaken);
    incrementCount(totals.damageDealtCounts, damageDealt);
    incrementCount(totals.roundsCounts, rounds);

    if (heroHp > 0 && beastHp <= 0) {
      totals.wins += 1;
    }
  }

  return totals;
};

export const mergeSimulationTotals = (target: SimulationTotals, addition: SimulationTotals): SimulationTotals => {
  const merged: SimulationTotals = {
    ...target,
    damageTakenCounts: { ...target.damageTakenCounts },
    damageDealtCounts: { ...target.damageDealtCounts },
    roundsCounts: { ...target.roundsCounts },
  };

  merged.fightsSimulated += addition.fightsSimulated;
  merged.wins += addition.wins;
  merged.totalRounds += addition.totalRounds;
  merged.totalDamageDealt += addition.totalDamageDealt;
  merged.totalDamageTaken += addition.totalDamageTaken;
  merged.minDamageDealt = Math.min(merged.minDamageDealt, addition.minDamageDealt);
  merged.maxDamageDealt = Math.max(merged.maxDamageDealt, addition.maxDamageDealt);
  merged.minDamageTaken = Math.min(merged.minDamageTaken, addition.minDamageTaken);
  merged.maxDamageTaken = Math.max(merged.maxDamageTaken, addition.maxDamageTaken);
  merged.minRounds = Math.min(merged.minRounds, addition.minRounds);
  merged.maxRounds = Math.max(merged.maxRounds, addition.maxRounds);

  const mergeCounts = (destination: Record<string, number>, source: Record<string, number>) => {
    Object.entries(source).forEach(([key, value]) => {
      destination[key] = (destination[key] ?? 0) + value;
    });
  };

  mergeCounts(merged.damageTakenCounts, addition.damageTakenCounts);
  mergeCounts(merged.damageDealtCounts, addition.damageDealtCounts);
  mergeCounts(merged.roundsCounts, addition.roundsCounts);

  return merged;
};

const getModeFromCounts = (counts: Record<string, number>) => {
  let modeValue = 0;
  let highestCount = 0;

  Object.entries(counts).forEach(([key, count]) => {
    const value = Number(key);

    if (Number.isNaN(value)) {
      return;
    }

    if (count > highestCount || (count === highestCount && value < modeValue)) {
      modeValue = value;
      highestCount = count;
    }
  });

  if (highestCount === 0) {
    return 0;
  }

  return modeValue;
};

export const totalsToResult = (totals: SimulationTotals, goldReward: number): CombatSimulationResult => {
  if (totals.fightsSimulated === 0) {
    return defaultSimulationResult;
  }

  const fights = totals.fightsSimulated;
  const wins = totals.wins;
  const losses = fights - wins;

  const modeDamageTaken = getModeFromCounts(totals.damageTakenCounts);
  const modeDamageDealt = getModeFromCounts(totals.damageDealtCounts);
  const modeRounds = getModeFromCounts(totals.roundsCounts);

  return {
    totalFights: fights,
    wins,
    losses,
    winRate: Number(((wins / fights) * 100).toFixed(1)),
    lossRate: Number(((losses / fights) * 100).toFixed(1)),
    averageRounds: Number((totals.totalRounds / fights).toFixed(1)),
    averageDamageDealt: Number((totals.totalDamageDealt / fights).toFixed(1)),
    averageDamageTaken: Number((totals.totalDamageTaken / fights).toFixed(1)),
    modeDamageTaken,
    modeDamageDealt,
    modeRounds,
    minRounds: Number.isFinite(totals.minRounds) ? totals.minRounds : 0,
    maxRounds: totals.maxRounds,
    minDamageDealt: Number.isFinite(totals.minDamageDealt) ? Math.round(totals.minDamageDealt) : 0,
    maxDamageDealt: Math.round(totals.maxDamageDealt),
    minDamageTaken: Number.isFinite(totals.minDamageTaken) ? Math.round(totals.minDamageTaken) : 0,
    maxDamageTaken: Math.round(totals.maxDamageTaken),
    goldRiskRatio: goldReward > 0 ? Number((modeDamageTaken / goldReward).toFixed(2)) : modeDamageTaken,
  };
};
