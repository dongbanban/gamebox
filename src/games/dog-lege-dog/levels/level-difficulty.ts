import type {
  DogDifficultyTarget,
  DogLevelDifficulty,
  DogLevelGeometry,
  DogSafeChoiceSearchStatus,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  DOG_BASE_TRAY_CAPACITY,
  DOG_DIFFICULTY_CURVE_GENERATOR_VERSION,
} from "@/games/dog-lege-dog/game/game-config";
import {
  getDifficultyTargetForGeneratorVersion,
} from "@/games/dog-lege-dog/levels/level-progression";
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
import {
  getDogLogicalBlockCount,
  getDogSpecialMechanismComposition,
} from "@/games/dog-lege-dog/game/special-mechanisms";

export function isDifficultyWithinTarget(
  difficulty: DogLevelDifficulty,
  target: DogDifficultyTarget = difficulty.target,
): boolean {
  return (
    difficulty.solvabilityStatus === "solvable" &&
    difficulty.safeChoiceSearchStatus === "complete" &&
    difficulty.certainty === "certain" &&
    isWithinRange(difficulty.safeChoiceCount, target.safeChoiceCount) &&
    (target.safeChoiceRate === undefined ||
      isWithinRange(difficulty.safeChoiceRate, target.safeChoiceRate)) &&
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
  const target = getDifficultyTargetForGeneratorVersion(
    level.number,
    level.generatorVersion,
  );
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
  const overlapMetrics = calculateCrossLayerOverlapMetrics(level);
  const shapeComplexity = calculateShapeComplexity(level, overlapMetrics.ratios);
  const specialMechanismComposition = getDogSpecialMechanismComposition(
    level.blocks,
    level.maxLayers,
    level.specialMechanisms ?? [],
  );
  const logicalBlockCount = getDogLogicalBlockCount(
    level.blocks,
    level.specialMechanisms ?? [],
  );
  const safeChoiceRate = logicalBlockCount === 0
    ? 0
    : safeChoiceCount / logicalBlockCount;
  const specialMechanismDifficulty = Math.round(
    (specialMechanismComposition.specialMechanismDensity * 100 +
      specialMechanismComposition.specialMechanismCount * 0.25) *
      10,
  ) / 10;
  const estimatedDurationMinutes = estimateDurationMinutes(
    level,
    coverageRate,
    safeChoiceCount,
    verification.trayPeakPressure,
    shapeComplexity,
    specialMechanismDifficulty,
    safeChoiceRate,
    overlapMetrics.partialOverlapRate,
    level.patternTypes.length,
    logicalBlockCount,
  );
  const difficulty = {
    blockCount: level.blocks.length,
    maxLayers: level.maxLayers,
    coverageRate,
    initialSelectableCount: initialSelectable,
    rawSafeChoiceCount,
    safeChoiceCount,
    safeChoiceRate,
    solvabilityStatus,
    safeChoiceSearchStatus: safeChoiceMetrics.searchStatus,
    certainty: safeChoiceMetrics.searchStatus === "complete" ? "certain" : "uncertain",
    trayPeakPressure: verification.trayPeakPressure,
    shapeComplexity,
    patternTypeCount: level.patternTypes.length,
    logicalBlockCount,
    solutionPathLength: path.length,
    crossLayerOverlapCount: overlapMetrics.ratios.length,
    partialOverlapRate: overlapMetrics.partialOverlapRate,
    alignedOverlapRate: overlapMetrics.alignedOverlapRate,
    specialMechanismCount: specialMechanismComposition.specialMechanismCount,
    specialMechanismLogicalUnitCount: specialMechanismComposition.logicalUnitCount,
    specialMechanismDensity: specialMechanismComposition.specialMechanismDensity,
    specialMechanismDifficulty,
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
  generatorVersion?: number,
): DogDifficultyTarget {
  const target = getDifficultyTargetForGeneratorVersion(levelNumber, generatorVersion);
  if (
    generatorVersion === undefined ||
    generatorVersion >= DOG_DIFFICULTY_CURVE_GENERATOR_VERSION
  ) {
    return target;
  }
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
  const safeRateDistance = difficulty.target.safeChoiceRate === undefined
    ? 0
    : rangeDistance(difficulty.safeChoiceRate, difficulty.target.safeChoiceRate);
  return safeDistance * 10 + safeRateDistance * 100 + durationDistance;
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
  specialMechanismDifficulty: number,
  safeChoiceRate: number,
  partialOverlapRate: number,
  patternTypeCount: number,
  logicalBlockCount: number,
): number {
  const shapeScore = shapeComplexity / 4;
  const blockScore = logicalBlockCount / 180;
  const layerScore = level.maxLayers / 6;
  const effectiveTrayCapacity = DOG_BASE_TRAY_CAPACITY - (level.lockedTraySlotCount ?? 0);
  const pressureScore = trayPeakPressure / Math.max(1, effectiveTrayCapacity);
  const safeChoiceScore = 1 / Math.max(1, safeChoiceCount);
  const choicePressureScore = Math.max(0, 1 - safeChoiceRate);
  const patternScore = Math.max(0, (patternTypeCount - 6) / 4);
  const rawDuration =
    3.8 +
    3 * blockScore +
    1.4 * layerScore +
    1.2 * coverageRate +
    0.7 * shapeScore +
    0.4 * pressureScore +
    0.4 * safeChoiceScore +
    0.1 * specialMechanismDifficulty +
    0.15 * choicePressureScore +
    0.1 * partialOverlapRate +
    0.15 * patternScore;
  return Math.round(rawDuration * 10) / 10;
}

function calculateShapeComplexity(
  level: DogLevelGeometry,
  overlapRatios = calculateCrossLayerOverlapMetrics(level).ratios,
): number {
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

interface CrossLayerOverlapMetrics {
  readonly ratios: readonly number[];
  readonly partialOverlapRate: number;
  readonly alignedOverlapRate: number;
}

function calculateCrossLayerOverlapMetrics(
  level: DogLevelGeometry,
): CrossLayerOverlapMetrics {
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
  return {
    ratios,
    partialOverlapRate: ratios.length === 0
      ? 0
      : ratios.filter((ratio) => ratio === 0.25 || ratio === 0.5).length / ratios.length,
    alignedOverlapRate: ratios.length === 0
      ? 0
      : ratios.filter((ratio) => ratio === 1).length / ratios.length,
  };
}
