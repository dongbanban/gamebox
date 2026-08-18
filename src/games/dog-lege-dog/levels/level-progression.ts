import type { DogDifficultyTarget } from "./level-types";

export type ProgressStage = 0 | 1 | 2 | 3;

const DIFFICULTY_TARGETS: readonly DogDifficultyTarget[] = [
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
  const target = DIFFICULTY_TARGETS[getProgressStage(levelNumber)];
  return {
    safeChoiceCount: { ...target.safeChoiceCount },
    durationMinutes: { ...target.durationMinutes },
  };
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
