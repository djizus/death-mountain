import type { Adventurer, Beast } from '@/types/game';
import {
  type CombatSimulationOptions,
  CombatSimulationResult,
  defaultSimulationResult,
  calculateDeterministicCombatResult,
} from './combatSimulationCore';

export type { CombatSimulationResult } from './combatSimulationCore';
export { defaultSimulationResult } from './combatSimulationCore';

const supportsWorkers = () => typeof window !== 'undefined' && typeof Worker !== 'undefined';

const getErrorMessage = (error: unknown): string => {
  if (!error) {
    return '';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof (error as ErrorEvent)?.message === 'string') {
    return (error as ErrorEvent).message;
  }

  if (typeof (error as { error?: unknown })?.error === 'object') {
    const nested = (error as { error?: { message?: unknown } }).error;
    if (nested && typeof (nested as { message?: unknown }).message === 'string') {
      return String((nested as { message?: unknown }).message);
    }
  }

  return '';
};

const isStackOverflowError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('maximum call stack') || message.includes('call stack size exceeded');
};

const runSimulationInline = (
  adventurer: Adventurer,
  beast: Beast,
  options: CombatSimulationOptions,
): CombatSimulationResult => {
  try {
    return calculateDeterministicCombatResult(adventurer, beast, options);
  } catch (error) {
    if (isStackOverflowError(error)) {
      console.warn('Combat simulation exceeded call stack limit; returning default result instead.');
      return defaultSimulationResult;
    }

    throw error;
  }
};

const spawnWorker = (params: { adventurer: Adventurer; beast: Beast; options?: CombatSimulationOptions; }) =>
  new Promise<CombatSimulationResult>((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/combatSimulationWorker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event) => {
      resolve(event.data);
      worker.terminate();
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(event);
    };

    worker.postMessage(params);
  });

export const simulateCombatOutcomes = async (
  adventurer: Adventurer | null | undefined,
  beast: Beast | null | undefined,
  options: CombatSimulationOptions = {},
): Promise<CombatSimulationResult> => {
  if (!adventurer || !beast || adventurer.health <= 0 || beast.health <= 0) {
    return defaultSimulationResult;
  }

  try {
    if (supportsWorkers()) {
      return await spawnWorker({ adventurer, beast, options });
    }

    return runSimulationInline(adventurer, beast, options);
  } catch (error) {
    if (isStackOverflowError(error)) {
      console.warn('Combat simulation failed due to stack overflow; returning default result.');
      return defaultSimulationResult;
    }

    console.error('combat simulation workers failed, falling back to single-threaded run', error);

    try {
      return runSimulationInline(adventurer, beast, options);
    } catch (fallbackError) {
      if (isStackOverflowError(fallbackError)) {
        console.warn('Combat simulation fallback also exceeded call stack; returning default result.');
        return defaultSimulationResult;
      }

      throw fallbackError;
    }
  }
};
