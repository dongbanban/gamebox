import {
  DEFAULT_LEVEL_SEED,
  FIRST_LEVEL_NUMBER,
  LEVEL_GENERATOR_VERSION,
} from "./game-config";
import { FIRST_LEVEL } from "./first-level";
import {
  GeneratedLevelGenerator,
} from "./level-generation-engine";
import {
  isFirstLevelReplay,
  normalizeRequest,
  validateReplay,
  validateRequest,
} from "./level-replay";
import type {
  LevelGeneratorOptions,
  LevelGeneratorRequest,
} from "./level-generator-contracts";
import type {
  DogLevelDifficulty,
  DogLevelGenerationFailure,
  DogLevelGeometry,
  DogLevelReplay,
  DogLegeDogLevel,
} from "./level-types";

/** One level source for fixed first level and deterministic generated levels. */
export class DogLevelProvider {
  private readonly generatedLevels: GeneratedLevelGenerator;

  constructor(options: LevelGeneratorOptions = {}) {
    this.generatedLevels = new GeneratedLevelGenerator(options);
  }

  getLevel(request: LevelGeneratorRequest): DogLegeDogLevel;
  getLevel(
    levelNumber: number,
    seed?: string,
    generatorVersion?: number,
  ): DogLegeDogLevel;
  getLevel(
    requestOrLevelNumber: LevelGeneratorRequest | number,
    seed = DEFAULT_LEVEL_SEED,
    generatorVersion = LEVEL_GENERATOR_VERSION,
  ): DogLegeDogLevel {
    const request = normalizeRequest(requestOrLevelNumber, seed, generatorVersion);
    validateRequest(request);
    if (
      request.levelNumber === FIRST_LEVEL_NUMBER &&
      request.seed === DEFAULT_LEVEL_SEED &&
      request.generatorVersion === LEVEL_GENERATOR_VERSION
    ) {
      return FIRST_LEVEL;
    }

    return this.generatedLevels.generate(request);
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
    if (typeof requestOrLevelNumber === "number") {
      return this.generatedLevels.generate(requestOrLevelNumber, seed, generatorVersion);
    }

    return this.generatedLevels.generate(requestOrLevelNumber);
  }

  replay(replay: DogLevelReplay): DogLegeDogLevel {
    validateReplay(replay);
    if (isFirstLevelReplay(replay)) {
      return FIRST_LEVEL;
    }

    return this.generatedLevels.replay(replay);
  }

  replayAttempt(replay: DogLevelReplay): DogLegeDogLevel {
    validateReplay(replay);
    if (isFirstLevelReplay(replay)) {
      return FIRST_LEVEL;
    }

    return this.generatedLevels.replayAttempt(replay);
  }

  replayFailure(failure: DogLevelGenerationFailure): DogLegeDogLevel {
    return this.replayAttempt(failure);
  }

  findSolvablePath(level: DogLevelGeometry): readonly string[] | null {
    return this.generatedLevels.findSolvablePath(level);
  }

  isSolvable(level: DogLevelGeometry): boolean {
    return this.generatedLevels.isSolvable(level);
  }

  getDifficultyMetrics(level: DogLevelGeometry): DogLevelDifficulty {
    return this.generatedLevels.getDifficultyMetrics(level);
  }
}

export const DEFAULT_LEVEL_PROVIDER = new DogLevelProvider();

export function getDogLegeDogLevel(levelNumber: number): DogLegeDogLevel {
  return DEFAULT_LEVEL_PROVIDER.getLevel(levelNumber);
}
