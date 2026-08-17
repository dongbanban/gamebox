import type { GameResultDisplayMetadata } from "../../catalog";
import type { DogPatternType } from "./level-types";

const GAME_ID = "dog-lege-dog" as const;
const GENERATOR_VERSION = 2 as const;

export const DOG_GAME_RESULT_DISPLAY: GameResultDisplayMetadata = Object.freeze({
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
  firstLevelSeed: `${GAME_ID}:first-level:v${GENERATOR_VERSION}`,
  firstLevelMaxLayers: 3 as const,
  firstLevelPatternTypes: Object.freeze([
    "打工狗",
    "单身狗",
    "舔狗",
    "看门狗",
  ] as readonly DogPatternType[]),
});

export const DOG_GAME_ID = DOG_LEGE_DOG_CONFIG.id;
export const LEVEL_GENERATOR_VERSION = DOG_LEGE_DOG_CONFIG.generatorVersion;
export const FIRST_LEVEL_GENERATOR_VERSION = DOG_LEGE_DOG_CONFIG.generatorVersion;
export const DEFAULT_LEVEL_SEED = DOG_LEGE_DOG_CONFIG.defaultSeed;
export const DEFAULT_LEVEL_REWARD = DOG_LEGE_DOG_CONFIG.defaultReward;
export const FIRST_LEVEL_NUMBER = DOG_LEGE_DOG_CONFIG.firstLevelNumber;
export const FIRST_LEVEL_SEED = DOG_LEGE_DOG_CONFIG.firstLevelSeed;
export const FIRST_LEVEL_MAX_LAYERS = DOG_LEGE_DOG_CONFIG.firstLevelMaxLayers;
export const FIRST_LEVEL_PATTERN_TYPES = DOG_LEGE_DOG_CONFIG.firstLevelPatternTypes;
