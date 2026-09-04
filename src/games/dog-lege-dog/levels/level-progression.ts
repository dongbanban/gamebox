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
  return getDogV13LogicalBlockCount(levelNumber, config);
}

export function getMaxLayers(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  return getDogV13LevelStage(levelNumber, config).maxLayers;
}

export function getPatternTypeCount(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  return getDogV13LevelStage(levelNumber, config).patternTypeCount;
}

export function getDifficultyTarget(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): DogDifficultyTarget {
  return getDogV13DifficultyTarget(levelNumber, config);
}

export function getProgressStage(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): ProgressStage {
  return getDogV13LevelStageIndex(levelNumber, config) as ProgressStage;
}
