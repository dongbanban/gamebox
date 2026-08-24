import {
  DEFAULT_LEVEL_SEED,
  DOG_GAME_ID,
  FIRST_LEVEL_NUMBER,
  FIRST_LEVEL_SEED,
  LEVEL_GENERATOR_VERSION,
} from "@/games/dog-lege-dog/game/game-config";
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
  SeededRandom,
} from "@/games/dog-lege-dog/levels/level-random";
import {
  assignDogSpecialMechanisms,
  validateDogSpecialMechanismComposition,
  getDogSpecialMechanismConfigs,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
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
// Default target search gets one relaxed-target window before using closest proven candidate.
const MAX_DIFFICULTY_TARGET_ATTEMPTS = 32 as const;

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
  private readonly gameId: string;
  private readonly candidateFilter: LevelCandidateFilter;
  private readonly usesDefaultCandidateFilter: boolean;

  constructor(options: LevelGeneratorOptions = {}) {
    this.gameId = options.gameId ?? DOG_GAME_ID;
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
            getRelaxedDifficultyTarget(request.levelNumber, attempt),
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

    let fallback = closestCandidate;
    if (fallback === undefined) {
      try {
        fallback = this.createFallbackCandidate(request, levelSeed, testSeed);
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
          fallback = this.createEmergencyCandidate(request, levelSeed, testSeed);
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
          fallback = this.createLastResortCandidate(request, levelSeed, testSeed);
        }
      }
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
    const plan = createGenerationPlan(
      request,
      templateFactory,
      placementFactory,
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
    const { blocks: ordinaryBlocks, solutionPath } = createSolvableBlocks(
      placements,
      patternTypes,
      request.levelNumber,
      random,
      removalPlan,
    );
    const specialMechanisms = getDogSpecialMechanismConfigs(request.levelNumber);
    const board = createBoard(shape);
    const placementGraph = createBlockGraph(ordinaryBlocks);
    const blocks = assignDogSpecialMechanisms(
      ordinaryBlocks,
      specialMechanisms,
      random,
      (candidateBlocks) =>
        verifyRemovalPath(
          {
            number: request.levelNumber,
            maxLayers,
            board,
            patternTypes,
            blocks: candidateBlocks,
            specialMechanisms,
          },
          solutionPath,
          placementGraph,
        ).solvable,
      { maxLayers },
    );
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
      solutionPath,
      replayMode,
      randomSeed,
      spatialValidation,
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
  solutionPath: readonly string[],
  replayMode: DogLevelReplayMode,
  randomSeed: string,
  spatialValidation: SpatialValidationPolicy,
): GeneratedLevelCandidate {
  const geometry: DogLevelGeometry = {
    number: request.levelNumber,
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
  const mechanismCompositionError = validateDogSpecialMechanismComposition(
    blocks,
    maxLayers,
    specialMechanisms,
  );
  if (mechanismCompositionError !== undefined) {
    throw new Error(mechanismCompositionError);
  }
  const verification = verifyRemovalPath(geometry, solutionPath);
  if (!verification.solvable) {
    throw new Error(verification.reason ?? "LevelGenerator created an unsolvable level");
  }
  const difficulty = calculateDifficultyMetrics(geometry, solutionPath, verification);

  return {
    attempt,
    number: request.levelNumber,
    seed: levelSeed,
    runSeed: request.runSeed,
    generatorVersion: request.generatorVersion,
    rewardConfigVersion: DOG_REWARD_CONFIG_VERSION,
    maxLayers,
    reward: calculateDogLevelReward(difficulty),
    board,
    patternTypes: Object.freeze([...patternTypes]),
    blocks: Object.freeze([...blocks]),
    specialMechanisms: Object.freeze([...specialMechanisms]),
    solutionPath: Object.freeze([...solutionPath]),
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
): CandidateGenerationPlan {
  if (request.levelNumber === FIRST_LEVEL_NUMBER) {
    return {
      blockCount: getBlockCount(request.levelNumber),
      maxLayers: getMaxLayers(request.levelNumber),
      templateFactory,
      placementFactory: createFirstLevelBlockPlacements,
      patternTypesFactory: (random) => selectPatternTypes(request.levelNumber, random),
    };
  }

  return {
    blockCount: getBlockCount(request.levelNumber),
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

function getLevelSeed(request: NormalizedLevelGeneratorRequest): string {
  if (
    request.levelNumber === FIRST_LEVEL_NUMBER &&
    request.seed === DEFAULT_LEVEL_SEED &&
    request.generatorVersion === LEVEL_GENERATOR_VERSION
  ) {
    return FIRST_LEVEL_SEED;
  }

  return `${request.seed}:v${request.generatorVersion}:level-${request.levelNumber}`;
}

export const DEFAULT_GENERATED_LEVEL_GENERATOR = new GeneratedLevelGenerator();
