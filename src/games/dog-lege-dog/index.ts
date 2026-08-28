export {
  GAME_SESSION_BASE_TRAY_CAPACITY,
  GAME_SESSION_MAX_TRAY_CAPACITY,
  GAME_SESSION_TRAY_CAPACITY,
  GameSession,
} from "@/games/dog-lege-dog/game/game-session";
export type {
  GameSessionDemagnetizeResult,
  GameSessionMeltLocation,
  GameSessionMeltResult,
  GameSessionMagneticResolution,
  GameSessionOptions,
  GameSessionPendingSelectionResult,
  GameSessionSelectionResult,
  GameSessionSnapshot,
  GameSessionStatus,
  GameSessionTripleRemovalPlan,
  GameSessionTripleRemovalResult,
  GameSessionUnlockResult,
  GameSessionWildcardPlan,
  GameSessionWildcardResolution,
  GameSessionWildcardResult,
} from "@/games/dog-lege-dog/game/game-session";

export {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_PATTERN_TYPES,
} from "@/games/dog-lege-dog/levels/level-types";
export type {
  DogBlock,
  DogBoard,
  DogBoardCell,
  DogBoardShape,
  DogDifficultyRange,
  DogDifficultyTarget,
  DogDifficultyCertainty,
  DogLevelDifficulty,
  DogLevelGeneration,
  DogLevelGenerationFailure,
  DogLevelGeometry,
  DogLevelReplay,
  DogLevelReplayMode,
  DogLegeDogLevel,
  DogPatternType,
  DogSpecialMechanism,
  DogSpecialMechanismConfig,
  DogSpecialMechanismHandler,
  DogSpecialMechanismStateValue,
  DogTrayBlock,
  DogSafeChoiceSearchStatus,
  DogSolvabilityStatus,
} from "@/games/dog-lege-dog/levels/level-types";

export {
  getDogLegeDogLevel,
  LevelGenerator,
  MAX_LEVEL_GENERATION_ATTEMPTS,
} from "@/games/dog-lege-dog/levels/level-generation-engine";
export type {
  LevelCandidateFilter,
  LevelGeneratorOptions,
  LevelGeneratorRequest,
} from "@/games/dog-lege-dog/levels/level-generator-contracts";
export {
  DogLevelGenerationService,
  getPreparedDogLevel,
} from "@/games/dog-lege-dog/levels/level-generation-service";
export type {
  DogLevelGenerationServiceOptions,
  DogLevelGenerationWorker,
  DogLevelGenerationWorkerRequest,
  DogLevelGenerationWorkerResponse,
  DogLevelPreparationRequest,
  DogPreparedLevelPayload,
} from "@/games/dog-lege-dog/levels/level-generation-service";
export { GamePreparationError } from "@/game-contracts";
export {
  DOG_SHAPE_TEMPLATES,
} from "@/games/dog-lege-dog/levels/level-shapes";
export type { DogShapeTemplate } from "@/games/dog-lege-dog/levels/level-shapes";
export {
  calculateDifficultyMetrics,
  compareDifficultyDistance,
  isDifficultyAtLeastTarget,
  isDifficultyWithinTarget,
} from "@/games/dog-lege-dog/levels/level-difficulty";
export {
  getDifficultyTarget,
  getBlockCount,
  getMaxLayers,
  getPatternTypeCount,
} from "@/games/dog-lege-dog/levels/level-progression";
export {
  findSolvability,
  findSolvabilityFromState,
} from "@/games/dog-lege-dog/levels/level-solvability";
export type {
  SolvabilityResult,
  SolvabilitySearchOptions,
  SolvabilityStateOptions,
} from "@/games/dog-lege-dog/levels/level-solvability";
export {
  calculateDogLevelReward,
  DOG_LEVEL_REWARD_CONFIG,
  DOG_REWARD_CONFIG_VERSION,
} from "@/games/dog-lege-dog/levels/level-reward";
export type { DogLevelRewardConfig } from "@/games/dog-lege-dog/levels/level-reward";
export { createRunSeed, getDogTrayLockCount } from "@/games/dog-lege-dog/levels/level-random";

