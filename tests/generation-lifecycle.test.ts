import { describe, expect, it } from "vitest";
import {
  DOG_V13_CONFIG,
  DogLevelGenerationService,
  GamePreparationError,
  type DogLevelGenerationWorker,
  type DogLevelGenerationWorkerRequest,
  type DogLevelGenerationWorkerResponse,
} from "@/games/dog-lege-dog";
import {
  TEST_LEVEL,
  TEST_RUN_SEED,
} from "./support/dog-level-fixture";

describe("关卡生成 Worker 生命周期", () => {
  it("Worker 完整验证候选后发布并立即终止", async () => {
    const worker = new FakeGenerationWorker((request, target) => {
      target.respond({
        type: "generated",
        requestId: request.requestId,
        level: TEST_LEVEL,
        replayVerified: true,
      });
    });
    const service = new DogLevelGenerationService({ workerFactory: () => worker });

    const prepared = await service.prepare({
      levelNumber: 1,
      runSeed: TEST_RUN_SEED,
      config: DOG_V13_CONFIG,
    });

    expect(prepared).toMatchObject({
      gameId: DOG_V13_CONFIG.game.id,
      levelNumber: 1,
      runSeed: TEST_RUN_SEED,
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    });
    expect(prepared.payload).toMatchObject({
      kind: "dog-level",
      source: "worker",
      replayVerified: true,
      level: { runSeed: TEST_RUN_SEED },
    });
    expect(worker.terminated).toBe(true);
  });

  it("Worker 失败后严格同步重试，只发布 fallback 验证结果", async () => {
    const worker = new FakeGenerationWorker((_request, target) => {
      target.fail("worker exploded");
    });
    const service = new DogLevelGenerationService({ workerFactory: () => worker });

    const prepared = await service.prepare({
      levelNumber: 1,
      runSeed: TEST_RUN_SEED,
      config: DOG_V13_CONFIG,
    });

    expect(prepared.payload).toMatchObject({
      kind: "dog-level",
      source: "sync-fallback",
      replayVerified: true,
      level: {
        number: 1,
        runSeed: TEST_RUN_SEED,
        generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
      },
    });
    expect(worker.terminated).toBe(true);
  });

  it("Worker 与同步路径都失败时保留完整可重放诊断", async () => {
    const worker = new FakeGenerationWorker((_request, target) => {
      target.fail("worker exploded");
    });
    const service = new DogLevelGenerationService({ workerFactory: () => worker });

    const error = await Promise.resolve(service.prepare({
      levelNumber: DOG_V13_CONFIG.game.maxLevelNumber + 1,
      runSeed: "failed-generation-seed",
      config: DOG_V13_CONFIG,
    })).catch((failure: unknown) => failure);

    expect(error).toMatchObject({
      name: GamePreparationError.name,
      details: {
        gameId: DOG_V13_CONFIG.game.id,
        levelNumber: DOG_V13_CONFIG.game.maxLevelNumber + 1,
        runSeed: "failed-generation-seed",
        generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
        workerFailure: "worker exploded",
      },
    });
    expect(error).toBeInstanceOf(GamePreparationError);
    expect((error as GamePreparationError).details.fallbackFailure).toContain(
      "1 to 99",
    );
  });

  it("离开加载页会终止 Worker，不把 abort 当作生成失败重试", async () => {
    const worker = new FakeGenerationWorker(() => undefined);
    const service = new DogLevelGenerationService({ workerFactory: () => worker });
    const abortController = new AbortController();
    const preparation = service.prepare({
      levelNumber: DOG_V13_CONFIG.game.maxLevelNumber + 1,
      runSeed: "aborted-generation-seed",
      config: DOG_V13_CONFIG,
      signal: abortController.signal,
    });

    abortController.abort();

    await expect(preparation).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminated).toBe(true);
  });
});

class FakeGenerationWorker implements DogLevelGenerationWorker {
  onmessage: ((event: MessageEvent<DogLevelGenerationWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  terminated = false;

  constructor(
    private readonly onPost: (
      request: DogLevelGenerationWorkerRequest,
      worker: FakeGenerationWorker,
    ) => void,
  ) {}

  postMessage(request: DogLevelGenerationWorkerRequest): void {
    queueMicrotask(() => this.onPost(request, this));
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: DogLevelGenerationWorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<DogLevelGenerationWorkerResponse>);
  }

  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}
