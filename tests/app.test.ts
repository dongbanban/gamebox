/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { mountApp as mountGameboxApp, type MountAppOptions } from "@/app";
import type { GameDefinition, GameLaunchContext, GameResult } from "@/catalog";
import {
  DEFAULT_LEVEL_SEED,
  FIRST_LEVEL,
  FIRST_LEVEL_SEED,
  MAX_LEVEL_NUMBER,
} from "@/games/dog-lege-dog";
import { GAME_ID, ProgressStore, type StorageLike } from "@/progress-store";

class DamagedStorage implements StorageLike {
  getItem(): string {
    return "{damaged";
  }

  setItem(): void {
    throw new Error("storage unavailable");
  }

  removeItem(): void {
    throw new Error("storage unavailable");
  }
}

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("通用游戏定义与结果契约", () => {
  it("使用测试游戏定义渲染分类与游戏侧结果文案，不依赖实际游戏规则", () => {
    const root = document.createElement("div");
    const resultDisplay = {
      won: {
        eyebrow: "测试游戏 · 结果",
        title: "测试通关",
        description: "测试游戏已完成。",
      },
      lost: {
        eyebrow: "测试游戏 · 结果",
        title: "测试未完成",
        description: "测试游戏返回自定义失败说明。",
      },
    } as const;
    let launchContext: GameLaunchContext | undefined;
    const launchedLevels: number[] = [];
    const launchedSeeds: string[] = [];
    const testGame: GameDefinition = {
      id: "test-game",
      name: "测试游戏",
      category: "测试类别",
      description: "用于验证公共层契约。",
      cover: "test-cover.svg",
      playable: true,
      resultDisplay,
      launch: (_mount, context) => {
        launchContext = context;
        launchedLevels.push(context?.levelNumber ?? -1);
        launchedSeeds.push(context?.runSeed ?? "");
        return { destroy: vi.fn() };
      },
    };
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });

    const app = mountApp(root, {
      store,
      catalog: [testGame],
      runSeedFactory: () => `test-run-${launchedSeeds.length + 1}`,
    });
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();

    expect(root.querySelector(".catalog-item__heading h2")?.textContent).toBe("测试游戏");
    expect(root.querySelector(".catalog-item__description")?.textContent).toContain(
      "用于验证公共层契约。",
    );
    expect(root.querySelector(".catalog-item__level")?.textContent).toContain("最高解锁关卡");
    expect(root.querySelector(".catalog-item__actions")).not.toBeNull();
    expect(root.querySelector(".catalog-item__actions [data-action=\"enter-game\"]")).not.toBeNull();
    expect(root.querySelector('[data-view="catalog"]')?.textContent).not.toContain("累计积分");
    expect(root.querySelector(".status-dot")).toBeNull();
    expect(root.querySelector('[data-action="enter-game"]')?.textContent?.trim()).toBe("开始游戏");

    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
    expect(launchContext?.runSeed).toBe("test-run-1");
    launchContext?.onResultConfirmed?.({
      gameId: testGame.id,
      levelNumber: 1,
      status: "lost",
      reward: 0,
      display: resultDisplay.lost,
      actions: ["retry", "catalog"],
    });
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    launchContext?.onResult?.({
      gameId: testGame.id,
      levelNumber: 1,
      status: "lost",
      reward: 0,
      display: resultDisplay.lost,
      actions: ["retry", "catalog"],
    });

    expect(root.querySelector('[data-result="lost"]')).not.toBeNull();
    expect(root.textContent).toContain("测试游戏 · 结果");
    expect(root.textContent).toContain("测试未完成");
    expect(root.textContent).toContain("测试游戏返回自定义失败说明。");
    expect(root.textContent).toContain("第 1 关");
    expect(root.textContent).not.toContain("暂存槽已满");
    expect(root.querySelector('[data-action="retry"]')).not.toBeNull();
    expect(root.querySelector('[data-action="catalog"]')).not.toBeNull();
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    root.querySelector<HTMLButtonElement>('[data-action="retry"]')?.click();
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
    expect(launchContext?.runSeed).toBe("test-run-2");
    launchContext?.onResultConfirmed?.({
      gameId: testGame.id,
      levelNumber: 1,
      status: "won",
      reward: 25,
      display: resultDisplay.won,
      actions: ["next-level", "catalog"],
    });
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    launchContext?.onResult?.({
      gameId: testGame.id,
      levelNumber: 1,
      status: "won",
      reward: 25,
      display: resultDisplay.won,
      actions: ["next-level", "catalog"],
    });

    expect(root.textContent).toContain("测试通关");
    expect(root.textContent).toContain("通关奖励");
    expect(root.textContent).toContain("25");
    expect(root.querySelector('[data-action="next-level"]')).not.toBeNull();
    const wonActions = root.querySelector<HTMLElement>(
      ".game-result-card__actions--split",
    );
    const wonCatalogAction = root.querySelector<HTMLElement>('[data-action="catalog"]');
    const nextLevelAction = root.querySelector<HTMLElement>('[data-action="next-level"]');
    expect(wonActions).not.toBeNull();
    expect([...wonActions?.children ?? []]).toEqual([wonCatalogAction, nextLevelAction]);
    expect(wonCatalogAction?.classList.contains("icon-button")).toBe(true);
    expect(nextLevelAction?.classList.contains("primary-button--next")).toBe(true);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    root.querySelector<HTMLButtonElement>('[data-action="next-level"]')?.click();
    expect(launchedLevels).toEqual([1, 1, 2]);
    expect(launchedSeeds).toEqual(["test-run-1", "test-run-2", "test-run-3"]);
    expect(root.querySelector('[data-view="game-entry"]')).not.toBeNull();

    app.destroy();
  });

  it("下一关生成或启动失败时安全返回游戏目录", () => {
    const root = document.createElement("div");
    const resultDisplay = {
      won: {
        eyebrow: "测试游戏 · 结果",
        title: "测试通关",
        description: "完成。",
      },
      lost: {
        eyebrow: "测试游戏 · 结果",
        title: "测试失败",
        description: "失败。",
      },
    } as const;
    const launchedLevels: number[] = [];
    const launchContexts: GameLaunchContext[] = [];
    const testGame: GameDefinition = {
      id: GAME_ID,
      name: "测试游戏",
      category: "测试类别",
      description: "用于验证启动失败降级。",
      cover: "test-cover.svg",
      playable: true,
      resultDisplay,
      launch: (_mount, context) => {
        const launchContext = context ?? {};
        const levelNumber = launchContext.levelNumber ?? -1;
        launchedLevels.push(levelNumber);
        launchContexts.push(launchContext);
        if (levelNumber === 2) {
          throw new Error("level generation failed");
        }

        return { destroy: vi.fn() };
      },
    };
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    const app = mountApp(root, { store, catalog: [testGame] });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    launchContexts[0]?.onResultConfirmed?.({
      gameId: GAME_ID,
      levelNumber: 1,
      status: "won",
      reward: 25,
      display: resultDisplay.won,
      actions: ["next-level", "catalog"],
    });
    launchContexts[0]?.onResult?.({
      gameId: GAME_ID,
      levelNumber: 1,
      status: "won",
      reward: 25,
      display: resultDisplay.won,
      actions: ["next-level", "catalog"],
    });

    root.querySelector<HTMLButtonElement>('[data-action="next-level"]')?.click();

    expect(launchedLevels).toEqual([1, 2]);
    expect(root.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(root.querySelector('[data-view="game-entry"]')).toBeNull();
    expect(root.textContent).toContain("测试游戏");

    app.destroy();
  });

  it("第 99 关通关后展示最终称号页且不提供下一关", () => {
    const root = document.createElement("div");
    const resultDisplay = {
      won: {
        eyebrow: "测试游戏 · 结果",
        title: "测试通关",
        description: "完成。",
      },
      final: {
        eyebrow: "狗了个狗 · 最终通关",
        title: "你就是最狗的玩家",
        description: "全部 99 关完成。",
      },
      lost: {
        eyebrow: "测试游戏 · 结果",
        title: "测试失败",
        description: "失败。",
      },
    } as const;
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    store.register();
    for (let levelNumber = 1; levelNumber < MAX_LEVEL_NUMBER; levelNumber += 1) {
      store.recordLevelCompletion({
        gameId: GAME_ID,
        levelNumber,
        reward: 0,
      });
    }

    let launchContext: GameLaunchContext | undefined;
    const testGame: GameDefinition = {
      id: GAME_ID,
      name: "狗了个狗",
      category: "测试",
      description: "测试最终通关页。",
      cover: "test-cover.svg",
      playable: true,
      resultDisplay,
      launch: (_mount, context) => {
        launchContext = context;
        return { destroy: vi.fn() };
      },
    };
    const app = mountApp(root, { store, catalog: [testGame] });
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    const finalResult: GameResult = {
      gameId: GAME_ID,
      levelNumber: MAX_LEVEL_NUMBER,
      status: "won",
      reward: 25,
      display: resultDisplay.final,
      actions: ["catalog"],
      isFinal: true,
    };
    launchContext?.onResultConfirmed?.(finalResult);
    launchContext?.onResult?.(finalResult);

    expect(root.querySelector('[data-final="true"]')).not.toBeNull();
    expect(root.querySelector("#game-result-title")?.textContent).toBe("你就是最狗的玩家");
    expect(root.querySelector('[data-action="next-level"]')).toBeNull();
    expect(root.textContent).toContain("99 / 99");
    expect(store.snapshot().state?.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: MAX_LEVEL_NUMBER,
      completedLevels: Array.from(
        { length: MAX_LEVEL_NUMBER },
        (_, index) => index + 1,
      ),
    });

    app.destroy();
  });
});

