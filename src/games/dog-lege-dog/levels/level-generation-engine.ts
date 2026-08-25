import {
  DEFAULT_LEVEL_SEED,
  DOG_BASE_TRAY_CAPACITY,
  DOG_DIFFICULTY_CURVE_GENERATOR_VERSION,
  DOG_GAME_ID,
  FIRST_LEVEL_NUMBER,
  FIRST_LEVEL_SEED,
  LEVEL_GENERATOR_VERSION,
  loadDogV13Config,
} from "@/games/dog-lege-dog/game/game-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/game-config";
import {
  getBlockCount,
  getMaxLayers,
} from "@/games/dog-lege-dog/levels/level-progression";
import {
  createBoard,
  DOG_SHAPE_TEMPLATES,
  selectShapeTemplate,
  type DogShapeTemplate,
} from "@/games/dog-lege-dog/levels/level-shapes";
import {
  createFirstLevelBlockPlacements,
  createGuaranteedBlockPlacements,
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
  type SolvabilitySearchOptions,
  type SolvabilityResult,
} from "@/games/dog-lege-dog/levels/level-solvability";
import { createBlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import {
  calculateDifficultyMetrics,
  compareDifficultyDistance,
  getRelaxedDifficultyTarget,
  isDifficultyWithinTarget,
} from "@/games/dog-lege-dog/levels/level-difficulty";
import {
  calculateDogLevelReward,
  DOG_REWARD_CONFIG_VERSION,
} from "@/games/dog-lege-dog/levels/level-reward";
import {
  getCandidateRandomSeed,
  getGuaranteedRandomSeed,
  getDogTrayLockCount,
  SeededRandom,
} from "@/games/dog-lege-dog/levels/level-random";
import {
  assignDogSpecialMechanisms,
  createDogSpecialMechanism,
  DOG_TWIN_MECHANISM_TYPE,
  validateDogSpecialMechanismComposition,
  getDogSpecialMechanismConfigs,
  getDogSpecialMechanismConfigsForGeneration,
  limitDogSpecialMechanismConfigsForLogicalDensity,
  selectDogSpecialMechanismCounts,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  DogBlock,
  DogLevelDifficulty,
  DogLevelGenerationFailure,
  DogLevelGeometry,
  DogLevelReplay,
  DogLevelReplayMode,
  DogLegeDogLevel,
  DogPatternType,
} from "@/games/dog-lege-dog/levels/level-types";
import type {
  LevelCandidateFilter,
  LevelGeneratorOptions,
  LevelGeneratorRequest,
  NormalizedLevelGeneratorRequest,
} from "@/games/dog-lege-dog/levels/level-generator-contracts";
import {
  createGenerationFailure,
  finalizeCandidate,
  normalizeRequest,
  validateReplay,
  validateRequest,
  type GeneratedLevelCandidate,
} from "@/games/dog-lege-dog/levels/level-replay";

export const MAX_LEVEL_GENERATION_ATTEMPTS = 100 as const;
// Legacy generator versions keep their historical relaxed retry window for replay.
const MAX_DIFFICULTY_TARGET_ATTEMPTS = 32 as const;
// Lock pressure makes alternate solvability paths branch more often than the base tray.
const LOCK_AWARE_SOLVABILITY_BRANCH_BUDGET = 128 as const;

type TemplateFactory = (random: SeededRandom) => DogShapeTemplate;
type PatternTypesFactory = (random: SeededRandom) => readonly DogPatternType[];
// Failed-candidate replay preserves diagnostic geometry; normal generation stays strict.
type SpatialValidationPolicy = "enforce" | "diagnostic";

interface CandidateGenerationPlan {
  readonly blockCount: number;
  readonly maxLayers: number;
  readonly templateFactory: TemplateFactory;
  readonly placementFactory: PlacementFactory;
  readonly patternTypesFactory: PatternTypesFactory;
}

export class GeneratedLevelGenerator {
  private readonly config: DogV13Config;
  private readonly gameId: string;
  private readonly candidateFilter: LevelCandidateFilter;
  private readonly usesDefaultCandidateFilter: boolean;

  constructor(options: LevelGeneratorOptions = {}) {
    this.config = loadDogV13Config(options.config);
    this.gameId = options.gameId ?? this.config.game.id ?? DOG_GAME_ID;
    this.usesDefaultCandidateFilter = options.candidateFilter === undefined;
    this.candidateFilter =
      options.candidateFilter ??
      ((difficulty, target) => isDifficultyWithinTarget(difficulty, target));
  }

  generate(request: LevelGeneratorRequest): DogLegeDogLevel;
  generate(
    levelNumber: number,
    seed?: string,
    generatorVersion?: number,
  ): DogLegeDogLevel;
  generate(
    requestOrLevelNumber: LevelGeneratorRequest | number,
    seed = DEFAULT_LEVEL_SEED,
    generatorVersion = LEVEL_GENERATOR_VERSION,
  ): DogLegeDogLevel {
    const request = normalizeRequest(requestOrLevelNumber, seed, generatorVersion);
    validateRequest(request);

    const levelSeed = getLevelSeed(request);
    const testSeed = request.testSeed ?? request.seed;
    const failures: DogLevelGenerationFailure[] = [];
    let closestCandidate: GeneratedLevelCandidate | undefined;
    let attempts = 0;

    for (let attempt = 1; attempt <= MAX_LEVEL_GENERATION_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      try {
        const candidate = this.createCandidate(
          request,
          levelSeed,
          testSeed,
          attempt,
        );
        if (
          closestCandidate === undefined ||
          compareDifficultyDistance(candidate.difficulty, closestCandidate.difficulty) < 0
        ) {
          closestCandidate = candidate;
        }

        if (
          candidate.difficulty.certainty === "certain" &&
          candidate.difficulty.solvabilityStatus === "solvable" &&
          this.candidateFilter(
            candidate.difficulty,
            getRelaxedDifficultyTarget(
              request.levelNumber,
              attempt,
              request.generatorVersion,
            ),
            attempt,
          )
        ) {
          return finalizeCandidate(
            candidate,
            attempt,
            !candidate.difficulty.withinTarget,
            failures,
          );
        }

        failures.push(
          createGenerationFailure(
            request,
            levelSeed,
            testSeed,
            attempt,
            "difficulty-out-of-range",
            "generated",
            getCandidateRandomSeed(this.gameId, levelSeed, attempt),
          ),
        );

        if (
          this.usesDefaultCandidateFilter &&
          request.generatorVersion < DOG_DIFFICULTY_CURVE_GENERATOR_VERSION &&
          attempt >= MAX_DIFFICULTY_TARGET_ATTEMPTS
        ) {
          break;
        }
      } catch (error) {
        failures.push(
          createGenerationFailure(
            request,
            levelSeed,
            testSeed,
            attempt,
            error instanceof Error ? error.message : "unknown-generation-error",
            "generated",
            getCandidateRandomSeed(this.gameId, levelSeed, attempt),
          ),
        );
      }
    }

    let fallback = closestCandidate !== undefined &&
        meetsDifficultyMinimum(closestCandidate.difficulty)
      ? closestCandidate
      : undefined;
    if (fallback === undefined) {
      try {
        const candidate = this.createFallbackCandidate(request, levelSeed, testSeed);
        if (!meetsDifficultyMinimum(candidate.difficulty)) {
          throw new Error("fallback candidate is below the current difficulty minimum");
        }
        fallback = candidate;
      } catch (error) {
        failures.push(
          createGenerationFailure(
            request,
            levelSeed,
            testSeed,
            MAX_LEVEL_GENERATION_ATTEMPTS,
            `fallback-failed: ${error instanceof Error ? error.message : "unknown-error"}`,
            "generated",
            getCandidateRandomSeed(
              this.gameId,
              levelSeed,
              MAX_LEVEL_GENERATION_ATTEMPTS,
            ),
          ),
        );
        try {
          const candidate = this.createEmergencyCandidate(request, levelSeed, testSeed);
          if (!meetsDifficultyMinimum(candidate.difficulty)) {
            throw new Error("emergency fallback is below the current difficulty minimum");
          }
          fallback = candidate;
        } catch (emergencyError) {
          failures.push(
            createGenerationFailure(
              request,
              levelSeed,
              testSeed,
              MAX_LEVEL_GENERATION_ATTEMPTS,
              `emergency-fallback-failed: ${
                emergencyError instanceof Error ? emergencyError.message : "unknown-error"
              }`,
              "guaranteed",
              getGuaranteedRandomSeed(this.gameId, levelSeed),
            ),
          );
          const candidate = this.createLastResortCandidate(request, levelSeed, testSeed);
          if (!meetsDifficultyMinimum(candidate.difficulty)) {
            throw new Error("last-resort fallback is below the current difficulty minimum");
          }
          fallback = candidate;
        }
      }
    }

    if (fallback === undefined || !meetsDifficultyMinimum(fallback.difficulty)) {
      throw new Error(
        "LevelGenerator fallback did not satisfy the current difficulty minimum",
      );
    }

    return finalizeCandidate(fallback, attempts, true, failures);
  }

  findSolvablePath(level: DogLevelGeometry): readonly string[] | null {
    const result = findSolvability(level);
    return result.status === "solvable" ? [...result.path] : null;
  }

  findSolvability(
    level: DogLevelGeometry,
    options?: SolvabilitySearchOptions,
  ): SolvabilityResult {
    return findSolvability(level, options);
  }

  isSolvable(level: DogLevelGeometry): boolean {
    return this.findSolvability(level).status === "solvable";
  }

  getDifficultyMetrics(
    level: DogLevelGeometry,
    options?: SolvabilitySearchOptions,
  ): DogLevelDifficulty {
    const solvability = this.findSolvability(level, options);
    return calculateDifficultyMetrics(
      level,
      solvability.status === "solvable" ? solvability.path : undefined,
      undefined,
      solvability,
      options,
    );
  }

  replay(replay: DogLevelReplay): DogLegeDogLevel {
    validateReplay(replay);
    const runSeed = replay.runSeed ?? replay.seed;
    return this.generate({
      levelNumber: replay.levelNumber,
      runSeed,
      testSeed: replay.testSeed,
      generatorVersion: replay.generatorVersion,
    });
  }

  replayAttempt(replay: DogLevelReplay): DogLegeDogLevel {
    validateReplay(replay);
    if (replay.mode === "generated" && replay.accepted === true) {
      const generated = this.generate({
        levelNumber: replay.levelNumber,
        runSeed: replay.runSeed ?? replay.seed,
        testSeed: replay.testSeed,
        generatorVersion: replay.generatorVersion,
      });
      if (
        generated.generation.replay.attempt === replay.attempt &&
        generated.generation.replay.randomSeed === replay.randomSeed
      ) {
        return generated;
      }
    }
    const runSeed = replay.runSeed ?? replay.seed;
    const request: NormalizedLevelGeneratorRequest = {
      levelNumber: replay.levelNumber,
      seed: runSeed,
      runSeed,
      testSeed: replay.testSeed,
      generatorVersion: replay.generatorVersion,
    };
    const levelSeed = getLevelSeed(request);
    // Failed candidates may lack spatial invariants; replayAttempt exists to inspect them.
    const candidate = replay.mode === "guaranteed"
      ? this.createGuaranteedCandidate(
          request,
          levelSeed,
          replay.testSeed,
          getFallbackTemplate("emergency"),
          replay.randomSeed,
          "diagnostic",
        )
      : this.createCandidate(
          request,
          levelSeed,
          replay.testSeed,
          replay.attempt,
          undefined,
          replay.randomSeed,
          "diagnostic",
        );
    return finalizeCandidate(
      candidate,
      replay.attempt,
      !candidate.difficulty.withinTarget,
      [],
    );
  }

  private createCandidate(
    request: NormalizedLevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
    attempt: number,
    templateOverride?: DogShapeTemplate,
    randomSeed?: string,
    spatialValidation: SpatialValidationPolicy = "enforce",
  ): GeneratedLevelCandidate {
    const candidateRandomSeed =
      randomSeed ?? getCandidateRandomSeed(this.gameId, levelSeed, attempt);
    return this.createCandidateWithPlacementStrategy(
      request,
      levelSeed,
      testSeed,
      attempt,
      candidateRandomSeed,
      "generated",
      (random) => templateOverride ?? selectShapeTemplate(random),
      createSolvableBlockPlacements,
      spatialValidation,
    );
  }

  private createCandidateWithPlacementStrategy(
    request: NormalizedLevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
    attempt: number,
    randomSeed: string,
    replayMode: DogLevelReplayMode,
    templateFactory: TemplateFactory,
    placementFactory: PlacementFactory,
    spatialValidation: SpatialValidationPolicy = "enforce",
  ): GeneratedLevelCandidate {
    const random = new SeededRandom(randomSeed);
    const lockedTraySlotCount = getDogTrayLockCount(
      request.runSeed,
      request.generatorVersion,
    );
    const specialMechanisms = getDogSpecialMechanismConfigs(
      request.levelNumber,
      request.generatorVersion,
    );
    const logicalBlockCount = getBlockCount(request.levelNumber);
    const generationSpecialMechanisms = limitDogSpecialMechanismConfigsForLogicalDensity(
      getDogSpecialMechanismConfigsForGeneration(
        request.levelNumber,
        request.generatorVersion,
      ),
      logicalBlockCount,
    );
    const mechanismCounts = selectDogSpecialMechanismCounts(
      generationSpecialMechanisms,
      random,
      logicalBlockCount,
    );
    const twinCount = mechanismCounts.get(DOG_TWIN_MECHANISM_TYPE) ?? 0;
    const physicalBlockCount = logicalBlockCount - twinCount;
    if (physicalBlockCount <= 0) {
      throw new Error("LevelGenerator twin count exceeds logical block count");
    }
    const plan = createGenerationPlan(
      request,
      templateFactory,
      placementFactory,
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
    const placementGraph = createBlockGraph(blocksWithTwins);
    let usedDiagnosticSpecialMechanismFallback = false;
    let blocks: readonly DogBlock[];
    try {
      blocks = assignDogSpecialMechanisms(
        blocksWithTwins,
        generationSpecialMechanisms,
        random,
        (candidateBlocks) => {
          const candidateGeometry: DogLevelGeometry = {
            number: request.levelNumber,
            lockedTraySlotCount,
            maxLayers,
            board,
            patternTypes,
            blocks: candidateBlocks,
            specialMechanisms,
          };
          const fixedPathVerification = verifyRemovalPath(
            candidateGeometry,
            solutionPath,
            placementGraph,
          );
          if (fixedPathVerification.solvable) {
            return true;
          }

          // A sampled path may only fail because the lock is tighter; keep
          // that mechanism layout and let finalization search another path.
          return verifyRemovalPath(
            candidateGeometry,
            solutionPath,
            placementGraph,
            undefined,
            DOG_BASE_TRAY_CAPACITY,
          ).solvable;
        },
        { maxLayers, countOverrides: mechanismCounts },
      );
    } catch (error) {
      if (spatialValidation !== "diagnostic") {
        throw error;
      }
      // A failed candidate may be replayed for diagnostics even when its
      // sampled mechanism layout has no valid assignment. Keep deterministic
      // geometry and twin placement available for inspection.
      usedDiagnosticSpecialMechanismFallback = true;
      blocks = blocksWithTwins;
    }
    return createCandidateLevel(
      request,
      levelSeed,
      testSeed,
      attempt,
      maxLayers,
      board,
      patternTypes,
      blocks,
      specialMechanisms,
      generationSpecialMechanisms,
      lockedTraySlotCount,
      solutionPath,
      replayMode,
      randomSeed,
      spatialValidation,
      usedDiagnosticSpecialMechanismFallback,
    );
  }

  private createFallbackCandidate(
    request: NormalizedLevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
  ): GeneratedLevelCandidate {
    const fallbackTemplate = getFallbackTemplate("fallback");

    return this.createCandidate(
      request,
      levelSeed,
      testSeed,
      MAX_LEVEL_GENERATION_ATTEMPTS,
      fallbackTemplate,
    );
  }

  private createEmergencyCandidate(
    request: NormalizedLevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
  ): GeneratedLevelCandidate {
    const fallbackTemplate = getFallbackTemplate("emergency");
    return this.createGuaranteedCandidate(
      request,
      levelSeed,
      testSeed,
      fallbackTemplate,
    );
  }

  private createLastResortCandidate(
    request: NormalizedLevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
  ): GeneratedLevelCandidate {
    return this.createGuaranteedCandidate(
      request,
      levelSeed,
      testSeed,
      DOG_SHAPE_TEMPLATES[0],
    );
  }

  private createGuaranteedCandidate(
    request: NormalizedLevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
    template: DogShapeTemplate | undefined,
    randomSeed = getGuaranteedRandomSeed(this.gameId, levelSeed),
    spatialValidation: SpatialValidationPolicy = "enforce",
  ): GeneratedLevelCandidate {
    if (template === undefined) {
      throw new Error("LevelGenerator has no emergency template");
    }
    return this.createCandidateWithPlacementStrategy(
      request,
      levelSeed,
      testSeed,
      MAX_LEVEL_GENERATION_ATTEMPTS,
      randomSeed,
      "guaranteed",
      () => template,
      createGuaranteedBlockPlacements,
      spatialValidation,
    );
  }
}

function createCandidateLevel(
  request: NormalizedLevelGeneratorRequest,
  levelSeed: string,
  testSeed: string,
  attempt: number,
  maxLayers: number,
  board: DogLegeDogLevel["board"],
  patternTypes: DogLegeDogLevel["patternTypes"],
  blocks: DogLegeDogLevel["blocks"],
  specialMechanisms: DogLegeDogLevel["specialMechanisms"],
  generationSpecialMechanisms: DogLegeDogLevel["specialMechanisms"],
  lockedTraySlotCount: number,
  solutionPath: readonly string[],
  replayMode: DogLevelReplayMode,
  randomSeed: string,
  spatialValidation: SpatialValidationPolicy,
  skipSpecialMechanismComposition = false,
): GeneratedLevelCandidate {
  const geometry: DogLevelGeometry = {
    number: request.levelNumber,
    generatorVersion: request.generatorVersion,
    lockedTraySlotCount,
    maxLayers,
    board,
    patternTypes,
    blocks,
    specialMechanisms,
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
  if (!skipSpecialMechanismComposition) {
    const mechanismCompositionError = validateDogSpecialMechanismComposition(
      blocks,
      maxLayers,
      generationSpecialMechanisms,
    );
    if (mechanismCompositionError !== undefined) {
      throw new Error(mechanismCompositionError);
    }
  }
  let acceptedSolutionPath = solutionPath;
  let verification = verifyRemovalPath(geometry, acceptedSolutionPath);
  if (!verification.solvable) {
    const alternative = findSolvability(
      geometry,
      lockedTraySlotCount > 0
        ? { branchBudget: LOCK_AWARE_SOLVABILITY_BRANCH_BUDGET }
        : undefined,
    );
    if (alternative.status !== "solvable") {
      throw new Error(verification.reason ?? "LevelGenerator created an unsolvable level");
    }
    acceptedSolutionPath = alternative.path;
    verification = verifyRemovalPath(geometry, acceptedSolutionPath);
    if (!verification.solvable) {
      throw new Error(verification.reason ?? "LevelGenerator created an unsolvable level");
    }
  }
  const difficulty = calculateDifficultyMetrics(
    geometry,
    acceptedSolutionPath,
    verification,
    undefined,
    lockedTraySlotCount > 0
      ? { branchBudget: LOCK_AWARE_SOLVABILITY_BRANCH_BUDGET }
      : undefined,
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
    baseSeed: request.seed,
    testSeed,
    replayMode,
    randomSeed,
  };
}

function createGenerationPlan(
  request: NormalizedLevelGeneratorRequest,
  templateFactory: TemplateFactory,
  placementFactory: PlacementFactory,
  blockCount: number,
): CandidateGenerationPlan {
  if (request.levelNumber === FIRST_LEVEL_NUMBER) {
    return {
      blockCount,
      maxLayers: getMaxLayers(request.levelNumber),
      templateFactory,
      placementFactory: createFirstLevelBlockPlacements,
      patternTypesFactory: (random) => selectPatternTypes(request.levelNumber, random),
    };
  }

  return {
    blockCount,
    maxLayers: getMaxLayers(request.levelNumber),
    templateFactory,
    placementFactory,
    patternTypesFactory: (random) => selectPatternTypes(request.levelNumber, random),
  };
}

function getFallbackTemplate(kind: "fallback" | "emergency"): DogShapeTemplate {
  return getTemplateById("irregular-notch-1", `LevelGenerator ${kind} template`);
}

function getTemplateById(templateId: string, label: string): DogShapeTemplate {
  const template = DOG_SHAPE_TEMPLATES.find((candidate) => candidate.id === templateId);
  if (template === undefined) {
    throw new Error(`${label} is unavailable`);
  }

  return template;
}

function meetsDifficultyMinimum(difficulty: DogLevelDifficulty): boolean {
  return (
    difficulty.solvabilityStatus === "solvable" &&
    difficulty.safeChoiceSearchStatus === "complete" &&
    difficulty.certainty === "certain" &&
    difficulty.safeChoiceCount >= difficulty.target.safeChoiceCount.min &&
    (difficulty.target.safeChoiceRate === undefined ||
      difficulty.safeChoiceRate >= difficulty.target.safeChoiceRate.min) &&
    difficulty.estimatedDurationMinutes >= difficulty.target.durationMinutes.min
  );
}

function getLevelSeed(request: NormalizedLevelGeneratorRequest): string {
  if (
    request.levelNumber === FIRST_LEVEL_NUMBER &&
    request.seed === DEFAULT_LEVEL_SEED &&
    request.generatorVersion >= 1
  ) {
    return FIRST_LEVEL_SEED;
  }

  return `${request.seed}:v${request.generatorVersion}:level-${request.levelNumber}`;
}

export const DEFAULT_GENERATED_LEVEL_GENERATOR = new GeneratedLevelGenerator();
