import { describe, expect, it, vi } from "vitest";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  calculateDifficultyMetrics,
  DOG_PATTERN_TYPES,
  DOG_SHAPE_TEMPLATES,
  DOG_V13_CONFIG,
  GameSession,
  MAX_LEVEL_GENERATION_ATTEMPTS,
  LevelGenerator,
  getDifficultyTarget,
  getBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  getDogLegeDogLevel,
  getDogLogicalBlockCount,
  DOG_REWARD_CONFIG_VERSION,
  getDogTrayLockCount,
} from "@/games/dog-lege-dog";

const MAX_LEVEL_NUMBER = DOG_V13_CONFIG.game.maxLevelNumber;
const CURRENT_GENERATOR_VERSION = DOG_V13_CONFIG.game.generatorVersion;
const MAX_LOCKED_TRAY_SLOTS = DOG_V13_CONFIG.tray.maxLockedSlotCount;

type SolvabilityFixture = Parameters<LevelGenerator["findSolvability"]>[0];
export function createLongSearchFixture(): SolvabilityFixture {
  const preferredOrder = [
    0, 3, 6, 9, 12, 15,
    1, 4, 2, 5,
    7, 8, 10, 11, 13, 14, 16, 17,
  ];
  const idByBlockIndex = new Map(
    preferredOrder.map((blockIndex, order) => [
      blockIndex,
      `block-${String(order).padStart(2, "0")}`,
    ]),
  );
  const blocks: SolvabilityFixture["blocks"] = Array.from(
    { length: 18 },
    (_, index) => ({
      id: idByBlockIndex.get(index)!,
      x: index * BLOCK_WIDTH,
      y: 0,
      z: 0,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[Math.floor(index / 3)]!,
    }),
  );

  return {
    number: 1,
    maxLayers: 3,
    board: {
      shape: "irregular",
      templateId: "test-long-search",
      width: blocks.length * BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      logicalCellSize: 4,
      playableCells: [],
    },
    patternTypes: DOG_PATTERN_TYPES.slice(0, 6),
    blocks,
  } as SolvabilityFixture;
}

export function createBudgetFixture(): SolvabilityFixture {
  const blocks: SolvabilityFixture["blocks"] = Array.from(
    { length: 8 },
    (_, index) => ({
      id: `budget-block-${String(index).padStart(2, "0")}`,
      x: index * BLOCK_WIDTH,
      y: 0,
      z: 0,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[index]!,
    }),
  );

  return {
    number: 1,
    maxLayers: 1,
    board: {
      shape: "irregular",
      templateId: "test-budget",
      width: blocks.length * BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      logicalCellSize: 4,
      playableCells: [],
    },
    patternTypes: DOG_PATTERN_TYPES.slice(0, 8),
    blocks,
  };
}

export function createFiniteBranchFixture(): SolvabilityFixture {
  const blocks: SolvabilityFixture["blocks"] = Array.from(
    { length: 8 },
    (_, index) => ({
      id: `finite-branch-${index}`,
      x: index < 2 ? index * BLOCK_WIDTH * 2 : BLOCK_WIDTH * 2,
      y: 0,
      z: 2 - index,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[index]!,
    }),
  );

  return {
    number: 1,
    maxLayers: 3,
    board: {
      shape: "irregular",
      templateId: "test-finite-branch",
      width: blocks.length * BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      logicalCellSize: 4,
      playableCells: [],
    },
    patternTypes: DOG_PATTERN_TYPES.slice(0, 8),
    blocks,
  };
}


type SpatialRegion =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "edge";

export function classifySpatialRegion(
  block: { readonly x: number; readonly y: number },
  board: { readonly width: number; readonly height: number },
): SpatialRegion {
  const centerX = (block.x + BLOCK_WIDTH / 2) / board.width;
  const centerY = (block.y + BLOCK_HEIGHT / 2) / board.height;
  const horizontal = centerX < 0.2 ? "left" : centerX > 0.8 ? "right" : "center";
  const vertical = centerY < 0.2 ? "top" : centerY > 0.8 ? "bottom" : "center";
  if (horizontal === "center" && vertical === "center") {
    return "center";
  }
  if (horizontal !== "center" && vertical !== "center") {
    return `${vertical}-${horizontal}` as Exclude<SpatialRegion, "center" | "edge">;
  }
  return "edge";
}

