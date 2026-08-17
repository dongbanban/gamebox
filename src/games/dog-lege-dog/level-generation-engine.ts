import {
  DEFAULT_LEVEL_REWARD,
  DEFAULT_LEVEL_SEED,
  DOG_GAME_ID,
  FIRST_LEVEL_BLOCK_COUNT,
  FIRST_LEVEL_MAX_LAYERS,
  FIRST_LEVEL_NUMBER,
  FIRST_LEVEL_PATTERN_TYPES,
  FIRST_LEVEL_SEED,
  FIRST_LEVEL_TEMPLATE_ID,
  LEVEL_GENERATOR_VERSION,
} from "./game-config";
import {
  getBlockCount,
  getMaxLayers,
} from "./level-progression";
import {
  createBoard,
  DOG_SHAPE_TEMPLATES,
  selectShapeTemplate,
  type DogShapeTemplate,
} from "./level-shapes";
import {
  createFirstLevelBlockPlacements,
  createGuaranteedBlockPlacements,
  createRemovalPathPlan,
  createSolvableBlockPlacements,
  createSolvableBlocks,
  resolveRemovalPathPlan,
  selectPatternTypes,
  type PlacementFactory,
} from "./level-placement";
import {
  findSolvablePath,
  verifyRemovalPath,
} from "./level-solvability";
import {
  calculateDifficultyMetrics,
  compareDifficultyDistance,
  getRelaxedDifficultyTarget,
  isDifficultyWithinTarget,
} from "./level-difficulty";
import {
  getCandidateRandomSeed,
  getGuaranteedRandomSeed,
  SeededRandom,
} from "./level-random";
import type {
  DogLevelDifficulty,
  DogLevelGenerationFailure,
  DogLevelGeometry,
  DogLevelReplay,
  DogLevelReplayMode,
  DogLegeDogLevel,
  DogPatternType,
} from "./level-types";
import type {
  LevelCandidateFilter,
  LevelGeneratorOptions,
  LevelGeneratorRequest,
} from "./level-generator-contracts";
import {
  createGenerationFailure,
  finalizeCandidate,
  normalizeRequest,
  validateReplay,
  validateRequest,
  type GeneratedLevelCandidate,
} from "./level-replay";

export const MAX_LEVEL_GENERATION_ATTEMPTS = 100 as const;

type TemplateFactory = (random: SeededRandom) => DogShapeTemplate;
type PatternTypesFactory = (random: SeededRandom) => readonly DogPatternType[];

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

  constructor(options: LevelGeneratorOptions = {}) {
    this.gameId = options.gameId ?? DOG_GAME_ID;
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

    for (let attempt = 1; attempt <= MAX_LEVEL_GENERATION_ATTEMPTS; attempt += 1) {
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
            getCandidateRandomSeed(this.gameId, levelSeed, testSeed, attempt),
          ),
        );
      } catch (error) {
        failures.push(
          createGenerationFailure(
            request,
            levelSeed,
            testSeed,
            attempt,
            error instanceof Error ? error.message : "unknown-generation-error",
            "generated",
            getCandidateRandomSeed(this.gameId, levelSeed, testSeed, attempt),
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
              testSeed,
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

    return finalizeCandidate(fallback, MAX_LEVEL_GENERATION_ATTEMPTS, true, failures);
  }

  findSolvablePath(level: DogLevelGeometry): readonly string[] | null {
    return findSolvablePath(level);
  }

  isSolvable(level: DogLevelGeometry): boolean {
    return this.findSolvablePath(level) !== null;
  }

  getDifficultyMetrics(level: DogLevelGeometry): DogLevelDifficulty {
    return calculateDifficultyMetrics(level, this.findSolvablePath(level) ?? undefined);
  }

  replay(replay: DogLevelReplay): DogLegeDogLevel {
    validateReplay(replay);
    return this.generate({
      levelNumber: replay.levelNumber,
      seed: replay.seed,
      testSeed: replay.testSeed,
      generatorVersion: replay.generatorVersion,
    });
  }

  replayAttempt(replay: DogLevelReplay): DogLegeDogLevel {
    validateReplay(replay);
    const request: LevelGeneratorRequest = {
      levelNumber: replay.levelNumber,
      seed: replay.seed,
      testSeed: replay.testSeed,
      generatorVersion: replay.generatorVersion,
    };
    const levelSeed = getLevelSeed(request);
    const candidate = replay.mode === "guaranteed"
      ? this.createGuaranteedCandidate(
          request,
          levelSeed,
          replay.testSeed,
          getFallbackTemplate("emergency"),
          replay.randomSeed,
        )
      : this.createCandidate(
          request,
          levelSeed,
          replay.testSeed,
          replay.attempt,
          undefined,
          replay.randomSeed,
        );
    return finalizeCandidate(
      candidate,
      replay.attempt,
      !candidate.difficulty.withinTarget,
      [],
    );
  }

  private createCandidate(
    request: LevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
    attempt: number,
    templateOverride?: DogShapeTemplate,
    randomSeed?: string,
  ): GeneratedLevelCandidate {
    const candidateRandomSeed =
      randomSeed ?? getCandidateRandomSeed(this.gameId, levelSeed, testSeed, attempt);
    return this.createCandidateWithPlacementStrategy(
      request,
      levelSeed,
      testSeed,
      attempt,
      candidateRandomSeed,
      "generated",
      (random) => templateOverride ?? selectShapeTemplate(request.levelNumber, random),
      createSolvableBlockPlacements,
    );
  }

  private createCandidateWithPlacementStrategy(
    request: LevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
    attempt: number,
    randomSeed: string,
    replayMode: DogLevelReplayMode,
    templateFactory: TemplateFactory,
    placementFactory: PlacementFactory,
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
    const { blocks, solutionPath } = createSolvableBlocks(
      placements,
      patternTypes,
      request.levelNumber,
      random,
      removalPlan,
    );
    return createCandidateLevel(
      request,
      levelSeed,
      testSeed,
      attempt,
      maxLayers,
      createBoard(shape),
      patternTypes,
      blocks,
      solutionPath,
      replayMode,
      randomSeed,
    );
  }

  private createFallbackCandidate(
    request: LevelGeneratorRequest,
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
    request: LevelGeneratorRequest,
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
    request: LevelGeneratorRequest,
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
    request: LevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
    template: DogShapeTemplate | undefined,
    randomSeed = getGuaranteedRandomSeed(this.gameId, levelSeed),
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
    );
  }
}

