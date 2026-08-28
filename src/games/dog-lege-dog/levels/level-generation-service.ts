import {
  GamePreparationError,
  type GameLaunchPreparation,
  type GamePreparationResult,
} from "@/game-contracts";
import {
  loadDogV13Config,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import type {
  DogLevelGenerationWorker,
  DogLevelGenerationWorkerRequest,
  DogLevelGenerationWorkerResponse,
} from "@/games/dog-lege-dog/levels/level-generation-protocol";
import type { LevelGeneratorRequest } from "@/games/dog-lege-dog/levels/level-generator-contracts";
import { freezeDogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-immutability";
import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-types";
import {
  formatDogGenerationError,
  generateVerifiedDogLevel,
} from "@/games/dog-lege-dog/levels/level-generation-verification";

export type {
  DogLevelGenerationWorker,
  DogLevelGenerationWorkerRequest,
  DogLevelGenerationWorkerResponse,
} from "@/games/dog-lege-dog/levels/level-generation-protocol";

export interface DogLevelPreparationRequest {
  readonly levelNumber: number;
  readonly runSeed: string;
  readonly config?: unknown;
  readonly signal?: AbortSignal;
}

export interface DogPreparedLevelPayload {
  readonly kind: "dog-level";
  readonly source: "worker" | "sync-fallback";
  readonly replayVerified: true;
  readonly level: DogLegeDogLevel;
}

export interface DogLevelGenerationServiceOptions {
  readonly workerFactory?: () => DogLevelGenerationWorker | null;
}

export class DogLevelGenerationService {
  private readonly workerFactory: () => DogLevelGenerationWorker | null;
  private nextRequestId = 1;

  constructor(options: DogLevelGenerationServiceOptions = {}) {
    this.workerFactory = options.workerFactory ?? createDogGenerationWorker;
  }

  prepare(request: DogLevelPreparationRequest): GamePreparationResult {
    const config = loadDogV13Config(request.config);
    const generatorRequest: LevelGeneratorRequest = {
      levelNumber: request.levelNumber,
      runSeed: request.runSeed,
      generatorVersion: config.game.generatorVersion,
    };
    let worker: DogLevelGenerationWorker | null;
    try {
      worker = config.generation.preferWorker ? this.workerFactory() : null;
    } catch (error) {
      return this.prepareSynchronously(generatorRequest, config, formatDogGenerationError(error));
    }
    if (worker === null) {
      return this.prepareSynchronously(
        generatorRequest,
        config,
        "Web Worker unavailable",
      );
    }

    const requestId = `dog-level-${this.nextRequestId++}`;
    return generateInWorker(
      worker,
      {
        type: "generate",
        requestId,
        request: generatorRequest,
        config,
      },
      config.generation.workerTimeoutMs,
      request.signal,
    ).then(
      (level) => createDogLaunchPreparation(level, "worker", config),
      (error: unknown) => {
        if (isAbortError(error)) throw error;
        return this.prepareSynchronously(
          generatorRequest,
          config,
          formatDogGenerationError(error),
        );
      },
    );
  }

  private prepareSynchronously(
    request: LevelGeneratorRequest,
    config: DogV13Config,
    workerFailure: string,
  ): GameLaunchPreparation {
    try {
      const level = generateVerifiedDogLevel(request, config);
      return createDogLaunchPreparation(level, "sync-fallback", config);
    } catch (error) {
      throw new GamePreparationError({
        gameId: config.game.id,
        levelNumber: request.levelNumber,
        runSeed: request.runSeed,
        generatorVersion: config.game.generatorVersion,
        workerFailure,
        fallbackFailure: formatDogGenerationError(error),
      });
    }
  }
}

export function getPreparedDogLevel(
  preparation: GameLaunchPreparation,
  expected: {
    readonly levelNumber: number;
    readonly runSeed: string;
    readonly config: DogV13Config;
  },
): DogLegeDogLevel {
  const payload = preparation.payload;
  if (
    preparation.gameId !== expected.config.game.id ||
    preparation.levelNumber !== expected.levelNumber ||
    preparation.runSeed !== expected.runSeed ||
    preparation.generatorVersion !== expected.config.game.generatorVersion ||
    !isDogPreparedLevelPayload(payload)
  ) {
    throw new Error("Prepared dog level does not match the requested launch");
  }
  assertPublishableLevel(payload.level, expected, payload.replayVerified);
  return payload.level;
}

function createDogLaunchPreparation(
  level: DogLegeDogLevel,
  source: DogPreparedLevelPayload["source"],
  config: DogV13Config,
): GameLaunchPreparation {
  const frozenLevel = freezeDogLegeDogLevel(level);
  assertPublishableLevel(
    frozenLevel,
    { levelNumber: level.number, runSeed: level.runSeed, config },
    true,
  );
  const payload: DogPreparedLevelPayload = Object.freeze({
    kind: "dog-level",
    source,
    replayVerified: true,
    level: frozenLevel,
  });
  return Object.freeze({
    gameId: config.game.id,
    levelNumber: level.number,
    runSeed: level.runSeed,
    generatorVersion: level.generatorVersion,
    payload,
  });
}

function assertPublishableLevel(
  level: DogLegeDogLevel,
  expected: {
    readonly levelNumber: number;
    readonly runSeed: string;
    readonly config: DogV13Config;
  },
  replayVerified: boolean,
): void {
  if (
    !replayVerified ||
    level.number !== expected.levelNumber ||
    level.runSeed !== expected.runSeed ||
    level.generatorVersion !== expected.config.game.generatorVersion ||
    level.generation.replay.accepted !== true ||
    level.generation.replay.levelNumber !== expected.levelNumber ||
    level.generation.replay.runSeed !== expected.runSeed ||
    level.generation.replay.generatorVersion !== expected.config.game.generatorVersion
  ) {
    throw new Error("Generated dog level failed publication metadata validation");
  }
}

function isDogPreparedLevelPayload(value: unknown): value is DogPreparedLevelPayload {
  if (value === null || typeof value !== "object") return false;
  const payload = value as Partial<DogPreparedLevelPayload>;
  return payload.kind === "dog-level" &&
    (payload.source === "worker" || payload.source === "sync-fallback") &&
    payload.replayVerified === true &&
    payload.level !== undefined;
}

function generateInWorker(
  worker: DogLevelGenerationWorker,
  request: DogLevelGenerationWorkerRequest,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<DogLegeDogLevel> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settle(() => reject(new Error(`Worker generation timed out after ${timeoutMs}ms`)));
    }, timeoutMs);
    const handleAbort = (): void => {
      settle(() => reject(createAbortError()));
    };
    const cleanup = (): void => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", handleAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };
    const settle = (complete: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      complete();
    };

    worker.onmessage = (event): void => {
      const response = event.data;
      if (response.requestId !== request.requestId) return;
      if (response.type === "failed") {
        settle(() => reject(new Error(response.diagnostic)));
        return;
      }
      if (response.replayVerified !== true) {
        settle(() => reject(new Error("Worker returned an unverified replay")));
        return;
      }
      settle(() => resolve(response.level));
    };
    worker.onerror = (event): void => {
      settle(() => reject(new Error(event.message || "Worker generation failed")));
    };
    worker.onmessageerror = (): void => {
      settle(() => reject(new Error("Worker generation response could not be decoded")));
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
    if (signal?.aborted === true) {
      handleAbort();
      return;
    }
    try {
      worker.postMessage(request);
    } catch (error) {
      settle(() => reject(error));
    }
  });
}

function createDogGenerationWorker(): DogLevelGenerationWorker | null {
  if (typeof Worker === "undefined") return null;
  return new Worker(
    new URL("./level-generation-worker.ts", import.meta.url),
    { type: "module", name: "dog-level-generation" },
  );
}

function createAbortError(): Error {
  const error = new Error("Level generation aborted");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
