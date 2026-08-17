import { insertPatternIntoTray } from "./level-rules";
import { createBlockGraph, type BlockGraph } from "./level-graph";
import type {
  DogLevelGeometry,
  DogPatternType,
  DogSafeChoiceSearchStatus,
  DogSolvabilityStatus,
} from "./level-types";

export const MAX_SOLVABILITY_SEARCH_BRANCHES = 16 as const;

export interface SolvabilitySearchOptions {
  readonly branchBudget?: number;
}

export interface PathVerification {
  readonly status: Exclude<DogSolvabilityStatus, "budget-exhausted">;
  readonly solvable: boolean;
  readonly path: readonly string[];
  readonly trayPeakPressure: number;
  readonly reason?: string;
}

export interface SolvabilityResult {
  readonly status: DogSolvabilityStatus;
  readonly path: readonly string[];
  readonly trayPeakPressure: number;
  readonly reason?: string;
}

export interface SafeChoiceMetrics {
  readonly safeChoiceCount: number;
  readonly searchStatus: DogSafeChoiceSearchStatus;
}

export function findSolvability(
  level: DogLevelGeometry & { readonly solutionPath?: readonly string[] },
  options: SolvabilitySearchOptions = {},
): SolvabilityResult {
  const storedPath = level.solutionPath;
  if (storedPath !== undefined && storedPath.length > 0) {
    const storedVerification = verifyRemovalPath(level, storedPath);
    if (storedVerification.solvable) {
      return toSolvabilityResult(storedVerification);
    }
  }

  const descendingPath = [...level.blocks]
    .sort((first, second) => second.z - first.z || first.id.localeCompare(second.id))
    .map((block) => block.id);
  const descendingVerification = verifyRemovalPath(level, descendingPath);
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
    preferredRank,
    [],
    0,
  );
  if (greedyResult !== undefined) {
    return normalizeSolvabilityResult(level, greedyResult);
  }

  const searchResult = searchSolvableContinuation(
    level,
    graph,
    createFullBlockMask(level.blocks.length),
    [...graph.higherBlockCounts],
    [],
    preferredRank,
    {
      completedStates: new Map<string, SolvabilityMemoEntry>(),
      branchAttempts: 0,
      branchBudget: resolveBranchBudget(options),
    },
    [],
    0,
  );
  return normalizeSolvabilityResult(level, searchResult);
}

/** @deprecated Use findSolvability to distinguish unsolvable from budget-exhausted. */
export function findSolvablePath(
  level: DogLevelGeometry & { readonly solutionPath?: readonly string[] },
  options: SolvabilitySearchOptions = {},
): readonly string[] | null {
  // Legacy path-only seam; use findSolvability when budget-exhausted must be distinguished.
  const result = findSolvability(level, options);
  return result.status === "solvable" ? [...result.path] : null;
}

/** @deprecated Use findSolvability to distinguish unsolvable from budget-exhausted. */
export function isLevelSolvable(level: DogLevelGeometry): boolean {
  // Boolean compatibility seam reports only a proven solvable result.
  return findSolvability(level).status === "solvable";
}

