import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import {
  getBlockCount,
  getMaxLayers,
} from "@/games/dog-lege-dog/levels/level-progression";
import {
  createBoard,
  DOG_SHAPE_TEMPLATES,
  type DogShapeTemplate,
} from "@/games/dog-lege-dog/levels/level-shapes";
import {
  createRemovalPathPlan,
  createSolvableBlockPlacements,
  createSolvableBlocks,
  resolveRemovalPathPlan,
  selectPatternTypes,
  validatePlacementGeometry,
  validateSpatialDistribution,
  type PlacementFactory,
} from "@/games/dog-lege-dog/levels/level-placement";
import {
  findSolvability,
  verifyRemovalPath,
  type SolvabilityResult,
} from "@/games/dog-lege-dog/levels/level-solvability";
import {
  calculateDifficultyMetrics,
} from "@/games/dog-lege-dog/levels/level-difficulty";
import {
  calculateDogLevelReward,
  DOG_REWARD_CONFIG_VERSION,
} from "@/games/dog-lege-dog/levels/level-reward";
import {
  getDogTrayLockCount,
  SeededRandom,
} from "@/games/dog-lege-dog/levels/level-random";
import {
  createDogSpecialMechanism,
  DOG_TWIN_MECHANISM_TYPE,
  getDogSpecialMechanismConfigs,
  selectDogSpecialMechanismCounts,
  validateDogSpecialMechanismComposition,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import { assignDogV13SpecialMechanisms } from "@/games/dog-lege-dog/levels/level-mechanism-assignment";
import type {
  DogBlock,
  DogLevelGeometry,
  DogLevelReplayMode,
  DogLegeDogLevel,
  DogPatternType,
} from "@/games/dog-lege-dog/levels/level-types";
import type { NormalizedLevelGeneratorRequest } from "@/games/dog-lege-dog/levels/level-generator-contracts";
import type { GeneratedLevelCandidate } from "@/games/dog-lege-dog/levels/level-replay";

export const LOCK_AWARE_SOLVABILITY_BRANCH_BUDGET = 192 as const;

export type SpatialValidationPolicy = "enforce" | "diagnostic";

type TemplateFactory = (random: SeededRandom) => DogShapeTemplate;
type PatternTypesFactory = (random: SeededRandom) => readonly DogPatternType[];

interface CandidateGenerationPlan {
  readonly blockCount: number;
  readonly maxLayers: number;
  readonly templateFactory: TemplateFactory;
  readonly placementFactory: PlacementFactory;
  readonly patternTypesFactory: PatternTypesFactory;
}

export interface LevelCandidateBuildOptions {
  readonly config: DogV13Config;
  readonly request: NormalizedLevelGeneratorRequest;
  readonly levelSeed: string;
  readonly testSeed: string;
  readonly attempt: number;
  readonly randomSeed: string;
  readonly replayMode: DogLevelReplayMode;
  readonly templateFactory: TemplateFactory;
  readonly placementFactory: PlacementFactory;
  readonly spatialValidation?: SpatialValidationPolicy;
}

export function createLevelCandidate(
  options: LevelCandidateBuildOptions,
): GeneratedLevelCandidate {
  const spatialValidation = options.spatialValidation ?? "enforce";
  const { request } = options;
  const random = new SeededRandom(options.randomSeed);
  const lockedTraySlotCount = getDogTrayLockCount(
    request.runSeed,
    options.config,
  );
  const specialMechanisms = getDogSpecialMechanismConfigs(
    request.levelNumber,
    options.config,
  );
  const logicalBlockCount = getBlockCount(request.levelNumber, options.config);
  const mechanismCounts = selectDogSpecialMechanismCounts(
    specialMechanisms,
    random,
    logicalBlockCount,
    options.config.specialMechanisms.logicalBudgetRatio,
  );
  const twinCount = mechanismCounts.get(DOG_TWIN_MECHANISM_TYPE) ?? 0;
  const physicalBlockCount = logicalBlockCount - twinCount;
  if (physicalBlockCount <= 0) {
    throw new Error("LevelGenerator twin count exceeds logical block count");
  }

  const plan = createGenerationPlan(
    request,
    options.config,
    options.templateFactory,
    options.placementFactory,
    physicalBlockCount,
  );
  const { blockCount, maxLayers } = plan;
  const plannedRemovalPlan = createRemovalPathPlan(blockCount, maxLayers, random);
  const shape = plan.templateFactory(random);
  const placements = plan.placementFactory(
    shape,
    blockCount,
    maxLayers,
    random,
    plannedRemovalPlan,
  );
  const patternTypes = plan.patternTypesFactory(random);
  const removalPlan = resolveRemovalPathPlan(
    placements,
    random,
    plannedRemovalPlan.order,
  );
  const {
    blocks: ordinaryBlocks,
    solutionPath,
    twinBlockIndices,
  } = createSolvableBlocks(
    placements,
    patternTypes,
    request.levelNumber,
    random,
    removalPlan,
    {
      logicalBlockCount,
      twinCount,
    },
  );
  const board = createBoard(shape);
  const blocksWithTwins = ordinaryBlocks.map((block, index) =>
    twinBlockIndices.has(index)
      ? {
          ...block,
          specialMechanism: createDogSpecialMechanism(DOG_TWIN_MECHANISM_TYPE),
        }
      : block,
  );
  let blocks: readonly DogBlock[];
  let shouldValidateMechanismComposition = true;
  try {
    blocks = assignDogV13SpecialMechanisms(
      blocksWithTwins,
      specialMechanisms,
      removalPlan.order,
      random,
      maxLayers,
    );
  } catch (error) {
    if (spatialValidation !== "diagnostic") {
      throw error;
    }
    // Diagnostic replay keeps deterministic geometry even when assignment failed.
    shouldValidateMechanismComposition = false;
    blocks = blocksWithTwins;
  }

  return createCandidateLevel(
    options.config,
    request,
    options.levelSeed,
    options.testSeed,
    options.attempt,
    maxLayers,
    board,
    patternTypes,
    blocks,
    specialMechanisms,
    lockedTraySlotCount,
    solutionPath,
    options.replayMode,
    options.randomSeed,
    spatialValidation,
    shouldValidateMechanismComposition,
  );
}

function createCandidateLevel(
  config: DogV13Config,
  request: NormalizedLevelGeneratorRequest,
  levelSeed: string,
  testSeed: string,
  attempt: number,
  maxLayers: number,
  board: DogLegeDogLevel["board"],
  patternTypes: DogLegeDogLevel["patternTypes"],
  blocks: DogLegeDogLevel["blocks"],
  specialMechanisms: DogLegeDogLevel["specialMechanisms"],
  lockedTraySlotCount: number,
  solutionPath: readonly string[],
  replayMode: DogLevelReplayMode,
  randomSeed: string,
  spatialValidation: SpatialValidationPolicy,
  shouldValidateMechanismComposition: boolean,
): GeneratedLevelCandidate {
  const geometry: DogLevelGeometry = {
    number: request.levelNumber,
    generatorVersion: request.generatorVersion,
    runSeed: request.runSeed,
    lockedTraySlotCount,
    maxLayers,
    board,
    patternTypes,
    blocks,
    specialMechanisms,
    ...(specialMechanisms.some(({ type }) => type === "shuffle")
      ? { solutionPath }
      : {}),
  };
  const geometryError = validatePlacementGeometry(board, blocks);
  if (geometryError !== undefined) {
    throw new Error(geometryError);
  }
  if (spatialValidation === "enforce") {
    const spatialError = validateSpatialDistribution(board, blocks);
    if (spatialError !== undefined) {
      throw new Error(spatialError);
    }
  }
  if (shouldValidateMechanismComposition) {
    const mechanismCompositionError = validateDogSpecialMechanismComposition(
      blocks,
      maxLayers,
      specialMechanisms,
      undefined,
      config.specialMechanisms.logicalBudgetRatio,
    );
    if (mechanismCompositionError !== undefined) {
      throw new Error(mechanismCompositionError);
    }
  }

  let acceptedSolutionPath = solutionPath;
  let verification = verifyRemovalPath(
    geometry,
    acceptedSolutionPath,
    undefined,
    undefined,
    undefined,
    config,
  );
  const initialVerificationReason = verification.reason;
  if (verification.solvable) {
    acceptedSolutionPath = verification.path;
  }
  if (!verification.solvable) {
    const alternative = findSolvability(
      geometry,
      lockedTraySlotCount > 0
        ? {
            branchBudget: LOCK_AWARE_SOLVABILITY_BRANCH_BUDGET,
            config,
          }
        : { config },
    );
    if (alternative.status !== "solvable") {
      if (spatialValidation === "diagnostic") {
        verification = createDiagnosticVerification(solutionPath, alternative);
      } else {
        throw new Error(verification.reason ?? "LevelGenerator created an unsolvable level");
      }
    } else {
      acceptedSolutionPath = alternative.path;
      const acceptedGeometry: DogLevelGeometry = {
        ...geometry,
        solutionPath: acceptedSolutionPath,
      };
      verification = verifyRemovalPath(
        acceptedGeometry,
        acceptedSolutionPath,
        undefined,
        undefined,
        undefined,
        config,
      );
      if (!verification.solvable) {
        if (spatialValidation === "diagnostic") {
          verification = createDiagnosticVerification(acceptedSolutionPath, alternative);
        } else {
          throw new Error(
            `${verification.reason ?? "LevelGenerator created an unsolvable level"}; ` +
            `initial-path=${initialVerificationReason ?? "unknown"}; ` +
            `solver-path-length=${alternative.path.length}`,
          );
        }
      } else {
        acceptedSolutionPath = verification.path;
      }
    }
  }

  const acceptedGeometry: DogLevelGeometry = {
    ...geometry,
    solutionPath: acceptedSolutionPath,
  };

  const difficulty = calculateDifficultyMetrics(
    acceptedGeometry,
    acceptedSolutionPath,
    verification,
    undefined,
    lockedTraySlotCount > 0
      ? { branchBudget: LOCK_AWARE_SOLVABILITY_BRANCH_BUDGET, config }
      : { config },
    config,
  );

  return {
    attempt,
    number: request.levelNumber,
    seed: levelSeed,
    runSeed: request.runSeed,
    generatorVersion: request.generatorVersion,
    rewardConfigVersion: DOG_REWARD_CONFIG_VERSION,
    maxLayers,
    reward: calculateDogLevelReward(difficulty),
    lockedTraySlotCount,
    board,
    patternTypes: Object.freeze([...patternTypes]),
    blocks: Object.freeze([...blocks]),
    specialMechanisms: Object.freeze([...specialMechanisms]),
    solutionPath: Object.freeze([...acceptedSolutionPath]),
    difficulty,
    testSeed,
    replayMode,
    randomSeed,
  };
}

function createGenerationPlan(
  request: NormalizedLevelGeneratorRequest,
  config: DogV13Config,
  templateFactory: TemplateFactory,
  placementFactory: PlacementFactory,
  blockCount: number,
): CandidateGenerationPlan {
  return {
    blockCount,
    maxLayers: getMaxLayers(request.levelNumber, config),
    templateFactory,
    placementFactory,
    patternTypesFactory: (random) =>
      selectPatternTypes(request.levelNumber, random, config),
  };
}

export function getFallbackTemplate(): DogShapeTemplate {
  const template = DOG_SHAPE_TEMPLATES.find((candidate) => candidate.id === "irregular-notch-1");
  if (template === undefined) {
    throw new Error("LevelGenerator fallback template is unavailable");
  }
  return template;
}

function createDiagnosticVerification(
  path: readonly string[],
  result: SolvabilityResult,
): {
  readonly status: "unsolvable";
  readonly solvable: false;
  readonly path: readonly string[];
  readonly trayPeakPressure: number;
  readonly reason?: string;
} {
  return {
    status: "unsolvable",
    solvable: false,
    path,
    trayPeakPressure: result.trayPeakPressure,
    reason: result.reason,
  };
}
