import { DEFAULT_LEVEL_REWARD } from "@/games/dog-lege-dog/game/game-config";
import type { DogLevelDifficulty } from "@/games/dog-lege-dog/levels/level-types";

export const DOG_REWARD_CONFIG_VERSION = 1 as const;

export interface DogLevelRewardConfig {
  readonly version: number;
  readonly baseReward: number;
  readonly baselineBlockCount: number;
  readonly blocksPerStage: number;
  readonly rewardPerBlockStage: number;
  readonly baselineLayers: number;
  readonly rewardPerLayer: number;
  readonly baselinePatternTypes: number;
  readonly rewardPerPatternType: number;
  readonly rewardPerDifficultyPoint: number;
}

export const DOG_LEVEL_REWARD_CONFIG: DogLevelRewardConfig = Object.freeze({
  version: DOG_REWARD_CONFIG_VERSION,
  baseReward: DEFAULT_LEVEL_REWARD,
  baselineBlockCount: 90,
  blocksPerStage: 18,
  rewardPerBlockStage: 20,
  baselineLayers: 3,
  rewardPerLayer: 15,
  baselinePatternTypes: 6,
  rewardPerPatternType: 5,
  rewardPerDifficultyPoint: 5,
});

export function calculateDogLevelReward(
  difficulty: DogLevelDifficulty,
  config: DogLevelRewardConfig = DOG_LEVEL_REWARD_CONFIG,
): number {
  assertValidRewardConfig(config);
  assertValidDifficulty(difficulty);

  const blockStage = Math.max(
    0,
    Math.floor(
      (difficulty.blockCount - config.baselineBlockCount) / config.blocksPerStage,
    ),
  );
  const layerBonus =
    Math.max(0, difficulty.maxLayers - config.baselineLayers) * config.rewardPerLayer;
  const patternBonus =
    Math.max(0, difficulty.patternTypeCount - config.baselinePatternTypes) *
    config.rewardPerPatternType;
  const difficultyBonus = blockStage > 0
    ? Math.max(0, difficulty.estimatedDurationMinutes - 6) *
      config.rewardPerDifficultyPoint
    : 0;

  const rawReward =
    config.baseReward +
    blockStage * config.rewardPerBlockStage +
    layerBonus +
    patternBonus +
    difficultyBonus;

  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(rawReward)));
}

function assertValidRewardConfig(config: DogLevelRewardConfig): void {
  if (!Number.isSafeInteger(config.version) || config.version < 1) {
    throw new Error("Dog level reward config version must be a positive integer");
  }

  const nonNegativeValues = [
    config.baseReward,
    config.baselineBlockCount,
    config.blocksPerStage,
    config.rewardPerBlockStage,
    config.baselineLayers,
    config.rewardPerLayer,
    config.baselinePatternTypes,
    config.rewardPerPatternType,
    config.rewardPerDifficultyPoint,
  ];
  if (
    !nonNegativeValues.every(Number.isFinite) ||
    nonNegativeValues.some((value) => value < 0) ||
    config.blocksPerStage === 0
  ) {
    throw new Error("Dog level reward config values must be finite and non-negative");
  }
}

function assertValidDifficulty(difficulty: DogLevelDifficulty): void {
  const values = [
    difficulty.blockCount,
    difficulty.maxLayers,
    difficulty.patternTypeCount,
    difficulty.estimatedDurationMinutes,
  ];
  if (!values.every(Number.isFinite)) {
    throw new Error("Dog level difficulty values must be finite");
  }
}
