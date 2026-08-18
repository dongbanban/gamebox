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
  findSolvability,
} from "./level-solvability";
import type {
  SolvabilityResult,
  SolvabilitySearchOptions,
} from "./level-solvability";
import {
  getBlockCount,
  getDifficultyTarget,
  getMaxLayers,
  getPatternTypeCount,
} from "./level-progression";
import {
  DOG_SHAPE_TEMPLATES,
  type DogShapeTemplate,
} from "./level-shapes";
import type {
  DogLevelDifficulty,
  DogLevelGenerationFailure,
  DogLevelReplay,
  DogLevelGeometry,
  DogLegeDogLevel,
} from "./level-types";
import {
  calculateDogLevelReward,
  DOG_LEVEL_REWARD_CONFIG,
  DOG_REWARD_CONFIG_VERSION,
} from "./level-reward";
import type { DogLevelRewardConfig } from "./level-reward";
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
  findSolvability,
  getBlockCount,
  getDifficultyTarget,
  getMaxLayers,
  getPatternTypeCount,
  isDifficultyWithinTarget,
  calculateDogLevelReward,
  DOG_LEVEL_REWARD_CONFIG,
  DOG_REWARD_CONFIG_VERSION,
};

export type { DogShapeTemplate };
export type { DogLevelRewardConfig };

/** Compatibility path-only seam. Prefer findSolvability for tri-state results. */
export function findSolvablePath(
  level: DogLevelGeometry & { readonly solutionPath?: readonly string[] },
  options: SolvabilitySearchOptions = {},
): readonly string[] | null {
  const result = findSolvability(level, options);
  return result.status === "solvable" ? [...result.path] : null;
}

/** Compatibility boolean seam. Prefer findSolvability for tri-state results. */
export function isLevelSolvable(level: DogLevelGeometry): boolean {
  return findSolvability(level).status === "solvable";
}

export function getLevelDifficultyMetrics(level: DogLegeDogLevel): DogLevelDifficulty {
  const solvability = findSolvability(level);
  return calculateDifficultyMetrics(
    level,
    solvability.status === "solvable" ? solvability.path : undefined,
    undefined,
    solvability,
  );
}

export type {
  LevelCandidateFilter,
  LevelGeneratorOptions,
  LevelGeneratorRequest,
};
export type {
  SolvabilityResult,
  SolvabilitySearchOptions,
} from "./level-solvability";

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

  findSolvablePath(level: DogLevelGeometry): readonly string[] | null {
    return this.provider.findSolvablePath(level);
  }

  findSolvability(
    level: DogLevelGeometry,
    options?: SolvabilitySearchOptions,
  ): SolvabilityResult {
    return this.provider.findSolvability(level, options);
  }

  isSolvable(level: DogLevelGeometry): boolean {
    return this.provider.isSolvable(level);
  }

  getDifficultyMetrics(
    level: DogLevelGeometry,
    options?: SolvabilitySearchOptions,
  ): DogLevelDifficulty {
    return this.provider.getDifficultyMetrics(level, options);
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
