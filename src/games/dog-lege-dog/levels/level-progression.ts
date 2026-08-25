import type { DogDifficultyTarget } from "@/games/dog-lege-dog/levels/level-types";
import { LEVEL_GENERATOR_VERSION } from "@/games/dog-lege-dog/game/game-config";

export type ProgressStage = 0 | 1 | 2 | 3;

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
    // Twin logical units add a small tray-pressure cost from level 6 onward.
    durationMinutes: { min: 8.4, max: 9.2 },
  },
  {
    safeChoiceCount: { min: 38, max: 55 },
    safeChoiceRate: { min: 0.26, max: 0.4 },
    durationMinutes: { min: 8.6, max: 9.4 },
  },
  {
    safeChoiceCount: { min: 40, max: 59 },
    safeChoiceRate: { min: 0.25, max: 0.4 },
    durationMinutes: { min: 9.1, max: 10 },
  },
  {
    safeChoiceCount: { min: 43, max: 66 },
    safeChoiceRate: { min: 0.24, max: 0.39 },
    durationMinutes: { min: 9.4, max: 10.4 },
  },
  {
    safeChoiceCount: { min: 49, max: 70 },
    safeChoiceRate: { min: 0.23, max: 0.37 },
    durationMinutes: { min: 9.8, max: 10.7 },
  },
  {
    safeChoiceCount: { min: 40, max: 65 },
    safeChoiceRate: { min: 0.22, max: 0.36 },
    durationMinutes: { min: 10, max: 11 },
  },
].map((target) =>
  Object.freeze({
    safeChoiceCount: Object.freeze({ ...target.safeChoiceCount }),
    safeChoiceRate: Object.freeze({ ...target.safeChoiceRate }),
    durationMinutes: Object.freeze({ ...target.durationMinutes }),
  }),
);

export function getBlockCount(levelNumber: number): number {
  validateLevelNumber(levelNumber);
  const stage = Math.min(5, Math.floor((levelNumber - 1) / 5));
  return 90 + stage * 18;
}

export function getMaxLayers(levelNumber: number): number {
  return [3, 4, 5, 6][getProgressStage(levelNumber)];
}

export function getPatternTypeCount(levelNumber: number): number {
  return [6, 8, 10, 10][getProgressStage(levelNumber)];
}

export function getDifficultyTarget(levelNumber: number): DogDifficultyTarget {
  return getDifficultyTargetForGeneratorVersion(levelNumber, LEVEL_GENERATOR_VERSION);
}

export function getDifficultyTargetForGeneratorVersion(
  levelNumber: number,
  generatorVersion: number | undefined,
): DogDifficultyTarget {
  validateLevelNumber(levelNumber);
  const target = generatorVersion !== undefined && generatorVersion < LEVEL_GENERATOR_VERSION
    ? LEGACY_DIFFICULTY_TARGETS[getProgressStage(levelNumber)]
    : getCurrentDifficultyTarget(levelNumber);
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
  };
}

function getCurrentDifficultyTarget(levelNumber: number): DogDifficultyTarget {
  const target = levelNumber <= 5
    ? CURRENT_DIFFICULTY_TARGETS[levelNumber - 1]
    : CURRENT_DIFFICULTY_TARGETS[Math.min(
        CURRENT_DIFFICULTY_TARGETS.length - 1,
        Math.floor((levelNumber - 1) / 5) + 4,
      )];
  if (target === undefined) {
    throw new Error("狗了个狗 current difficulty target is unavailable");
  }
  return target;
}

export function getProgressStage(levelNumber: number): ProgressStage {
  validateLevelNumber(levelNumber);
  if (levelNumber <= 5) {
    return 0;
  }

  if (levelNumber <= 15) {
    return 1;
  }

  if (levelNumber <= 30) {
    return 2;
  }

  return 3;
}

function validateLevelNumber(levelNumber: number): void {
  if (!Number.isSafeInteger(levelNumber) || levelNumber < 1) {
    throw new Error("狗了个狗 level number must be a positive integer");
  }
}
