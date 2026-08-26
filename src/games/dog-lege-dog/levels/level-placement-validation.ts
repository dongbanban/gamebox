import type {
  DogBlock,
  DogBoard,
} from "@/games/dog-lege-dog/levels/level-types";
import { getPositiveOverlapArea } from "@/games/dog-lege-dog/levels/level-rules";
import {
  CORNER_REGIONS,
  cellKey,
  getPlacementRegion,
  type PlacementRegion,
} from "@/games/dog-lege-dog/levels/level-placement-regions";

const MAX_BLOCKS_PER_LOWER_BLOCK = 4;
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
    if (regionBlocks.length > 0 && !hasCrossLayerOverlap(regionBlocks)) {
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

function overlapArea(first: DogBlock, second: DogBlock): number {
  return getPositiveOverlapArea(first, second);
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
