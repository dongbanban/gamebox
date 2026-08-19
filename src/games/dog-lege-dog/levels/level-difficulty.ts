import type {
  DogDifficultyTarget,
  DogLevelDifficulty,
  DogLevelGeometry,
  DogSafeChoiceSearchStatus,
} from "@/games/dog-lege-dog/levels/level-types";
import { getDifficultyTarget } from "@/games/dog-lege-dog/levels/level-progression";
import {
  countSafeChoiceMetrics,
  findSolvability,
  type SolvabilitySearchOptions,
  verifyRemovalPath,
  type PathVerification,
  type SolvabilityResult,
} from "@/games/dog-lege-dog/levels/level-solvability";
import { createBlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import { getPositiveOverlapArea } from "@/games/dog-lege-dog/levels/level-rules";

export function isDifficultyWithinTarget(
  difficulty: DogLevelDifficulty,
  target: DogDifficultyTarget = difficulty.target,
): boolean {
  return (
    difficulty.solvabilityStatus === "solvable" &&
    difficulty.safeChoiceSearchStatus === "complete" &&
    difficulty.certainty === "certain" &&
    isWithinRange(difficulty.safeChoiceCount, target.safeChoiceCount) &&
    isWithinRange(difficulty.estimatedDurationMinutes, target.durationMinutes)
  );
}

export function calculateDifficultyMetrics(
  level: DogLevelGeometry,
  solutionPath?: readonly string[],
  knownVerification?: PathVerification,
  knownSolvability?: SolvabilityResult,
  searchOptions: SolvabilitySearchOptions = {},
): DogLevelDifficulty {
  const discoveredSolvability =
    knownSolvability ??
    (solutionPath === undefined ? findSolvability(level, searchOptions) : undefined);
  const path = solutionPath ??
    (discoveredSolvability?.status === "solvable" ? discoveredSolvability.path : []);
  const verification =
    knownVerification ??
    (discoveredSolvability === undefined
      ? verifyRemovalPath(level, path)
      : toPathVerification(discoveredSolvability));
  const graph = createBlockGraph(level.blocks);
  const initialSelectable = graph.higherBlockCounts.filter((count) => count === 0).length;
  const target = getDifficultyTarget(level.number);
  const solvabilityStatus =
    discoveredSolvability?.status ?? verification.status;
  const safeChoiceMetrics =
    solvabilityStatus === "solvable" && path.length === level.blocks.length
      ? countSafeChoiceMetrics(level, path, graph, searchOptions)
      : {
          safeChoiceCount: 0,
          searchStatus: solvabilityStatus === "budget-exhausted"
            ? "budget-exhausted"
            : "complete",
        } satisfies {
          safeChoiceCount: number;
          searchStatus: DogSafeChoiceSearchStatus;
        };
  const rawSafeChoiceCount = safeChoiceMetrics.safeChoiceCount;
  const safeChoiceCount = safeChoiceMetrics.safeChoiceCount;
  const coveredBlocks = graph.higherBlockCounts.filter((count) => count > 0).length;
  const coverageRate = level.blocks.length === 0 ? 0 : coveredBlocks / level.blocks.length;
  const shapeComplexity = calculateShapeComplexity(level);
  const estimatedDurationMinutes = estimateDurationMinutes(
    level,
    coverageRate,
    safeChoiceCount,
    verification.trayPeakPressure,
    shapeComplexity,
  );
  const difficulty = {
    blockCount: level.blocks.length,
    maxLayers: level.maxLayers,
    coverageRate,
    initialSelectableCount: initialSelectable,
    rawSafeChoiceCount,
    safeChoiceCount,
    solvabilityStatus,
    safeChoiceSearchStatus: safeChoiceMetrics.searchStatus,
    certainty: safeChoiceMetrics.searchStatus === "complete" ? "certain" : "uncertain",
    trayPeakPressure: verification.trayPeakPressure,
    shapeComplexity,
    patternTypeCount: level.patternTypes.length,
    estimatedDurationMinutes,
    target,
    withinTarget: false,
  } satisfies DogLevelDifficulty;

  return Object.freeze({
    ...difficulty,
    withinTarget: isDifficultyWithinTarget(difficulty, target),
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
  if (first.certainty !== second.certainty) {
    return first.certainty === "certain" ? -1 : 1;
  }

  if (first.solvabilityStatus !== second.solvabilityStatus) {
    return first.solvabilityStatus === "solvable" ? -1 : 1;
  }

  return difficultyDistance(first) - difficultyDistance(second);
}

function toPathVerification(result: SolvabilityResult): PathVerification {
  return {
    status: result.status === "solvable" ? "solvable" : "unsolvable",
    solvable: result.status === "solvable",
    path: result.path,
    trayPeakPressure: result.trayPeakPressure,
    reason: result.reason,
  };
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
  shapeComplexity: number,
): number {
  const shapeScore = shapeComplexity / 4;
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

function calculateShapeComplexity(level: DogLevelGeometry): number {
  const playableCells = new Set(level.board.playableCells.map((cell) => `${cell.x}:${cell.y}`));
  let boundaryEdges = 0;
  let concaveCells = 0;
  for (const cell of level.board.playableCells) {
    const missingNeighbors = [
      `${cell.x - 1}:${cell.y}`,
      `${cell.x + 1}:${cell.y}`,
      `${cell.x}:${cell.y - 1}`,
      `${cell.x}:${cell.y + 1}`,
    ].filter((neighbor) => !playableCells.has(neighbor)).length;
    boundaryEdges += missingNeighbors;
    if (missingNeighbors >= 2) {
      concaveCells += 1;
    }
  }

  const contourScore = Math.min(
    1,
    (boundaryEdges / Math.max(1, level.board.playableCells.length)) * 2 +
      concaveCells / Math.max(1, level.board.playableCells.length),
  );
  const overlapRatios = getCrossLayerOverlapRatios(level);
  const partialOverlapRate = overlapRatios.length === 0
    ? 0
    : overlapRatios.filter((ratio) => ratio === 0.25 || ratio === 0.5).length /
      overlapRatios.length;
  const alignmentRate = overlapRatios.length === 0
    ? 0
    : overlapRatios.filter((ratio) => ratio === 1).length / overlapRatios.length;
  const quarterRate = overlapRatios.length === 0
    ? 0
    : overlapRatios.filter((ratio) => ratio === 0.25).length / overlapRatios.length;
  const halfRate = overlapRatios.length === 0
    ? 0
    : overlapRatios.filter((ratio) => ratio === 0.5).length / overlapRatios.length;
  const overlapDistributionScore = Math.min(1, Math.min(quarterRate, halfRate) * 2);

  return Math.round(
    Math.min(
      4,
      1 +
        contourScore * 1.5 +
        partialOverlapRate * 1.5 +
        overlapDistributionScore * 0.5 +
        (1 - alignmentRate) * 0.5,
    ) *
      10,
  ) / 10;
}

function getCrossLayerOverlapRatios(level: DogLevelGeometry): readonly number[] {
  const ratios: number[] = [];
  for (let firstIndex = 0; firstIndex < level.blocks.length; firstIndex += 1) {
    const first = level.blocks[firstIndex];
    for (const second of level.blocks.slice(firstIndex + 1)) {
      if (first.z === second.z) {
        continue;
      }

      const overlapArea = getPositiveOverlapArea(first, second);
      if (overlapArea > 0) {
        ratios.push(overlapArea / (first.width * first.height));
      }
    }
  }
  return ratios;
}
