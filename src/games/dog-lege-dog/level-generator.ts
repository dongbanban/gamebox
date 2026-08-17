import {
  DEFAULT_LEVEL_REWARD,
  DEFAULT_LEVEL_SEED,
  DOG_GAME_ID,
  LEVEL_GENERATOR_VERSION,
} from "./game-config";
import { MAX_LEVEL_GENERATION_ATTEMPTS } from "./level-generation-engine";
import {
  DogLevelProvider,
} from "./level-provider";
import {
  calculateDifficultyMetrics,
  isDifficultyWithinTarget,
} from "./level-difficulty";
import {
  findSolvablePath,
  isLevelSolvable,
} from "./level-solvability";
import {
  getBlockCount,
  getDifficultyTarget,
  getMaxLayers,
  getPatternTypeCount,
} from "./level-progression";
import {
  DOG_SHAPE_TEMPLATES,
  getShapePool,
  type DogShapeTemplate,
} from "./level-shapes";
import type {
  DogLevelDifficulty,
  DogLevelGenerationFailure,
  DogLevelReplay,
  DogLegeDogLevel,
} from "./level-types";
import type {
  LevelCandidateFilter,
  LevelGeneratorOptions,
  LevelGeneratorRequest,
} from "./level-generator-contracts";

export {
  DEFAULT_LEVEL_REWARD,
  DEFAULT_LEVEL_SEED,
  DOG_GAME_ID,
  LEVEL_GENERATOR_VERSION,
  MAX_LEVEL_GENERATION_ATTEMPTS,
  DOG_SHAPE_TEMPLATES,
  calculateDifficultyMetrics,
  findSolvablePath,
  getBlockCount,
  getDifficultyTarget,
  getMaxLayers,
  getPatternTypeCount,
  getShapePool,
  isDifficultyWithinTarget,
  isLevelSolvable,
};

export type { DogShapeTemplate };

export function getLevelDifficultyMetrics(level: DogLegeDogLevel): DogLevelDifficulty {
  return calculateDifficultyMetrics(level, findSolvablePath(level) ?? undefined);
}

export type {
  LevelCandidateFilter,
  LevelGeneratorOptions,
  LevelGeneratorRequest,
};

export class LevelGenerator {
  private readonly provider: DogLevelProvider;

  constructor(options: LevelGeneratorOptions = {}) {
    this.provider = new DogLevelProvider(options);
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
      return this.provider.generate(requestOrLevelNumber, seed, generatorVersion);
    }

    return this.provider.generate(requestOrLevelNumber);
  }

  findSolvablePath(level: DogLegeDogLevel): readonly string[] | null {
    return this.provider.findSolvablePath(level);
  }

  isSolvable(level: DogLegeDogLevel): boolean {
    return this.provider.isSolvable(level);
  }

  getDifficultyMetrics(level: DogLegeDogLevel): DogLevelDifficulty {
    return this.provider.getDifficultyMetrics(level);
  }

  replay(replay: DogLevelReplay): DogLegeDogLevel {
    return this.provider.replay(replay);
  }

  replayAttempt(replay: DogLevelReplay): DogLegeDogLevel {
    return this.provider.replayAttempt(replay);
  }

  replayFailure(failure: DogLevelGenerationFailure): DogLegeDogLevel {
    return this.provider.replayFailure(failure);
  }
}

export const DEFAULT_LEVEL_GENERATOR = new LevelGenerator();

export function generateDogLegeDogLevel(
  request: LevelGeneratorRequest,
): DogLegeDogLevel {
  return DEFAULT_LEVEL_GENERATOR.generate(request);
}

export function replayDogLegeDogLevel(replay: DogLevelReplay): DogLegeDogLevel {
  return DEFAULT_LEVEL_GENERATOR.replay(replay);
}

export function replayDogLegeDogLevelAttempt(
  replay: DogLevelReplay,
): DogLegeDogLevel {
  return DEFAULT_LEVEL_GENERATOR.replayAttempt(replay);
}

export type {
  DogLevelDifficulty,
};
