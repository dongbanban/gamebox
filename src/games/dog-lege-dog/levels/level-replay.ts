import type {
  DogLevelDifficulty,
  DogLevelGeneration,
  DogLevelGenerationFailure,
  DogLevelReplay,
  DogLevelReplayMode,
  DogLegeDogLevel,
} from "@/games/dog-lege-dog/levels/level-types";
import type {
  LevelGeneratorRequest,
  NormalizedLevelGeneratorRequest,
} from "@/games/dog-lege-dog/levels/level-generator-contracts";
import { freezeDogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-immutability";
import { DOG_REWARD_CONFIG_VERSION } from "@/games/dog-lege-dog/levels/level-reward";

export interface GeneratedLevelCandidate {
  readonly attempt: number;
  readonly number: number;
  readonly seed: string;
  readonly runSeed: string;
  readonly generatorVersion: number;
  readonly rewardConfigVersion: number;
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
    runSeed: candidate.runSeed,
    levelSeed: candidate.seed,
    testSeed,
    generatorVersion: candidate.generatorVersion,
    rewardConfigVersion: candidate.rewardConfigVersion,
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

  return freezeDogLegeDogLevel({
    ...level,
    generation,
  });
}

export function createGenerationFailure(
  request: NormalizedLevelGeneratorRequest,
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
    runSeed: request.runSeed,
    levelSeed,
    testSeed,
    generatorVersion: request.generatorVersion,
    rewardConfigVersion: DOG_REWARD_CONFIG_VERSION,
    mode,
    randomSeed,
    reason,
  };
}

export function normalizeRequest(
  requestOrLevelNumber: LevelGeneratorRequest | number,
  seed: string,
  generatorVersion: number,
): NormalizedLevelGeneratorRequest {
  if (typeof requestOrLevelNumber === "number") {
    return {
      levelNumber: requestOrLevelNumber,
      seed,
      runSeed: seed,
      generatorVersion,
    };
  }

  const runSeed = requestOrLevelNumber.runSeed ?? requestOrLevelNumber.seed ?? "";
  return {
    levelNumber: requestOrLevelNumber.levelNumber,
    seed: runSeed,
    runSeed,
    testSeed: requestOrLevelNumber.testSeed,
    generatorVersion: requestOrLevelNumber.generatorVersion,
  };
}

export function validateRequest(
  request: LevelGeneratorRequest | NormalizedLevelGeneratorRequest,
): void {
  validateLevelNumber(request.levelNumber);
  const runSeed = request.runSeed ?? request.seed;
  if (typeof runSeed !== "string" || runSeed.length === 0) {
    throw new Error("LevelGenerator runSeed must be a non-empty string");
  }

  if (
    request.testSeed !== undefined &&
    (typeof request.testSeed !== "string" || request.testSeed.length === 0)
  ) {
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
    seed: replay.runSeed ?? replay.seed,
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
  if (replay.rewardConfigVersion !== DOG_REWARD_CONFIG_VERSION) {
    throw new Error("LevelGenerator replay reward config version is unsupported");
  }
  if (typeof replay.randomSeed !== "string" || replay.randomSeed.length === 0) {
    throw new Error("LevelGenerator replay random seed must be non-empty");
  }
}

function validateLevelNumber(levelNumber: number): void {
  if (!Number.isSafeInteger(levelNumber) || levelNumber < 1) {
    throw new Error("狗了个狗 level number must be a positive integer");
  }
}
