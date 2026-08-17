import {
  FIRST_LEVEL_NUMBER,
  FIRST_LEVEL_SEED,
} from "./game-config";
import type {
  DogLevelDifficulty,
  DogLevelGeneration,
  DogLevelGenerationFailure,
  DogLevelReplay,
  DogLevelReplayMode,
  DogLegeDogLevel,
} from "./level-types";
import type { LevelGeneratorRequest } from "./level-generator-contracts";

export interface GeneratedLevelCandidate {
  readonly attempt: number;
  readonly number: number;
  readonly seed: string;
  readonly generatorVersion: number;
  readonly maxLayers: number;
  readonly reward: number;
  readonly board: DogLegeDogLevel["board"];
  readonly patternTypes: DogLegeDogLevel["patternTypes"];
  readonly blocks: DogLegeDogLevel["blocks"];
  readonly solutionPath: readonly string[];
  readonly difficulty: DogLevelDifficulty;
  readonly baseSeed: string;
  readonly testSeed: string;
  readonly replayMode: DogLevelReplayMode;
  readonly randomSeed: string;
}

export function finalizeCandidate(
  candidate: GeneratedLevelCandidate,
  attempts: number,
  fallbackUsed: boolean,
  failures: readonly DogLevelGenerationFailure[],
): DogLegeDogLevel {
  const { baseSeed, testSeed, ...level } = candidate;
  const replay: DogLevelReplay = Object.freeze({
    attempt: candidate.attempt,
    levelNumber: candidate.number,
    seed: baseSeed,
    levelSeed: candidate.seed,
    testSeed,
    generatorVersion: candidate.generatorVersion,
    mode: candidate.replayMode,
    randomSeed: candidate.randomSeed,
  });
  const generation: DogLevelGeneration = Object.freeze({
    attempts,
    fallbackUsed,
    replay,
    failures: Object.freeze(
      failures.map((failure) => Object.freeze({ ...failure })),
    ),
  });

  return Object.freeze({
    ...level,
    generation,
  });
}

export function createGenerationFailure(
  request: LevelGeneratorRequest,
  levelSeed: string,
  testSeed: string,
  attempt: number,
  reason: string,
  mode: DogLevelReplayMode,
  randomSeed: string,
): DogLevelGenerationFailure {
  return {
    attempt,
    levelNumber: request.levelNumber,
    seed: request.seed,
    levelSeed,
    testSeed,
    generatorVersion: request.generatorVersion,
    mode,
    randomSeed,
    reason,
  };
}

export function normalizeRequest(
  requestOrLevelNumber: LevelGeneratorRequest | number,
  seed: string,
  generatorVersion: number,
): LevelGeneratorRequest {
  if (typeof requestOrLevelNumber === "number") {
    return {
      levelNumber: requestOrLevelNumber,
      seed,
      generatorVersion,
    };
  }

  return requestOrLevelNumber;
}

export function validateRequest(request: LevelGeneratorRequest): void {
  validateLevelNumber(request.levelNumber);
  if (typeof request.seed !== "string" || request.seed.length === 0) {
    throw new Error("LevelGenerator seed must be a non-empty string");
  }

  if (request.testSeed !== undefined && request.testSeed.length === 0) {
    throw new Error("LevelGenerator test seed must be a non-empty string");
  }

  if (!Number.isSafeInteger(request.generatorVersion) || request.generatorVersion < 1) {
    throw new Error("LevelGenerator version must be a positive integer");
  }
}

export function validateReplay(replay: DogLevelReplay): void {
  if (!Number.isSafeInteger(replay.attempt) || replay.attempt < 1) {
    throw new Error("LevelGenerator replay attempt must be a positive integer");
  }

  validateRequest({
    levelNumber: replay.levelNumber,
    seed: replay.seed,
    testSeed: replay.testSeed,
    generatorVersion: replay.generatorVersion,
  });
  if (
    replay.mode !== "fixed" &&
    replay.mode !== "generated" &&
    replay.mode !== "guaranteed"
  ) {
    throw new Error("LevelGenerator replay mode is invalid");
  }
  if (replay.randomSeed.length === 0) {
    throw new Error("LevelGenerator replay random seed must be non-empty");
  }
}

export function isFirstLevelReplay(replay: DogLevelReplay): boolean {
  return (
    replay.mode === "fixed" &&
    replay.levelNumber === FIRST_LEVEL_NUMBER &&
    replay.levelSeed === FIRST_LEVEL_SEED
  );
}

function validateLevelNumber(levelNumber: number): void {
  if (!Number.isSafeInteger(levelNumber) || levelNumber < 1) {
    throw new Error("狗了个狗 level number must be a positive integer");
  }
}
