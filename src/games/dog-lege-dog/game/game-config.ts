import type {
  DogPatternType,
  DogSpecialMechanismConfig,
} from "@/games/dog-lege-dog/levels/level-types";

const GAME_ID = "dog-lege-dog" as const;
const GENERATOR_VERSION = 11 as const;

export const DOG_GAME_RESULT_DISPLAY = Object.freeze({
  won: Object.freeze({
    eyebrow: "狗了个狗 · 关卡结果",
    title: "通关！",
    description: "完成。",
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
  defaultSeed: GAME_ID,
  defaultReward: 100 as const,
  firstLevelNumber: 1 as const,
  // Keep fixed first-level geometry stable across generator versions.
  firstLevelSeed: `${GAME_ID}:first-level:v9`,
  firstLevelBlockCount: 90 as const,
  firstLevelMaxLayers: 3 as const,
  firstLevelPatternTypes: Object.freeze([
    "打工狗",
    "单身狗",
    "舔狗",
    "看门狗",
    "疯狗",
    "拆家狗",
  ] as readonly DogPatternType[]),
  firstLevelTemplateId: "irregular-first-level-v2" as const,
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
