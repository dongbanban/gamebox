import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  type DogBlock,
  type DogPatternType,
} from "@/games/dog-lege-dog/levels/level-types";
import { createPlacementGraph } from "@/games/dog-lege-dog/levels/level-graph";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import type {
  BlockPlacement,
  RemovalPathPlan,
  SolvableBlocksOptions,
} from "@/games/dog-lege-dog/levels/level-placement-contracts";

export function createSolvableBlocks(
  placements: readonly BlockPlacement[],
  patternTypes: readonly DogPatternType[],
  levelNumber: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
  options: SolvableBlocksOptions = {},
): {
  readonly blocks: readonly DogBlock[];
  readonly solutionPath: readonly string[];
  readonly twinBlockIndices: ReadonlySet<number>;
} {
  const patternByBlock = new Array<DogPatternType>(placements.length);
  const blockOrder = removalPlan.order;
  const twinCount = options.twinCount ?? 0;
  const logicalBlockCount = options.logicalBlockCount ?? placements.length;
  const twinBlockIndices = createTwinBlockIndices(
    blockOrder,
    placements,
    logicalBlockCount,
    twinCount,
    random,
  );
  const groupCount = logicalBlockCount / 3;
  const patternSequence = createSolvablePatternSequence(patternTypes, groupCount, random);

  let logicalPatternIndex = 0;
  for (let pathIndex = 0; pathIndex < blockOrder.length; pathIndex += 1) {
    const blockIndex = blockOrder[pathIndex];
    const patternType = patternSequence[logicalPatternIndex];
    if (patternType === undefined) {
      throw new Error("LevelGenerator pattern sequence is incomplete");
    }
    patternByBlock[blockIndex] = patternType;
    logicalPatternIndex += twinBlockIndices.has(blockIndex) ? 2 : 1;
  }
  if (logicalPatternIndex !== logicalBlockCount) {
    throw new Error("LevelGenerator logical pattern quota is invalid");
  }

  const blocks: DogBlock[] = placements.map((placement, index) => ({
    id: `level-${levelNumber}-block-${index + 1}`,
    x: placement.x,
    y: placement.y,
    z: placement.z,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    rotation: 0 as const,
    patternType: patternByBlock[index],
  }));

  return {
    blocks,
    solutionPath: blockOrder.map((index) => blocks[index].id),
    twinBlockIndices,
  };
}

function createTwinBlockIndices(
  blockOrder: readonly number[],
  placements: readonly BlockPlacement[],
  logicalBlockCount: number,
  twinCount: number,
  random: SeededRandom,
): ReadonlySet<number> {
  if (
    !Number.isSafeInteger(logicalBlockCount) ||
    logicalBlockCount <= 0 ||
    logicalBlockCount % 3 !== 0 ||
    !Number.isSafeInteger(twinCount) ||
    twinCount < 0 ||
    twinCount > Math.floor(logicalBlockCount / 3) ||
    blockOrder.length + twinCount !== logicalBlockCount
  ) {
    throw new Error("LevelGenerator twin logical-unit quota is invalid");
  }

  const groupCount = logicalBlockCount / 3;
  const memo = new Set<string>();
  const twinBlockIndices = new Set<number>();
  const maxLayerIndex = Math.max(1, ...placements.map((placement) => placement.z));

  const assignGroups = (
    groupIndex: number,
    physicalCursor: number,
    twinsLeft: number,
  ): boolean => {
    if (groupIndex === groupCount) {
      return physicalCursor === blockOrder.length && twinsLeft === 0;
    }
    if (twinsLeft < 0 || twinsLeft > groupCount - groupIndex) {
      return false;
    }

    const stateKey = `${groupIndex}:${physicalCursor}:${twinsLeft}`;
    if (memo.has(stateKey)) {
      return false;
    }
    memo.add(stateKey);

    const firstBlockIndex = blockOrder[physicalCursor];
    const firstPlacement = firstBlockIndex === undefined
      ? undefined
      : placements[firstBlockIndex];
    const canUseTwin = twinsLeft > 0 &&
      firstBlockIndex !== undefined &&
      firstPlacement !== undefined &&
      firstPlacement.z > 0;
    const options = random.shuffle(canUseTwin ? [true, false] : [false]);
    for (const groupHasTwin of options) {
      const nextCursor = physicalCursor + (groupHasTwin ? 2 : 3);
      if (nextCursor > blockOrder.length) {
        continue;
      }
      if (groupHasTwin && firstBlockIndex !== undefined) {
        twinBlockIndices.add(firstBlockIndex);
      }
      if (assignGroups(
        groupIndex + 1,
        nextCursor,
        twinsLeft - (groupHasTwin ? 1 : 0),
      )) {
        return true;
      }
      if (groupHasTwin && firstBlockIndex !== undefined) {
        twinBlockIndices.delete(firstBlockIndex);
      }
    }
    return false;
  };

  if (assignGroups(0, 0, twinCount)) {
    return twinBlockIndices;
  }
  throw new Error(
    `LevelGenerator twin placement has no high-layer capacity across ${maxLayerIndex + 1} layers`,
  );
}

