import {
  DEFAULT_LEVEL_SEED,
  DEFAULT_LEVEL_REWARD,
  FIRST_LEVEL_GENERATOR_VERSION,
  FIRST_LEVEL_NUMBER,
} from "./game-config";
import { GeneratedLevelGenerator } from "./level-generation-engine";
import type { DogLegeDogLevel } from "./level-types";

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

/** Public first-level value generated through same provider pipeline as every level. */
export const FIRST_LEVEL: DogLegeDogLevel = new GeneratedLevelGenerator().generate({
  levelNumber: FIRST_LEVEL_NUMBER,
  seed: DEFAULT_LEVEL_SEED,
  generatorVersion: FIRST_LEVEL_GENERATOR_VERSION,
});
