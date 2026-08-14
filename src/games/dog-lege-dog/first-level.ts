export const FIRST_LEVEL_NUMBER = 1 as const;
export const FIRST_LEVEL_SEED = "dog-lege-dog:first-level:v1";
export const FIRST_LEVEL_GENERATOR_VERSION = 1 as const;
export const FIRST_LEVEL_MAX_LAYERS = 3 as const;
export const FIRST_LEVEL_REWARD = 100 as const;
export const BLOCK_WIDTH = 2 as const;
export const BLOCK_HEIGHT = 2 as const;

export const FIRST_LEVEL_PATTERN_TYPES = [
  "打工狗",
  "单身狗",
  "舔狗",
  "看门狗",
] as const;

export type DogPatternType = (typeof FIRST_LEVEL_PATTERN_TYPES)[number];

export interface DogBoard {
  readonly shape: "rectangle";
  readonly width: number;
  readonly height: number;
  readonly logicalCellSize: 2;
}

export interface DogBlock {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: 2;
  readonly height: 2;
  readonly rotation: 0;
  readonly patternType: DogPatternType;
}

export interface DogLegeDogLevel {
  readonly number: 1;
  readonly seed: string;
  readonly generatorVersion: 1;
  readonly maxLayers: 3;
  readonly reward: number;
  readonly board: DogBoard;
  readonly patternTypes: readonly DogPatternType[];
  readonly blocks: readonly DogBlock[];
}

const BOARD: DogBoard = Object.freeze({
  shape: "rectangle",
  width: 14,
  height: 12,
  logicalCellSize: BLOCK_WIDTH,
});

/**
 * Fixed first level layout. Each layer is a separate rectangle of 2×2 cells;
 * upper layers overlap the center of lower layers to make the hierarchy visible.
 */
export const FIRST_LEVEL: DogLegeDogLevel = Object.freeze({
  number: FIRST_LEVEL_NUMBER,
  seed: FIRST_LEVEL_SEED,
  generatorVersion: FIRST_LEVEL_GENERATOR_VERSION,
  maxLayers: FIRST_LEVEL_MAX_LAYERS,
  reward: FIRST_LEVEL_REWARD,
  board: BOARD,
  patternTypes: FIRST_LEVEL_PATTERN_TYPES,
  blocks: Object.freeze(createFirstLevelBlocks()),
});

function createFirstLevelBlocks(): DogBlock[] {
  const blocks: DogBlock[] = [];
  const layers = [
    { z: 0, xStart: 0, xEnd: 12, yStart: 0, yEnd: 10 },
    { z: 1, xStart: 2, xEnd: 12, yStart: 2, yEnd: 10 },
    { z: 2, xStart: 2, xEnd: 12, yStart: 4, yEnd: 8 },
  ] as const;

  for (const layer of layers) {
    for (let y = layer.yStart; y <= layer.yEnd; y += BLOCK_HEIGHT) {
      for (let x = layer.xStart; x <= layer.xEnd; x += BLOCK_WIDTH) {
        const index = blocks.length;
        blocks.push({
          id: `first-level-block-${index + 1}`,
          x,
          y,
          z: layer.z,
          width: BLOCK_WIDTH,
          height: BLOCK_HEIGHT,
          rotation: 0,
          patternType:
            FIRST_LEVEL_PATTERN_TYPES[Math.floor(index / 3) % FIRST_LEVEL_PATTERN_TYPES.length],
        });
      }
    }
  }

  return blocks;
}
