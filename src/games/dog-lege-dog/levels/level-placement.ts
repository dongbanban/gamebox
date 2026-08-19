import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_PATTERN_TYPES,
  type DogBlock,
  type DogBoard,
  type DogPatternType,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  FIRST_LEVEL_BLOCK_COUNT,
  FIRST_LEVEL_MAX_LAYERS,
} from "@/games/dog-lege-dog/game/game-config";
import { getPositiveOverlapArea, hasPositiveAreaOverlap } from "@/games/dog-lege-dog/levels/level-rules";
import { getPatternTypeCount } from "@/games/dog-lege-dog/levels/level-progression";
import { createPlacementGraph } from "@/games/dog-lege-dog/levels/level-graph";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import type { DogShapeTemplate } from "@/games/dog-lege-dog/levels/level-shapes";

const MAX_BLOCKS_PER_LOWER_BLOCK = 4;
const LAYER_OFFSETS = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 2 },
  { x: 0, y: 2 },
] as const;

const CORNER_REGIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

type PlacementRegion = "center" | (typeof CORNER_REGIONS)[number] | "edge";

export interface BlockPlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RemovalPathPlan {
  readonly order: readonly number[];
  readonly layerByBlock: readonly number[];
}

export function validateSpatialDistribution(
  board: DogBoard,
  blocks: readonly DogBlock[],
): string | undefined {
  const counts = new Map<PlacementRegion, number>();
  for (const block of blocks) {
    const region = getPlacementRegion(block, board.width, board.height);
    counts.set(region, (counts.get(region) ?? 0) + 1);
  }

  const centerCount = counts.get("center") ?? 0;
  if (centerCount <= blocks.length / 2) {
    return "LevelGenerator center region must contain most blocks";
  }

  for (const region of CORNER_REGIONS) {
    if ((counts.get(region) ?? 0) === 0) {
      return `LevelGenerator ${region} region is empty`;
    }
  }

  for (const region of ["center", ...CORNER_REGIONS, "edge"] as const) {
    const regionBlocks = blocks.filter(
      (block) => getPlacementRegion(block, board.width, board.height) === region,
    );
    if (
      regionBlocks.length > 0 &&
      !hasCrossLayerOverlap(regionBlocks)
    ) {
      return `LevelGenerator ${region} region has no cross-layer overlap`;
    }
  }

  if (!hasCrossRegionOverlap(blocks, board.width, board.height)) {
    return "LevelGenerator level has no cross-region overlap";
  }

  return undefined;
}

export function validatePlacementGeometry(
  board: DogBoard,
  blocks: readonly DogBlock[],
): string | undefined {
  if (board.shape !== "irregular") {
    return "LevelGenerator board shape must be irregular";
  }

  const playableCells = new Set(board.playableCells.map(cellKey));
  const crossLayerOverlapRatios: number[] = [];
  for (let firstIndex = 0; firstIndex < blocks.length; firstIndex += 1) {
    const first = blocks[firstIndex];
    if (
      first.x < 0 ||
      first.y < 0 ||
      first.x + first.width > board.width ||
      first.y + first.height > board.height
    ) {
      return `LevelGenerator block ${first.id} leaves board bounds`;
    }
    for (let y = first.y; y < first.y + first.height; y += 1) {
      for (let x = first.x; x < first.x + first.width; x += 1) {
        if (!playableCells.has(`${x}:${y}`)) {
          return `LevelGenerator block ${first.id} leaves playable outline`;
        }
      }
    }

    for (let secondIndex = firstIndex + 1; secondIndex < blocks.length; secondIndex += 1) {
      const second = blocks[secondIndex];
      const area = overlapArea(first, second);
      if (first.z === second.z) {
        if (area > 0) {
          return `LevelGenerator blocks ${first.id} and ${second.id} overlap on one layer`;
        }
        continue;
      }

      if (area > 0) {
        crossLayerOverlapRatios.push(area / (first.width * first.height));
      }
    }
  }

  for (const lowerBlock of blocks) {
    const higherOverlapCount = blocks.filter(
      (higherBlock) => higherBlock.z > lowerBlock.z && overlapArea(lowerBlock, higherBlock) > 0,
    ).length;
    if (higherOverlapCount > MAX_BLOCKS_PER_LOWER_BLOCK) {
      return `LevelGenerator block ${lowerBlock.id} exceeds overlap limit`;
    }
  }

  if (crossLayerOverlapRatios.length === 0) {
    return "LevelGenerator level has no cross-layer overlap";
  }
  const partialOverlapCount = crossLayerOverlapRatios.filter(
    (ratio) => ratio === 0.25 || ratio === 0.5,
  ).length;
  const alignedOverlapCount = crossLayerOverlapRatios.filter((ratio) => ratio === 1).length;
  if (partialOverlapCount / crossLayerOverlapRatios.length < 0.7) {
    return "LevelGenerator partial overlap ratio is below 70%";
  }
  if (alignedOverlapCount / crossLayerOverlapRatios.length > 0.1) {
    return "LevelGenerator aligned overlap ratio is above 10%";
  }

  return undefined;
}

