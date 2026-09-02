import { describe, expect, it, vi } from "vitest";
import type {
  GameDefinition,
  GameLaunchContext,
  GameLaunchPreparation,
  GamePreparationContext,
  GameResult,
} from "@/catalog";
import { GamePreparationError } from "@/catalog";
import { ProgressStore } from "@/progress-store";
import { MemoryStorage, mountApp } from "../support/app-fixtures";

describe("关卡加载与预生成生命周期", () => {
  it("异步准备期间显示加载态，验证完成前不启动游戏", async () => {
    const deferred = createDeferred<GameLaunchPreparation>();
    const preparations: GamePreparationContext[] = [];
    const launches: GameLaunchContext[] = [];
    const game = createPreparedGame({
      prepare: (context) => {
        preparations.push(context);
        return deferred.promise;
      },
      launch: (mount, context) => {
        launches.push(context);
        mount.innerHTML = '<div data-testid="prepared-game"></div>';
      },
    });
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: createStore(),
      catalog: [game],
      runSeedFactory: () => "loading-run-seed",
    });

    registerAndEnter(root);

    expect(root.querySelector('[data-testid="game-generation-loading"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="prepared-game"]')).toBeNull();
    expect(launches).toHaveLength(0);
    root.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]')?.click();
    expect(root.querySelector('[data-action="toggle-sound"]')?.getAttribute("aria-pressed"))
      .toBe("false");
    deferred.resolve(createPreparation(game.id, 1, "loading-run-seed"));

    await vi.waitFor(() => {
      expect(root.querySelector('[data-testid="prepared-game"]')).not.toBeNull();
    });
    expect(launches[0]?.preparation).toMatchObject({
      gameId: game.id,
      levelNumber: 1,
      runSeed: "loading-run-seed",
    });
    expect(launches[0]?.soundEnabled).toBe(false);
    expect(preparations[0]?.signal.aborted).toBe(false);
    app.destroy();
  });

  it("加载失败显示诊断；恢复重试沿用原 runSeed 并等待验证", async () => {
    const retryPreparation = createDeferred<GameLaunchPreparation>();
    const seenSeeds: string[] = [];
    const launches: GameLaunchContext[] = [];
    const game = createPreparedGame({
      prepare: (context) => {
        seenSeeds.push(context.runSeed);
        if (seenSeeds.length === 1) {
          throw new GamePreparationError({
            gameId: context.gameId,
            levelNumber: context.levelNumber,
            runSeed: context.runSeed,
            generatorVersion: 13,
            workerFailure: "worker failed",
            fallbackFailure: "sync failed",
          });
        }
        return retryPreparation.promise;
      },
      launch: (_mount, context) => launches.push(context),
    });
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: createStore(),
      catalog: [game],
      runSeedFactory: () => "recoverable-run-seed",
    });

    registerAndEnter(root);

    const error = root.querySelector<HTMLElement>('[data-testid="game-generation-error"]');
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain("recoverable-run-seed");
    expect(error?.textContent).toContain("13");
    expect(error?.textContent).toContain("worker failed");
    expect(error?.textContent).toContain("sync failed");
    expect(launches).toHaveLength(0);

    root.querySelector<HTMLButtonElement>('[data-action="retry-generation"]')?.click();

    expect(seenSeeds).toEqual(["recoverable-run-seed", "recoverable-run-seed"]);
    expect(root.querySelector('[data-testid="game-generation-loading"]')).not.toBeNull();
    expect(launches).toHaveLength(0);
    retryPreparation.resolve(createPreparation(game.id, 1, "recoverable-run-seed"));
    await vi.waitFor(() => expect(launches).toHaveLength(1));
    app.destroy();
  });

  it("失败后的普通重试生成新 runSeed，验证完成前保持加载态", async () => {
    const retryPreparation = createDeferred<GameLaunchPreparation>();
    const preparations: GamePreparationContext[] = [];
    const launches: GameLaunchContext[] = [];
    let latestContext: GameLaunchContext | undefined;
    let seedIndex = 0;
    const game = createPreparedGame({
      prepare: (context) => {
        preparations.push(context);
        return preparations.length === 1
          ? createPreparation(context.gameId, context.levelNumber, context.runSeed)
          : retryPreparation.promise;
      },
      launch: (_mount, context) => {
        launches.push(context);
        latestContext = context;
      },
    });
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: createStore(),
      catalog: [game],
      runSeedFactory: () => `retry-seed-${++seedIndex}`,
    });

    registerAndEnter(root);
    latestContext?.onResult?.(createLossResult(game.id, 1));
    root.querySelector<HTMLButtonElement>('[data-action="retry"]')?.click();

    expect(preparations.map(({ runSeed }) => runSeed)).toEqual([
      "retry-seed-1",
      "retry-seed-2",
    ]);
    expect(root.querySelector('[data-testid="game-generation-loading"]')).not.toBeNull();
    expect(launches).toHaveLength(1);
    retryPreparation.resolve(createPreparation(game.id, 1, "retry-seed-2"));
    await vi.waitFor(() => expect(launches).toHaveLength(2));
    app.destroy();
  });

  it("活动关卡重玩只启动一次新尝试，保留道具组与进度并等待新验证", async () => {
    const thirdPreparation = createDeferred<GameLaunchPreparation>();
    const launches: GameLaunchContext[] = [];
    let prepareCount = 0;
    const game = createPreparedGame({
      prepare: (context) => {
        prepareCount += 1;
        return prepareCount < 3
          ? createPreparation(context.gameId, context.levelNumber, context.runSeed)
          : thirdPreparation.promise;
      },
      launch: (mount, context) => {
        launches.push(context);
        mount.innerHTML = `<button type="button" data-action="replay-current-level" data-game-id="prepared-game" data-level-number="${context.levelNumber ?? 1}">重玩本关</button>`;
      },
    });
    const store = createStore();
    store.register();
    store.setGameLoadout(game.id, ["one", "two", "three"]);
    const root = document.createElement("div");
    const app = mountApp(root, {
      store,
      catalog: [game],
      runSeedFactory: (() => {
        let index = 0;
        return () => `replay-seed-${++index}`;
      })(),
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    const progressBefore = store.snapshot().state?.games[game.id];
    root.querySelector<HTMLButtonElement>('[data-action="replay-current-level"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="replay-current-level"]')?.click();

    expect(confirm).not.toHaveBeenCalled();
    expect(launches).toHaveLength(2);
    expect(launches[0]?.runSeed).toBe("replay-seed-1");
    expect(launches[1]?.runSeed).toBe("replay-seed-2");
    expect(launches[0]?.loadout).toEqual(["one", "two", "three"]);
    expect(store.snapshot().state?.games[game.id]).toEqual(progressBefore);

    await new Promise((resolve) => setTimeout(resolve, 301));
    root.querySelector<HTMLButtonElement>('[data-action="replay-current-level"]')?.click();
    expect(root.querySelector('[data-testid="game-generation-loading"]')).not.toBeNull();
    expect(launches).toHaveLength(2);

    thirdPreparation.resolve(createPreparation(game.id, 1, "replay-seed-3"));
    await vi.waitFor(() => expect(launches).toHaveLength(3));
    expect(launches[2]?.levelNumber).toBe(1);
    expect(launches[2]?.runSeed).toBe("replay-seed-3");
    expect(launches[2]?.loadout).toEqual(["one", "two", "three"]);
    expect(store.snapshot().state?.games[game.id]).toEqual(progressBefore);
    app.destroy();
  });

  it("当前关卡完成后预生成下一关，进入时等待并复用已验证候选", async () => {
    const nextPreparation = createDeferred<GameLaunchPreparation>();
    const preparations: GamePreparationContext[] = [];
    const preparedValues: GameLaunchPreparation[] = [];
    const launches: GameLaunchContext[] = [];
    let latestContext: GameLaunchContext | undefined;
    let seedIndex = 0;
    const game = createPreparedGame({
      prepare: (context) => {
        preparations.push(context);
        const preparation = createPreparation(
          context.gameId,
          context.levelNumber,
          context.runSeed,
        );
        preparedValues.push(preparation);
        return context.levelNumber === 2 ? nextPreparation.promise : preparation;
      },
      launch: (_mount, context) => {
        launches.push(context);
        latestContext = context;
      },
    });
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: createStore(),
      catalog: [game],
      runSeedFactory: () => `prefetch-seed-${++seedIndex}`,
    });

    registerAndEnter(root);
    const result = createWinResult(game.id, 1);
    latestContext?.onResultConfirmed?.(result);
    latestContext?.onResult?.(result);

    expect(preparations.map(({ levelNumber, runSeed }) => ({ levelNumber, runSeed }))).toEqual([
      { levelNumber: 1, runSeed: "prefetch-seed-1" },
      { levelNumber: 2, runSeed: "prefetch-seed-2" },
    ]);

    root.querySelector<HTMLButtonElement>('[data-action="next-level"]')?.click();

    expect(preparations).toHaveLength(2);
    expect(root.querySelector('[data-testid="game-generation-loading"]')).not.toBeNull();
    expect(launches).toHaveLength(1);
    nextPreparation.resolve(preparedValues[1]!);
    await vi.waitFor(() => expect(launches).toHaveLength(2));
    expect(launches.map(({ levelNumber, runSeed }) => ({ levelNumber, runSeed }))).toEqual([
      { levelNumber: 1, runSeed: "prefetch-seed-1" },
      { levelNumber: 2, runSeed: "prefetch-seed-2" },
    ]);
    expect(launches[1]?.preparation).toBe(preparedValues[1]);
    app.destroy();
  });

  it("离开加载页终止准备任务，主界面保持可响应", () => {
    let preparationSignal: AbortSignal | undefined;
    const game = createPreparedGame({
      prepare: (context) => {
        preparationSignal = context.signal;
        return new Promise<GameLaunchPreparation>(() => undefined);
      },
      launch: () => undefined,
    });
    const root = document.createElement("div");
    const app = mountApp(root, { store: createStore(), catalog: [game] });

    registerAndEnter(root);
    root.querySelector<HTMLButtonElement>('[data-action="catalog"]')?.click();

    expect(preparationSignal?.aborted).toBe(true);
    expect(root.querySelector('[data-view="catalog"]')).not.toBeNull();
    app.destroy();
  });
});

