/// <reference lib="webworker" />

import { SimulationChunkArgs, runSimulationChunk } from '@/utils/combatSimulationCore';

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<SimulationChunkArgs>) => {
  const { adventurer, beast, iterations } = event.data;
  const result = runSimulationChunk({ adventurer, beast, iterations });
  ctx.postMessage(result);
};