export type PlacementFactory = (
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
) => readonly BlockPlacement[];

export function selectPatternTypes(
  levelNumber: number,
  random: SeededRandom,
): readonly DogPatternType[] {
  return random.shuffle([...DOG_PATTERN_TYPES]).slice(0, getPatternTypeCount(levelNumber));
}

export function createSolvableBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
): readonly BlockPlacement[] {
  const structuralPlacements = createStructuralBlockPlacements(
    template,
    blockCount,
    maxLayers,
    random,
  );
  return assignPlacementsToRemovalPlan(structuralPlacements, blockCount, maxLayers, removalPlan);
}

export function createFirstLevelBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
): readonly BlockPlacement[] {
  if (
    blockCount !== FIRST_LEVEL_BLOCK_COUNT ||
    maxLayers !== FIRST_LEVEL_MAX_LAYERS
  ) {
    throw new Error("LevelGenerator first-level placement config is invalid");
  }

  const structuralPlacements = createStructuralBlockPlacements(
    template,
    blockCount,
    maxLayers,
    random,
  );
  return assignPlacementsToRemovalPlan(
    structuralPlacements,
    blockCount,
    maxLayers,
    removalPlan,
  );
}

export function createGuaranteedBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
): readonly BlockPlacement[] {
  const structuralPlacements = createStructuralBlockPlacements(
    template,
    blockCount,
    maxLayers,
    random,
  );
  return assignPlacementsToRemovalPlan(
    structuralPlacements,
    blockCount,
    maxLayers,
    removalPlan,
  );
}

function assignPlacementsToRemovalPlan(
  structuralPlacements: readonly BlockPlacement[],
  blockCount: number,
  maxLayers: number,
  removalPlan: RemovalPathPlan,
): readonly BlockPlacement[] {
  const blockIndicesByLayer = Array.from(
    { length: maxLayers },
    () => [] as number[],
  );

  for (const blockIndex of removalPlan.order) {
    blockIndicesByLayer[removalPlan.layerByBlock[blockIndex]].push(blockIndex);
  }

  const placementsByBlock: BlockPlacement[] = Array.from(
    { length: blockCount },
    () => ({ x: 0, y: 0, z: 0 }),
  );
  const placementCursorByLayer = Array.from({ length: maxLayers }, () => 0);

  // Path exists before geometry. Structural layers are built bottom-up, then
  // assigned to path blocks in reverse stack order so path order removes top first.
  for (const placement of structuralPlacements) {
    const layerIndices = blockIndicesByLayer[placement.z];
    const cursor = placementCursorByLayer[placement.z];
    const blockIndex = layerIndices[cursor];
    if (blockIndex === undefined) {
      throw new Error(`LevelGenerator path plan has no block for layer ${placement.z}`);
    }

    placementsByBlock[blockIndex] = placement;
    placementCursorByLayer[placement.z] += 1;
  }

  return placementsByBlock;
}

