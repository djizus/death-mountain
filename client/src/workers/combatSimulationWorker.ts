/// <reference lib="webworker" />

import type { Adventurer, Beast } from '@/types/game';
import { calculateDeterministicCombatResult, type CombatSimulationOptions } from '@/utils/combatSimulationCore';

interface CombatSimulationRequest {
  adventurer: Adventurer;
  beast: Beast;
  options?: CombatSimulationOptions;
}

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<CombatSimulationRequest>) => {
  const { adventurer, beast, options } = event.data;
  const result = calculateDeterministicCombatResult(adventurer, beast, options);
  ctx.postMessage(result);
};
