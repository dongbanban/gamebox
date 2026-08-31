import type { BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import {
  getDogTrayLogicalUnitCount,
  isDogSpecialMechanismResolved,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  DogLevelGeometry,
  DogSpecialMechanismHandler,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import {
  blockMask,
  createSolvabilityResult,
  resolveBranchBudget,
  type SolvabilityResult,
  type SolvabilitySearchContext,
} from "@/games/dog-lege-dog/levels/level-solvability-contracts";
import {
  cloneTray,
  getSelectableBlocks,
  isCapacityBlocked,
  resolveDogShuffleAfterSelection,
  sortSelectableBlocks,
  stateKeyFor,
  trayPeakPressureForPath,
} from "@/games/dog-lege-dog/levels/level-solvability-simulation";
import { createDogMagneticRandom, resolveDogSelection } from "@/games/dog-lege-dog/levels/level-mechanism-resolution";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";

export function searchSolvableContinuation(
  level: DogLevelGeometry,
  graph: BlockGraph,
  remainingMask: bigint,
  higherBlockCounts: readonly number[],
  tray: readonly DogTrayBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  preferredRank: ReadonlyMap<number, number>,
  context: SolvabilitySearchContext,
  path: readonly string[],
  pathDepth: number,
  trayCapacity: number = DOG_V13_CONFIG.tray.baseCapacity,
  magneticRandom: SeededRandom = createDogMagneticRandom(level),
  shuffleTriggered = false,
): SolvabilityResult {
  const stateKey = `${stateKeyFor(remainingMask, tray, magneticRandom)}:${
    shuffleTriggered ? "shuffle" : "no-shuffle"
  }`;
  if (remainingMask === 0n) {
    if (context.requireShuffleTrigger && !shuffleTriggered) {
      return createSolvabilityResult(
        "unsolvable",
        path,
        getDogTrayLogicalUnitCount(tray),
        "solvability path never triggers shuffle",
      );
    }
    if (tray.some((block) => !isDogSpecialMechanismResolved(block.specialMechanism))) {
      return createSolvabilityResult(
        "unsolvable",
        path,
        getDogTrayLogicalUnitCount(tray),
        "solvable continuation leaves unresolved special mechanisms",
      );
    }
    if (tray.length > 0) {
      return createSolvabilityResult(
        "unsolvable",
        path,
        getDogTrayLogicalUnitCount(tray),
        "solvable continuation leaves tray blocks after clearing the board",
      );
    }
    context.completedStates.set(stateKey, {
      status: "solvable",
      path: [],
      trayPeakPressure: getDogTrayLogicalUnitCount(tray),
    });
    return createSolvabilityResult("solvable", path, getDogTrayLogicalUnitCount(tray));
  }

  if (pathDepth >= level.blocks.length) {
    return createSolvabilityResult(
      "unsolvable",
      path,
      getDogTrayLogicalUnitCount(tray),
      "solvable path exceeded available block depth",
    );
  }

  const completedState = context.completedStates.get(stateKey);
  if (completedState !== undefined) {
    if (completedState.status === "solvable") {
      return createSolvabilityResult(
        "solvable",
        [...path, ...completedState.path],
        Math.max(getDogTrayLogicalUnitCount(tray), completedState.trayPeakPressure),
      );
    }

    return createSolvabilityResult(
      "unsolvable",
      path,
      getDogTrayLogicalUnitCount(tray),
      "solvable continuation repeats a proven failed state",
    );
  }

  const selectable = getSelectableBlocks(level, remainingMask, higherBlockCounts);
  if (selectable.length === 0) {
    context.completedStates.set(stateKey, {
      status: "unsolvable",
      path: [],
      trayPeakPressure: getDogTrayLogicalUnitCount(tray),
    });
    return createSolvabilityResult(
      "unsolvable",
      path,
      getDogTrayLogicalUnitCount(tray),
      "solvable continuation has no selectable block",
    );
  }

  sortSelectableBlocks(selectable, level, tray, handlers, preferredRank);

  let trayPeakPressure = getDogTrayLogicalUnitCount(tray);
  for (let choiceIndex = 0; choiceIndex < selectable.length; choiceIndex += 1) {
    if (choiceIndex > 0) {
      if (context.branchAttempts >= context.branchBudget) {
        return createSolvabilityResult(
          "budget-exhausted",
          path,
          trayPeakPressure,
          "solvability search branch budget exhausted",
        );
      }
      context.branchAttempts += 1;
    }

    const selectedIndex = selectable[choiceIndex];
    const nextMagneticRandom = magneticRandom.clone();
    const resolution = resolveDogSelection(
      level,
      selectedIndex,
      remainingMask,
      higherBlockCounts,
      tray,
      handlers,
      nextMagneticRandom,
      graph,
    );
    const nextRemainingMask = resolution.remainingMask;
    const shuffleResolution = resolveDogShuffleAfterSelection({
      level,
      tray: resolution.tray,
      remainingMask: nextRemainingMask,
      effectiveTrayCapacity: trayCapacity,
      handlers,
      magneticRandom: nextMagneticRandom,
      config: context.config,
    });
    const nextShuffleTriggered = shuffleTriggered || shuffleResolution.computation !== null;
    const nextTray = [...shuffleResolution.tray];
    const nextTrayLogicalUnitCount = getDogTrayLogicalUnitCount(nextTray);
    trayPeakPressure = Math.max(trayPeakPressure, nextTrayLogicalUnitCount);
    const nextHigherBlockCounts = [...higherBlockCounts];
    nextHigherBlockCounts.splice(0, nextHigherBlockCounts.length, ...resolution.higherBlockCounts);
    const nextSelectable = getSelectableBlocks(
      level,
      nextRemainingMask,
      nextHigherBlockCounts,
    );
    if (isCapacityBlocked(
      level,
      nextTray,
      nextTrayLogicalUnitCount,
      trayCapacity,
      nextRemainingMask !== 0n,
      nextSelectable,
      handlers,
      context.config,
      nextHigherBlockCounts,
      nextMagneticRandom,
      nextRemainingMask,
      graph,
    )) {
      continue;
    }
    const result = searchSolvableContinuation(
      level,
      graph,
      nextRemainingMask,
      nextHigherBlockCounts,
      nextTray,
      handlers,
      preferredRank,
      context,
      [...path, level.blocks[selectedIndex].id],
      pathDepth + 1,
      trayCapacity,
      nextMagneticRandom,
      nextShuffleTriggered,
    );
    trayPeakPressure = Math.max(trayPeakPressure, result.trayPeakPressure);
    if (result.status !== "unsolvable") {
      if (result.status === "solvable") {
        const continuationPath = result.path.slice(path.length);
        context.completedStates.set(stateKey, {
          status: "solvable",
          path: continuationPath,
          trayPeakPressure: trayPeakPressureForPath(
            level,
            tray,
            continuationPath,
            graph,
            handlers,
            context.config,
            remainingMask,
            higherBlockCounts,
            magneticRandom,
          ),
        });
      }
      return createSolvabilityResult(
        result.status,
        result.path,
        trayPeakPressure,
        result.reason,
      );
    }
  }

  context.completedStates.set(stateKey, {
    status: "unsolvable",
    path: [],
    trayPeakPressure,
  });
  return createSolvabilityResult(
    "unsolvable",
    path,
    trayPeakPressure,
    "all selectable continuations were proven unsolvable",
  );
}

export function findGreedyContinuation(
  level: DogLevelGeometry,
  graph: BlockGraph,
  initialRemainingMask: bigint,
  initialHigherBlockCounts: readonly number[],
  initialTray: readonly DogTrayBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  preferredRank: ReadonlyMap<number, number>,
  initialPath: readonly string[],
  initialPathDepth: number,
  trayCapacity: number = DOG_V13_CONFIG.tray.baseCapacity,
  magneticRandom: SeededRandom = createDogMagneticRandom(level),
  config: DogV13Config = DOG_V13_CONFIG,
  requireShuffleTrigger = false,
  shuffleTriggered = false,
): SolvabilityResult | undefined {
  let remainingMask = initialRemainingMask;
  const higherBlockCounts = [...initialHigherBlockCounts];
  const tray = [...initialTray];
  const path = [...initialPath];
  let pathDepth = initialPathDepth;
  const selectionRandom = magneticRandom.clone();
  let trayPeakPressure = getDogTrayLogicalUnitCount(tray);

  while (remainingMask !== 0n) {
    if (pathDepth >= level.blocks.length) {
      return undefined;
    }

    const selectable = getSelectableBlocks(level, remainingMask, higherBlockCounts);
    if (selectable.length === 0) {
      return undefined;
    }
    sortSelectableBlocks(selectable, level, tray, handlers, preferredRank);

    const selectedIndex = selectable[0];
    const resolution = resolveDogSelection(
      level,
      selectedIndex,
      remainingMask,
      higherBlockCounts,
      tray,
      handlers,
      selectionRandom,
      graph,
    );
    remainingMask = resolution.remainingMask;
    const shuffleResolution = resolveDogShuffleAfterSelection({
      level,
      tray: resolution.tray,
      remainingMask,
      effectiveTrayCapacity: trayCapacity,
      handlers,
      magneticRandom: selectionRandom,
      config,
    });
    shuffleTriggered ||= shuffleResolution.computation !== null;
    tray.splice(0, tray.length, ...shuffleResolution.tray);
    higherBlockCounts.splice(0, higherBlockCounts.length, ...resolution.higherBlockCounts);
    const trayLogicalUnitCount = getDogTrayLogicalUnitCount(tray);
    trayPeakPressure = Math.max(trayPeakPressure, trayLogicalUnitCount);
    path.push(level.blocks[selectedIndex].id);
    pathDepth += 1;
    const nextSelectable = getSelectableBlocks(level, remainingMask, higherBlockCounts);
    if (isCapacityBlocked(
      level,
      tray,
      trayLogicalUnitCount,
      trayCapacity,
      remainingMask !== 0n,
      nextSelectable,
      handlers,
      config,
      higherBlockCounts,
      selectionRandom,
      remainingMask,
      graph,
    )) {
      return undefined;
    }
  }

  if (requireShuffleTrigger && !shuffleTriggered) {
    return undefined;
  }
  if (tray.length > 0) {
    return undefined;
  }

  return createSolvabilityResult("solvable", path, trayPeakPressure);
}

export function verifyStateContinuation(
  level: DogLevelGeometry,
  graph: BlockGraph,
  initialRemainingMask: bigint,
  initialHigherBlockCounts: readonly number[],
  initialTray: readonly DogTrayBlock[],
  path: readonly string[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  trayCapacity: number,
  magneticRandom: SeededRandom = createDogMagneticRandom(level),
  config: DogV13Config = DOG_V13_CONFIG,
  requireShuffleTrigger = false,
  shuffleTriggered = false,
): SolvabilityResult | undefined {
  let remainingMask = initialRemainingMask;
  const higherBlockCounts = [...initialHigherBlockCounts];
  const tray = cloneTray(initialTray);
  const selectionRandom = magneticRandom.clone();
  const autoConsumedIndices = new Set<number>();
  let trayPeakPressure = getDogTrayLogicalUnitCount(tray);

  for (const blockId of path) {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex === undefined) {
      return undefined;
    }

    if ((remainingMask & blockMask(blockIndex)) === 0n) {
      if (autoConsumedIndices.has(blockIndex)) {
        continue;
      }
      return undefined;
    }

    if (higherBlockCounts[blockIndex] !== 0) {
      return undefined;
    }

    const resolution = resolveDogSelection(
      level,
      blockIndex,
      remainingMask,
      higherBlockCounts,
      tray,
      handlers,
      selectionRandom,
      graph,
    );
    remainingMask = resolution.remainingMask;
    higherBlockCounts.splice(0, higherBlockCounts.length, ...resolution.higherBlockCounts);
    const shuffleResolution = resolveDogShuffleAfterSelection({
      level,
      tray: resolution.tray,
      remainingMask,
      effectiveTrayCapacity: trayCapacity,
      handlers,
      magneticRandom: selectionRandom,
      config,
    });
    shuffleTriggered ||= shuffleResolution.computation !== null;
    tray.splice(0, tray.length, ...shuffleResolution.tray);
    for (const consumedIndex of resolution.consumedBlockIndices) {
      if (consumedIndex !== blockIndex) {
        autoConsumedIndices.add(consumedIndex);
      }
    }
    const trayLogicalUnitCount = getDogTrayLogicalUnitCount(tray);
    trayPeakPressure = Math.max(trayPeakPressure, trayLogicalUnitCount);
    const nextSelectable = getSelectableBlocks(level, remainingMask, higherBlockCounts);
    if (isCapacityBlocked(
      level,
      tray,
      trayLogicalUnitCount,
      trayCapacity,
      remainingMask !== 0n,
      nextSelectable,
      handlers,
      config,
      higherBlockCounts,
      selectionRandom,
      remainingMask,
      graph,
    )) {
      return undefined;
    }
  }

  if (remainingMask !== 0n || tray.length > 0 ||
    (requireShuffleTrigger && !shuffleTriggered)) {
    return undefined;
  }

  return createSolvabilityResult("solvable", path, trayPeakPressure);
}

export function createPreferredRank(
  preferredPath: readonly string[],
  graph: BlockGraph,
): ReadonlyMap<number, number> {
  const preferredRank = new Map<number, number>();
  preferredPath.forEach((blockId, rank) => {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex !== undefined) {
      preferredRank.set(blockIndex, rank);
    }
  });
  return preferredRank;
}
