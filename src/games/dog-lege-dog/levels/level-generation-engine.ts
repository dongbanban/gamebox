import {
  DOG_DIFFICULTY_CURVE_GENERATOR_VERSION,
  DOG_GAME_ID,
  loadDogV13Config,
} from "@/games/dog-lege-dog/game/game-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/game-config";
import {
  DOG_SHAPE_TEMPLATES,
  selectShapeTemplate,
  type DogShapeTemplate,
} from "@/games/dog-lege-dog/levels/level-shapes";
import {
  createGuaranteedBlockPlacements,
  createSolvableBlockPlacements,
} from "@/games/dog-lege-dog/levels/level-placement";
import {
  findSolvability,
  type SolvabilitySearchOptions,
  type SolvabilityResult,
} from "@/games/dog-lege-dog/levels/level-solvability";
import {
  calculateDifficultyMetrics,
  compareDifficultyDistance,
  getRelaxedDifficultyTarget,
  isDifficultyWithinTarget,
} from "@/games/dog-lege-dog/levels/level-difficulty";
import {
  getCandidateRandomSeed,
  getGuaranteedRandomSeed,
} from "@/games/dog-lege-dog/levels/level-random";
import type {
  DogLevelDifficulty,
  DogLevelGenerationFailure,
  DogLevelGeometry,
  DogLevelReplay,
  DogLegeDogLevel,
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
import {
  createLevelCandidate,
  getFallbackTemplate,
  type SpatialValidationPolicy,
} from "@/games/dog-lege-dog/levels/level-candidate-generation";

export const MAX_LEVEL_GENERATION_ATTEMPTS = 100 as const;
// Legacy generator versions keep their historical relaxed retry window for replay.
const MAX_DIFFICULTY_TARGET_ATTEMPTS = 32 as const;

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
    seed?: string,
    generatorVersion?: number,
  ): DogLegeDogLevel {
    const request = normalizeRequest(
      requestOrLevelNumber,
      seed ?? this.config.game.defaultSeed,
      generatorVersion ?? this.config.game.generatorVersion,
    );
    validateRequest(request);

    const levelSeed = getLevelSeed(request, this.config);
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
              this.config,
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
      this.config,
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
    const levelSeed = getLevelSeed(request, this.config);
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
    return createLevelCandidate({
      config: this.config,
      request,
      levelSeed,
      testSeed,
      attempt,
      randomSeed: candidateRandomSeed,
      replayMode: "generated",
      templateFactory: (random) => templateOverride ?? selectShapeTemplate(random),
      placementFactory: createSolvableBlockPlacements,
      spatialValidation,
    });
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
    return createLevelCandidate({
      config: this.config,
      request,
      levelSeed,
      testSeed,
      attempt: MAX_LEVEL_GENERATION_ATTEMPTS,
      randomSeed,
      replayMode: "guaranteed",
      templateFactory: () => template,
      placementFactory: createGuaranteedBlockPlacements,
      spatialValidation,
    });
  }
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

function getLevelSeed(
  request: NormalizedLevelGeneratorRequest,
  config: DogV13Config,
): string {
  if (
    request.levelNumber === config.game.firstLevelNumber &&
    request.seed === config.game.defaultSeed &&
    request.generatorVersion >= 1
  ) {
    return config.firstLevel.seed;
  }

  return `${request.seed}:v${request.generatorVersion}:level-${request.levelNumber}`;
}

export const DEFAULT_GENERATED_LEVEL_GENERATOR = new GeneratedLevelGenerator();
