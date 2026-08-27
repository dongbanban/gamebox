import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
} from "@/games/dog-lege-dog/levels/level-types";
import { hasPositiveAreaOverlap } from "@/games/dog-lege-dog/levels/level-rules";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import type { DogShapeTemplate } from "@/games/dog-lege-dog/levels/level-shapes";
import type { BlockPlacement } from "@/games/dog-lege-dog/levels/level-placement-contracts";
import {
  CORNER_REGIONS,
  getPlacementRegion,
  type PlacementRegion,
  cellKey,
} from "@/games/dog-lege-dog/levels/level-placement-regions";

const MAX_BLOCKS_PER_LOWER_BLOCK = 4;
const MAX_STRUCTURAL_PLACEMENT_ATTEMPTS = 8;
const LAYER_OFFSETS = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 2 },
  { x: 0, y: 2 },
] as const;

export function createStructuralBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
): readonly BlockPlacement[] {
  const layerCounts = distributeBlocks(blockCount, maxLayers);
  let failedLayer = 0;

  for (let attempt = 0; attempt < MAX_STRUCTURAL_PLACEMENT_ATTEMPTS; attempt += 1) {
    const placements: BlockPlacement[] = [];
    let complete = true;

    for (let z = 0; z < maxLayers; z += 1) {
      const desiredCount = layerCounts[z];
      const selected = selectStructuralLayerPlacements(
        template,
        z,
        desiredCount,
        placements,
        random,
      );

      if (selected.length !== desiredCount) {
        failedLayer = z;
        complete = false;
        break;
      }

      placements.push(...selected);
    }

    if (complete) {
      return placements;
    }
  }

  throw new Error(
    `LevelGenerator could not place layer ${failedLayer} for template ${template.id}`,
  );
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
  return Array.from(
    { length: maxLayers },
    (_, index) => baseCount + (index < remainder ? 1 : 0),
  );
}

function selectStructuralLayerPlacements(
  template: DogShapeTemplate,
  z: number,
  desiredCount: number,
  previousPlacements: readonly BlockPlacement[],
  random: SeededRandom,
): BlockPlacement[] {
  // Every layer uses quarter-block phases; overlap and alignment limits stay enforced below.
  const candidateOffsets = getLayerOffsetOrder(z);
  const candidates = random.shuffle([
    ...new Map(
      candidateOffsets
        .flatMap((candidateOffset) =>
          getCandidateAnchors(
            template,
            candidateOffset.x,
            candidateOffset.y,
          ),
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
        getRegionalOverlapScore(
          second.placement,
          region,
          previousPlacements,
          boardWidth,
          boardHeight,
        ) -
          getRegionalOverlapScore(
            first.placement,
            region,
            previousPlacements,
            boardWidth,
            boardHeight,
          ) ||
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
