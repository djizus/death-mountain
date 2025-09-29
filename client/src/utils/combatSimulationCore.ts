import { calculateAttackDamage, calculateBeastDamageDetails, calculateLevel } from '@/utils/game';
import type { Adventurer, Beast, Equipment } from '@/types/game';

export const ARMOR_TARGET_SLOTS: Array<keyof Equipment> = ['chest', 'head', 'waist', 'foot', 'hand'];
export const MAX_ROUNDS_PER_FIGHT = 500;

export interface CombatSimulationOptions {
  initialBeastStrike?: boolean;
}

export interface CombatSimulationResult {
  hasOutcome: boolean;
  winRate: number;
  otkRate: number;
  modeDamageDealt: number;
  modeDamageTaken: number;
  modeRounds: number;
  minDamageDealt: number;
  maxDamageDealt: number;
  minDamageTaken: number;
  maxDamageTaken: number;
  minRounds: number;
  maxRounds: number;
}

export const defaultSimulationResult: CombatSimulationResult = {
  hasOutcome: false,
  winRate: 0,
  otkRate: 0,
  modeDamageDealt: 0,
  modeDamageTaken: 0,
  minDamageDealt: 0,
  maxDamageDealt: 0,
  minDamageTaken: 0,
  maxDamageTaken: 0,
  modeRounds: 0,
  minRounds: 0,
  maxRounds: 0,
};

interface DamageOption {
  damage: number;
  probability: number;
}

interface StateOutcome {
  winProbability: number;
  lethalProbability: number;
  damageDealtDistribution: Map<number, number>;
  damageTakenDistribution: Map<number, number>;
  roundsDistribution: Map<number, number>;
}

const PROBABILITY_EPSILON = 1e-12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const addProbability = (distribution: Map<number, number>, value: number, probability: number) => {
  if (probability <= PROBABILITY_EPSILON) {
    return;
  }

  const existing = distribution.get(value) ?? 0;
  distribution.set(value, existing + probability);
};

const combineDistributions = (
  target: Map<number, number>,
  source: Map<number, number>,
  offset: number,
  weight: number,
) => {
  if (weight <= PROBABILITY_EPSILON) {
    return;
  }

  source.forEach((probability, value) => {
    addProbability(target, value + offset, probability * weight);
  });
};

const getBeastCriticalChance = (adventurer: Adventurer) => clamp(calculateLevel(adventurer.xp) * 2, 5, 35) / 100;

const buildHeroDamageOptions = (baseDamage: number, criticalDamage: number, critChancePercent: number): DamageOption[] => {
  const criticalChance = clamp(critChancePercent, 0, 100) / 100;
  const baseChance = 1 - criticalChance;

  const aggregated = new Map<number, number>();
  addProbability(aggregated, baseDamage, baseChance);
  addProbability(aggregated, criticalDamage, criticalChance);

  if (aggregated.size === 0) {
    aggregated.set(baseDamage, 1);
  }

  return Array.from(aggregated.entries()).map(([damage, probability]) => ({ damage, probability }));
};

const buildBeastDamageOptions = (
  adventurer: Adventurer,
  beast: Beast,
  beastDamageBySlot: Record<string, ReturnType<typeof calculateBeastDamageDetails> | undefined>,
  beastCritChance: number,
): DamageOption[] => {
  const slotSummaries = ARMOR_TARGET_SLOTS.map((slot) => beastDamageBySlot[slot] ?? undefined).filter(
    (summary): summary is ReturnType<typeof calculateBeastDamageDetails> => !!summary,
  );

  if (slotSummaries.length === 0) {
    const fallback = calculateBeastDamageDetails(beast, adventurer, adventurer.equipment.chest);
    return [{ damage: fallback.baseDamage, probability: 1 }];
  }

  const slotProbability = 1 / slotSummaries.length;
  const aggregated = new Map<number, number>();
  const criticalChance = clamp(beastCritChance, 0, 1);
  const baseChance = 1 - criticalChance;

  slotSummaries.forEach((summary) => {
    addProbability(aggregated, summary.baseDamage, baseChance * slotProbability);
    addProbability(aggregated, summary.criticalDamage, criticalChance * slotProbability);
  });

  if (aggregated.size === 0) {
    aggregated.set(slotSummaries[0]!.baseDamage, 1);
  }

  return Array.from(aggregated.entries()).map(([damage, probability]) => ({ damage, probability }));
};

