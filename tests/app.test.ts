/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { mountApp } from "@/app";
import type { GameDefinition, GameLaunchContext } from "@/catalog";
import { FIRST_LEVEL, FIRST_LEVEL_SEED } from "@/games/dog-lege-dog";
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
        return { destroy: vi.fn() };
      },
    };
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });

    const app = mountApp(root, { store, catalog: [testGame] });
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
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

    root.querySelector<HTMLButtonElement>('[data-action="next-level"]')?.click();
    expect(launchedLevels).toEqual([1, 1, 2]);
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
});

function completeFirstLevel(root: HTMLElement): void {
  for (const blockId of FIRST_LEVEL.solutionPath) {
    root
      .querySelector<HTMLButtonElement>(
        `[data-testid="dog-block"][data-block-id="${blockId}"]`,
      )
      ?.click();
  }
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
    expect(root.querySelector(".catalog-header .brand-lockup__mark--dog svg")).not.toBeNull();

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
    expect(firstBlock?.style.getPropertyValue("--block-width")).toBe("40px");
    expect(firstBlock?.style.getPropertyValue("--block-height")).toBe("40px");
    expect(root.textContent).not.toContain("狗了个狗");
    expect(root.querySelector('.game-entry-view__brand [data-action="catalog"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="dog-game"] h2')).toBeNull();
    expect(root.textContent).not.toContain("游戏入口已打开");
    expect(root.textContent).not.toContain("固定首关");
    expect(root.textContent).not.toContain("稳定关卡");
    expect(root.textContent).not.toContain(FIRST_LEVEL_SEED);
    expect(root.textContent).not.toContain("选择没有遮挡的方块，凑齐三个相同图案。");
    expect(root.textContent).not.toContain("剩余方块");
    expect(root.textContent).not.toContain("图案");
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
    expect(root.textContent).not.toContain("图案");
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

    expect(root.querySelector('[data-view="game-entry"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="dog-board"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="dog-block"]')).toHaveLength(90);

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

    const selectedPatterns: string[] = [];
    for (let selectionNumber = 0; selectionNumber < 7; selectionNumber += 1) {
      const candidate = [...root.querySelectorAll<HTMLButtonElement>(
        '[data-testid="dog-block"]:not([disabled])',
      )].find((block) => {
        const patternType = block.dataset.patternType;
        return patternType !== undefined &&
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