describe("狗了个狗道具组选择", () => {
  it("首次进入同时展示本关棋盘与七种道具，确认三个后才建立道具组", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    const root = document.createElement("div");
    const app = mountApp(root, { store });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    expect(root.querySelector('[data-testid="dog-board"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="dog-loadout-modal"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="dog-loadout-modal"]')?.getAttribute("role")).toBe(
      "dialog",
    );
    expect(root.querySelector('[data-testid="dog-loadout-modal"]')?.getAttribute("aria-modal")).toBe(
      "true",
    );
    expect(root.querySelector('[data-testid="dog-loadout-modal"] .eyebrow')).toBeNull();
    expect(root.querySelector('[data-action="cancel-loadout"]')?.textContent).toBe("清空");
    expect(root.querySelector('[data-action="confirm-loadout"]')?.textContent).toContain("确认");
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="dog-loadout-option"]')).toHaveLength(7);
    expect(root.querySelector('[data-testid="dog-block"]:not([disabled])')).toBeNull();
    expect(store.snapshot().state?.games[GAME_ID].loadout).toBeNull();

    const clickOption = (index: number): void => {
      root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-loadout-option"]')[index]?.click();
    };
    clickOption(0);
    root.querySelector<HTMLButtonElement>('[data-action="cancel-loadout"]')?.click();
    expect(root.querySelectorAll('[data-testid="dog-loadout-option"][aria-pressed="true"]')).toHaveLength(0);
    expect(store.snapshot().state?.games[GAME_ID].loadout).toBeNull();
    clickOption(0);
    clickOption(1);
    expect(root.querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')?.disabled).toBe(true);

    clickOption(2);
    expect(root.querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')?.disabled).toBe(false);
    expect(store.snapshot().state?.games[GAME_ID].loadout).toBeNull();

    root.querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')?.click();

    expect(root.querySelector('[data-testid="dog-loadout-modal"]')).toBeNull();
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).toBeNull();
    const loadoutSlot = root.querySelector('[data-testid="dog-loadout-slot"]');
    const loadoutSummary = loadoutSlot?.querySelector('[data-testid="dog-loadout-summary"]');
    expect(loadoutSlot?.querySelectorAll('[data-testid="dog-loadout-thumbnail"]')).toHaveLength(3);
    expect(loadoutSummary?.querySelector('.dog-loadout-summary__label')).toBeNull();
    expect(
      [...loadoutSummary?.querySelectorAll<HTMLImageElement>('.dog-loadout-thumbnail__icon img') ?? []].map(
        (icon) => icon.getAttribute("src"),
      ),
    ).toEqual([
      "assets/dog-item-icons/triple-removal.svg",
      "assets/dog-item-icons/tray-capacity-plus-one.svg",
      "assets/dog-item-icons/wildcard.svg",
    ]);
    expect(loadoutSlot?.nextElementSibling?.getAttribute("data-testid")).toBe("dog-tray-region");
    expect(loadoutSummary?.lastElementChild?.getAttribute("data-testid")).toBe("dog-loadout-actions");
    expect(loadoutSummary?.querySelector('[data-action="edit-loadout"]')?.textContent).toContain("变更");
    expect(root.querySelector('[data-testid="dog-block"]:not([disabled])')).not.toBeNull();
    expect(store.snapshot().state?.games[GAME_ID].loadout).toEqual([
      "triple-removal",
      "tray-capacity",
      "wildcard",
    ]);
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").games[GAME_ID]).not.toHaveProperty(
      "tray",
    );

    app.destroy();
  });

  it("失败结果页更换道具组后重试当前关卡，不回滚已保存进度", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    store.register();
    store.setGameLoadout(GAME_ID, ["triple-removal", "tray-capacity", "wildcard"]);
    const resultDisplay = {
      won: { eyebrow: "测试 · 通关", title: "通关", description: "完成。" },
      lost: { eyebrow: "测试 · 失败", title: "失败", description: "失败。" },
    } as const;
    const launchContexts: GameLaunchContext[] = [];
    const testGame: GameDefinition = {
      id: GAME_ID,
      name: "狗了个狗",
      category: "测试",
      description: "测试道具组结果页。",
      cover: "test-cover.svg",
      playable: true,
      resultDisplay,
      launch: (_mount, context) => {
        launchContexts.push(context ?? {});
        return { destroy: vi.fn() };
      },
    };
    const root = document.createElement("div");
    const app = mountGameboxApp(root, {
      store,
      catalog: [testGame],
    });

    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    const result: GameResult = {
      gameId: GAME_ID,
      levelNumber: 1,
      status: "lost",
      reward: 0,
      display: resultDisplay.lost,
      actions: ["retry", "catalog"],
    };
    launchContexts[0]?.onResultConfirmed?.(result);
    launchContexts[0]?.onResult?.(result);

    root.querySelector<HTMLButtonElement>('[data-action="edit-loadout"]')?.click();
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).not.toBeNull();
    expect(root.textContent).toContain("当前道具组将应用于第 1 关");
    expect(root.querySelector('[data-loadout-id="key"] small')?.textContent).toBe("本关 0 次");
    root.querySelector<HTMLButtonElement>('[data-loadout-id="triple-removal"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-loadout-id="torch"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')?.click();
    expect(root.querySelector('[data-testid="dog-loadout-confirmation"]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-action="apply-loadout-change"]')?.click();

    expect(launchContexts).toHaveLength(2);
    expect(launchContexts[1]?.levelNumber).toBe(1);
    expect(launchContexts[0]?.runSeed).toEqual(expect.any(String));
    expect(launchContexts[1]?.runSeed).toBe(launchContexts[0]?.runSeed);
    expect(store.snapshot().state?.games[GAME_ID].loadout).toEqual([
      "tray-capacity",
      "wildcard",
      "torch",
    ]);
    expect(store.snapshot().state?.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 1,
      completedLevels: [],
      totalScore: 0,
    });

    app.destroy();
  });

  it("已确认道具组跨离开与再次进入保留，局内过程不进入进度", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    store.register();
    store.setGameLoadout(GAME_ID, ["triple-removal", "tray-capacity", "wildcard"]);

    const firstRoot = document.createElement("div");
    const firstApp = mountApp(firstRoot, { store });
    firstRoot.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    expect(firstRoot.querySelector('[data-testid="dog-loadout-panel"]')).toBeNull();
    firstRoot.querySelector<HTMLButtonElement>('[data-testid="dog-block"]:not([disabled])')?.click();
    expect(firstRoot.querySelector<HTMLButtonElement>('[data-action="edit-loadout"]')?.disabled).toBe(true);
    firstApp.destroy();

    const secondRoot = document.createElement("div");
    const secondApp = mountApp(secondRoot, { store: new ProgressStore({ storage }) });
    secondRoot.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    expect(secondRoot.querySelector('[data-testid="dog-loadout-panel"]')).toBeNull();
    expect(secondRoot.querySelector('[data-testid="dog-loadout-summary"]')).not.toBeNull();
    const persistedState = JSON.parse(storage.getItem("gamebox.state") ?? "null");
    expect(persistedState.games[GAME_ID]).not.toHaveProperty("tray");
    expect(persistedState.games[GAME_ID]).not.toHaveProperty("runSeed");

    secondApp.destroy();
  });

  it("保存道具 ID 有任一无效时整组失效，不静默替换", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "gamebox.state",
      JSON.stringify({
        schemaVersion: 1,
        userId: "123e4567-e89b-12d3-a456-426614174000",
        games: {
          [GAME_ID]: {
            highestUnlockedLevel: 1,
            totalScore: 0,
            completedLevels: [],
            loadout: ["triple-removal", "invalid-item", "torch"],
          },
        },
        settings: { soundEnabled: true },
      }),
    );
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage }) });

    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="dog-loadout-option"][aria-pressed="true"]')).toHaveLength(0);
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").games[GAME_ID].loadout).toEqual([
      "triple-removal",
      "invalid-item",
      "torch",
    ]);

    app.destroy();
  });

  it("胜利结果页更换道具组后进入下一关，已确认通关与奖励保持", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    store.register();
    for (const levelNumber of [1, 2, 3, 4]) {
      store.recordLevelCompletion({
        gameId: GAME_ID,
        levelNumber,
        reward: 0,
      });
    }
    store.setGameLoadout(GAME_ID, ["triple-removal", "tray-capacity", "wildcard"]);
    const resultDisplay = {
      won: { eyebrow: "测试 · 通关", title: "通关", description: "完成。" },
      lost: { eyebrow: "测试 · 失败", title: "失败", description: "失败。" },
    } as const;
    const launchContexts: GameLaunchContext[] = [];
    const testGame: GameDefinition = {
      id: GAME_ID,
      name: "狗了个狗",
      category: "测试",
      description: "测试通关结果页。",
      cover: "test-cover.svg",
      playable: true,
      resultDisplay,
      launch: (_mount, context) => {
        launchContexts.push(context ?? {});
        return { destroy: vi.fn() };
      },
    };
    const root = document.createElement("div");
    const app = mountApp(root, {
      store,
      catalog: [testGame],
      runSeedFactory: () => `win-run-${launchContexts.length + 1}`,
    });

    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    const result: GameResult = {
      gameId: GAME_ID,
      levelNumber: 5,
      status: "won",
      reward: 25,
      display: resultDisplay.won,
      actions: ["next-level", "catalog"],
    };
    launchContexts[0]?.onResultConfirmed?.(result);
    launchContexts[0]?.onResult?.(result);
    root.querySelector<HTMLButtonElement>('[data-action="edit-loadout"]')?.click();
    expect(root.textContent).toContain("新道具组将在第 6 关生效");
    expect(root.querySelector('[data-loadout-id="demagnetizer"] small')?.textContent).toBe("本关 1 次");
    root.querySelector<HTMLButtonElement>('[data-loadout-id="triple-removal"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-loadout-id="torch"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')?.click();
    expect(root.textContent).toContain("已完成关卡、奖励与解锁保持不变");
    root.querySelector<HTMLButtonElement>('[data-action="apply-loadout-change"]')?.click();

    expect(launchContexts[1]?.levelNumber).toBe(6);
    expect(launchContexts[1]?.runSeed).toBe("win-run-2");
    expect(store.snapshot().state?.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 6,
      totalScore: 25,
      completedLevels: [1, 2, 3, 4, 5],
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).toBeNull();

    app.destroy();
  });
});

