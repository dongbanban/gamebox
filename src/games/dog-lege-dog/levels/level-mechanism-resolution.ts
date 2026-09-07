import {
  DOG_MAGNETIC_MECHANISM_TYPE,
  prepareDogTrayBlocks,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import {
  insertDogBlockIntoTray,
  resolveDogTrayMatches,
} from "@/games/dog-lege-dog/levels/level-rules";
import type {
  DogLevelGeometry,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import { createBlockGraph, type BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import { toDogTrayBlock } from "@/games/dog-lege-dog/levels/level-tray-block";

export interface DogSelectionResolution {
  readonly remainingMask: bigint;
  readonly higherBlockCounts: readonly number[];
  readonly tray: readonly DogTrayBlock[];
  readonly consumedBlockIndices: readonly number[];
  readonly magneticTargetIndex: number | null;
}

/**
 * Creates same stream used by GameSession magnetic target selection.
 * Hand-built fixtures use level number as stable fallback identity.
 */
export function createDogMagneticRandom(level: DogLevelGeometry): SeededRandom {
  return new SeededRandom(
    `${level.runSeed ?? `level-${level.number}`}:magnetic-target`,
  );
}

/**
 * Resolves one click, including magnetic auto-consumption and mechanism entry.
 * Solver, difficulty metrics and runtime can share exact selection semantics.
 */
export function resolveDogSelection(
  level: DogLevelGeometry,
  selectedBlockIndex: number,
  remainingMask: bigint,
  higherBlockCounts: readonly number[],
  initialTray: readonly DogTrayBlock[],
  magneticRandom: SeededRandom,
  knownGraph?: BlockGraph,
  config: DogV13Config = DOG_V13_CONFIG,
): DogSelectionResolution {
  const selectedBlock = level.blocks[selectedBlockIndex];
  if (selectedBlock === undefined) {
    throw new Error(`狗了个狗 selected block is missing: ${selectedBlockIndex}`);
  }

  let nextRemainingMask = remainingMask & ~blockMask(selectedBlockIndex);
  const nextHigherBlockCounts = [...higherBlockCounts];
  const graph = knownGraph ?? createBlockGraph(level.blocks);
  revealLowerBlocks(graph, selectedBlockIndex, nextHigherBlockCounts);
  const consumedBlockIndices = [selectedBlockIndex];
  let magneticTargetIndex: number | null = null;
  if (selectedBlock.specialMechanism?.type === DOG_MAGNETIC_MECHANISM_TYPE) {
    magneticTargetIndex = chooseDogMagneticTargetIndex(
      level,
      selectedBlockIndex,
      nextRemainingMask,
      nextHigherBlockCounts,
      magneticRandom,
    );
    if (magneticTargetIndex !== null) {
      nextRemainingMask &= ~blockMask(magneticTargetIndex);
      revealLowerBlocks(graph, magneticTargetIndex, nextHigherBlockCounts);
      consumedBlockIndices.push(magneticTargetIndex);
    }
  }

  const tray = [...initialTray];
  if (magneticTargetIndex === null) {
    insertDogBlockIntoTray(
      tray,
      toDogTrayBlock(selectedBlock),
      {
        allowFrozenFinalTriple: nextRemainingMask === 0n,
        config,
      },
    );
  } else {
    // Magnetic source and target enter as one animation. Resolve triples only
    // after both entries, matching GameSession.enterMagneticBlocks().
    const targetBlock = level.blocks[magneticTargetIndex];
    insertDogMagneticBlocks(
      tray,
      toDogTrayBlock(selectedBlock),
      targetBlock === undefined ? undefined : toDogTrayBlock(targetBlock),
    );
    resolveDogTrayMatches(tray, {
      allowFrozenFinalTriple: nextRemainingMask === 0n,
      config,
    });
  }

  return {
    remainingMask: nextRemainingMask,
    higherBlockCounts: nextHigherBlockCounts,
    tray,
    consumedBlockIndices: Object.freeze([...consumedBlockIndices]),
    magneticTargetIndex,
  };
}

export function insertDogMagneticBlocks(
  tray: DogTrayBlock[],
  sourceBlock: DogTrayBlock,
  targetBlock: DogTrayBlock | undefined,
): readonly string[] {
  for (const block of prepareDogTrayBlocks(sourceBlock)) {
    tray.push(block);
  }

  if (targetBlock === undefined) {
    return Object.freeze([]);
  }

  const targetTrayBlockIds: string[] = [];
  for (const block of prepareDogTrayBlocks(targetBlock)) {
    tray.push(block);
    targetTrayBlockIds.push(block.id);
  }
  return Object.freeze(targetTrayBlockIds);
}

export function chooseDogMagneticTargetIndex(
  level: DogLevelGeometry,
  sourceBlockIndex: number,
  remainingMask: bigint,
  higherBlockCounts: readonly number[],
  magneticRandom: SeededRandom,
): number | null {
  const sourceBlock = level.blocks[sourceBlockIndex];
  if (sourceBlock === undefined) {
    return null;
  }

  const candidates = level.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) =>
      (remainingMask & blockMask(index)) !== 0n &&
      block.specialMechanism?.type !== DOG_MAGNETIC_MECHANISM_TYPE &&
      block.patternType !== sourceBlock.patternType,
    );
  if (candidates.length === 0) {
    return null;
  }

  const selectableCandidates = candidates.filter(
    ({ index }) => higherBlockCounts[index] === 0,
  );
  const candidatePool = selectableCandidates.length > 0
    ? selectableCandidates
    : candidates;
  return candidatePool[magneticRandom.nextInt(candidatePool.length)]?.index ?? null;
}

function revealLowerBlocks(
  graph: BlockGraph,
  higherBlockIndex: number,
  higherBlockCounts: number[],
): void {
  for (const lowerBlockIndex of graph.lowerBlockIndicesByHigher[higherBlockIndex] ?? []) {
    higherBlockCounts[lowerBlockIndex] -= 1;
  }
}

function blockMask(blockIndex: number): bigint {
  return 1n << BigInt(blockIndex);
}