function createCandidateLevel(
  request: LevelGeneratorRequest,
  levelSeed: string,
  testSeed: string,
  attempt: number,
  maxLayers: number,
  board: DogLegeDogLevel["board"],
  patternTypes: DogLegeDogLevel["patternTypes"],
  blocks: DogLegeDogLevel["blocks"],
  solutionPath: readonly string[],
  replayMode: DogLevelReplayMode,
  randomSeed: string,
): GeneratedLevelCandidate {
  const geometry: DogLevelGeometry = {
    number: request.levelNumber,
    maxLayers,
    board,
    patternTypes,
    blocks,
  };
  const verification = verifyRemovalPath(geometry, solutionPath);
  if (!verification.solvable) {
    throw new Error(verification.reason ?? "LevelGenerator created an unsolvable level");
  }

  return {
    attempt,
    number: request.levelNumber,
    seed: levelSeed,
    generatorVersion: request.generatorVersion,
    maxLayers,
    reward: DEFAULT_LEVEL_REWARD,
    board,
    patternTypes: Object.freeze([...patternTypes]),
    blocks: Object.freeze([...blocks]),
    solutionPath: Object.freeze([...solutionPath]),
    difficulty: calculateDifficultyMetrics(geometry, solutionPath, verification),
    baseSeed: request.seed,
    testSeed,
    replayMode,
    randomSeed,
  };
}

function createGenerationPlan(
  request: LevelGeneratorRequest,
  templateFactory: TemplateFactory,
  placementFactory: PlacementFactory,
): CandidateGenerationPlan {
  if (request.levelNumber === FIRST_LEVEL_NUMBER) {
    return {
      blockCount: FIRST_LEVEL_BLOCK_COUNT,
      maxLayers: FIRST_LEVEL_MAX_LAYERS,
      templateFactory: () => getFirstLevelTemplate(),
      placementFactory: createFirstLevelBlockPlacements,
      patternTypesFactory: () => FIRST_LEVEL_PATTERN_TYPES,
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
  return getTemplateById("rectangle-classic-1", `LevelGenerator ${kind} template`);
}

function getFirstLevelTemplate(): DogShapeTemplate {
  return getTemplateById(FIRST_LEVEL_TEMPLATE_ID, "LevelGenerator first-level template");
}

function getTemplateById(templateId: string, label: string): DogShapeTemplate {
  const template = DOG_SHAPE_TEMPLATES.find((candidate) => candidate.id === templateId);
  if (template === undefined) {
    throw new Error(`${label} is unavailable`);
  }

  return template;
}

function getLevelSeed(request: LevelGeneratorRequest): string {
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