export function createRemovalPathPlan(
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
): RemovalPathPlan {
  const order = random.shuffle(
    Array.from({ length: blockCount }, (_, index) => index),
  );
  const layerCounts = distributeBlocks(blockCount, maxLayers);
  const layerByBlock = Array.from({ length: blockCount }, () => 0);
  let pathCursor = 0;

  // Assign path prefix to upper layers. Reversing this assignment creates stack
  // geometry where every earlier path block can be removed before lower blocks.
  for (let z = maxLayers - 1; z >= 0; z -= 1) {
    for (let count = 0; count < layerCounts[z]; count += 1) {
      const blockIndex = order[pathCursor];
      if (blockIndex === undefined) {
        throw new Error("LevelGenerator path plan has incomplete block order");
      }

      layerByBlock[blockIndex] = z;
      pathCursor += 1;
    }
  }

  return {
    order: Object.freeze([...order]),
    layerByBlock: Object.freeze([...layerByBlock]),
  };
}

export function resolveRemovalPathPlan(
  placements: readonly BlockPlacement[],
  random: SeededRandom,
  preferredOrder: readonly number[],
): RemovalPathPlan {
  // Resolve reveal dependencies once after raw stack geometry exists. Pattern
  // assignment consumes this plan directly; it never regenerates the path.
  const order = createRemovalOrder(placements, random, preferredOrder);
  return {
    order: Object.freeze([...order]),
    layerByBlock: Object.freeze(placements.map((placement) => placement.z)),
  };
}

function createStructuralBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
): readonly BlockPlacement[] {
  const layerCounts = distributeBlocks(blockCount, maxLayers);
  const placements: BlockPlacement[] = [];

  for (let z = 0; z < maxLayers; z += 1) {
    const desiredCount = layerCounts[z];
    let selected: BlockPlacement[] = [];

    for (const offset of getLayerOffsetOrder(z)) {
      selected = selectStructuralLayerPlacements(
        template,
        z,
        desiredCount,
        offset,
        placements,
        random,
      );
      if (selected.length === desiredCount) {
        break;
      }
    }

    if (selected.length !== desiredCount) {
      throw new Error(
        `LevelGenerator could not place layer ${z} for template ${template.id}`,
      );
    }

    placements.push(...selected);
  }

  return placements;
}

function getLayerOffsetOrder(z: number): readonly (typeof LAYER_OFFSETS)[number][] {
  const preferredOffsetIndex = z % LAYER_OFFSETS.length;
  return [
    ...LAYER_OFFSETS.slice(preferredOffsetIndex),
    ...LAYER_OFFSETS.slice(0, preferredOffsetIndex),
  ];
}

function distributeBlocks(blockCount: number, maxLayers: number): readonly number[] {
  const baseCount = Math.floor(blockCount / maxLayers);
  const remainder = blockCount % maxLayers;
  return Array.from({ length: maxLayers }, (_, index) => baseCount + (index < remainder ? 1 : 0));
}

function selectStructuralLayerPlacements(
  template: DogShapeTemplate,
  z: number,
  desiredCount: number,
  offset: (typeof LAYER_OFFSETS)[number],
  previousPlacements: readonly BlockPlacement[],
  random: SeededRandom,
): BlockPlacement[] {
  const candidateOffsets = z === 0 ? getLayerOffsetOrder(z) : [offset];
  const candidates = random.shuffle([
    ...new Map(
      candidateOffsets
        .flatMap((candidateOffset) =>
          getCandidateAnchors(template, candidateOffset.x, candidateOffset.y),
        )
        .map((candidate) => [`${candidate.x}:${candidate.y}`, candidate]),
    ).values(),
  ]);
  const selected: BlockPlacement[] = [];

  for (const region of CORNER_REGIONS) {
    const candidate = takeRegionCandidate(
      candidates,
      region,
      template.width,
      template.height,
      z,
      selected,
      previousPlacements,
    );
    if (candidate !== undefined) {
      selected.push({ ...candidate, z });
      removeCandidate(candidates, candidate);
    }
  }

  const crossRegionCandidate = takeCrossRegionCandidate(
    candidates,
    template.width,
    template.height,
    z,
    selected,
    previousPlacements,
  );
  if (crossRegionCandidate !== undefined) {
    selected.push({ ...crossRegionCandidate, z });
    removeCandidate(candidates, crossRegionCandidate);
  }

  const edgeCandidate = takeEdgeCandidate(
    candidates,
    template.width,
    template.height,
    z,
    selected,
    previousPlacements,
    z > 0,
  );
  if (edgeCandidate !== undefined) {
    selected.push({ ...edgeCandidate, z });
    removeCandidate(candidates, edgeCandidate);
  }

  const prioritizedCandidates = random.shuffle([...candidates]).sort(
    (first, second) =>
      Number(getPlacementRegion(second, template.width, template.height) === "center") -
      Number(getPlacementRegion(first, template.width, template.height) === "center"),
  );

  while (selected.length < desiredCount && prioritizedCandidates.length > 0) {
    const candidate = prioritizedCandidates.shift();
    if (candidate === undefined) {
      break;
    }

    const placement = { ...candidate, z };
    if (!canAddPlacement(placement, selected, previousPlacements)) {
      continue;
    }

    selected.push(placement);
  }

  return selected;
}

