import {
  DOG_V13_CONFIG,
  getDogV13DifficultyTarget,
  getDogV13LevelStage,
  getDogV13LevelStageIndex,
  getDogV13LogicalBlockCount,
} from "@/games/dog-lege-dog/game/v13-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type { DogDifficultyTarget } from "@/games/dog-lege-dog/levels/level-types";

export type ProgressStage = 0 | 1 | 2 | 3;

export function getBlockCount(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  validateLevelNumber(levelNumber, config);
  return getDogV13LogicalBlockCount(levelNumber, config);
}

export function getMaxLayers(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  validateLevelNumber(levelNumber, config);
  return getDogV13LevelStage(levelNumber, config).maxLayers;
}

export function getPatternTypeCount(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  validateLevelNumber(levelNumber, config);
  return getDogV13LevelStage(levelNumber, config).patternTypeCount;
}

export function getDifficultyTarget(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): DogDifficultyTarget {
  validateLevelNumber(levelNumber, config);
  const target = getDogV13DifficultyTarget(levelNumber, config);
  return {
    safeChoiceCount: { ...target.safeChoiceCount },
    safeChoiceRate: { ...target.safeChoiceRate },
    durationMinutes: { ...target.durationMinutes },
    trayPeakPressure: { ...target.trayPeakPressure },
    mechanismDensity: { ...target.mechanismDensity },
    operationCost: { ...target.operationCost },
    mistakeRisk: { ...target.mistakeRisk },
  };
}

export function getProgressStage(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): ProgressStage {
  validateLevelNumber(levelNumber, config);
  return getDogV13LevelStageIndex(levelNumber, config) as ProgressStage;
}

function validateLevelNumber(levelNumber: number, config: DogV13Config): void {
  if (
    !Number.isSafeInteger(levelNumber) ||
    levelNumber < config.game.firstLevelNumber ||
    levelNumber > config.game.maxLevelNumber
  ) {
    throw new Error(
      `狗了个狗 level number must be an integer from ${config.game.firstLevelNumber} to ${config.game.maxLevelNumber}`,
    );
  }
}