export function hasRegionalCrossLayerOverlap(
  blocks: readonly { readonly x: number; readonly y: number; readonly z: number; readonly width: number; readonly height: number }[],
  board: { readonly width: number; readonly height: number },
  region: SpatialRegion,
): boolean {
  const regionBlocks = blocks.filter((block) => classifySpatialRegion(block, board) === region);
  for (let firstIndex = 0; firstIndex < regionBlocks.length; firstIndex += 1) {
    for (const second of regionBlocks.slice(firstIndex + 1)) {
      if (regionBlocks[firstIndex].z !== second.z && overlapArea(regionBlocks[firstIndex], second) > 0) {
        return true;
      }
    }
  }
  return false;
}

export function hasCrossRegionOverlap(
  blocks: readonly { readonly x: number; readonly y: number; readonly z: number; readonly width: number; readonly height: number }[],
  board: { readonly width: number; readonly height: number },
): boolean {
  for (let firstIndex = 0; firstIndex < blocks.length; firstIndex += 1) {
    const first = blocks[firstIndex];
    for (const second of blocks.slice(firstIndex + 1)) {
      if (
        first.z !== second.z &&
        classifySpatialRegion(first, board) !== classifySpatialRegion(second, board) &&
        overlapArea(first, second) > 0
      ) {
        return true;
      }
    }
  }
  return false;
}

export function hasPositiveAreaOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

export function cellKey(cell: { readonly x: number; readonly y: number }): string {
  return `${cell.x}:${cell.y}`;
}

export function getLogicalPatternCount(
  blocks: readonly { readonly patternType: string; readonly specialMechanism?: { readonly type: string } }[],
  patternType: string,
): number {
  return blocks
    .filter((block) => block.patternType === patternType)
    .reduce(
      (total, block) => total + (block.specialMechanism?.type === "twin" ? 2 : 1),
      0,
    );
}

export function overlapArea(
  first: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  second: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): number {
  const overlapWidth = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y),
  );
  return overlapWidth * overlapHeight;
}

export function getCrossLayerOverlapRatios(
  blocks: readonly { readonly x: number; readonly y: number; readonly z: number; readonly width: number; readonly height: number }[],
): number[] {
  const ratios: number[] = [];
  for (let firstIndex = 0; firstIndex < blocks.length; firstIndex += 1) {
    const first = blocks[firstIndex];
    for (const second of blocks.slice(firstIndex + 1)) {
      if (first.z === second.z) {
        continue;
      }

      const area = overlapArea(first, second);
      if (area > 0) {
        ratios.push(area / (first.width * first.height));
      }
    }
  }
  return ratios;
}

export function isConnected(cells: readonly { readonly x: number; readonly y: number }[]): boolean {
  if (cells.length === 0) {
    return false;
  }

  const all = new Set(cells.map(cellKey));
  const visited = new Set<string>();
  const queue = [cells[0]!];
  while (queue.length > 0) {
    const cell = queue.shift()!;
    const key = cellKey(cell);
    if (visited.has(key)) {
      continue;
    }

    visited.add(key);
    for (const neighbor of [
      { x: cell.x - 1, y: cell.y },
      { x: cell.x + 1, y: cell.y },
      { x: cell.x, y: cell.y - 1 },
      { x: cell.x, y: cell.y + 1 },
    ]) {
      if (all.has(cellKey(neighbor)) && !visited.has(cellKey(neighbor))) {
        queue.push(neighbor);
      }
    }
  }

  return visited.size === all.size;
}

export function countInteriorConcavities(
  cells: readonly { readonly x: number; readonly y: number }[],
): number {
  const all = new Set(cells.map(cellKey));
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  let concavities = 0;
  for (let y = minY + 1; y < maxY; y += 1) {
    for (let x = minX + 1; x < maxX; x += 1) {
      if (all.has(`${x}:${y}`)) {
        continue;
      }

      const neighbors = [
        `${x - 1}:${y}`,
        `${x + 1}:${y}`,
        `${x}:${y - 1}`,
        `${x}:${y + 1}`,
      ].filter((neighbor) => all.has(neighbor)).length;
      if (neighbors >= 2) {
        concavities += 1;
      }
    }
  }
  return concavities;
}

export function isReflectionSymmetric(
  cells: readonly { readonly x: number; readonly y: number }[],
): boolean {
  const all = new Set(cells.map(cellKey));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  const horizontal = cells.every((cell) => all.has(`${maxX - cell.x}:${cell.y}`));
  const vertical = cells.every((cell) => all.has(`${cell.x}:${maxY - cell.y}`));
  return horizontal || vertical;
}