export function createRemovalOrder(
  placements: readonly BlockPlacement[],
  random: SeededRandom,
  preferredOrder?: readonly number[],
): readonly number[] {
  const graph = createPlacementGraph(placements, BLOCK_WIDTH, BLOCK_HEIGHT);
  const higherBlockCounts = [...graph.higherBlockCounts];
  const remaining = new Set(placements.map((_, index) => index));
  const ready = higherBlockCounts
    .map((count, index) => (count === 0 ? index : -1))
    .filter((index) => index >= 0);
  const newlyRevealed: number[] = [];
  const order: number[] = [];
  const preferredRank = preferredOrder === undefined
    ? undefined
    : new Map(preferredOrder.map((blockIndex, rank) => [blockIndex, rank]));

  while (remaining.size > 0) {
    let selectedIndex = takeNextRemovalCandidate(newlyRevealed, random, preferredRank);
    if (selectedIndex === undefined) {
      selectedIndex = takeNextRemovalCandidate(ready, random, preferredRank);
    }
    if (selectedIndex === undefined || !remaining.has(selectedIndex)) {
      throw new Error("LevelGenerator could not construct a legal removal path");
    }

    remaining.delete(selectedIndex);
    const readyIndex = ready.indexOf(selectedIndex);
    if (readyIndex >= 0) {
      ready.splice(readyIndex, 1);
    }
    order.push(selectedIndex);

    for (const lowerIndex of graph.lowerBlockIndicesByHigher[selectedIndex]) {
      higherBlockCounts[lowerIndex] -= 1;
      if (higherBlockCounts[lowerIndex] === 0) {
        ready.push(lowerIndex);
        newlyRevealed.push(lowerIndex);
      }
    }
  }

  return order;
}

function takeNextRemovalCandidate(
  candidates: number[],
  random: SeededRandom,
  preferredRank?: ReadonlyMap<number, number>,
): number | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  let eligible = candidates;
  if (preferredRank !== undefined) {
    const minimumRank = Math.min(
      ...candidates.map((candidate) => preferredRank.get(candidate) ?? Number.MAX_SAFE_INTEGER),
    );
    eligible = candidates.filter(
      (candidate) => (preferredRank.get(candidate) ?? Number.MAX_SAFE_INTEGER) === minimumRank,
    );
  }
  const selectedPosition = random.nextInt(eligible.length);
  const selectedIndex = eligible[selectedPosition];
  if (selectedIndex === undefined) {
    return undefined;
  }

  const candidatePosition = candidates.indexOf(selectedIndex);
  candidates.splice(candidatePosition, 1);
  return selectedIndex;
}

function createSolvablePatternSequence(
  patternTypes: readonly DogPatternType[],
  groupCount: number,
  random: SeededRandom,
): readonly DogPatternType[] {
  const groupPatterns = random.shuffle(Array.from(
    { length: groupCount },
    (_, index) => patternTypes[index % patternTypes.length],
  ));

  // Tray order is click order. Every solution group stays contiguous.
  return groupPatterns.flatMap((patternType) => [patternType, patternType, patternType]);
}
