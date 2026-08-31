import { loadDogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import {
  DOG_SHAPE_TEMPLATES,
  selectShapeTemplate,
  type DogShapeTemplate,
} from "@/games/dog-lege-dog/levels/level-shapes";
import { createSolvableBlockPlacements } from "@/games/dog-lege-dog/levels/level-placement";
import {
  findShuffleTriggerPath,
  findSolvability,
  type SolvabilitySearchOptions,
  type SolvabilityResult,
} from "@/games/dog-lege-dog/levels/level-solvability";
import {
  calculateDifficultyMetrics,
  compareDifficultyDistance,
  isDifficultyAtLeastTarget,
  isDifficultyWithinTarget,
} from "@/games/dog-lege-dog/levels/level-difficulty";
import {
  createRunSeed,
  getCandidateRandomSeed,
  SeededRandom,
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

export class LevelGenerator {
  private readonly config: DogV13Config;
  private readonly gameId: string;
  private readonly candidateFilter: LevelCandidateFilter;

  constructor(options: LevelGeneratorOptions = {}) {
    this.config = loadDogV13Config(options.config);
    this.gameId = options.gameId ?? this.config.game.id;
    this.candidateFilter =
      options.candidateFilter ??
      ((difficulty, target) => isDifficultyWithinTarget(difficulty, target));
  }

  generate(request: LevelGeneratorRequest): DogLegeDogLevel {
    const normalizedRequest = normalizeRequest(
      request,
      this.config.game.generatorVersion,
    );
    validateRequest(normalizedRequest);

    const levelSeed = getLevelSeed(normalizedRequest);
    const testSeed = normalizedRequest.testSeed ?? normalizedRequest.runSeed;
    const failures: DogLevelGenerationFailure[] = [];
    let closestCandidate: GeneratedLevelCandidate | undefined;
    let attempts = 0;

    for (let attempt = 1; attempt <= MAX_LEVEL_GENERATION_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      try {
        const candidate = this.createCandidate(
          normalizedRequest,
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
          this.candidateFilter(candidate.difficulty, candidate.difficulty.target, attempt)
        ) {
          if (!hasShuffleTriggerPath(candidate, this.config)) {
            failures.push(
              createGenerationFailure(
                normalizedRequest,
                levelSeed,
                testSeed,
                attempt,
                "shuffle trigger path is unavailable",
                getCandidateRandomSeed(this.gameId, levelSeed, attempt),
              ),
            );
            continue;
          }
          return finalizeCandidate(
            candidate,
            attempt,
            !candidate.difficulty.withinTarget,
            failures,
          );
        }

        failures.push(
          createGenerationFailure(
            normalizedRequest,
            levelSeed,
            testSeed,
            attempt,
            "difficulty-out-of-range",
            getCandidateRandomSeed(this.gameId, levelSeed, attempt),
          ),
        );
      } catch (error) {
        failures.push(
          createGenerationFailure(
            normalizedRequest,
            levelSeed,
            testSeed,
            attempt,
            error instanceof Error ? error.message : "unknown-generation-error",
            getCandidateRandomSeed(this.gameId, levelSeed, attempt),
          ),
        );
      }
    }

    const fallback = this.findFallback(
      normalizedRequest,
      levelSeed,
      testSeed,
      closestCandidate,
      failures,
    );
    return finalizeCandidate(
      fallback,
      attempts,
      true,
      failures,
    );
  }

  findSolvability(
    level: DogLevelGeometry,
    options?: SolvabilitySearchOptions,
  ): SolvabilityResult {
    return findSolvability(level, { ...options, config: this.config });
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
    return this.generate({
      levelNumber: replay.levelNumber,
      runSeed: replay.runSeed,
      testSeed: replay.testSeed,
      generatorVersion: replay.generatorVersion,
    });
  }

  /** Rebuilds failed or accepted candidate from recorded v13 random inputs. */
  replayAttempt(replay: DogLevelReplay): DogLegeDogLevel {
    validateReplay(replay);
    if (replay.accepted === true) {
      const generated = this.replay(replay);
      if (
        generated.generation.replay.attempt === replay.attempt &&
        generated.generation.replay.randomSeed === replay.randomSeed
      ) {
        return generated;
      }
    }

    const request = normalizeRequest({
      levelNumber: replay.levelNumber,
      runSeed: replay.runSeed,
      testSeed: replay.testSeed,
      generatorVersion: replay.generatorVersion,
    }, this.config.game.generatorVersion);
    return finalizeCandidate(
      this.createCandidate(
        request,
        getLevelSeed(request),
        replay.testSeed,
        replay.attempt,
        undefined,
        replay.randomSeed,
        "diagnostic",
      ),
      replay.attempt,
      true,
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
    return createLevelCandidate({
      config: this.config,
      request,
      levelSeed,
      testSeed,
      attempt,
      randomSeed: randomSeed ?? getCandidateRandomSeed(this.gameId, levelSeed, attempt),
      replayMode: "generated",
      templateFactory: (random) => templateOverride ?? selectShapeTemplate(random),
      placementFactory: createSolvableBlockPlacements,
      spatialValidation,
    });
  }

  private findFallback(
    request: NormalizedLevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
    closestCandidate: GeneratedLevelCandidate | undefined,
    failures: DogLevelGenerationFailure[],
  ): GeneratedLevelCandidate {
    if (
      closestCandidate !== undefined &&
      meetsFallbackRequirements(closestCandidate.difficulty) &&
      hasShuffleTriggerPath(closestCandidate, this.config)
    ) {
      return closestCandidate;
    }

    try {
      const fallback = this.createCandidate(
        request,
        levelSeed,
        testSeed,
        MAX_LEVEL_GENERATION_ATTEMPTS,
        getFallbackTemplate(),
      );
      if (
        !meetsFallbackRequirements(fallback.difficulty) ||
        !hasShuffleTriggerPath(fallback, this.config)
      ) {
        throw new Error("fallback candidate is below the current difficulty minimum");
      }
      return fallback;
    } catch (error) {
      failures.push(
        createGenerationFailure(
          request,
          levelSeed,
          testSeed,
          MAX_LEVEL_GENERATION_ATTEMPTS,
          `fallback-failed: ${error instanceof Error ? error.message : "unknown-error"}`,
          getCandidateRandomSeed(this.gameId, levelSeed, MAX_LEVEL_GENERATION_ATTEMPTS),
        ),
      );
    }

    const lastResort = this.createCandidate(
      request,
      levelSeed,
      testSeed,
      MAX_LEVEL_GENERATION_ATTEMPTS,
      DOG_SHAPE_TEMPLATES[0],
      getCandidateRandomSeed(this.gameId, levelSeed, MAX_LEVEL_GENERATION_ATTEMPTS + 1),
    );
    if (
      !meetsFallbackRequirements(lastResort.difficulty) ||
      !hasShuffleTriggerPath(lastResort, this.config)
    ) {
      throw new Error("LevelGenerator fallback did not satisfy the current difficulty minimum");
    }
    return lastResort;
  }
}

function hasShuffleTriggerPath(
  level: GeneratedLevelCandidate,
  config: DogV13Config,
): boolean {
  return !level.specialMechanisms.some(({ type }) => type === "shuffle") ||
    findShuffleTriggerPath(level, config) !== undefined;
}

const defaultLevelGenerator = new LevelGenerator();

export function getDogLegeDogLevel(
  levelNumber: number,
  runSeed = createRunSeed(),
): DogLegeDogLevel {
  return defaultLevelGenerator.generate({ levelNumber, runSeed });
}

function meetsFallbackRequirements(difficulty: DogLevelDifficulty): boolean {
  return difficulty.target.trayPeakPressure === undefined
    ? isDifficultyAtLeastTarget(difficulty)
    : isDifficultyWithinTarget(difficulty);
}

function getLevelSeed(request: NormalizedLevelGeneratorRequest): string {
  return `${request.runSeed}:v${request.generatorVersion}:level-${request.levelNumber}`;
}