export function verifyRemovalPath(
  level: DogLevelGeometry,
  path: readonly string[],
  knownGraph?: BlockGraph,
): PathVerification {
  if (path.length !== level.blocks.length) {
    return createPathVerification(
      "unsolvable",
      path,
      0,
      "solvable path must contain every block exactly once",
    );
  }

  const graph = knownGraph ?? createBlockGraph(level.blocks);
  const remaining = new Set(level.blocks.map((_, index) => index));
  const higherBlockCounts = [...graph.higherBlockCounts];
  const tray: DogPatternType[] = [];
  const seen = new Set<number>();
  let trayPeakPressure = 0;

  for (const blockId of path) {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex === undefined || seen.has(blockIndex)) {
      return createPathVerification(
        "unsolvable",
        path,
        trayPeakPressure,
        `solvable path contains duplicate or unknown block ${blockId}`,
      );
    }

    if (!remaining.has(blockIndex)) {
      return createPathVerification(
        "unsolvable",
        path,
        trayPeakPressure,
        `solvable path removes block ${blockId} more than once`,
      );
    }

    if (higherBlockCounts[blockIndex] !== 0) {
      return createPathVerification(
        "unsolvable",
        path,
        trayPeakPressure,
        `solvable path selects blocked block ${blockId}`,
      );
    }

    seen.add(blockIndex);
    remaining.delete(blockIndex);
    for (const lowerIndex of graph.lowerBlockIndicesByHigher[blockIndex]) {
      higherBlockCounts[lowerIndex] -= 1;
    }

    insertPatternIntoTray(tray, level.blocks[blockIndex].patternType);
    trayPeakPressure = Math.max(trayPeakPressure, tray.length);
    if (tray.length >= 7 && remaining.size > 0) {
      return createPathVerification(
        "unsolvable",
        path,
        trayPeakPressure,
        "solvable path fills the seven-slot tray before clearing the board",
      );
    }
  }

  return createPathVerification(
    remaining.size === 0 ? "solvable" : "unsolvable",
    path,
    trayPeakPressure,
    remaining.size === 0 ? undefined : "solvable path leaves blocks behind",
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
  if (solutionPath.length !== level.blocks.length) {
    return {
      safeChoiceCount: 0,
      searchStatus: "complete",
    };
  }

  let safeChoiceCount = 0;
  let searchStatus: DogSafeChoiceSearchStatus = "complete";
  const completedStates = new Map<string, SolvabilityMemoEntry>();
  for (let index = 0; index < level.blocks.length; index += 1) {
    if (graph.higherBlockCounts[index] !== 0) {
      continue;
    }

    const blockId = level.blocks[index].id;
    const candidatePath = [
      blockId,
      ...solutionPath.filter((pathBlockId) => pathBlockId !== blockId),
    ];
    const candidateVerification = verifyRemovalPath(level, candidatePath, graph);
    if (candidateVerification.solvable) {
      safeChoiceCount += 1;
      continue;
    }

    const continuation = hasSolvableContinuation(
      level,
      solutionPath,
      graph,
      index,
      options,
      completedStates,
    );
    if (continuation.status === "solvable") {
      safeChoiceCount += 1;
    } else if (continuation.status === "budget-exhausted") {
      searchStatus = "budget-exhausted";
    }
  }

  return {
    safeChoiceCount,
    searchStatus,
  };
}

function hasSolvableContinuation(
  level: DogLevelGeometry,
  solutionPath: readonly string[],
  graph: BlockGraph,
  firstBlockIndex: number,
  options: SolvabilitySearchOptions,
  completedStates: Map<string, SolvabilityMemoEntry>,
): SolvabilityResult {
  const remainingMask = createFullBlockMask(level.blocks.length) &
    ~blockMask(firstBlockIndex);
  const tray: DogPatternType[] = [];
  insertPatternIntoTray(tray, level.blocks[firstBlockIndex].patternType);
  const firstBlockId = level.blocks[firstBlockIndex].id;
  if (tray.length >= 7 && remainingMask !== 0n) {
    return createSolvabilityResult(
      "unsolvable",
      [firstBlockId],
      tray.length,
      "solvable path fills the seven-slot tray before clearing the board",
    );
  }

  const higherBlockCounts = [...graph.higherBlockCounts];
  higherBlockCounts[firstBlockIndex] = 0;
  for (const lowerIndex of graph.lowerBlockIndicesByHigher[firstBlockIndex]) {
    higherBlockCounts[lowerIndex] -= 1;
  }

  const preferredRank = createPreferredRank(solutionPath, graph);
  const greedyResult = findGreedyContinuation(
    level,
    graph,
    remainingMask,
    higherBlockCounts,
    tray,
    preferredRank,
    [firstBlockId],
    1,
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
    preferredRank,
    {
      completedStates,
      branchAttempts: 0,
      branchBudget: resolveBranchBudget(options),
    },
    [firstBlockId],
    1,
  );
}

interface SolvabilitySearchContext {
  readonly completedStates: Map<string, SolvabilityMemoEntry>;
  readonly branchBudget: number;
  branchAttempts: number;
}

interface SolvabilityMemoEntry {
  readonly status: "solvable" | "unsolvable";
  readonly path: readonly string[];
  readonly trayPeakPressure: number;
}

