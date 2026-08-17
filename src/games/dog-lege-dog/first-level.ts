import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  type DogBlock,
  type DogBoard,
  type DogLegeDogLevel,
} from "./level-types";
import {
  DEFAULT_LEVEL_REWARD,
  DEFAULT_LEVEL_SEED,
  FIRST_LEVEL_GENERATOR_VERSION,
  FIRST_LEVEL_MAX_LAYERS,
  FIRST_LEVEL_NUMBER,
  FIRST_LEVEL_PATTERN_TYPES,
  FIRST_LEVEL_SEED,
} from "./game-config";
import { calculateDifficultyMetrics } from "./level-difficulty";

export {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_PATTERN_TYPES,
  type DogBlock,
  type DogBoard,
  type DogBoardCell,
  type DogBoardShape,
  type DogLegeDogLevel,
  type DogPatternType,
  type DogDifficultyRange,
  type DogDifficultyTarget,
  type DogLevelDifficulty,
  type DogLevelGeneration,
  type DogLevelGenerationFailure,
  type DogLevelReplay,
  type DogLevelReplayMode,
} from "./level-types";

export const FIRST_LEVEL_REWARD = DEFAULT_LEVEL_REWARD;

export {
  FIRST_LEVEL_GENERATOR_VERSION,
  FIRST_LEVEL_MAX_LAYERS,
  FIRST_LEVEL_NUMBER,
  FIRST_LEVEL_PATTERN_TYPES,
  FIRST_LEVEL_SEED,
} from "./game-config";

const BOARD: DogBoard = Object.freeze({
  shape: "rectangle",
  templateId: "rectangle-first-level",
  width: 14,
  height: 12,
  logicalCellSize: BLOCK_WIDTH,
  playableCells: Object.freeze(createFirstLevelPlayableCells()),
});

const FIRST_LEVEL_BLOCKS = Object.freeze(createFirstLevelBlocks());
const FIRST_LEVEL_SOLUTION_PATH = Object.freeze(
  [...FIRST_LEVEL_BLOCKS]
    .sort((first, second) => second.z - first.z || first.id.localeCompare(second.id))
    .map((block) => block.id),
);
const FIRST_LEVEL_DIFFICULTY = calculateDifficultyMetrics(
  {
    number: FIRST_LEVEL_NUMBER,
    maxLayers: FIRST_LEVEL_MAX_LAYERS,
    board: BOARD,
    patternTypes: FIRST_LEVEL_PATTERN_TYPES,
    blocks: FIRST_LEVEL_BLOCKS,
  },
  FIRST_LEVEL_SOLUTION_PATH,
);

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
  blocks: FIRST_LEVEL_BLOCKS,
  solutionPath: FIRST_LEVEL_SOLUTION_PATH,
  difficulty: FIRST_LEVEL_DIFFICULTY,
  generation: Object.freeze({
    attempts: 1,
    fallbackUsed: false,
    replay: Object.freeze({
      attempt: 1,
      levelNumber: FIRST_LEVEL_NUMBER,
      seed: DEFAULT_LEVEL_SEED,
      levelSeed: FIRST_LEVEL_SEED,
      testSeed: DEFAULT_LEVEL_SEED,
      generatorVersion: FIRST_LEVEL_GENERATOR_VERSION,
      mode: "fixed",
      randomSeed: FIRST_LEVEL_SEED,
    }),
    failures: Object.freeze([]),
  }),
});

function createFirstLevelPlayableCells(): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 14; x += 1) {
      cells.push({ x, y });
    }
  }

  return cells;
}

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
