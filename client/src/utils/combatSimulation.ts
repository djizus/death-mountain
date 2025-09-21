import type { Adventurer, Beast } from '@/types/game';
import {
  CombatSimulationResult,
  SimulationTotals,
  createEmptyTotals,
  defaultSimulationResult,
  mergeSimulationTotals,
  runSimulationChunk,
  totalsToResult,
} from './combatSimulationCore';

export type { CombatSimulationResult } from './combatSimulationCore';
export { defaultSimulationResult } from './combatSimulationCore';

const MIN_ITERATIONS_PER_WORKER = 1000;
const MAX_WORKERS = 8;

const workerUrl = new URL('../workers/combatSimulationWorker.ts', import.meta.url);

const supportsWorkers = () => typeof window !== 'undefined' && typeof Worker !== 'undefined';

const resolveWorkerCount = (iterations: number) => {
  if (!supportsWorkers()) {
    return 1;
  }

  const hardwareLimit = typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
    ? navigator.hardwareConcurrency
    : MAX_WORKERS;
  const maxAllowed = Math.max(1, Math.min(MAX_WORKERS, hardwareLimit));
  const basedOnIterations = Math.max(1, Math.floor(iterations / MIN_ITERATIONS_PER_WORKER));

  return Math.min(maxAllowed, basedOnIterations);
};

const spawnWorker = (params: { adventurer: Adventurer; beast: Beast; iterations: number; }) =>
  new Promise<SimulationTotals>((resolve, reject) => {
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

const runSimulationWithWorkers = async (
  adventurer: Adventurer,
  beast: Beast,
  iterations: number,
): Promise<SimulationTotals> => {
  const workerCount = resolveWorkerCount(iterations);

  if (workerCount <= 1) {
    return runSimulationChunk({ adventurer, beast, iterations });
  }

  const chunkPromises: Array<Promise<SimulationTotals>> = [];
  let remainingIterations = iterations;

  for (let i = 0; i < workerCount; i += 1) {
    const workersLeft = workerCount - i;
    const chunkIterations = Math.max(0, Math.floor(remainingIterations / workersLeft));
    const iterationsForWorker = i === workerCount - 1
      ? remainingIterations
      : chunkIterations;

    if (iterationsForWorker <= 0) {
      continue;
    }

    chunkPromises.push(spawnWorker({ adventurer, beast, iterations: iterationsForWorker }));
    remainingIterations -= iterationsForWorker;
  }

  const chunks = await Promise.all(chunkPromises);
  return chunks.reduce(
    (acc, chunk) => mergeSimulationTotals(acc, chunk),
    createEmptyTotals(),
  );
};

export const simulateCombatOutcomes = async (
  adventurer: Adventurer | null | undefined,
  beast: Beast | null | undefined,
  iterations = 10000,
  goldReward: number,
): Promise<CombatSimulationResult> => {
  if (!adventurer || !beast || adventurer.health <= 0 || beast.health <= 0 || iterations <= 0) {
    return defaultSimulationResult;
  }

  const totalIterations = Math.max(1, iterations);

  try {
    const totals = supportsWorkers()
      ? await runSimulationWithWorkers(adventurer, beast, totalIterations)
      : runSimulationChunk({ adventurer, beast, iterations: totalIterations });

    return totalsToResult(totals, goldReward);
  } catch (error) {
    console.error('combat simulation workers failed, falling back to single-threaded run', error);
    const totals = runSimulationChunk({ adventurer, beast, iterations: totalIterations });
    return totalsToResult(totals, goldReward);
  }
};
