import type { DogDifficultyTarget } from "@/games/dog-lege-dog/levels/level-types";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import {
  DOG_DIFFICULTY_CURVE_GENERATOR_VERSION,
  DOG_V13_CONFIG,
  getDogV13DifficultyTarget,
  LEVEL_GENERATOR_VERSION,
  getDogV13LevelStage,
  getDogV13LevelStageIndex,
  getDogV13LogicalBlockCount,
} from "@/games/dog-lege-dog/game/game-config";

export type ProgressStage = 0 | 1 | 2 | 3;

/** Legacy adapter. v13 target ranges live in DOG_V13_CONFIG. */
const LEGACY_DIFFICULTY_TARGETS: readonly DogDifficultyTarget[] = [
  {
    safeChoiceCount: { min: 3, max: Number.MAX_SAFE_INTEGER },
    durationMinutes: { min: 6, max: 8 },
  },
  {
    safeChoiceCount: { min: 2, max: Number.MAX_SAFE_INTEGER },
    durationMinutes: { min: 7, max: 9 },
  },
  {
    safeChoiceCount: { min: 1, max: 2 },
    durationMinutes: { min: 8, max: 10 },
  },
  {
    safeChoiceCount: { min: 1, max: 2 },
    durationMinutes: { min: 8, max: 12 },
  },
].map((target) =>
  Object.freeze({
    safeChoiceCount: Object.freeze({ ...target.safeChoiceCount }),
    durationMinutes: Object.freeze({ ...target.durationMinutes }),
  }),
);

/**
 * Difficulty targets are intentionally narrower than the old stage-wide
 * ranges. The first five levels get individual targets so the learning curve
 * changes before block-count progression starts at level 6.
 */
const CURRENT_DIFFICULTY_TARGETS: readonly DogDifficultyTarget[] = [
  {
    safeChoiceCount: { min: 32, max: 40 },
    safeChoiceRate: { min: 0.34, max: 0.48 },
    durationMinutes: { min: 7.8, max: 8.3 },
  },
  {
    safeChoiceCount: { min: 29, max: 39 },
    safeChoiceRate: { min: 0.32, max: 0.46 },
    durationMinutes: { min: 7.9, max: 8.4 },
  },
  {
    safeChoiceCount: { min: 29, max: 38 },
    safeChoiceRate: { min: 0.31, max: 0.44 },
    durationMinutes: { min: 8, max: 8.5 },
  },
  {
    safeChoiceCount: { min: 28, max: 38 },
    safeChoiceRate: { min: 0.3, max: 0.43 },
    durationMinutes: { min: 8, max: 8.6 },
  },
  {
    safeChoiceCount: { min: 28, max: 37 },
    safeChoiceRate: { min: 0.29, max: 0.42 },
    durationMinutes: { min: 8.1, max: 8.7 },
  },
  {
    safeChoiceCount: { min: 29, max: 45 },
    safeChoiceRate: { min: 0.27, max: 0.4 },
    // Twin logical units and locked slots add tray-pressure cost from level 6 onward.
    durationMinutes: { min: 8.4, max: 9.4 },
  },
  {
    safeChoiceCount: { min: 38, max: 55 },
    safeChoiceRate: { min: 0.26, max: 0.4 },
    durationMinutes: { min: 8.6, max: 9.6 },
  },
  {
    safeChoiceCount: { min: 40, max: 59 },
    safeChoiceRate: { min: 0.25, max: 0.4 },
    // v12 lock-aware generation widened the 16–20 upper tolerance by 0.2 min.
    durationMinutes: { min: 9.1, max: 10.2 },
  },
  {
    safeChoiceCount: { min: 43, max: 66 },
    safeChoiceRate: { min: 0.24, max: 0.39 },
    durationMinutes: { min: 9.4, max: 10.6 },
  },
  {
    safeChoiceCount: { min: 49, max: 70 },
    safeChoiceRate: { min: 0.23, max: 0.37 },
    durationMinutes: { min: 9.8, max: 10.9 },
  },
  {
    safeChoiceCount: { min: 40, max: 65 },
    safeChoiceRate: { min: 0.22, max: 0.36 },
    // v12 lock-aware generation also widens the 31+ upper tolerance.
    durationMinutes: { min: 10, max: 11.2 },
  },
].map((target) =>
  Object.freeze({
    safeChoiceCount: Object.freeze({ ...target.safeChoiceCount }),
    safeChoiceRate: Object.freeze({ ...target.safeChoiceRate }),
    durationMinutes: Object.freeze({ ...target.durationMinutes }),
  }),
);