function completeFirstLevel(root: HTMLElement): void {
  confirmDogLoadout(root);
  for (const blockId of FIRST_LEVEL.solutionPath) {
    root
      .querySelector<HTMLButtonElement>(
        `[data-testid="dog-block"][data-block-id="${blockId}"]`,
      )
      ?.click();
  }
}

function confirmDogLoadout(root: HTMLElement): void {
  if (root.querySelector('[data-testid="dog-loadout-panel"]') === null) {
    return;
  }

  for (const itemId of ["triple-removal", "tray-capacity", "wildcard"]) {
    root.querySelector<HTMLButtonElement>(`[data-loadout-id="${itemId}"]`)?.click();
  }
  root.querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')?.click();
}

function requestLevelThroughNavigationSeam(root: HTMLElement, levelNumber: number): void {
  const request = document.createElement("button");
  request.dataset.action = "select-level";
  request.dataset.gameId = GAME_ID;
  request.dataset.levelNumber = String(levelNumber);
  root.append(request);
  request.click();
}

function dispatchBeforeUnload(): BeforeUnloadEvent {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

function mountApp(root: HTMLElement, options: MountAppOptions = {}) {
  return mountGameboxApp(root, {
    ...options,
    runSeedFactory: options.runSeedFactory ?? (() => DEFAULT_LEVEL_SEED),
  });
}

function readActiveGameSnapshot(root: HTMLElement): {
  readonly blockIds: readonly (string | undefined)[];
  readonly trayPatterns: readonly (string | undefined)[];
  readonly inputLocked: string | undefined;
} {
  return {
    blockIds: [...root.querySelectorAll<HTMLElement>('[data-testid="dog-block"]')].map(
      (block) => block.dataset.blockId,
    ),
    trayPatterns: [
      ...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"]'),
    ].map((slot) => slot.dataset.patternType),
    inputLocked: root.querySelector<HTMLElement>('[data-testid="dog-game"]')?.dataset.inputLocked,
  };
}

describe("活动关卡离开保护", () => {
  it("取消应用返回后保留当前棋盘、暂存槽与输入状态，且只在活动关卡拦截浏览器离开", () => {
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage,
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);
    root.querySelector<HTMLButtonElement>('[data-testid="dog-block"]:not([disabled])')?.click();
    const stateBeforeCancelledLeave = readActiveGameSnapshot(root);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    root.querySelector<HTMLButtonElement>('[data-action="catalog"]')?.click();

    expect(confirm).toHaveBeenCalledWith("当前关卡不会保存，确认离开？");
    expect(readActiveGameSnapshot(root)).toEqual(stateBeforeCancelledLeave);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

    confirm.mockReturnValue(true);
    root.querySelector<HTMLButtonElement>('[data-action="catalog"]')?.click();

    expect(root.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    app.destroy();
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
  });
});

describe("注册与游戏目录 UI", () => {
  it("精简目录与游戏控制区，同时保留当前关卡和局内行为", () => {
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage: new MemoryStorage(),
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    expect(root.querySelector('[data-view="register"]')?.textContent).not.toContain(
      "浏览器小游戏合集 · 01",
    );
    expect(root.querySelector(".register-panel .brand-lockup__mark--dog img")).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();

    const catalogText = root.querySelector('[data-view="catalog"]')?.textContent ?? "";
    expect(catalogText).toContain("GAMEBOX");
    expect(catalogText).toContain("游戏目录");
    expect(catalogText).toContain("重置本地数据");
    expect(catalogText).not.toContain("你的游戏合集");
    expect(catalogText).not.toContain("首个游戏");
    expect(catalogText).not.toContain("更多游戏正在路上");
    expect(catalogText).not.toContain("当前浏览器身份");
    expect(catalogText).not.toContain("累计积分");
    const coverSource = root.querySelector<HTMLImageElement>(".catalog-item__cover")?.src ?? "";
    expect(decodeURIComponent(coverSource)).not.toContain("GAMEBOX · 01");
    expect(root.querySelector(".catalog-item")).not.toBeNull();
    expect(root.querySelector(".catalog-item__cover-wrap")).not.toBeNull();
    expect(root.querySelector(".catalog-item__content h2")?.textContent).toBe("狗了个狗");
    expect(root.querySelector(".catalog-item__level")?.textContent).toContain("最高解锁关卡");
    expect(root.querySelector(".catalog-item__actions")).not.toBeNull();
    expect(root.querySelector(".status-dot")).toBeNull();
    expect(root.querySelector(".catalog-header .brand-lockup__mark--dog img")).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    const catalogButton = root.querySelector<HTMLButtonElement>('[data-action="catalog"]');
    expect(catalogButton?.getAttribute("aria-label")).toBe("返回游戏目录");
    expect(catalogButton?.textContent?.trim()).toBe("");
    expect(catalogButton?.querySelector("svg")).not.toBeNull();
    expect(root.querySelector('[data-testid="level-picker"]')).toBeNull();
    expect(root.querySelectorAll('[data-action="select-level"]')).toHaveLength(0);
    expect(root.querySelector('[data-action="toggle-sound"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector('[data-action="toggle-sound"]')?.textContent).not.toContain("音效");
    expect(root.querySelector('.game-entry-view > h1.sr-only')?.textContent).toBe("活动游戏");
    expect(root.querySelector('[data-testid="dog-active-level"]')?.textContent).toContain("1");
    const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
    const firstBlock = root.querySelector<HTMLElement>('[data-testid="dog-block"]');
    expect(board?.dataset.surfaceShape).toBe("rectangle");
    expect(board?.style.clipPath).toBe("");
    expect(firstBlock?.style.getPropertyValue("--block-width")).toBe("48px");
    expect(firstBlock?.style.getPropertyValue("--block-height")).toBe("48px");
    expect(root.textContent).not.toContain("狗了个狗");
    expect(root.querySelector('.game-entry-view__brand [data-action="catalog"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="dog-game"] h2')).toBeNull();
    expect(root.textContent).not.toContain("游戏入口已打开");
    expect(root.textContent).not.toContain("固定首关");
    expect(root.textContent).not.toContain("稳定关卡");
    expect(root.textContent).not.toContain(FIRST_LEVEL_SEED);
    expect(root.textContent).not.toContain("选择没有遮挡的方块，凑齐三个相同图案。");
    expect(root.textContent).not.toContain("剩余方块");
    expect(root.querySelectorAll('[data-testid="dog-loadout-option"]')).toHaveLength(7);
    expect(root.textContent).not.toContain("层数");
    expect(root.querySelector('[data-testid="dog-tray"]')).not.toBeNull();

    app.destroy();
  });

  it("默认打开最高解锁关卡，并区分已解锁与锁定关卡", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    store.register();
    store.recordLevelCompletion({ gameId: GAME_ID, levelNumber: 1, reward: 100 });

    const root = document.createElement("div");
    const app = mountApp(root, { store });

    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    expect(root.querySelector('[data-testid="dog-active-level"]')?.textContent).toContain("2");
    expect(root.querySelector('[data-testid="level-picker"]')).toBeNull();
    expect(root.querySelectorAll('[data-action="select-level"]')).toHaveLength(0);

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    requestLevelThroughNavigationSeam(root, 2);
    expect(confirm).not.toHaveBeenCalled();
    expect(root.querySelector(".dog-game__stats")).toBeNull();
    expect(root.textContent).not.toContain("剩余方块");
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).not.toBeNull();
    expect(root.textContent).not.toContain("层数");

    requestLevelThroughNavigationSeam(root, 1);

    expect(root.querySelector('[data-testid="dog-active-level"]')?.textContent).toContain("1");

    requestLevelThroughNavigationSeam(root, 3);
    expect(root.querySelector('[data-testid="dog-active-level"]')?.textContent).toContain("1");

    app.destroy();
  });

  it("重玩已完成关卡不重复发放通关奖励", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    store.register();
    store.recordLevelCompletion({ gameId: GAME_ID, levelNumber: 1, reward: 100 });

    const root = document.createElement("div");
    const app = mountApp(root, { store });
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    requestLevelThroughNavigationSeam(root, 1);

    completeFirstLevel(root);

    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    const savedState = JSON.parse(storage.getItem("gamebox.state") ?? "null");
    expect(savedState.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 2,
      totalScore: 100,
      completedLevels: [1],
    });

    app.destroy();
  });

  it("离开活动关卡前确认，取消后继续且确认后返回目录", () => {
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage,
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-testid="dog-block"]:not([disabled])')?.click();
    const savedBeforeLeaving = storage.getItem("gamebox.state");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    root.querySelector<HTMLButtonElement>('[data-action="catalog"]')?.click();

    expect(confirm).toHaveBeenCalledWith("当前关卡不会保存，确认离开？");
    expect(root.querySelector('[data-view="game-entry"]')).not.toBeNull();
    expect(storage.getItem("gamebox.state")).toBe(savedBeforeLeaving);

    confirm.mockReturnValue(true);
    root.querySelector<HTMLButtonElement>('[data-action="catalog"]')?.click();

    expect(root.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(storage.getItem("gamebox.state")).toBe(savedBeforeLeaving);

    app.destroy();
  });

  it("shows a persistence warning and still permits temporary registration", () => {
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage: new DamagedStorage(),
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    expect(root.querySelector('[data-view="register"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="persistence-warning"]')?.textContent).toContain(
      "无法持久化",
    );

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();

    expect(root.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(root.querySelector('[data-game-id="dog-lege-dog"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="persistence-warning"]')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    expect(root.querySelector('[data-view="game-entry"]')).not.toBeNull();
    expect(root.textContent).not.toContain("狗了个狗");

    app.destroy();
  });

  it("opens the fixed first level and returns to the game directory", () => {
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage: new MemoryStorage(),
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);

    expect(root.querySelector('[data-view="game-entry"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="dog-board"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="dog-block"]')).toHaveLength(FIRST_LEVEL.blocks.length);

    vi.spyOn(window, "confirm").mockReturnValue(true);
    root.querySelector<HTMLButtonElement>('[data-action="catalog"]')?.click();

    expect(root.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(root.querySelector('[data-view="game-entry"]')).toBeNull();

    app.destroy();
  });

  it("真实狗了个狗通关后通过通用动作进入刚解锁的下一关", () => {
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage: new MemoryStorage(),
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    completeFirstLevel(root);

    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    expect(root.querySelector('[data-action="next-level"]')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('[data-action="next-level"]')?.click();

    expect(root.querySelector('[data-view="game-entry"]')).not.toBeNull();
    expect(root.querySelector('[data-view="game-entry"]')?.getAttribute("data-level-number")).toBe(
      "2",
    );
    expect(root.querySelector('[data-testid="dog-active-level"]')?.textContent).toContain("2");

    app.destroy();
  });

  it("下一关动作拒绝结果页之外的已解锁关卡", () => {
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage: new MemoryStorage(),
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    completeFirstLevel(root);

    const nextLevelAction = root.querySelector<HTMLButtonElement>('[data-action="next-level"]');
    expect(nextLevelAction?.dataset.levelNumber).toBe("2");
    nextLevelAction?.setAttribute("data-level-number", "1");
    nextLevelAction?.click();

    expect(root.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(root.querySelector('[data-view="game-entry"]')).toBeNull();

    app.destroy();
  });

  it("重玩旧关通关后进入该关的下一关且不越过解锁进度", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    store.register();
    store.recordLevelCompletion({ gameId: GAME_ID, levelNumber: 1, reward: 100 });

    const root = document.createElement("div");
    const app = mountApp(root, { store });
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    requestLevelThroughNavigationSeam(root, 1);

    completeFirstLevel(root);

    root.querySelector<HTMLButtonElement>('[data-action="next-level"]')?.click();

    expect(root.querySelector('[data-view="game-entry"]')?.getAttribute("data-level-number")).toBe(
      "2",
    );
    expect(root.querySelector('[data-testid="dog-active-level"]')?.textContent).toContain("2");

    app.destroy();
  });

  it("切换音效后保留设置，并在重新进入游戏时恢复", () => {
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage,
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    const soundButton = root.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]');
    expect(soundButton?.dataset.soundEnabled).toBe("true");
    soundButton?.click();

    expect(root.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]')?.dataset.soundEnabled).toBe(
      "false",
    );
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").settings.soundEnabled).toBe(false);

    app.destroy();
    const refreshedRoot = document.createElement("div");
    const refreshedApp = mountApp(refreshedRoot, { store: new ProgressStore({ storage }) });
    refreshedRoot.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    expect(
      refreshedRoot
        .querySelector<HTMLButtonElement>('[data-action="toggle-sound"]')
        ?.dataset.soundEnabled,
    ).toBe("false");

    refreshedApp.destroy();
  });

  it("Pointer 动画期间先持久化通关结果，动画完成后再显示结果页", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage,
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);

    for (const blockId of FIRST_LEVEL.solutionPath.slice(0, -1)) {
      const block = [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]')].find(
        (candidate) => candidate.dataset.blockId === blockId,
      );
      block?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      await vi.runAllTimersAsync();
    }

    const finalBlockId = FIRST_LEVEL.solutionPath.at(-1);
    const finalBlock = [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]')].find(
      (candidate) => candidate.dataset.blockId === finalBlockId,
    );
    finalBlock?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));

    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 2,
      completedLevels: [1],
    });
    expect(root.querySelector('[data-view="game-result"]')).toBeNull();
    expect(root.querySelector('[data-testid="dog-game"]')?.getAttribute("data-input-locked")).toBe(
      "true",
    );

    await vi.runAllTimersAsync();

    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    app.destroy();
  });

  it("通关动画被销毁后仍保留已确认的游戏进度", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage,
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);

    for (const blockId of FIRST_LEVEL.solutionPath.slice(0, -1)) {
      const block = [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]')].find(
        (candidate) => candidate.dataset.blockId === blockId,
      );
      block?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      await vi.runAllTimersAsync();
    }

    const finalBlockId = FIRST_LEVEL.solutionPath.at(-1);
    [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]')]
      .find((candidate) => candidate.dataset.blockId === finalBlockId)
      ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 2,
      completedLevels: [1],
    });

    app.destroy();
    await vi.runAllTimersAsync();

    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 2,
      completedLevels: [1],
    });
  });

  it("显示失败结果并提供重新挑战与游戏目录操作", () => {
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage: new MemoryStorage(),
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);

    const selectedPatterns: string[] = [];
    for (let selectionNumber = 0; selectionNumber < 20 && root.querySelector('[data-view="game-result"]') === null; selectionNumber += 1) {
      const candidate = [...root.querySelectorAll<HTMLButtonElement>(
        '[data-testid="dog-block"]:not([disabled])',
      )].find((block) => {
        const patternType = block.dataset.patternType;
        return patternType !== undefined &&
          block.dataset.specialMechanism === undefined &&
          selectedPatterns.filter((selected) => selected === patternType).length < 2;
      });
      expect(candidate).toBeDefined();
      const patternType = candidate?.dataset.patternType;
      if (patternType !== undefined) {
        selectedPatterns.push(patternType);
      }
      candidate?.click();
    }

    expect(root.querySelector('[data-view="game-result"]')).not.toBeNull();
    expect(root.querySelector('[data-result="lost"]')).not.toBeNull();
    expect(root.textContent).toContain("第 1 关");
    const resultActions = root.querySelector<HTMLElement>(
      ".game-result-card__actions--retry",
    );
    const catalogAction = root.querySelector<HTMLElement>('[data-action="catalog"]');
    const retryAction = root.querySelector<HTMLElement>('[data-action="retry"]');
    expect(resultActions).not.toBeNull();
    expect([...resultActions?.children ?? []]).toEqual([catalogAction, retryAction]);
    expect(retryAction?.classList.contains("primary-button--retry")).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-action="retry"]')?.click();
    expect(root.querySelector('[data-testid="dog-board"]')).not.toBeNull();

    app.destroy();
  });

  it("首次通关先记录游戏进度，再显示通关结果并恢复游戏目录进度", () => {
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage,
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    completeFirstLevel(root);

    expect(root.querySelector('[data-view="game-result"]')).not.toBeNull();
    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    expect(root.textContent).toContain("当前关卡");
    expect(root.textContent).toContain("通关奖励");
    expect(root.textContent).toContain("累计积分");
    expect(root.querySelector(".game-result-card__stats")?.textContent).toContain("100");
    expect(root.textContent).toContain("下一关");

    const savedState = JSON.parse(storage.getItem("gamebox.state") ?? "null");
    expect(savedState.games["dog-lege-dog"]).toMatchObject({
      highestUnlockedLevel: 2,
      totalScore: 100,
      completedLevels: [1],
    });

    root.querySelector<HTMLButtonElement>('[data-action="catalog"]')?.click();
    expect(root.querySelector('[data-view="catalog"]')?.textContent).toContain("第 2 关");

    app.destroy();

    const refreshedRoot = document.createElement("div");
    const refreshedApp = mountApp(refreshedRoot, {
      store: new ProgressStore({ storage }),
    });

    expect(refreshedRoot.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(refreshedRoot.querySelector('[data-view="catalog"]')?.textContent).toContain(
      "第 2 关",
    );
    expect(refreshedRoot.querySelector('[data-view="catalog"]')?.textContent).not.toContain(
      "累计积分",
    );

    refreshedApp.destroy();
  });

  it("无法持久化时，通关结果显示警告", () => {
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage: new DamagedStorage(),
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();

    completeFirstLevel(root);

    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="persistence-warning"]')?.textContent).toContain(
      "无法持久化",
    );
    expect(root.textContent).toContain("刷新后进度可能丢失");

    app.destroy();
  });
});