function createPreparedGame(options: {
  readonly prepare: NonNullable<GameDefinition["prepareLaunch"]>;
  readonly launch: (mount: HTMLElement, context: GameLaunchContext) => void;
}): GameDefinition {
  const resultDisplay = {
    won: { eyebrow: "测试 · 结果", title: "测试通关", description: "完成。" },
    lost: { eyebrow: "测试 · 结果", title: "测试失败", description: "失败。" },
  } as const;
  return {
    id: "prepared-game",
    name: "准备型游戏",
    category: "测试",
    description: "验证异步关卡准备。",
    cover: "prepared.svg",
    playable: true,
    resultDisplay,
    prepareLaunch: options.prepare,
    launch: (mount, context = {}) => {
      options.launch(mount, context);
      return { destroy: vi.fn() };
    },
  };
}

function createPreparation(
  gameId: string,
  levelNumber: number,
  runSeed: string,
): GameLaunchPreparation {
  return {
    gameId,
    levelNumber,
    runSeed,
    generatorVersion: 13,
    payload: Object.freeze({ verified: true }),
  };
}

function createStore(): ProgressStore {
  return new ProgressStore({
    storage: new MemoryStorage(),
    userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
  });
}

function registerAndEnter(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
  root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
}

function createWinResult(gameId: string, levelNumber: number): GameResult {
  return {
    gameId,
    levelNumber,
    status: "won",
    reward: 25,
    display: { eyebrow: "测试 · 结果", title: "测试通关", description: "完成。" },
    actions: ["next-level", "catalog"],
  };
}

function createLossResult(gameId: string, levelNumber: number): GameResult {
  return {
    gameId,
    levelNumber,
    status: "lost",
    reward: 0,
    display: { eyebrow: "测试 · 结果", title: "测试失败", description: "失败。" },
    actions: ["retry", "catalog"],
  };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
