/// <reference lib="webworker" />

import type { Adventurer, Beast } from '@/types/game';
import { calculateDeterministicCombatResult } from '@/utils/combatSimulationCore';

interface CombatSimulationRequest {
  adventurer: Adventurer;
  beast: Beast;
}

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<CombatSimulationRequest>) => {
  const { adventurer, beast } = event.data;
  const result = calculateDeterministicCombatResult(adventurer, beast);
  ctx.postMessage(result);
};
