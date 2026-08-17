export {
  GAME_SESSION_TRAY_CAPACITY,
  GameSession,
  type GameSessionOptions,
  type GameSessionSelectionResult,
  type GameSessionSnapshot,
  type GameSessionStatus,
} from "./game-session";

export {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_PATTERN_TYPES,
  FIRST_LEVEL,
  FIRST_LEVEL_GENERATOR_VERSION,
  FIRST_LEVEL_MAX_LAYERS,
  FIRST_LEVEL_NUMBER,
  FIRST_LEVEL_PATTERN_TYPES,
  FIRST_LEVEL_REWARD,
  FIRST_LEVEL_SEED,
} from "./first-level";
export { getDogLegeDogLevel } from "./level-provider";
export type {
  DogBlock,
  DogBoard,
  DogBoardCell,
  DogBoardShape,
  DogDifficultyRange,
  DogDifficultyTarget,
  DogLevelDifficulty,
  DogLevelGeneration,
  DogLevelGenerationFailure,
  DogLevelReplay,
  DogLevelReplayMode,
  DogLegeDogLevel,
  DogPatternType,
} from "./first-level";

export {
  DEFAULT_LEVEL_GENERATOR,
  DEFAULT_LEVEL_REWARD,
  DEFAULT_LEVEL_SEED,
  DOG_GAME_ID,
  DOG_SHAPE_TEMPLATES,
  calculateDifficultyMetrics,
  findSolvablePath,
  getDifficultyTarget,
  getLevelDifficultyMetrics,
  LEVEL_GENERATOR_VERSION,
  MAX_LEVEL_GENERATION_ATTEMPTS,
  LevelGenerator,
  generateDogLegeDogLevel,
  getBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  isDifficultyWithinTarget,
  isLevelSolvable,
  type LevelCandidateFilter,
  replayDogLegeDogLevel,
  replayDogLegeDogLevelAttempt,
  type DogShapeTemplate,
  type LevelGeneratorOptions,
  type LevelGeneratorRequest,
} from "./level-generator";

export { createDogLegeDogGame, startDogLegeDogGame } from "./game-controller";
export type {
  DogLegeDogGame,
  DogLegeDogGameOptions,
  DogLegeDogGameState,
  DogVisualFeedback,
} from "./game-types";