const getModeFromDistribution = (distribution: Map<number, number>) => {
  let modeValue = 0;
  let highestProbability = 0;

  distribution.forEach((probability, value) => {
    if (
      probability > highestProbability + PROBABILITY_EPSILON
      || (Math.abs(probability - highestProbability) <= PROBABILITY_EPSILON && value < modeValue)
    ) {
      highestProbability = probability;
      modeValue = value;
    }
  });

  if (highestProbability <= PROBABILITY_EPSILON) {
    return 0;
  }

  return modeValue;
};

const getMinFromDistribution = (distribution: Map<number, number>) => {
  let minValue = Infinity;

  distribution.forEach((probability, value) => {
    if (probability > PROBABILITY_EPSILON && value < minValue) {
      minValue = value;
    }
  });

  return Number.isFinite(minValue) ? minValue : 0;
};

const getMaxFromDistribution = (distribution: Map<number, number>) => {
  let maxValue = 0;

  distribution.forEach((probability, value) => {
    if (probability > PROBABILITY_EPSILON && value > maxValue) {
      maxValue = value;
    }
  });

  return maxValue;
};

export const calculateDeterministicCombatResult = (
  adventurer: Adventurer,
  beast: Beast,
  options: CombatSimulationOptions = {},
): CombatSimulationResult => {
  if (!adventurer || !beast || adventurer.health <= 0 || beast.health <= 0) {
    return defaultSimulationResult;
  }

  const weaponDamage = calculateAttackDamage(adventurer.equipment.weapon, adventurer, beast);
  const heroDamageOptions = buildHeroDamageOptions(
    weaponDamage.baseDamage,
    weaponDamage.criticalDamage,
    adventurer.stats.luck ?? 0,
  );

  const beastDamageBySlot = ARMOR_TARGET_SLOTS.reduce<Record<string, ReturnType<typeof calculateBeastDamageDetails>>>(
    (acc, slot) => {
      const armor = adventurer.equipment[slot];
      acc[slot] = calculateBeastDamageDetails(beast, adventurer, armor);
      return acc;
    },
    {},
  );

  const beastDamageOptions = buildBeastDamageOptions(
    adventurer,
    beast,
    beastDamageBySlot,
    getBeastCriticalChance(adventurer),
  );

  if (heroDamageOptions.length === 0 || beastDamageOptions.length === 0) {
    return defaultSimulationResult;
  }

  const startingBeastHp = Math.max(0, adventurer.beast_health ?? 0);
  const effectiveBeastHp = startingBeastHp > 0 ? startingBeastHp : beast.health;

  if (effectiveBeastHp <= 0) {
    return defaultSimulationResult;
  }

  const initialHeroHp = adventurer.health;
  const { initialBeastStrike = false } = options;

  const memo = new Map<string, StateOutcome>();

  const solve = (heroHp: number, beastHp: number, rounds: number): StateOutcome => {
    if (heroHp <= 0) {
      return {
        winProbability: 0,
        lethalProbability: 1,
        damageDealtDistribution: new Map([[0, 1]]),
        damageTakenDistribution: new Map([[0, 1]]),
        roundsDistribution: new Map([[0, 1]]),
      };
    }

    if (beastHp <= 0) {
      return {
        winProbability: 1,
        lethalProbability: 0,
        damageDealtDistribution: new Map([[0, 1]]),
        damageTakenDistribution: new Map([[0, 1]]),
        roundsDistribution: new Map([[0, 1]]),
      };
    }

    if (rounds >= MAX_ROUNDS_PER_FIGHT) {
      return {
        winProbability: 0,
        lethalProbability: 1,
        damageDealtDistribution: new Map([[0, 1]]),
        damageTakenDistribution: new Map([[0, 1]]),
        roundsDistribution: new Map([[0, 1]]),
      };
    }

    const memoKey = `${heroHp}|${beastHp}|${rounds}`;
    const cached = memo.get(memoKey);
    if (cached) {
      return cached;
    }

    let winProbability = 0;
    let lethalProbability = 0;
    const damageDealtDistribution = new Map<number, number>();
    const damageTakenDistribution = new Map<number, number>();
    const roundsDistribution = new Map<number, number>();

    heroDamageOptions.forEach(({ damage: heroDamage, probability: heroProbability }) => {
      if (heroProbability <= PROBABILITY_EPSILON) {
        return;
      }

      const remainingBeastHp = beastHp - heroDamage;

      if (remainingBeastHp <= 0) {
        winProbability += heroProbability;
        addProbability(damageDealtDistribution, heroDamage, heroProbability);
        addProbability(damageTakenDistribution, 0, heroProbability);
        addProbability(roundsDistribution, rounds + 1, heroProbability);
        return;
      }

      beastDamageOptions.forEach(({ damage: beastDamage, probability: beastProbability }) => {
        const branchProbability = heroProbability * beastProbability;

        if (branchProbability <= PROBABILITY_EPSILON) {
          return;
        }

        const remainingHeroHp = heroHp - beastDamage;

        if (remainingHeroHp <= 0 || rounds + 1 >= MAX_ROUNDS_PER_FIGHT) {
          lethalProbability += branchProbability;
          addProbability(damageDealtDistribution, heroDamage, branchProbability);
          addProbability(damageTakenDistribution, beastDamage, branchProbability);
          addProbability(roundsDistribution, rounds + 1, branchProbability);
          return;
        }

        const nextState = solve(remainingHeroHp, remainingBeastHp, rounds + 1);

        winProbability += branchProbability * nextState.winProbability;
        lethalProbability += branchProbability * nextState.lethalProbability;

        combineDistributions(damageDealtDistribution, nextState.damageDealtDistribution, heroDamage, branchProbability);
        combineDistributions(damageTakenDistribution, nextState.damageTakenDistribution, beastDamage, branchProbability);
        combineDistributions(roundsDistribution, nextState.roundsDistribution, 0, branchProbability);
      });
    });

    const outcome: StateOutcome = {
      winProbability,
      lethalProbability,
      damageDealtDistribution,
      damageTakenDistribution,
      roundsDistribution,
    };

    memo.set(memoKey, outcome);
    return outcome;
  };

  const computeInitialStrikeOutcome = (): StateOutcome => {
    let winProbability = 0;
    let lethalProbability = 0;
    const damageDealtDistribution = new Map<number, number>();
    const damageTakenDistribution = new Map<number, number>();
    const roundsDistribution = new Map<number, number>();

    beastDamageOptions.forEach(({ damage: initialDamage, probability: initialProbability }) => {
      if (initialProbability <= PROBABILITY_EPSILON) {
        return;
      }

      const remainingHeroHp = initialHeroHp - initialDamage;

      if (remainingHeroHp <= 0) {
        lethalProbability += initialProbability;
        addProbability(damageDealtDistribution, 0, initialProbability);
        addProbability(damageTakenDistribution, initialDamage, initialProbability);
        addProbability(roundsDistribution, 0, initialProbability);
        return;
      }

      const nextOutcome = solve(remainingHeroHp, effectiveBeastHp, 0);

      winProbability += initialProbability * nextOutcome.winProbability;
      lethalProbability += initialProbability * nextOutcome.lethalProbability;

      combineDistributions(damageDealtDistribution, nextOutcome.damageDealtDistribution, 0, initialProbability);
      combineDistributions(damageTakenDistribution, nextOutcome.damageTakenDistribution, initialDamage, initialProbability);
      combineDistributions(roundsDistribution, nextOutcome.roundsDistribution, 0, initialProbability);
    });

    return {
      winProbability,
      lethalProbability,
      damageDealtDistribution,
      damageTakenDistribution,
      roundsDistribution,
    };
  };

  const rootOutcome = initialBeastStrike
    ? computeInitialStrikeOutcome()
    : solve(initialHeroHp, effectiveBeastHp, 0);
  const totalProbability = rootOutcome.winProbability + rootOutcome.lethalProbability;

  if (totalProbability <= PROBABILITY_EPSILON) {
    return defaultSimulationResult;
  }

  const getBeastLethalChance = (heroHp: number) => beastDamageOptions.reduce((chance, { damage, probability }) => {
    if (probability <= PROBABILITY_EPSILON) {
      return chance;
    }

    return damage >= heroHp ? chance + probability : chance;
  }, 0);

  const otkProbability = initialBeastStrike
    ? (() => {
      let probability = 0;

      beastDamageOptions.forEach(({ damage: initialDamage, probability: initialProbability }) => {
        if (initialProbability <= PROBABILITY_EPSILON) {
          return;
        }

        const remainingHeroHp = initialHeroHp - initialDamage;

        if (remainingHeroHp <= 0) {
          probability += initialProbability;
          return;
        }

        heroDamageOptions.forEach(({ damage: heroDamage, probability: heroProbability }) => {
          if (heroProbability <= PROBABILITY_EPSILON) {
            return;
          }

          const remainingBeastHp = effectiveBeastHp - heroDamage;

          if (remainingBeastHp <= 0) {
            return;
          }

          const lethalChance = getBeastLethalChance(remainingHeroHp);
          if (lethalChance <= PROBABILITY_EPSILON) {
            return;
          }

          probability += initialProbability * heroProbability * lethalChance;
        });
      });

      return probability;
    })()
    : (() => {
      let probability = 0;

      heroDamageOptions.forEach(({ damage: heroDamage, probability: heroProbability }) => {
        if (heroProbability <= PROBABILITY_EPSILON) {
          return;
        }

        const remainingBeastHp = effectiveBeastHp - heroDamage;
        if (remainingBeastHp <= 0) {
          return;
        }

        const lethalChance = getBeastLethalChance(initialHeroHp);
        if (lethalChance <= PROBABILITY_EPSILON) {
          return;
        }

        probability += heroProbability * lethalChance;
      });

      return probability;
    })();

  const winRate = Number(((rootOutcome.winProbability / totalProbability) * 100).toFixed(1));
  const otkRate = Number(((otkProbability / totalProbability) * 100).toFixed(1));

  const damageDealtMode = getModeFromDistribution(rootOutcome.damageDealtDistribution);
  const damageTakenMode = getModeFromDistribution(rootOutcome.damageTakenDistribution);
  const modeRounds = getModeFromDistribution(rootOutcome.roundsDistribution);
  const minDamageDealt = getMinFromDistribution(rootOutcome.damageDealtDistribution);
  const maxDamageDealt = getMaxFromDistribution(rootOutcome.damageDealtDistribution);
  const minDamageTaken = getMinFromDistribution(rootOutcome.damageTakenDistribution);
  const maxDamageTaken = getMaxFromDistribution(rootOutcome.damageTakenDistribution);
  const minRounds = getMinFromDistribution(rootOutcome.roundsDistribution);
  const maxRounds = getMaxFromDistribution(rootOutcome.roundsDistribution);

  return {
    hasOutcome: true,
    winRate,
    otkRate,
    modeDamageDealt: Math.round(damageDealtMode),
    modeDamageTaken: Math.round(damageTakenMode),
    modeRounds: Math.round(modeRounds),
    minDamageDealt: Math.round(minDamageDealt),
    maxDamageDealt: Math.round(maxDamageDealt),
    minDamageTaken: Math.round(minDamageTaken),
    maxDamageTaken: Math.round(maxDamageTaken),
    minRounds: Math.round(minRounds),
    maxRounds: Math.round(maxRounds),
  };
};
