import type { Adventurer, Beast } from '@/types/game';
import {
  type CombatSimulationOptions,
  CombatSimulationResult,
  defaultSimulationResult,
  calculateDeterministicCombatResult,
} from './combatSimulationCore';

export type { CombatSimulationResult } from './combatSimulationCore';
export { defaultSimulationResult } from './combatSimulationCore';

const workerUrl = new URL('../workers/combatSimulationWorker.ts', import.meta.url);

const supportsWorkers = () => typeof window !== 'undefined' && typeof Worker !== 'undefined';

const spawnWorker = (params: { adventurer: Adventurer; beast: Beast; options?: CombatSimulationOptions; }) =>
  new Promise<CombatSimulationResult>((resolve, reject) => {
    const worker = new Worker(workerUrl, { type: 'module' });

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

    return calculateDeterministicCombatResult(adventurer, beast, options);
  } catch (error) {
    console.error('combat simulation workers failed, falling back to single-threaded run', error);
    return calculateDeterministicCombatResult(adventurer, beast, options);
  }
};
