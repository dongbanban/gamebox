import { createBlockGraph, type BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import {
  createDogSpecialMechanismHandlerMap,
  DOG_SPECIAL_MECHANISM_HANDLERS,
  getDogBlockLogicalUnitCount,
  getDogTrayLogicalUnitCount,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import type {
  DogLevelGeometry,
  DogSafeChoiceSearchStatus,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  blockMask,
  createFullBlockMask,
  createSolvabilityResult,
  countBits,
  resolveBranchBudget,
} from "@/games/dog-lege-dog/levels/level-solvability-contracts";
import type {
  SafeChoiceMetrics,
  SolvabilityResult,
  SolvabilitySearchOptions,
  SolvabilityStateOptions,
} from "@/games/dog-lege-dog/levels/level-solvability-contracts";
import {
  cloneTray,
  getSelectableBlocks,
  isCapacityBlocked,
  resolveDogShuffleAfterSelection,
} from "@/games/dog-lege-dog/levels/level-solvability-simulation";
import { resolveDogTrayMatches } from "@/games/dog-lege-dog/levels/level-rules";
import {
  createPreferredRank,
  findGreedyContinuation,
  searchSolvableContinuation,
  verifyStateContinuation,
} from "@/games/dog-lege-dog/levels/level-solvability-search";
import {
  createDogMagneticRandom,
} from "@/games/dog-lege-dog/levels/level-mechanism-resolution";
import {
  normalizeSolvabilityResult,
  resolveLevelTrayCapacity,
  resolveTrayCapacity,
  toSolvabilityResult,
  verifyRemovalPath,
} from "@/games/dog-lege-dog/levels/level-solvability-verification";

export {
  MAX_SOLVABILITY_SEARCH_BRANCHES,
  createSolvabilityResult,
  resolveBranchBudget,
} from "@/games/dog-lege-dog/levels/level-solvability-contracts";
export type {
  PathVerification,
  PathSimulationMetrics,
  SafeChoiceMetrics,
  SolvabilityResult,
  SolvabilitySearchOptions,
  SolvabilityStateOptions,
} from "@/games/dog-lege-dog/levels/level-solvability-contracts";
export { verifyRemovalPath } from "@/games/dog-lege-dog/levels/level-solvability-verification";
export { findShuffleTriggerPath } from "@/games/dog-lege-dog/levels/level-shuffle";

export function findSolvability(
  level: DogLevelGeometry & { readonly solutionPath?: readonly string[] },
  options: SolvabilitySearchOptions = {},
): SolvabilityResult {
  const config = options.config ?? DOG_V13_CONFIG;
  const requireShuffleTrigger = options.requireShuffleTrigger === true;
  const handlers = createDogSpecialMechanismHandlerMap(
    options.specialMechanismHandlers ?? DOG_SPECIAL_MECHANISM_HANDLERS,
  );
  const trayCapacity = resolveLevelTrayCapacity(level);
  const storedPath = level.solutionPath;
  if (storedPath !== undefined && storedPath.length > 0) {
    const storedVerification = verifyRemovalPath(
      level,
      storedPath,
      undefined,
      handlers,
      trayCapacity,
      config,
    );
    if (storedVerification.solvable && (
      !requireShuffleTrigger || (storedVerification.simulation?.shuffleTriggerCount ?? 0) > 0
    )) {
      return toSolvabilityResult(storedVerification);
    }
  }

  const descendingPath = [...level.blocks]
    .sort((first, second) => second.z - first.z || first.id.localeCompare(second.id))
    .map((block) => block.id);
  const descendingVerification = verifyRemovalPath(
    level,
    descendingPath,
    undefined,
    handlers,
    trayCapacity,
    config,
  );
  if (descendingVerification.solvable && (
    !requireShuffleTrigger || (descendingVerification.simulation?.shuffleTriggerCount ?? 0) > 0
  )) {
    return toSolvabilityResult(descendingVerification);
  }

  const graph = createBlockGraph(level.blocks);
  const preferredPath = storedPath ?? descendingPath;
  const preferredRank = createPreferredRank(preferredPath, graph);
  const greedyResult = findGreedyContinuation(
    level,
    graph,
    createFullBlockMask(level.blocks.length),
    [...graph.higherBlockCounts],
    [],
    handlers,
    preferredRank,
    [],
    0,
    trayCapacity,
    undefined,
    config,
    requireShuffleTrigger,
  );
  if (greedyResult !== undefined) {
    return normalizeSolvabilityResult(level, greedyResult, handlers, config);
  }

  const searchResult = searchSolvableContinuation(
    level,
    graph,
    createFullBlockMask(level.blocks.length),
    [...graph.higherBlockCounts],
    [],
    handlers,
    preferredRank,
    {
      completedStates: new Map(),
      branchAttempts: 0,
      branchBudget: resolveBranchBudget(options),
      config,
      requireShuffleTrigger,
    },
    [],
    0,
    trayCapacity,
    createDogMagneticRandom(level),
  );
  return normalizeSolvabilityResult(level, searchResult, handlers, config);
}

export function findSolvabilityFromState(
  level: DogLevelGeometry & { readonly solutionPath?: readonly string[] },
  options: SolvabilityStateOptions,
): SolvabilityResult {
  const config = options.config ?? DOG_V13_CONFIG;
  const requireShuffleTrigger = options.requireShuffleTrigger === true;
  const handlers = createDogSpecialMechanismHandlerMap(
    options.specialMechanismHandlers ?? DOG_SPECIAL_MECHANISM_HANDLERS,
  );
  const trayCapacity = options.trayCapacity === undefined
    ? resolveLevelTrayCapacity(level)
    : resolveTrayCapacity(options.trayCapacity);
  const graph = createBlockGraph(level.blocks);
  const remainingIds = new Set(options.remainingBlockIds);
  if (remainingIds.size !== options.remainingBlockIds.length) {
    return createSolvabilityResult(
      "unsolvable",
      [],
      getDogTrayLogicalUnitCount(options.initialTray),
      "solvability state contains duplicate remaining block ids",
    );
  }

  let remainingMask = 0n;
  for (const [index, block] of level.blocks.entries()) {
    if (remainingIds.has(block.id)) {
      remainingMask |= blockMask(index);
    }
  }
  if (remainingIds.size !== countBits(remainingMask)) {
    return createSolvabilityResult(
      "unsolvable",
      [],
      getDogTrayLogicalUnitCount(options.initialTray),
      "solvability state contains an unknown remaining block id",
    );
  }

  const higherBlockCounts = [...graph.higherBlockCounts];
  for (let index = 0; index < level.blocks.length; index += 1) {
    if ((remainingMask & blockMask(index)) !== 0n) {
      continue;
    }

    for (const lowerIndex of graph.lowerBlockIndicesByHigher[index]) {
      higherBlockCounts[lowerIndex] -= 1;
    }
  }
  if (higherBlockCounts.some((count) => count < 0)) {
    return createSolvabilityResult(
      "unsolvable",
      [],
      getDogTrayLogicalUnitCount(options.initialTray),
      "solvability state contains inconsistent layer counts",
    );
  }

  const tray = cloneTray(options.initialTray);
  resolveDogTrayMatches(tray, handlers, {
    allowFrozenFinalTriple: remainingMask === 0n,
  });
  const magneticRandom = options.magneticRandom?.clone() ?? createDogMagneticRandom(level);
  const shuffleResolution = resolveDogShuffleAfterSelection({
    level,
    tray,
    remainingMask,
    effectiveTrayCapacity: trayCapacity,
    handlers,
    magneticRandom,
    config,
  });
  tray.splice(0, tray.length, ...shuffleResolution.tray);
  const trayLogicalUnitCount = getDogTrayLogicalUnitCount(tray);
  const initialShuffleTriggered = shuffleResolution.computation !== null;
  const selectable = getSelectableBlocks(level, remainingMask, higherBlockCounts);
  if (isCapacityBlocked(
    level,
    tray,
    trayLogicalUnitCount,
    trayCapacity,
    remainingMask !== 0n,
    selectable,
    handlers,
    config,
    higherBlockCounts,
    magneticRandom,
    remainingMask,
    graph,
  )) {
    return createSolvabilityResult(
      "unsolvable",
      [],
      trayLogicalUnitCount,
      "solvability state already fills the tray before clearing the board",
    );
  }

  const preferredPath = (level.solutionPath ?? [])
    .filter((blockId) => remainingIds.has(blockId));
  const preferredRank = createPreferredRank(preferredPath, graph);
  const preferredVerification = verifyStateContinuation(
    level,
    graph,
    remainingMask,
    higherBlockCounts,
    tray,
    preferredPath,
    handlers,
    trayCapacity,
    magneticRandom,
    config,
    requireShuffleTrigger,
    initialShuffleTriggered,
  );
  if (preferredVerification !== undefined) {
    return preferredVerification;
  }

  const greedyResult = findGreedyContinuation(
    level,
    graph,
    remainingMask,
    higherBlockCounts,
    tray,
    handlers,
    preferredRank,
    [],
    0,
    trayCapacity,
    magneticRandom,
    config,
    requireShuffleTrigger,
    initialShuffleTriggered,
  );
  if (greedyResult !== undefined) {
    return greedyResult;
  }

  return searchSolvableContinuation(
    level,
    graph,
    remainingMask,
    higherBlockCounts,
    tray,
    handlers,
    preferredRank,
    {
      completedStates: options.completedStates ?? new Map(),
      branchAttempts: 0,
      branchBudget: resolveBranchBudget(options),
      config,
      requireShuffleTrigger,
    },
    [],
    0,
    trayCapacity,
    magneticRandom,
  );
}

export function countSafeChoices(
  level: DogLevelGeometry,
  solutionPath: readonly string[],
  graph: BlockGraph,
): number {
  return countSafeChoiceMetrics(level, solutionPath, graph).safeChoiceCount;
}

export function countSafeChoiceMetrics(
  level: DogLevelGeometry,
  solutionPath: readonly string[],
  graph: BlockGraph,
  options: SolvabilitySearchOptions = {},
): SafeChoiceMetrics {
  if (solutionPath.length === 0 || solutionPath.length > level.blocks.length) {
    return {
      safeChoiceCount: 0,
      searchStatus: "complete",
    };
  }

  let safeChoiceCount = 0;
  let searchStatus: DogSafeChoiceSearchStatus = "complete";
  const config = options.config ?? DOG_V13_CONFIG;
  const handlers = createDogSpecialMechanismHandlerMap(
    options.specialMechanismHandlers ?? DOG_SPECIAL_MECHANISM_HANDLERS,
  );
  for (let index = 0; index < level.blocks.length; index += 1) {
    if (graph.higherBlockCounts[index] !== 0) {
      continue;
    }

    const blockId = level.blocks[index].id;
    const candidatePath = [
      blockId,
      ...solutionPath.filter((pathBlockId) => pathBlockId !== blockId),
    ];
    const candidateVerification = verifyRemovalPath(
      level,
      candidatePath,
      graph,
      handlers,
      undefined,
      config,
    );
    if (candidateVerification.solvable) {
      safeChoiceCount += getDogBlockLogicalUnitCount(level.blocks[index]);
      continue;
    }

    // Current v13 metrics count only directly replayable alternatives.
  }
  return {
    safeChoiceCount,
    searchStatus,
  };
}
