import { afterEach, describe, expect, it, vi } from "vitest";
import { GAME_ID, ProgressStore } from "@/progress-store";
import {
  confirmDogLoadout,
  completeFirstLevel,
  DamagedStorage,
  dispatchBeforeUnload,
  MemoryStorage,
  mountApp,
  readActiveGameSnapshot,
  requestLevelThroughNavigationSeam,
} from "../support/app-fixtures";
import { TEST_LEVEL } from "../support/dog-level-fixture";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("活动关卡离开保护", () => {
  it("取消应用返回后保留当前棋盘、暂存槽与输入状态，且只在活动关卡拦截浏览器离开", () => {
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
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
    const app = mountApp(root, { store: new ProgressStore({ storage: new MemoryStorage(), userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    expect(root.querySelector('[data-view="register"]')?.textContent).not.toContain("浏览器小游戏合集 · 01");
    expect(root.querySelector(".register-panel .brand-lockup__mark--dog img")).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    const catalogText = root.querySelector('[data-view="catalog"]')?.textContent ?? "";
    for (const text of ["GAMEBOX", "游戏目录", "重置本地数据"]) expect(catalogText).toContain(text);
    for (const text of ["你的游戏合集", "首个游戏", "更多游戏正在路上", "当前浏览器身份", "累计积分"]) expect(catalogText).not.toContain(text);
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
    for (const text of ["狗了个狗", "游戏入口已打开", "固定首关", "稳定关卡", "选择没有遮挡的方块，凑齐三个相同图案。", "剩余方块", "层数"]) expect(root.textContent).not.toContain(text);
    expect(root.querySelector('.game-entry-view__brand [data-action="catalog"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="dog-game"] h2')).toBeNull();
    expect(root.querySelectorAll('[data-testid="dog-loadout-option"]')).toHaveLength(8);
    expect(root.querySelector('[data-testid="dog-tray"]')).not.toBeNull();
    app.destroy();
  });

  it("默认打开最高解锁关卡，并区分已解锁与锁定关卡", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" });
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
    const store = new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" });
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
    expect(savedState.games[GAME_ID]).toMatchObject({ highestUnlockedLevel: 2, totalScore: 100, completedLevels: [1] });
    app.destroy();
  });

  it("离开活动关卡前确认，取消后继续且确认后返回目录", () => {
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
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
    const app = mountApp(root, { store: new ProgressStore({ storage: new DamagedStorage(), userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    expect(root.querySelector('[data-view="register"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="persistence-warning"]')?.textContent).toContain("无法持久化");
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    expect(root.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(root.querySelector('[data-game-id="dog-lege-dog"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="persistence-warning"]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    expect(root.querySelector('[data-view="game-entry"]')).not.toBeNull();
    expect(root.textContent).not.toContain("狗了个狗");
    app.destroy();
  });

  it("opens a generated first-level attempt and returns to the game directory", () => {
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage: new MemoryStorage(), userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);
    expect(root.querySelector('[data-view="game-entry"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="dog-board"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="dog-block"]')).toHaveLength(TEST_LEVEL.blocks.length);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    root.querySelector<HTMLButtonElement>('[data-action="catalog"]')?.click();
    expect(root.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(root.querySelector('[data-view="game-entry"]')).toBeNull();
    app.destroy();
  });

  it("真实狗了个狗通关后通过通用动作进入刚解锁的下一关", () => {
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage: new MemoryStorage(), userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    completeFirstLevel(root);
    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    expect(root.querySelector('[data-action="next-level"]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-action="next-level"]')?.click();
    expect(root.querySelector('[data-view="game-entry"]')).not.toBeNull();
    expect(root.querySelector('[data-view="game-entry"]')?.getAttribute("data-level-number")).toBe("2");
    expect(root.querySelector('[data-testid="dog-active-level"]')?.textContent).toContain("2");
    app.destroy();
  });

  it("下一关动作拒绝结果页之外的已解锁关卡", () => {
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage: new MemoryStorage(), userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
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
    const store = new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" });
    store.register();
    store.recordLevelCompletion({ gameId: GAME_ID, levelNumber: 1, reward: 100 });
    const root = document.createElement("div");
    const app = mountApp(root, { store });
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    requestLevelThroughNavigationSeam(root, 1);
    completeFirstLevel(root);
    root.querySelector<HTMLButtonElement>('[data-action="next-level"]')?.click();
    expect(root.querySelector('[data-view="game-entry"]')?.getAttribute("data-level-number")).toBe("2");
    expect(root.querySelector('[data-testid="dog-active-level"]')?.textContent).toContain("2");
    app.destroy();
  });
});
