import type {
  DogSpecialMechanismConfig,
} from "@/games/dog-lege-dog/levels/level-types";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config";

export {
  DOG_V13_CONFIG,
  DOG_V13_SCHEMA_VERSION,
  DogV13ConfigError,
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
} from "@/games/dog-lege-dog/game/v13-config";
export type {
  DogConfigChangeArea,
  DogV13Config,
  DogV13ConfigIssue,
  DogV13DifficultyTarget,
  DogV13ItemId,
  DogV13MechanismDefinition,
  DogV13MechanismPlan,
  DogV13MechanismType,
  DogV13Range,
  DogV13SoundEffectProfile,
  DogV13SoundWaveform,
  DogV13StructureStage,
  DogV13TestProfile,
  DogV13TestProfileName,
} from "@/games/dog-lege-dog/game/v13-config";

const GAME_ID = DOG_V13_CONFIG.game.id;
const GENERATOR_VERSION = DOG_V13_CONFIG.game.generatorVersion;
export const MAX_LEVEL_NUMBER = DOG_V13_CONFIG.game.maxLevelNumber;
export const DOG_BASE_TRAY_CAPACITY = DOG_V13_CONFIG.tray.baseCapacity;
export const DOG_MAX_LOCKED_TRAY_SLOTS = DOG_V13_CONFIG.tray.maxLockedSlotCount;
export const DOG_KEY_DROP_RATE = DOG_V13_CONFIG.items.key.dropRate;

export const DOG_GAME_RESULT_DISPLAY = Object.freeze({
  won: Object.freeze({
    eyebrow: "狗了个狗 · 关卡结果",
    title: "通关！",
    description: "完成。",
  }),
  final: Object.freeze({
    eyebrow: "狗了个狗 · 最终通关",
    title: "你就是最狗的玩家",
    description: `全部 ${MAX_LEVEL_NUMBER} 关完成。`,
  }),
  lost: Object.freeze({
    eyebrow: "狗了个狗 · 关卡结果",
    title: "失败",
    description: "暂存槽已满，进度未改变。",
  }),
});

/** Stable identity/config for all dog-lege-dog level consumers. */
export const DOG_LEGE_DOG_CONFIG = Object.freeze({
  id: GAME_ID,
  generatorVersion: GENERATOR_VERSION,
  defaultSeed: DOG_V13_CONFIG.game.defaultSeed,
  defaultReward: DOG_V13_CONFIG.game.defaultReward,
  firstLevelNumber: DOG_V13_CONFIG.game.firstLevelNumber,
  maxLevelNumber: MAX_LEVEL_NUMBER,
  // Legacy adapter. New code reads DOG_V13_CONFIG directly.
  firstLevelSeed: DOG_V13_CONFIG.firstLevel.seed,
  firstLevelBlockCount: DOG_V13_CONFIG.firstLevel.blockCount,
  firstLevelMaxLayers: DOG_V13_CONFIG.firstLevel.maxLayers,
  firstLevelPatternTypes: DOG_V13_CONFIG.firstLevel.patternTypes,
  firstLevelTemplateId: DOG_V13_CONFIG.firstLevel.templateId,
  // Legacy adapter. v13 mechanism definitions live in DOG_V13_CONFIG.specialMechanisms.
  specialMechanisms: Object.freeze([
    Object.freeze({
      type: "freeze",
      min: 1,
      max: 2,
      minByStage: Object.freeze([1, 2, 2, 3]),
      maxByStage: Object.freeze([2, 3, 4, 4]),
    }),
    Object.freeze({
      type: "illusion",
      min: 1,
      max: 2,
      minByStage: Object.freeze([1, 2, 3, 3]),
      maxByStage: Object.freeze([2, 3, 4, 5]),
    }),
    Object.freeze({
      type: "magnetic",
      min: 1,
      max: 2,
      minByStage: Object.freeze([1, 2, 2, 3]),
      maxByStage: Object.freeze([2, 3, 4, 4]),
      densityWeight: 1,
    }),
    Object.freeze({
      type: "twin",
      min: 1,
      max: 2,
      minByStage: Object.freeze([1, 2, 2, 3]),
      maxByStage: Object.freeze([2, 3, 4, 4]),
      densityWeight: 2,
    }),
  ] as readonly DogSpecialMechanismConfig[]),
});

export const DOG_FREEZE_GENERATOR_VERSION = 7 as const;
export const DOG_ILLUSION_GENERATOR_VERSION = 8 as const;
export const DOG_SPECIAL_MECHANISM_GENERATOR_VERSION = 11 as const;
export const DOG_DIFFICULTY_CURVE_GENERATOR_VERSION = 11 as const;
export const DOG_TRAY_LOCKS_GENERATOR_VERSION = GENERATOR_VERSION;

/** v7 replay metadata must keep its freeze-only quantity policy. */
export const DOG_FREEZE_ONLY_SPECIAL_MECHANISM_DEFINITIONS = Object.freeze([
  Object.freeze({ type: "freeze", min: 1, max: 2 }),
] as readonly DogSpecialMechanismConfig[]);

/** v8–v10 replay metadata must keep its two-mechanism quantity policy. */
export const DOG_LEGACY_SPECIAL_MECHANISM_DEFINITIONS = Object.freeze([
  Object.freeze({ type: "freeze", min: 1, max: 2 }),
  Object.freeze({ type: "illusion", min: 1, max: 2 }),
] as readonly DogSpecialMechanismConfig[]);

export const DOG_GAME_ID = DOG_LEGE_DOG_CONFIG.id;
export const LEVEL_GENERATOR_VERSION = DOG_LEGE_DOG_CONFIG.generatorVersion;
export const FIRST_LEVEL_GENERATOR_VERSION = DOG_LEGE_DOG_CONFIG.generatorVersion;
export const DEFAULT_LEVEL_SEED = DOG_LEGE_DOG_CONFIG.defaultSeed;
export const DEFAULT_LEVEL_REWARD = DOG_LEGE_DOG_CONFIG.defaultReward;
export const FIRST_LEVEL_NUMBER = DOG_LEGE_DOG_CONFIG.firstLevelNumber;
export const FIRST_LEVEL_SEED = DOG_LEGE_DOG_CONFIG.firstLevelSeed;
export const FIRST_LEVEL_BLOCK_COUNT = DOG_LEGE_DOG_CONFIG.firstLevelBlockCount;
export const FIRST_LEVEL_MAX_LAYERS = DOG_LEGE_DOG_CONFIG.firstLevelMaxLayers;
export const FIRST_LEVEL_PATTERN_TYPES = DOG_LEGE_DOG_CONFIG.firstLevelPatternTypes;
export const FIRST_LEVEL_TEMPLATE_ID = DOG_LEGE_DOG_CONFIG.firstLevelTemplateId;
export const DOG_LEVEL_SPECIAL_MECHANISM_DEFINITIONS =
  DOG_LEGE_DOG_CONFIG.specialMechanisms;
