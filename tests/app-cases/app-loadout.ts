import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameDefinition, GameLaunchContext, GameResult } from "@/catalog";
import { GAME_ID, ProgressStore } from "@/progress-store";
import {
  MemoryStorage,
  mountApp,
} from "../support/app-fixtures";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("狗了个狗道具组选择", () => {
  it("首次进入同时展示本关棋盘与八种道具，确认三个后才建立道具组", () => {
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
    expect(root.querySelector('[data-testid="dog-loadout-modal"]')?.getAttribute("role")).toBe("dialog");
    expect(root.querySelector('[data-testid="dog-loadout-modal"]')?.getAttribute("aria-modal")).toBe("true");
    expect(root.querySelector('[data-testid="dog-loadout-modal"] .eyebrow')).toBeNull();
    expect(root.querySelector('[data-action="cancel-loadout"]')?.textContent).toBe("清空");
    expect(root.querySelector('[data-action="confirm-loadout"]')?.textContent).toContain("确认");
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="dog-loadout-option"]')).toHaveLength(8);
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
    expect([...loadoutSummary?.querySelectorAll<HTMLImageElement>('.dog-loadout-thumbnail__icon img') ?? []].map((icon) => icon.getAttribute("src"))).toEqual([
      "assets/dog-item-icons/triple-removal.svg",
      "assets/dog-item-icons/tray-capacity-plus-one.svg",
      "assets/dog-item-icons/wildcard.svg",
    ]);
    expect(loadoutSlot?.nextElementSibling?.getAttribute("data-testid")).toBe("dog-tray-region");
    expect(loadoutSummary?.lastElementChild?.getAttribute("data-testid")).toBe("dog-loadout-actions");
    expect(loadoutSummary?.querySelector('[data-action="edit-loadout"]')?.textContent).toContain("变更");
    expect(root.querySelector('[data-testid="dog-block"]:not([disabled])')).not.toBeNull();
    expect(store.snapshot().state?.games[GAME_ID].loadout).toEqual(["triple-removal", "tray-capacity", "wildcard"]);
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").games[GAME_ID]).not.toHaveProperty("tray");
    app.destroy();
  });

  it("失败结果页更换道具组后重试当前关卡，不回滚已保存进度", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" });
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
    const app = mountApp(root, { store, catalog: [testGame] });
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
    expect(store.snapshot().state?.games[GAME_ID].loadout).toEqual(["tray-capacity", "wildcard", "torch"]);
    expect(store.snapshot().state?.games[GAME_ID]).toMatchObject({ highestUnlockedLevel: 1, completedLevels: [], totalScore: 0 });
    app.destroy();
  });

  it("已确认道具组跨离开与再次进入保留，局内过程不进入进度", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" });
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
    storage.setItem("gamebox.state", JSON.stringify({
      schemaVersion: 1,
      userId: "123e4567-e89b-12d3-a456-426614174000",
      games: { [GAME_ID]: { highestUnlockedLevel: 1, totalScore: 0, completedLevels: [], loadout: ["triple-removal", "invalid-item", "torch"] } },
      settings: { soundEnabled: true },
    }));
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage }) });
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="dog-loadout-option"][aria-pressed="true"]')).toHaveLength(0);
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").games[GAME_ID].loadout).toEqual(["triple-removal", "invalid-item", "torch"]);
    app.destroy();
  });

  it("胜利结果页更换道具组后进入下一关，已确认通关与奖励保持", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" });
    store.register();
    for (const levelNumber of [1, 2, 3, 4]) store.recordLevelCompletion({ gameId: GAME_ID, levelNumber, reward: 0 });
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
    const app = mountApp(root, { store, catalog: [testGame], runSeedFactory: () => `win-run-${launchContexts.length + 1}` });
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    const result: GameResult = { gameId: GAME_ID, levelNumber: 5, status: "won", reward: 25, display: resultDisplay.won, actions: ["next-level", "catalog"] };
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
    expect(store.snapshot().state?.games[GAME_ID]).toMatchObject({ highestUnlockedLevel: 6, totalScore: 25, completedLevels: [1, 2, 3, 4, 5], loadout: ["tray-capacity", "wildcard", "torch"] });
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).toBeNull();
    app.destroy();
  });
});
