import { calculateAttackDamage, calculateBeastDamageDetails, calculateLevel } from '@/utils/game';
import type { Adventurer, Beast, Equipment } from '@/types/game';

export const ARMOR_TARGET_SLOTS: Array<keyof Equipment> = ['chest', 'head', 'waist', 'foot', 'hand'];
const MAX_ROUNDS_PER_FIGHT = 500;

export interface CombatSimulationResult {
  totalFights: number;
  wins: number;
  losses: number;
  winRate: number;
  lossRate: number;
  averageRounds: number;
  averageDamageDealt: number;
  averageDamageTaken: number;
  minDamageDealt: number;
  maxDamageDealt: number;
  minDamageTaken: number;
  maxDamageTaken: number;
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
  minDamageDealt: 0,
  maxDamageDealt: 0,
  minDamageTaken: 0,
  maxDamageTaken: 0,
};

interface Accumulator {
  rounds: number;
  damageDealt: number;
  damageTaken: number;
  heroHp: number;
  beastHp: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const rollCritical = (chance: number) => Math.random() * 100 < chance;

const pickRandomArmorSlot = () => ARMOR_TARGET_SLOTS[Math.floor(Math.random() * ARMOR_TARGET_SLOTS.length)];

// Approximate beast critical chance using adventurer level as the driver.
const getBeastCriticalChance = (adventurer: Adventurer) => clamp(calculateLevel(adventurer.xp) * 2, 5, 35);

export const simulateCombatOutcomes = (
  adventurer: Adventurer | null | undefined,
  beast: Beast | null | undefined,
  iterations = 100,
): CombatSimulationResult => {
  if (!adventurer || !beast || adventurer.health <= 0 || beast.health <= 0 || iterations <= 0) {
    return defaultSimulationResult;
  }

  const weaponDamage = calculateAttackDamage(adventurer.equipment.weapon, adventurer, beast);
  const playerCritChance = clamp(adventurer.stats.luck ?? 0, 0, 100);
  const beastCritChance = getBeastCriticalChance(adventurer);

  const beastDamageBySlot = ARMOR_TARGET_SLOTS.reduce<Record<string, ReturnType<typeof calculateBeastDamageDetails>>>(
    (acc, slot) => {
      const armor = adventurer.equipment[slot];
      acc[slot] = calculateBeastDamageDetails(beast, adventurer, armor);
      return acc;
    },
    {},
  );
  const defaultBeastDamage = beastDamageBySlot[ARMOR_TARGET_SLOTS[0]];

  let fightsSimulated = 0;
  let wins = 0;
  let totalRounds = 0;
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let minDamageDealt = Number.POSITIVE_INFINITY;
  let maxDamageDealt = 0;
  let minDamageTaken = Number.POSITIVE_INFINITY;
  let maxDamageTaken = 0;

  const runFight = (): Accumulator => {
    let heroHp = adventurer.health;
    let beastHp = beast.health;
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
      const beastDamageSummary = beastDamageBySlot[slot] ?? defaultBeastDamage ?? weaponDamage; // Fallback shouldn't happen
      const beastCritical = rollCritical(beastCritChance);
      const beastDamage = beastCritical ? beastDamageSummary.criticalDamage : beastDamageSummary.baseDamage;
      heroHp -= beastDamage;
      damageTaken += beastDamage;
    }

    return { rounds, damageDealt, damageTaken, heroHp, beastHp };
  };

  for (let i = 0; i < iterations; i += 1) {
    const { rounds, damageDealt, damageTaken, heroHp, beastHp } = runFight();

    fightsSimulated += 1;
    totalRounds += rounds;
    totalDamageDealt += damageDealt;
    totalDamageTaken += damageTaken;
    minDamageDealt = Math.min(minDamageDealt, damageDealt);
    maxDamageDealt = Math.max(maxDamageDealt, damageDealt);
    minDamageTaken = Math.min(minDamageTaken, damageTaken);
    maxDamageTaken = Math.max(maxDamageTaken, damageTaken);

    if (heroHp > 0 && beastHp <= 0) {
      wins += 1;
    }
  }

  if (fightsSimulated === 0) {
    return defaultSimulationResult;
  }

  const losses = fightsSimulated - wins;

  return {
    totalFights: fightsSimulated,
    wins,
    losses,
    winRate: Number(((wins / fightsSimulated) * 100).toFixed(1)),
    lossRate: Number((((losses) / fightsSimulated) * 100).toFixed(1)),
    averageRounds: Number((totalRounds / fightsSimulated).toFixed(1)),
    averageDamageDealt: Number((totalDamageDealt / fightsSimulated).toFixed(1)),
    averageDamageTaken: Number((totalDamageTaken / fightsSimulated).toFixed(1)),
    minDamageDealt: Number.isFinite(minDamageDealt) ? Math.round(minDamageDealt) : 0,
    maxDamageDealt: Math.round(maxDamageDealt),
    minDamageTaken: Number.isFinite(minDamageTaken) ? Math.round(minDamageTaken) : 0,
    maxDamageTaken: Math.round(maxDamageTaken),
  };
};