export {
  DOG_V13_CONFIG,
  DOG_V13_SCHEMA_VERSION,
  assertDogV13Config,
  getDogTestProfile,
  getDogV13ConfigIssues,
  getDogV13DifficultyTarget,
  getDogV13ItemUses,
  getDogV13LevelStage,
  getDogV13LevelStageIndex,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
  getDogV13SpecialMechanismBudget,
  loadDogV13Config,
  selectDogTestProfile,
  validateDogV13Config,
  DogV13ConfigError,
} from "@/games/dog-lege-dog/game/v13-config";
export type {
  DogConfigChangeArea,
  DogV13AppCopy,
  DogV13Config,
  DogV13ConfigIssue,
  DogV13DifficultyScoring,
  DogV13DifficultyTarget,
  DogV13ItemId,
  DogV13ItemCopy,
  DogV13LoadoutCopy,
  DogV13MechanismDefinition,
  DogV13MechanismPlan,
  DogV13MechanismType,
  DogV13MechanismPresentation,
  DogV13ParticleEffectName,
  DogV13ParticleEffectProfile,
  DogV13Range,
  DogV13ResultDisplay,
  DogV13SoundEffectProfile,
  DogV13SoundWaveform,
  DogV13StructureStage,
  DogV13TestProfile,
  DogV13TestProfileName,
} from "@/games/dog-lege-dog/game/v13-config";
export {
  createDogGenerationTestCase,
  formatDogGenerationTestReport,
} from "@/games/dog-lege-dog/game/test-profile";
export type { DogGenerationTestCase } from "@/games/dog-lege-dog/game/test-profile";

export {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_FREEZE_MELT_TRIPLE_COUNT,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_ILLUSION_MASK_STATUS,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
  DOG_SPECIAL_MECHANISM_DENSITY_LIMIT,
  DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO,
  DOG_SPECIAL_MECHANISM_HANDLERS,
  createDogSpecialMechanism,
  createDogIllusionMechanism,
  createDogSpecialMechanismHandlerMap,
  createDogSpecialMechanismHandlers,
  getDogBlockLogicalUnitCount,
  getDogLogicalBlockCount,
  getDogTrayLogicalUnitCount,
  getDogSpecialMechanismLogicalUnitWeight,
  getDogSpecialMechanismComposition,
  getDogIllusionDisguisedPattern,
  getDogSpecialMechanismConfigs,
  selectDogSpecialMechanismCounts,
  validateDogSpecialMechanismComposition,
  validateDogSpecialMechanismConfiguration,
} from "@/games/dog-lege-dog/game/special-mechanisms";
export type { DogSpecialMechanismComposition } from "@/games/dog-lege-dog/game/special-mechanisms";
export { assignDogV13SpecialMechanisms } from "@/games/dog-lege-dog/levels/level-mechanism-assignment";
export {
  chooseDogMagneticTargetIndex,
  createDogMagneticRandom,
  resolveDogSelection,
} from "@/games/dog-lege-dog/levels/level-mechanism-resolution";
export type { DogSelectionResolution } from "@/games/dog-lege-dog/levels/level-mechanism-resolution";

export {
  DOG_ITEM_DEFINITIONS,
  DOG_ITEM_IDS,
  DOG_LOADOUT_SIZE,
  areDogLoadoutsEqual,
  getDogItemDefinition,
  isDogItemId,
  isValidDogLoadout,
  normalizeDogLoadout,
} from "@/games/dog-lege-dog/game/dog-loadout";
export type {
  DogItemDefinition,
  DogItemId,
  DogLoadoutSummaryItemState,
  DogItemTargetType,
  DogItemVisualFeedback,
} from "@/games/dog-lege-dog/game/dog-loadout";
export {
  DOG_ITEM_RUNTIME_DEFINITIONS,
  DogItemRuntime,
  getDogItemUses,
} from "@/games/dog-lege-dog/game/dog-item-runtime";
export type {
  DogItemAnimationCompletion,
  DogItemEffect,
  DogKeyDropResult,
  DogItemActionResult,
  DogItemAvailabilityContext,
  DogItemExecutionContext,
  DogItemExecutionResult,
  DogItemRuntimeDefinition,
  DogItemRuntimeOptions,
  DogItemRuntimePhase,
  DogItemRuntimeSnapshot,
  DogItemState,
  DogItemTarget,
} from "@/games/dog-lege-dog/game/dog-item-runtime";

export { createDogLegeDogGame, startDogLegeDogGame } from "@/games/dog-lege-dog/game/game-controller";
export type {
  DogLegeDogGame,
  DogLegeDogGameOptions,
  DogLegeDogGameState,
  DogVisualFeedback,
} from "@/games/dog-lege-dog/game/game-types";