function searchSolvableContinuation(
  level: DogLevelGeometry,
  graph: BlockGraph,
  remainingMask: bigint,
  higherBlockCounts: readonly number[],
  tray: readonly DogPatternType[],
  preferredRank: ReadonlyMap<number, number>,
  context: SolvabilitySearchContext,
  path: readonly string[],
  pathDepth: number,
): SolvabilityResult {
  if (remainingMask === 0n) {
    context.completedStates.set(stateKeyFor(remainingMask, tray), {
      status: "solvable",
      path: [],
      trayPeakPressure: tray.length,
    });
    return createSolvabilityResult("solvable", path, tray.length);
  }

  if (pathDepth >= level.blocks.length) {
    return createSolvabilityResult(
      "unsolvable",
      path,
      tray.length,
      "solvable path exceeded available block depth",
    );
  }

  const stateKey = stateKeyFor(remainingMask, tray);
  const completedState = context.completedStates.get(stateKey);
  if (completedState !== undefined) {
    if (completedState.status === "solvable") {
      return createSolvabilityResult(
        "solvable",
        [...path, ...completedState.path],
        Math.max(tray.length, completedState.trayPeakPressure),
      );
    }

    return createSolvabilityResult(
      "unsolvable",
      path,
      tray.length,
      "solvable continuation repeats a proven failed state",
    );
  }

  const selectable = getSelectableBlocks(level, remainingMask, higherBlockCounts);

  if (selectable.length === 0) {
    context.completedStates.set(stateKey, {
      status: "unsolvable",
      path: [],
      trayPeakPressure: tray.length,
    });
    return createSolvabilityResult(
      "unsolvable",
      path,
      tray.length,
      "solvable continuation has no selectable block",
    );
  }

  sortSelectableBlocks(selectable, level, tray, preferredRank);

  let trayPeakPressure = tray.length;
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
    const nextRemainingMask = remainingMask & ~blockMask(selectedIndex);
    const nextTray = [...tray];
    insertPatternIntoTray(nextTray, level.blocks[selectedIndex].patternType);
    trayPeakPressure = Math.max(trayPeakPressure, nextTray.length);
    if (nextTray.length >= 7 && nextRemainingMask !== 0n) {
      continue;
    }

    const nextHigherBlockCounts = [...higherBlockCounts];
    for (const lowerIndex of graph.lowerBlockIndicesByHigher[selectedIndex]) {
      nextHigherBlockCounts[lowerIndex] -= 1;
    }
    const result = searchSolvableContinuation(
      level,
      graph,
      nextRemainingMask,
      nextHigherBlockCounts,
      nextTray,
      preferredRank,
      context,
      [...path, level.blocks[selectedIndex].id],
      pathDepth + 1,
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

function createPreferredRank(
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

function findGreedyContinuation(
  level: DogLevelGeometry,
  graph: BlockGraph,
  initialRemainingMask: bigint,
  initialHigherBlockCounts: readonly number[],
  initialTray: readonly DogPatternType[],
  preferredRank: ReadonlyMap<number, number>,
  initialPath: readonly string[],
  initialPathDepth: number,
): SolvabilityResult | undefined {
  let remainingMask = initialRemainingMask;
  const higherBlockCounts = [...initialHigherBlockCounts];
  const tray = [...initialTray];
  const path = [...initialPath];
  let pathDepth = initialPathDepth;
  let trayPeakPressure = tray.length;

  while (remainingMask !== 0n) {
    if (pathDepth >= level.blocks.length) {
      return undefined;
    }

    const selectable = getSelectableBlocks(level, remainingMask, higherBlockCounts);
    if (selectable.length === 0) {
      return undefined;
    }
    sortSelectableBlocks(selectable, level, tray, preferredRank);

    const selectedIndex = selectable[0];
    remainingMask &= ~blockMask(selectedIndex);
    insertPatternIntoTray(tray, level.blocks[selectedIndex].patternType);
    trayPeakPressure = Math.max(trayPeakPressure, tray.length);
    path.push(level.blocks[selectedIndex].id);
    pathDepth += 1;
    if (tray.length >= 7 && remainingMask !== 0n) {
      return undefined;
    }

    for (const lowerIndex of graph.lowerBlockIndicesByHigher[selectedIndex]) {
      higherBlockCounts[lowerIndex] -= 1;
    }
  }

  return createSolvabilityResult("solvable", path, trayPeakPressure);
}

function getSelectableBlocks(
  level: DogLevelGeometry,
  remainingMask: bigint,
  higherBlockCounts: readonly number[],
): number[] {
  const selectable: number[] = [];
  for (let index = 0; index < level.blocks.length; index += 1) {
    if (
      (remainingMask & blockMask(index)) !== 0n &&
      higherBlockCounts[index] === 0
    ) {
      selectable.push(index);
    }
  }
  return selectable;
}

function sortSelectableBlocks(
  selectable: number[],
  level: DogLevelGeometry,
  tray: readonly DogPatternType[],
  preferredRank: ReadonlyMap<number, number>,
): void {
  selectable.sort((firstIndex, secondIndex) => {
    const firstRank = preferredRank.get(firstIndex) ?? Number.MAX_SAFE_INTEGER;
    const secondRank = preferredRank.get(secondIndex) ?? Number.MAX_SAFE_INTEGER;
    const firstMatches = tray.filter(
      (patternType) => patternType === level.blocks[firstIndex].patternType,
    ).length;
    const secondMatches = tray.filter(
      (patternType) => patternType === level.blocks[secondIndex].patternType,
    ).length;
    return (
      secondMatches - firstMatches ||
      firstRank - secondRank ||
      level.blocks[secondIndex].z - level.blocks[firstIndex].z ||
      level.blocks[firstIndex].id.localeCompare(level.blocks[secondIndex].id)
    );
  });
}

function stateKeyFor(
  remainingMask: bigint,
  tray: readonly DogPatternType[],
): string {
  return `${remainingMask.toString(36)}:${[...tray].sort().join(",")}`;
}

function trayPeakPressureForPath(
  level: DogLevelGeometry,
  initialTray: readonly DogPatternType[],
  path: readonly string[],
  graph: BlockGraph,
): number {
  const tray = [...initialTray];
  let trayPeakPressure = tray.length;
  for (const blockId of path) {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex === undefined) {
      return trayPeakPressure;
    }

    insertPatternIntoTray(tray, level.blocks[blockIndex].patternType);
    trayPeakPressure = Math.max(trayPeakPressure, tray.length);
  }

  return trayPeakPressure;
}

export function resolveBranchBudget(options: SolvabilitySearchOptions): number {
  if (options.branchBudget === undefined) {
    return MAX_SOLVABILITY_SEARCH_BRANCHES;
  }

  if (!Number.isSafeInteger(options.branchBudget) || options.branchBudget < 0) {
    throw new Error("solvability search branch budget must be a non-negative integer");
  }

  return options.branchBudget;
}

function createPathVerification(
  status: Exclude<DogSolvabilityStatus, "budget-exhausted">,
  path: readonly string[],
  trayPeakPressure: number,
  reason?: string,
): PathVerification {
  return {
    status,
    solvable: status === "solvable",
    path,
    trayPeakPressure,
    reason,
  };
}

function createSolvabilityResult(
  status: DogSolvabilityStatus,
  path: readonly string[],
  trayPeakPressure: number,
  reason?: string,
): SolvabilityResult {
  return {
    status,
    path,
    trayPeakPressure,
    reason,
  };
}

function toSolvabilityResult(verification: PathVerification): SolvabilityResult {
  return createSolvabilityResult(
    verification.status,
    [...verification.path],
    verification.trayPeakPressure,
    verification.reason,
  );
}

function normalizeSolvabilityResult(
  level: DogLevelGeometry,
  result: SolvabilityResult,
): SolvabilityResult {
  const graph = createBlockGraph(level.blocks);
  return {
    ...result,
    trayPeakPressure: trayPeakPressureForPath(level, [], result.path, graph),
  };
}

function createFullBlockMask(blockCount: number): bigint {
  return (1n << BigInt(blockCount)) - 1n;
}

function blockMask(blockIndex: number): bigint {
  return 1n << BigInt(blockIndex);
}
