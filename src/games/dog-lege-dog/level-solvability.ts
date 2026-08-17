import { insertPatternIntoTray } from "./level-rules";
import { createBlockGraph, type BlockGraph } from "./level-graph";
import type { DogLevelGeometry, DogPatternType } from "./level-types";

const MAX_SOLVABILITY_SEARCH_STATES = 16;

export interface PathVerification {
  readonly solvable: boolean;
  readonly path: readonly string[];
  readonly trayPeakPressure: number;
  readonly reason?: string;
}

export function findSolvablePath(
  level: DogLevelGeometry & { readonly solutionPath?: readonly string[] },
): readonly string[] | null {
  if (level.solutionPath !== undefined && level.solutionPath.length > 0) {
    const storedVerification = verifyRemovalPath(level, level.solutionPath);
    if (storedVerification.solvable) {
      return [...level.solutionPath];
    }
  }

  const descendingPath = [...level.blocks]
    .sort((first, second) => second.z - first.z || first.id.localeCompare(second.id))
    .map((block) => block.id);
  const descendingVerification = verifyRemovalPath(level, descendingPath);
  if (descendingVerification.solvable) {
    return descendingPath;
  }

  return findGreedySolvablePath(level);
}

export function isLevelSolvable(level: DogLevelGeometry): boolean {
  return findSolvablePath(level) !== null;
}

export function verifyRemovalPath(
  level: DogLevelGeometry,
  path: readonly string[],
  knownGraph?: BlockGraph,
): PathVerification {
  if (path.length !== level.blocks.length) {
    return {
      solvable: false,
      path,
      trayPeakPressure: 0,
      reason: "solvable path must contain every block exactly once",
    };
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
      return {
        solvable: false,
        path,
        trayPeakPressure,
        reason: `solvable path contains duplicate or unknown block ${blockId}`,
      };
    }

    if (!remaining.has(blockIndex)) {
      return {
        solvable: false,
        path,
        trayPeakPressure,
        reason: `solvable path removes block ${blockId} more than once`,
      };
    }

    if (higherBlockCounts[blockIndex] !== 0) {
      return {
        solvable: false,
        path,
        trayPeakPressure,
        reason: `solvable path selects blocked block ${blockId}`,
      };
    }

    seen.add(blockIndex);
    remaining.delete(blockIndex);
    for (const lowerIndex of graph.lowerBlockIndicesByHigher[blockIndex]) {
      higherBlockCounts[lowerIndex] -= 1;
    }

    insertPatternIntoTray(tray, level.blocks[blockIndex].patternType);
    trayPeakPressure = Math.max(trayPeakPressure, tray.length);
    if (tray.length >= 7 && remaining.size > 0) {
      return {
        solvable: false,
        path,
        trayPeakPressure,
        reason: "solvable path fills the seven-slot tray before clearing the board",
      };
    }
  }

  return {
    solvable: remaining.size === 0,
    path,
    trayPeakPressure,
    reason: remaining.size === 0 ? undefined : "solvable path leaves blocks behind",
  };
}

export function countSafeChoices(
  level: DogLevelGeometry,
  solutionPath: readonly string[],
  graph: BlockGraph,
): number {
  if (solutionPath.length !== level.blocks.length) {
    return 0;
  }

  let safeChoices = 0;
  for (let index = 0; index < level.blocks.length; index += 1) {
    if (graph.higherBlockCounts[index] !== 0) {
      continue;
    }

    const blockId = level.blocks[index].id;
    const candidatePath = [
      blockId,
      ...solutionPath.filter((pathBlockId) => pathBlockId !== blockId),
    ];
    if (
      verifyRemovalPath(level, candidatePath, graph).solvable ||
      hasSolvableContinuation(level, solutionPath, graph, index)
    ) {
      safeChoices += 1;
    }
  }

  return safeChoices;
}

function hasSolvableContinuation(
  level: DogLevelGeometry,
  solutionPath: readonly string[],
  graph: BlockGraph,
  firstBlockIndex: number,
): boolean {
  const remainingMask = createFullBlockMask(level.blocks.length) &
    ~blockMask(firstBlockIndex);
  const tray: DogPatternType[] = [];
  insertPatternIntoTray(tray, level.blocks[firstBlockIndex].patternType);
  if (tray.length >= 7 && remainingMask !== 0n) {
    return false;
  }

  const higherBlockCounts = [...graph.higherBlockCounts];
  higherBlockCounts[firstBlockIndex] = 0;
  for (const lowerIndex of graph.lowerBlockIndicesByHigher[firstBlockIndex]) {
    higherBlockCounts[lowerIndex] -= 1;
  }

  const preferredRank = new Map<number, number>();
  solutionPath.forEach((blockId, rank) => {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex !== undefined) {
      preferredRank.set(blockIndex, rank);
    }
  });

  return searchSolvableContinuation(
    level,
    graph,
    remainingMask,
    higherBlockCounts,
    tray,
    preferredRank,
    {
      failedStates: new Set<string>(),
      visitedStates: 0,
    },
  );
}

