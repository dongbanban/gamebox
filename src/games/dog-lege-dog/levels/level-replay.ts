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
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config";
import { freezeDogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-immutability";
import { DOG_REWARD_CONFIG_VERSION } from "@/games/dog-lege-dog/levels/level-reward";

export interface GeneratedLevelCandidate {
  readonly attempt: number;
  readonly number: number;
  readonly seed: string;
  readonly runSeed: string;
  readonly generatorVersion: number;
  readonly rewardConfigVersion: number;
  readonly lockedTraySlotCount?: number;
  readonly maxLayers: number;
  readonly reward: number;
  readonly board: DogLegeDogLevel["board"];
  readonly patternTypes: DogLegeDogLevel["patternTypes"];
  readonly blocks: DogLegeDogLevel["blocks"];
  readonly specialMechanisms: DogLegeDogLevel["specialMechanisms"];
  readonly solutionPath: readonly string[];
  readonly difficulty: DogLevelDifficulty;
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
  const { testSeed, ...level } = candidate;
  const replay: DogLevelReplay = Object.freeze({
    attempt: candidate.attempt,
    levelNumber: candidate.number,
    runSeed: candidate.runSeed,
    levelSeed: candidate.seed,
    testSeed,
    generatorVersion: candidate.generatorVersion,
    rewardConfigVersion: candidate.rewardConfigVersion,
    mode: candidate.replayMode,
    randomSeed: candidate.randomSeed,
    accepted: true,
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
  randomSeed: string,
): DogLevelGenerationFailure {
  return {
    attempt,
    levelNumber: request.levelNumber,
    runSeed: request.runSeed,
    levelSeed,
    testSeed,
    generatorVersion: request.generatorVersion,
    rewardConfigVersion: DOG_REWARD_CONFIG_VERSION,
    mode: "generated",
    randomSeed,
    reason,
    accepted: false,
  };
}

export function normalizeRequest(
  request: LevelGeneratorRequest,
  generatorVersion = DOG_V13_CONFIG.game.generatorVersion,
): NormalizedLevelGeneratorRequest {
  return {
    levelNumber: request.levelNumber,
    runSeed: request.runSeed,
    testSeed: request.testSeed,
    generatorVersion: request.generatorVersion ?? generatorVersion,
  };
}

export function validateRequest(
  request: LevelGeneratorRequest | NormalizedLevelGeneratorRequest,
): void {
  validateLevelNumber(request.levelNumber);
  if (typeof request.runSeed !== "string" || request.runSeed.length === 0) {
    throw new Error("LevelGenerator runSeed must be a non-empty string");
  }

  if (
    request.testSeed !== undefined &&
    (typeof request.testSeed !== "string" || request.testSeed.length === 0)
  ) {
    throw new Error("LevelGenerator test seed must be a non-empty string");
  }

  if (request.generatorVersion !== DOG_V13_CONFIG.game.generatorVersion) {
    throw new Error("LevelGenerator only supports generator version 13");
  }
}

export function validateReplay(replay: DogLevelReplay): void {
  if (!Number.isSafeInteger(replay.attempt) || replay.attempt < 1) {
    throw new Error("LevelGenerator replay attempt must be a positive integer");
  }

  validateRequest({
    levelNumber: replay.levelNumber,
    runSeed: replay.runSeed,
    testSeed: replay.testSeed,
    generatorVersion: replay.generatorVersion,
  });
  if (replay.mode !== "generated") {
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
  if (
    !Number.isSafeInteger(levelNumber) ||
    levelNumber < 1 ||
    levelNumber > DOG_V13_CONFIG.game.maxLevelNumber
  ) {
    throw new Error(
      `狗了个狗 level number must be an integer from 1 to ${DOG_V13_CONFIG.game.maxLevelNumber}`,
    );
  }
}
