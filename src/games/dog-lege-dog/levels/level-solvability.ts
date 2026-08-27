import { createBlockGraph, type BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import {
  createDogSpecialMechanismHandlerMap,
  DOG_SPECIAL_MECHANISM_HANDLERS,
  getDogBlockLogicalUnitCount,
  getDogTrayLogicalUnitCount,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  DogLevelGeometry,
  DogSafeChoiceSearchStatus,
} from "@/games/dog-lege-dog/levels/level-types";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/game-config";
import {
  blockMask,
  createFullBlockMask,
  createSolvabilityResult,
  countBits,
  resolveBranchBudget,
  type SolvabilityMemoEntry,
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
} from "@/games/dog-lege-dog/levels/level-solvability-simulation";
import {
  createPreferredRank,
  findGreedyContinuation,
  hasSolvableContinuation,
  searchSolvableContinuation,
  verifyStateContinuation,
} from "@/games/dog-lege-dog/levels/level-solvability-search";
import { createDogMagneticRandom } from "@/games/dog-lege-dog/levels/level-mechanism-resolution";
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

export function findSolvability(
  level: DogLevelGeometry & { readonly solutionPath?: readonly string[] },
  options: SolvabilitySearchOptions = {},
): SolvabilityResult {
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
    );
    if (storedVerification.solvable) {
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
  );
  if (descendingVerification.solvable) {
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
  );
  if (greedyResult !== undefined) {
    return normalizeSolvabilityResult(level, greedyResult, handlers);
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
    },
    [],
    0,
    trayCapacity,
  );
  return normalizeSolvabilityResult(level, searchResult, handlers);
}

export function findSolvabilityFromState(
  level: DogLevelGeometry & { readonly solutionPath?: readonly string[] },
  options: SolvabilityStateOptions,
): SolvabilityResult {
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
  const trayLogicalUnitCount = getDogTrayLogicalUnitCount(tray);
  const selectable = getSelectableBlocks(level, remainingMask, higherBlockCounts);
  if (isCapacityBlocked(
    level,
    tray,
    trayLogicalUnitCount,
    trayCapacity,
    remainingMask !== 0n,
    selectable,
    handlers,
    higherBlockCounts,
    undefined,
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
    createDogMagneticRandom(level),
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
      completedStates: new Map(),
      branchAttempts: 0,
      branchBudget: resolveBranchBudget(options),
    },
    [],
    0,
    trayCapacity,
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
  const completedStates = new Map<string, SolvabilityMemoEntry>();
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
    );
    if (candidateVerification.solvable) {
      safeChoiceCount += getDogBlockLogicalUnitCount(level.blocks[index]);
      continue;
    }

    // v13 metrics count directly replayable alternatives; deep search may be budget-limited.
    if ((level.generatorVersion ?? 0) >= DOG_V13_CONFIG.game.generatorVersion) {
      continue;
    }

    const continuation = hasSolvableContinuation(
      level,
      solutionPath,
      graph,
      index,
      options,
      completedStates,
      handlers,
    );
    if (continuation.status === "solvable") {
      safeChoiceCount += getDogBlockLogicalUnitCount(level.blocks[index]);
    } else if (continuation.status === "budget-exhausted") {
      searchStatus = "budget-exhausted";
    }
  }

  return {
    safeChoiceCount,
    searchStatus,
  };
}
