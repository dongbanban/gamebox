import {
  isDogTrayBlockMatchable,
  insertDogBlockIntoTray,
} from "@/games/dog-lege-dog/levels/level-rules";
import { createBlockGraph, type BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import {
  createDogSpecialMechanismHandlerMap,
  DOG_SPECIAL_MECHANISM_HANDLERS,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  DogLevelGeometry,
  DogSafeChoiceSearchStatus,
  DogSpecialMechanismHandler,
  DogSolvabilityStatus,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";

export const MAX_SOLVABILITY_SEARCH_BRANCHES = 16 as const;
const DEFAULT_SPECIAL_MECHANISM_HANDLER_MAP = createDogSpecialMechanismHandlerMap();

export interface SolvabilitySearchOptions {
  readonly branchBudget?: number;
  readonly specialMechanismHandlers?: readonly DogSpecialMechanismHandler[];
}

export interface SolvabilityStateOptions extends SolvabilitySearchOptions {
  readonly remainingBlockIds: readonly string[];
  readonly initialTray: readonly DogTrayBlock[];
  readonly trayCapacity?: number;
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
  const handlers = createDogSpecialMechanismHandlerMap(
    options.specialMechanismHandlers ?? DOG_SPECIAL_MECHANISM_HANDLERS,
  );
  const storedPath = level.solutionPath;
  if (storedPath !== undefined && storedPath.length > 0) {
    const storedVerification = verifyRemovalPath(level, storedPath, undefined, handlers);
    if (storedVerification.solvable) {
      return toSolvabilityResult(storedVerification);
    }
  }

  const descendingPath = [...level.blocks]
    .sort((first, second) => second.z - first.z || first.id.localeCompare(second.id))
    .map((block) => block.id);
  const descendingVerification = verifyRemovalPath(level, descendingPath, undefined, handlers);
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
      completedStates: new Map<string, SolvabilityMemoEntry>(),
      branchAttempts: 0,
      branchBudget: resolveBranchBudget(options),
    },
    [],
    0,
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
  const trayCapacity = resolveTrayCapacity(options.trayCapacity);
  const graph = createBlockGraph(level.blocks);
  const remainingIds = new Set(options.remainingBlockIds);
  if (remainingIds.size !== options.remainingBlockIds.length) {
    return createSolvabilityResult(
      "unsolvable",
      [],
      options.initialTray.length,
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
      options.initialTray.length,
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
      options.initialTray.length,
      "solvability state contains inconsistent layer counts",
    );
  }

  const tray = cloneTray(options.initialTray);
  if (tray.length >= trayCapacity && remainingMask !== 0n) {
    return createSolvabilityResult(
      "unsolvable",
      [],
      tray.length,
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
      completedStates: new Map<string, SolvabilityMemoEntry>(),
      branchAttempts: 0,
      branchBudget: resolveBranchBudget(options),
    },
    [],
    0,
    trayCapacity,
  );
}

export function verifyRemovalPath(
  level: DogLevelGeometry,
  path: readonly string[],
  knownGraph?: BlockGraph,
  specialMechanismHandlers: ReadonlyMap<string, DogSpecialMechanismHandler> =
    DEFAULT_SPECIAL_MECHANISM_HANDLER_MAP,
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
  const tray: DogTrayBlock[] = [];
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

    insertDogBlockIntoTray(
      tray,
      toTrayBlock(level.blocks[blockIndex]),
      specialMechanismHandlers,
    );
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

  if (remaining.size !== 0) {
    return createPathVerification(
      "unsolvable",
      path,
      trayPeakPressure,
      "solvable path leaves blocks behind",
    );
  }

  if (tray.some((block) => block.specialMechanism !== undefined)) {
    return createPathVerification(
      "unsolvable",
      path,
      trayPeakPressure,
      "solvable path leaves frozen blocks before natural melting",
    );
  }

  return createPathVerification("solvable", path, trayPeakPressure);
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
      handlers,
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
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): SolvabilityResult {
  const remainingMask = createFullBlockMask(level.blocks.length) &
    ~blockMask(firstBlockIndex);
  const tray: DogTrayBlock[] = [];
  insertDogBlockIntoTray(
    tray,
    toTrayBlock(level.blocks[firstBlockIndex]),
    handlers,
  );
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
    handlers,
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
    handlers,
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
  tray: readonly DogTrayBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  preferredRank: ReadonlyMap<number, number>,
  context: SolvabilitySearchContext,
  path: readonly string[],
  pathDepth: number,
  trayCapacity = 7,
): SolvabilityResult {
  if (remainingMask === 0n) {
    if (tray.some((block) => block.specialMechanism !== undefined)) {
      return createSolvabilityResult(
        "unsolvable",
        path,
        tray.length,
        "solvable continuation leaves frozen blocks before natural melting",
      );
    }
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

  sortSelectableBlocks(selectable, level, tray, handlers, preferredRank);

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
    insertDogBlockIntoTray(
      nextTray,
      toTrayBlock(level.blocks[selectedIndex]),
      handlers,
    );
    trayPeakPressure = Math.max(trayPeakPressure, nextTray.length);
    if (nextTray.length >= trayCapacity && nextRemainingMask !== 0n) {
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
      handlers,
      preferredRank,
      context,
      [...path, level.blocks[selectedIndex].id],
      pathDepth + 1,
      trayCapacity,
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
  initialTray: readonly DogTrayBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  preferredRank: ReadonlyMap<number, number>,
  initialPath: readonly string[],
  initialPathDepth: number,
  trayCapacity = 7,
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
    sortSelectableBlocks(selectable, level, tray, handlers, preferredRank);

    const selectedIndex = selectable[0];
    remainingMask &= ~blockMask(selectedIndex);
    insertDogBlockIntoTray(
      tray,
      toTrayBlock(level.blocks[selectedIndex]),
      handlers,
    );
    trayPeakPressure = Math.max(trayPeakPressure, tray.length);
    path.push(level.blocks[selectedIndex].id);
    pathDepth += 1;
    if (tray.length >= trayCapacity && remainingMask !== 0n) {
      return undefined;
    }

    for (const lowerIndex of graph.lowerBlockIndicesByHigher[selectedIndex]) {
      higherBlockCounts[lowerIndex] -= 1;
    }
  }

  if (tray.some((block) => block.specialMechanism !== undefined)) {
    return undefined;
  }

  return createSolvabilityResult("solvable", path, trayPeakPressure);
}

function verifyStateContinuation(
  level: DogLevelGeometry,
  graph: BlockGraph,
  initialRemainingMask: bigint,
  initialHigherBlockCounts: readonly number[],
  initialTray: readonly DogTrayBlock[],
  path: readonly string[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  trayCapacity: number,
): SolvabilityResult | undefined {
  let remainingMask = initialRemainingMask;
  const higherBlockCounts = [...initialHigherBlockCounts];
  const tray = cloneTray(initialTray);
  let trayPeakPressure = tray.length;

  for (const blockId of path) {
    const blockIndex = graph.indexById.get(blockId);
    if (
      blockIndex === undefined ||
      (remainingMask & blockMask(blockIndex)) === 0n ||
      higherBlockCounts[blockIndex] !== 0
    ) {
      return undefined;
    }

    remainingMask &= ~blockMask(blockIndex);
    insertDogBlockIntoTray(tray, toTrayBlock(level.blocks[blockIndex]), handlers);
    trayPeakPressure = Math.max(trayPeakPressure, tray.length);
    if (tray.length >= trayCapacity && remainingMask !== 0n) {
      return undefined;
    }
    for (const lowerIndex of graph.lowerBlockIndicesByHigher[blockIndex]) {
      higherBlockCounts[lowerIndex] -= 1;
    }
  }

  if (remainingMask !== 0n || tray.some((block) => block.specialMechanism !== undefined)) {
    return undefined;
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
  tray: readonly DogTrayBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  preferredRank: ReadonlyMap<number, number>,
): void {
  selectable.sort((firstIndex, secondIndex) => {
    const firstRank = preferredRank.get(firstIndex) ?? Number.MAX_SAFE_INTEGER;
    const secondRank = preferredRank.get(secondIndex) ?? Number.MAX_SAFE_INTEGER;
    const firstMatches = getTrailingMatchCount(
      tray,
      level.blocks[firstIndex].patternType,
      handlers,
    );
    const secondMatches = getTrailingMatchCount(
      tray,
      level.blocks[secondIndex].patternType,
      handlers,
    );
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
  tray: readonly DogTrayBlock[],
): string {
  return `${remainingMask.toString(36)}:${tray
    .map((block) => block.specialMechanism === undefined
      ? `ordinary:${block.patternType}`
      : `${block.id}:${block.patternType}:${serializeMechanism(block)}`)
    .join(",")}`;
}

function getTrailingMatchCount(
  tray: readonly DogTrayBlock[],
  patternType: DogTrayBlock["patternType"],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): number {
  let matchCount = 0;
  for (let index = tray.length - 1; index >= 0; index -= 1) {
    const block = tray[index];
    if (
      block === undefined ||
      block.patternType !== patternType ||
      !isDogTrayBlockMatchable(block, handlers)
    ) {
      break;
    }
    matchCount += 1;
  }
  return matchCount;
}

function trayPeakPressureForPath(
  level: DogLevelGeometry,
  initialTray: readonly DogTrayBlock[],
  path: readonly string[],
  graph: BlockGraph,
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): number {
  const tray = [...initialTray];
  let trayPeakPressure = tray.length;
  for (const blockId of path) {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex === undefined) {
      return trayPeakPressure;
    }

    insertDogBlockIntoTray(
      tray,
      toTrayBlock(level.blocks[blockIndex]),
      handlers,
    );
    trayPeakPressure = Math.max(trayPeakPressure, tray.length);
  }

  return trayPeakPressure;
}

function toTrayBlock(block: DogLevelGeometry["blocks"][number]): DogTrayBlock {
  return {
    id: block.id,
    patternType: block.patternType,
    ...(block.specialMechanism === undefined
      ? {}
      : { specialMechanism: block.specialMechanism }),
  };
}

function cloneTray(tray: readonly DogTrayBlock[]): DogTrayBlock[] {
  return tray.map((block) => ({
    ...block,
    ...(block.specialMechanism === undefined
      ? {}
      : { specialMechanism: { ...block.specialMechanism, state: { ...block.specialMechanism.state } } }),
  }));
}

function serializeMechanism(block: DogTrayBlock): string {
  if (block.specialMechanism === undefined) {
    return "ordinary";
  }

  return [
    block.specialMechanism.type,
    ...Object.entries(block.specialMechanism.state)
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
      .map(([key, value]) => `${key}=${String(value)}`),
  ].join(";");
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

function resolveTrayCapacity(value: number | undefined): number {
  if (value === undefined) {
    return 7;
  }

  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("solvability tray capacity must be a positive integer");
  }

  return value;
}

function countBits(value: bigint): number {
  let remaining = value;
  let count = 0;
  while (remaining !== 0n) {
    remaining &= remaining - 1n;
    count += 1;
  }
  return count;
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
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): SolvabilityResult {
  const graph = createBlockGraph(level.blocks);
  return {
    ...result,
    trayPeakPressure: trayPeakPressureForPath(level, [], result.path, graph, handlers),
  };
}

function createFullBlockMask(blockCount: number): bigint {
  return (1n << BigInt(blockCount)) - 1n;
}

function blockMask(blockIndex: number): bigint {
  return 1n << BigInt(blockIndex);
}