interface SolvabilitySearchContext {
  readonly failedStates: Set<string>;
  visitedStates: number;
}

function searchSolvableContinuation(
  level: DogLevelGeometry,
  graph: BlockGraph,
  remainingMask: bigint,
  higherBlockCounts: readonly number[],
  tray: readonly DogPatternType[],
  preferredRank: ReadonlyMap<number, number>,
  context: SolvabilitySearchContext,
): boolean {
  if (remainingMask === 0n) {
    return true;
  }

  const stateKey = `${remainingMask.toString(36)}:${tray.join(",")}`;
  if (context.failedStates.has(stateKey)) {
    return false;
  }
  context.visitedStates += 1;
  if (context.visitedStates > MAX_SOLVABILITY_SEARCH_STATES) {
    return false;
  }

  const selectable: number[] = [];
  for (let index = 0; index < level.blocks.length; index += 1) {
    if (
      (remainingMask & blockMask(index)) !== 0n &&
      higherBlockCounts[index] === 0
    ) {
      selectable.push(index);
    }
  }

  selectable.sort((firstIndex, secondIndex) => {
    const firstRank = preferredRank.get(firstIndex) ?? Number.MAX_SAFE_INTEGER;
    const secondRank = preferredRank.get(secondIndex) ?? Number.MAX_SAFE_INTEGER;
    if (firstRank !== secondRank) {
      return firstRank - secondRank;
    }

    const firstMatches = tray.filter(
      (patternType) => patternType === level.blocks[firstIndex].patternType,
    ).length;
    const secondMatches = tray.filter(
      (patternType) => patternType === level.blocks[secondIndex].patternType,
    ).length;
    return secondMatches - firstMatches || level.blocks[secondIndex].z - level.blocks[firstIndex].z;
  });

  for (const selectedIndex of selectable) {
    const nextRemainingMask = remainingMask & ~blockMask(selectedIndex);
    const nextTray = [...tray];
    insertPatternIntoTray(nextTray, level.blocks[selectedIndex].patternType);
    if (nextTray.length >= 7 && nextRemainingMask !== 0n) {
      continue;
    }

    const nextHigherBlockCounts = [...higherBlockCounts];
    for (const lowerIndex of graph.lowerBlockIndicesByHigher[selectedIndex]) {
      nextHigherBlockCounts[lowerIndex] -= 1;
    }
    if (
      searchSolvableContinuation(
        level,
        graph,
        nextRemainingMask,
        nextHigherBlockCounts,
        nextTray,
        preferredRank,
        context,
      )
    ) {
      return true;
    }
  }

  context.failedStates.add(stateKey);
  return false;
}

function createFullBlockMask(blockCount: number): bigint {
  return (1n << BigInt(blockCount)) - 1n;
}

function blockMask(blockIndex: number): bigint {
  return 1n << BigInt(blockIndex);
}

function findGreedySolvablePath(
  level: DogLevelGeometry & { readonly solutionPath?: readonly string[] },
): readonly string[] | null {
  const graph = createBlockGraph(level.blocks);
  const remaining = new Set(level.blocks.map((_, index) => index));
  const higherBlockCounts = [...graph.higherBlockCounts];
  const tray: DogPatternType[] = [];
  const path: string[] = [];

  while (remaining.size > 0) {
    const selectable = [...remaining].filter((index) => higherBlockCounts[index] === 0);
    if (selectable.length === 0) {
      return null;
    }

    selectable.sort((firstIndex, secondIndex) => {
      const firstMatches = tray.filter(
        (patternType) => patternType === level.blocks[firstIndex].patternType,
      ).length;
      const secondMatches = tray.filter(
        (patternType) => patternType === level.blocks[secondIndex].patternType,
      ).length;
      return secondMatches - firstMatches || level.blocks[firstIndex].z - level.blocks[secondIndex].z;
    });

    const selectedIndex = selectable[0];
    remaining.delete(selectedIndex);
    for (const lowerIndex of graph.lowerBlockIndicesByHigher[selectedIndex]) {
      higherBlockCounts[lowerIndex] -= 1;
    }
    insertPatternIntoTray(tray, level.blocks[selectedIndex].patternType);
    if (tray.length >= 7 && remaining.size > 0) {
      return null;
    }
    path.push(level.blocks[selectedIndex].id);
  }

  return path;
}