function takeCrossRegionCandidate(
  candidates: readonly Omit<BlockPlacement, "z">[],
  boardWidth: number,
  boardHeight: number,
  z: number,
  selected: readonly BlockPlacement[],
  previousPlacements: readonly BlockPlacement[],
): Omit<BlockPlacement, "z"> | undefined {
  return candidates
    .map((candidate) => ({
      candidate,
      placement: { ...candidate, z },
    }))
    .filter(({ placement }) => canAddPlacement(placement, selected, previousPlacements))
    .map(({ candidate, placement }) => ({
      candidate,
      placement,
      score: getCrossRegionOverlapScore(
        placement,
        previousPlacements,
        boardWidth,
        boardHeight,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score)[0]?.candidate;
}

function takeEdgeCandidate(
  candidates: readonly Omit<BlockPlacement, "z">[],
  boardWidth: number,
  boardHeight: number,
  z: number,
  selected: readonly BlockPlacement[],
  previousPlacements: readonly BlockPlacement[],
  requireOverlap: boolean,
): Omit<BlockPlacement, "z"> | undefined {
  return candidates
    .filter((candidate) => getPlacementRegion(candidate, boardWidth, boardHeight) === "edge")
    .map((candidate) => ({
      candidate,
      placement: { ...candidate, z },
    }))
    .filter(({ placement }) => canAddPlacement(placement, selected, previousPlacements))
    .map(({ candidate, placement }) => ({
      candidate,
      placement,
      score: getRegionalOverlapScore(
        placement,
        "edge",
        previousPlacements,
        boardWidth,
        boardHeight,
      ),
    }))
    .filter(({ score }) => !requireOverlap || score > 0)
    .sort((first, second) => second.score - first.score)[0]?.candidate;
}

function takeRegionCandidate(
  candidates: readonly Omit<BlockPlacement, "z">[],
  region: (typeof CORNER_REGIONS)[number],
  boardWidth: number,
  boardHeight: number,
  z: number,
  selected: readonly BlockPlacement[],
  previousPlacements: readonly BlockPlacement[],
): Omit<BlockPlacement, "z"> | undefined {
  return candidates
    .filter((candidate) => getPlacementRegion(candidate, boardWidth, boardHeight) === region)
    .map((candidate) => ({
      candidate,
      placement: { ...candidate, z },
    }))
    .filter(({ placement }) => canAddPlacement(placement, selected, previousPlacements))
    .sort(
      (first, second) =>
        getRegionalOverlapScore(second.placement, region, previousPlacements, boardWidth, boardHeight) -
          getRegionalOverlapScore(first.placement, region, previousPlacements, boardWidth, boardHeight) ||
        getRegionDistance(first.candidate, region, boardWidth, boardHeight) -
          getRegionDistance(second.candidate, region, boardWidth, boardHeight),
    )[0]?.candidate;
}

function getRegionalOverlapScore(
  placement: BlockPlacement,
  region: PlacementRegion,
  previousPlacements: readonly BlockPlacement[],
  boardWidth: number,
  boardHeight: number,
): number {
  return previousPlacements.filter(
    (previous) =>
      getPlacementRegion(previous, boardWidth, boardHeight) === region &&
      blocksOverlap(placement, previous),
  ).length;
}

function getCrossRegionOverlapScore(
  placement: BlockPlacement,
  previousPlacements: readonly BlockPlacement[],
  boardWidth: number,
  boardHeight: number,
): number {
  const placementRegion = getPlacementRegion(placement, boardWidth, boardHeight);
  return previousPlacements.filter(
    (previous) =>
      getPlacementRegion(previous, boardWidth, boardHeight) !== placementRegion &&
      blocksOverlap(placement, previous),
  ).length;
}

function getRegionDistance(
  placement: Omit<BlockPlacement, "z">,
  region: (typeof CORNER_REGIONS)[number],
  boardWidth: number,
  boardHeight: number,
): number {
  const targetX = region.endsWith("left") ? boardWidth * 0.18 : boardWidth * 0.82;
  const targetY = region.startsWith("top") ? boardHeight * 0.18 : boardHeight * 0.82;
  const centerX = placement.x + BLOCK_WIDTH / 2;
  const centerY = placement.y + BLOCK_HEIGHT / 2;
  return Math.abs(centerX - targetX) + Math.abs(centerY - targetY);
}

function removeCandidate(
  candidates: Omit<BlockPlacement, "z">[],
  candidate: Omit<BlockPlacement, "z">,
): void {
  const index = candidates.findIndex(
    (current) => current.x === candidate.x && current.y === candidate.y,
  );
  if (index >= 0) {
    candidates.splice(index, 1);
  }
}

function canAddPlacement(
  placement: BlockPlacement,
  selected: readonly BlockPlacement[],
  previousPlacements: readonly BlockPlacement[],
): boolean {
  if (selected.some((other) => blocksOverlap(placement, other))) {
    return false;
  }

  if (previousPlacements.some((lowerBlock) =>
    placement.x === lowerBlock.x && placement.y === lowerBlock.y,
  )) {
    return false;
  }

  return !previousPlacements.some(
    (lowerBlock) =>
      blocksOverlap(placement, lowerBlock) &&
      countHigherOverlaps(lowerBlock, [...previousPlacements, ...selected, placement]) >=
        MAX_BLOCKS_PER_LOWER_BLOCK,
  );
}

function getCandidateAnchors(
  template: DogShapeTemplate,
  offsetX: number,
  offsetY: number,
): readonly Omit<BlockPlacement, "z">[] {
  const playable = new Set(template.playableCells.map(cellKey));
  const candidates: Omit<BlockPlacement, "z">[] = [];

  for (let y = offsetY; y <= template.height - BLOCK_HEIGHT; y += BLOCK_HEIGHT) {
    for (let x = offsetX; x <= template.width - BLOCK_WIDTH; x += BLOCK_WIDTH) {
      if (isPlayablePlacement(x, y, playable)) {
        candidates.push({ x, y });
      }
    }
  }

  return candidates;
}

function isPlayablePlacement(
  x: number,
  y: number,
  playableCells: ReadonlySet<string>,
): boolean {
  for (let currentY = y; currentY < y + BLOCK_HEIGHT; currentY += 1) {
    for (let currentX = x; currentX < x + BLOCK_WIDTH; currentX += 1) {
      if (!playableCells.has(`${currentX}:${currentY}`)) {
        return false;
      }
    }
  }

  return true;
}

function countHigherOverlaps(
  lowerBlock: BlockPlacement,
  placements: readonly BlockPlacement[],
): number {
  return placements.filter(
    (other) => other.z > lowerBlock.z && blocksOverlap(lowerBlock, other),
  ).length;
}

function blocksOverlap(first: BlockPlacement, second: BlockPlacement): boolean {
  return hasPositiveAreaOverlap(
    {
      x: first.x,
      y: first.y,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
    },
    {
      x: second.x,
      y: second.y,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
    },
  );
}

function overlapArea(first: DogBlock, second: DogBlock): number {
  return getPositiveOverlapArea(first, second);
}

function getPlacementRegion(
  placement: Pick<BlockPlacement, "x" | "y"> | Pick<DogBlock, "x" | "y">,
  boardWidth: number,
  boardHeight: number,
): PlacementRegion {
  const centerX = (placement.x + BLOCK_WIDTH / 2) / boardWidth;
  const centerY = (placement.y + BLOCK_HEIGHT / 2) / boardHeight;
  const horizontal = centerX < 0.2 ? "left" : centerX > 0.8 ? "right" : "center";
  const vertical = centerY < 0.2 ? "top" : centerY > 0.8 ? "bottom" : "center";

  if (horizontal === "center" && vertical === "center") {
    return "center";
  }
  if (horizontal !== "center" && vertical !== "center") {
    return `${vertical}-${horizontal}` as (typeof CORNER_REGIONS)[number];
  }
  return "edge";
}

function hasCrossLayerOverlap(blocks: readonly DogBlock[]): boolean {
  for (let firstIndex = 0; firstIndex < blocks.length; firstIndex += 1) {
    for (const second of blocks.slice(firstIndex + 1)) {
      if (blocks[firstIndex].z !== second.z && overlapArea(blocks[firstIndex], second) > 0) {
        return true;
      }
    }
  }
  return false;
}

function hasCrossRegionOverlap(
  blocks: readonly DogBlock[],
  boardWidth: number,
  boardHeight: number,
): boolean {
  for (let firstIndex = 0; firstIndex < blocks.length; firstIndex += 1) {
    const first = blocks[firstIndex];
    const firstRegion = getPlacementRegion(first, boardWidth, boardHeight);
    for (const second of blocks.slice(firstIndex + 1)) {
      if (
        first.z !== second.z &&
        firstRegion !== getPlacementRegion(second, boardWidth, boardHeight) &&
        overlapArea(first, second) > 0
      ) {
        return true;
      }
    }
  }
  return false;
}

export function createSolvableBlocks(
  placements: readonly BlockPlacement[],
  patternTypes: readonly DogPatternType[],
  levelNumber: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
): { readonly blocks: readonly DogBlock[]; readonly solutionPath: readonly string[] } {
  const patternByBlock = new Array<DogPatternType>(placements.length);
  const blockOrder = removalPlan.order;
  const groupCount = placements.length / 3;
  const patternSequence = createSolvablePatternSequence(patternTypes, groupCount, random);

  for (let pathIndex = 0; pathIndex < blockOrder.length; pathIndex += 1) {
    patternByBlock[blockOrder[pathIndex]] = patternSequence[pathIndex];
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
  };
}

function createRemovalOrder(
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
  const groupPatterns = Array.from(
    { length: groupCount },
    (_, index) => patternTypes[index % patternTypes.length],
  );
  const remainingGroups = new Map<DogPatternType, number>();
  for (const patternType of groupPatterns) {
    remainingGroups.set(patternType, (remainingGroups.get(patternType) ?? 0) + 3);
  }

  const remaining = new Map(remainingGroups);
  const sequence: DogPatternType[] = [];
  while (sequence.length < groupCount * 3) {
    const activePatterns = random.shuffle(
      patternTypes.filter((patternType) => (remaining.get(patternType) ?? 0) > 0),
    );
    if (activePatterns.length >= 5) {
      const pressurePatterns = activePatterns.slice(0, 5);
      const [first, second, third, fourth, fifth] = pressurePatterns;
      sequence.push(
        first,
        second,
        third,
        fourth,
        fifth,
        first,
        first,
        second,
        second,
        third,
        third,
        fourth,
        fourth,
        fifth,
        fifth,
      );
      for (const patternType of pressurePatterns) {
        remaining.set(patternType, (remaining.get(patternType) ?? 0) - 3);
      }
      continue;
    }

    const patternType = activePatterns[0];
    if (patternType === undefined) {
      break;
    }
    sequence.push(patternType, patternType, patternType);
    remaining.set(patternType, (remaining.get(patternType) ?? 0) - 3);
  }

  return sequence.slice(0, groupCount * 3);
}


function cellKey(cell: { readonly x: number; readonly y: number }): string {
  return `${cell.x}:${cell.y}`;
}