/** v11 replay targets exclude v12 lock-pressure tolerance widening. */
const PREVIOUS_CURRENT_DURATION_MAXIMA = [
  8.3,
  8.4,
  8.5,
  8.6,
  8.7,
  9.2,
  9.4,
  10,
  10.4,
  10.7,
  11,
] as const;
const PREVIOUS_CURRENT_DIFFICULTY_TARGETS: readonly DogDifficultyTarget[] =
  CURRENT_DIFFICULTY_TARGETS.map((target, index) =>
    Object.freeze({
      safeChoiceCount: target.safeChoiceCount,
      safeChoiceRate: target.safeChoiceRate,
      durationMinutes: Object.freeze({
        min: target.durationMinutes.min,
        max: PREVIOUS_CURRENT_DURATION_MAXIMA[index] ?? target.durationMinutes.max,
      }),
    }),
  );

export function getBlockCount(
  levelNumber: number,
  configOrMapIndex: DogV13Config | number = DOG_V13_CONFIG,
): number {
  const config = resolveConfig(configOrMapIndex);
  validateLevelNumber(levelNumber, config);
  return getDogV13LogicalBlockCount(levelNumber, config);
}

export function getMaxLayers(
  levelNumber: number,
  configOrMapIndex: DogV13Config | number = DOG_V13_CONFIG,
): number {
  const config = resolveConfig(configOrMapIndex);
  return getDogV13LevelStage(levelNumber, config).maxLayers;
}

export function getPatternTypeCount(
  levelNumber: number,
  configOrMapIndex: DogV13Config | number = DOG_V13_CONFIG,
): number {
  const config = resolveConfig(configOrMapIndex);
  return getDogV13LevelStage(levelNumber, config).patternTypeCount;
}

export function getDifficultyTarget(levelNumber: number): DogDifficultyTarget {
  return getDifficultyTargetForGeneratorVersion(levelNumber, LEVEL_GENERATOR_VERSION);
}

export function getDifficultyTargetForGeneratorVersion(
  levelNumber: number,
  generatorVersion: number | undefined,
  config: DogV13Config = DOG_V13_CONFIG,
): DogDifficultyTarget {
  validateLevelNumber(levelNumber, config);
  if (
    generatorVersion !== undefined &&
    generatorVersion >= config.game.generatorVersion
  ) {
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
  const target = generatorVersion !== undefined &&
      generatorVersion < DOG_DIFFICULTY_CURVE_GENERATOR_VERSION
    ? LEGACY_DIFFICULTY_TARGETS[getProgressStage(levelNumber, config)]
    : getCurrentDifficultyTarget(
        levelNumber,
        generatorVersion !== undefined && generatorVersion < LEVEL_GENERATOR_VERSION
          ? PREVIOUS_CURRENT_DIFFICULTY_TARGETS
          : CURRENT_DIFFICULTY_TARGETS,
      );
  if (target === undefined) {
    throw new Error("狗了个狗 difficulty target is unavailable");
  }
  return cloneDifficultyTarget(target);
}

function cloneDifficultyTarget(target: DogDifficultyTarget): DogDifficultyTarget {
  return {
    safeChoiceCount: { ...target.safeChoiceCount },
    ...(target.safeChoiceRate === undefined
      ? {}
      : { safeChoiceRate: { ...target.safeChoiceRate } }),
    durationMinutes: { ...target.durationMinutes },
    ...(target.trayPeakPressure === undefined
      ? {}
      : { trayPeakPressure: { ...target.trayPeakPressure } }),
    ...(target.mechanismDensity === undefined
      ? {}
      : { mechanismDensity: { ...target.mechanismDensity } }),
    ...(target.operationCost === undefined
      ? {}
      : { operationCost: { ...target.operationCost } }),
    ...(target.mistakeRisk === undefined
      ? {}
      : { mistakeRisk: { ...target.mistakeRisk } }),
  };
}

function getCurrentDifficultyTarget(
  levelNumber: number,
  targets: readonly DogDifficultyTarget[],
): DogDifficultyTarget {
  const target = levelNumber <= 5
    ? targets[levelNumber - 1]
    : targets[Math.min(
        targets.length - 1,
        Math.floor((levelNumber - 1) / 5) + 4,
      )];
  if (target === undefined) {
    throw new Error("狗了个狗 current difficulty target is unavailable");
  }
  return target;
}

export function getProgressStage(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): ProgressStage {
  validateLevelNumber(levelNumber, config);
  return getDogV13LevelStageIndex(levelNumber, config) as ProgressStage;
}

function validateLevelNumber(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): void {
  if (
    !Number.isSafeInteger(levelNumber) ||
    levelNumber < 1 ||
    levelNumber > config.game.maxLevelNumber
  ) {
    throw new Error(
      `狗了个狗 level number must be an integer from 1 to ${config.game.maxLevelNumber}`,
    );
  }
}

function resolveConfig(configOrMapIndex: DogV13Config | number): DogV13Config {
  return typeof configOrMapIndex === "number" ? DOG_V13_CONFIG : configOrMapIndex;
}
