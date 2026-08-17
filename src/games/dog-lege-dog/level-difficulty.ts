import type {
  DogBoardShape,
  DogDifficultyTarget,
  DogLevelDifficulty,
  DogLevelGeometry,
} from "./level-types";
import { getDifficultyTarget } from "./level-progression";
import {
  countSafeChoices,
  findSolvablePath,
  verifyRemovalPath,
  type PathVerification,
} from "./level-solvability";
import { createBlockGraph } from "./level-graph";

const SHAPE_COMPLEXITY: Readonly<Record<DogBoardShape, number>> = {
  rectangle: 1,
  star: 2,
  heart: 3,
  irregular: 4,
};

export function isDifficultyWithinTarget(
  difficulty: DogLevelDifficulty,
  target: DogDifficultyTarget = difficulty.target,
): boolean {
  return (
    isWithinRange(difficulty.safeChoiceCount, target.safeChoiceCount) &&
    isWithinRange(difficulty.estimatedDurationMinutes, target.durationMinutes)
  );
}

export function calculateDifficultyMetrics(
  level: DogLevelGeometry,
  solutionPath?: readonly string[],
  knownVerification?: PathVerification,
): DogLevelDifficulty {
  const path = solutionPath ?? findSolvablePath(level) ?? [];
  const verification =
    knownVerification ?? verifyRemovalPath(level, path);
  const graph = createBlockGraph(level.blocks);
  const initialSelectable = graph.higherBlockCounts.filter((count) => count === 0).length;
  const rawSafeChoiceCount = countSafeChoices(level, path, graph);
  const safeChoiceCount = rawSafeChoiceCount;
  const coveredBlocks = graph.higherBlockCounts.filter((count) => count > 0).length;
  const coverageRate = level.blocks.length === 0 ? 0 : coveredBlocks / level.blocks.length;
  const target = getDifficultyTarget(level.number);
  const shapeComplexity = SHAPE_COMPLEXITY[level.board.shape];
  const estimatedDurationMinutes = estimateDurationMinutes(
    level,
    coverageRate,
    safeChoiceCount,
    verification.trayPeakPressure,
  );
  const difficulty = {
    blockCount: level.blocks.length,
    maxLayers: level.maxLayers,
    coverageRate,
    initialSelectableCount: initialSelectable,
    rawSafeChoiceCount,
    safeChoiceCount,
    trayPeakPressure: verification.trayPeakPressure,
    shapeComplexity,
    patternTypeCount: level.patternTypes.length,
    estimatedDurationMinutes,
    target,
    withinTarget: false,
  } satisfies DogLevelDifficulty;

  return Object.freeze({
    ...difficulty,
    withinTarget: verification.solvable && isDifficultyWithinTarget(difficulty, target),
  });
}

export function getRelaxedDifficultyTarget(
  levelNumber: number,
  attempt: number,
): DogDifficultyTarget {
  const target = getDifficultyTarget(levelNumber);
  const relaxationSteps = Math.floor(Math.max(0, attempt - 1) / 25);
  return {
    safeChoiceCount: {
      min: Math.max(1, target.safeChoiceCount.min - relaxationSteps),
      max: target.safeChoiceCount.max + relaxationSteps,
    },
    durationMinutes: {
      min: Math.max(1, target.durationMinutes.min - relaxationSteps * 0.25),
      max: target.durationMinutes.max + relaxationSteps * 0.25,
    },
  };
}

export function compareDifficultyDistance(
  first: DogLevelDifficulty,
  second: DogLevelDifficulty,
): number {
  return difficultyDistance(first) - difficultyDistance(second);
}

function difficultyDistance(difficulty: DogLevelDifficulty): number {
  const safeDistance = rangeDistance(
    difficulty.safeChoiceCount,
    difficulty.target.safeChoiceCount,
  );
  const durationDistance = rangeDistance(
    difficulty.estimatedDurationMinutes,
    difficulty.target.durationMinutes,
  );
  return safeDistance * 10 + durationDistance;
}

function rangeDistance(value: number, range: { min: number; max: number }): number {
  if (value < range.min) {
    return range.min - value;
  }

  if (value > range.max) {
    return value - range.max;
  }

  return 0;
}

function isWithinRange(
  value: number,
  range: { min: number; max: number },
): boolean {
  return value >= range.min && value <= range.max;
}

function estimateDurationMinutes(
  level: DogLevelGeometry,
  coverageRate: number,
  safeChoiceCount: number,
  trayPeakPressure: number,
): number {
  const shapeScore = SHAPE_COMPLEXITY[level.board.shape] / 4;
  const blockScore = level.blocks.length / 180;
  const layerScore = level.maxLayers / 6;
  const pressureScore = trayPeakPressure / 7;
  const safeChoiceScore = 1 / Math.max(1, safeChoiceCount);
  const rawDuration =
    3.8 +
    3 * blockScore +
    1.4 * layerScore +
    1.2 * coverageRate +
    0.7 * shapeScore +
    0.4 * pressureScore +
    0.4 * safeChoiceScore;
  return Math.round(rawDuration * 10) / 10;
}
