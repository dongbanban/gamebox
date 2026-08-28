import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameDefinition, GameLaunchContext, GameResult } from "@/catalog";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog";
import { GAME_ID, ProgressStore } from "@/progress-store";
import {
  dispatchBeforeUnload,
  MemoryStorage,
  mountApp,
} from "../support/app-fixtures";

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
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();

    expect(root.querySelector(".catalog-item__heading h2")?.textContent).toBe("测试游戏");
    expect(root.querySelector(".catalog-item__description")?.textContent).toContain("用于验证公共层契约。");
    expect(root.querySelector(".catalog-item__level")?.textContent).toContain("最高解锁关卡");
    expect(root.querySelector(".catalog-item__actions")).not.toBeNull();
    expect(root.querySelector('.catalog-item__actions [data-action="enter-game"]')).not.toBeNull();
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
    const wonActions = root.querySelector<HTMLElement>(".game-result-card__actions--split");
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

  it("下一关启动失败时返回目录，不伪装成生成失败", () => {
    const root = document.createElement("div");
    const resultDisplay = {
      won: { eyebrow: "测试游戏 · 结果", title: "测试通关", description: "完成。" },
      lost: { eyebrow: "测试游戏 · 结果", title: "测试失败", description: "失败。" },
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
        if (levelNumber === 2) throw new Error("level generation failed");
        return { destroy: vi.fn() };
      },
    };
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    let runSeedIndex = 0;
    const app = mountApp(root, {
      store,
      catalog: [testGame],
      runSeedFactory: () => `launch-failure-seed-${++runSeedIndex}`,
    });

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
    expect(root.querySelector('[data-testid="game-generation-error"]')).toBeNull();
    expect(root.querySelector('[data-testid="dog-game"]')).toBeNull();
    app.destroy();
  });

  it("第 99 关通关后展示最终称号页且不提供下一关", () => {
    const root = document.createElement("div");
    const resultDisplay = {
      won: { eyebrow: "测试游戏 · 结果", title: "测试通关", description: "完成。" },
      final: { eyebrow: "狗了个狗 · 最终通关", title: "你就是最狗的玩家", description: "全部 99 关完成。" },
      lost: { eyebrow: "测试游戏 · 结果", title: "测试失败", description: "失败。" },
    } as const;
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    store.register();
    for (let levelNumber = 1; levelNumber < DOG_V13_CONFIG.game.maxLevelNumber; levelNumber += 1) {
      store.recordLevelCompletion({ gameId: GAME_ID, levelNumber, reward: 0 });
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
      levelNumber: DOG_V13_CONFIG.game.maxLevelNumber,
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
      highestUnlockedLevel: DOG_V13_CONFIG.game.maxLevelNumber,
      completedLevels: Array.from(
        { length: DOG_V13_CONFIG.game.maxLevelNumber },
        (_, index) => index + 1,
      ),
    });
    app.destroy();
  });
});
