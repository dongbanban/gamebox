import { afterEach, describe, expect, it, vi } from "vitest";
import { GAME_ID, ProgressStore } from "@/progress-store";
import {
  completeFirstLevel,
  confirmDogLoadout,
  DamagedStorage,
  MemoryStorage,
  mountApp,
} from "../support/app-fixtures";
import { TEST_LEVEL } from "../support/dog-level-fixture";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("注册与游戏目录结果 UI", () => {
  it("切换音效后保留设置，并在重新进入游戏时恢复", () => {
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);
    const soundButton = root.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]');
    expect(soundButton?.dataset.soundEnabled).toBe("true");
    soundButton?.click();
    expect(root.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]')?.dataset.soundEnabled).toBe("false");
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").settings.soundEnabled).toBe(false);
    app.destroy();
    const refreshedRoot = document.createElement("div");
    const refreshedApp = mountApp(refreshedRoot, { store: new ProgressStore({ storage }) });
    refreshedRoot.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    expect(refreshedRoot.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]')?.dataset.soundEnabled).toBe("false");
    refreshedApp.destroy();
  });

  it("静音后仍可选择方块并将方块放入暂存槽", () => {
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage: new MemoryStorage(), userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);
    const soundButton = root.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]');
    soundButton?.click();
    expect(root.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]')?.dataset.soundEnabled).toBe("false");
    expect(root.querySelector('[data-testid="dog-game"]')?.getAttribute("data-input-locked")).toBe("false");
    root.querySelector<HTMLButtonElement>('[data-testid="dog-block"]:not([disabled])')?.click();
    expect(root.querySelectorAll('[data-testid="dog-tray-slot"][data-pattern-type]').length).toBeGreaterThan(0);
    app.destroy();
  });

  it("Pointer 动画期间先持久化通关结果，动画完成后再显示结果页", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);
    for (const blockId of TEST_LEVEL.solutionPath.slice(0, -1)) {
      [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]')]
        .find((candidate) => candidate.dataset.blockId === blockId)
        ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      await vi.runAllTimersAsync();
    }
    const finalBlockId = TEST_LEVEL.solutionPath.at(-1);
    [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]')]
      .find((candidate) => candidate.dataset.blockId === finalBlockId)
      ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").games[GAME_ID]).toMatchObject({ highestUnlockedLevel: 2, completedLevels: [1] });
    expect(root.querySelector('[data-view="game-result"]')).toBeNull();
    expect(root.querySelector('[data-testid="dog-game"]')?.getAttribute("data-input-locked")).toBe("true");
    await vi.runAllTimersAsync();
    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    app.destroy();
  });

  it("通关动画被销毁后仍保留已确认的游戏进度", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);
    for (const blockId of TEST_LEVEL.solutionPath.slice(0, -1)) {
      [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]')]
        .find((candidate) => candidate.dataset.blockId === blockId)
        ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      await vi.runAllTimersAsync();
    }
    const finalBlockId = TEST_LEVEL.solutionPath.at(-1);
    [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]')]
      .find((candidate) => candidate.dataset.blockId === finalBlockId)
      ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").games[GAME_ID]).toMatchObject({ highestUnlockedLevel: 2, completedLevels: [1] });
    app.destroy();
    await vi.runAllTimersAsync();
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null").games[GAME_ID]).toMatchObject({ highestUnlockedLevel: 2, completedLevels: [1] });
  });

  it("显示失败结果并提供重新挑战与游戏目录操作", () => {
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage: new MemoryStorage(), userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    confirmDogLoadout(root);
    const selectedPatterns: string[] = [];
    for (let selectionNumber = 0; selectionNumber < 20 && root.querySelector('[data-view="game-result"]') === null; selectionNumber += 1) {
      const candidate = [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]:not([disabled])')].find((block) => {
        const patternType = block.dataset.patternType;
        return patternType !== undefined && block.dataset.specialMechanism === undefined && selectedPatterns.filter((selected) => selected === patternType).length < 2;
      });
      expect(candidate).toBeDefined();
      const patternType = candidate?.dataset.patternType;
      if (patternType !== undefined) selectedPatterns.push(patternType);
      candidate?.click();
    }
    expect(root.querySelector('[data-view="game-result"]')).not.toBeNull();
    expect(root.querySelector('[data-result="lost"]')).not.toBeNull();
    expect(root.textContent).toContain("第 1 关");
    const resultActions = root.querySelector<HTMLElement>(".game-result-card__actions--retry");
    const catalogAction = root.querySelector<HTMLElement>('[data-action="catalog"]');
    const retryAction = root.querySelector<HTMLElement>('[data-action="retry"]');
    expect(resultActions).not.toBeNull();
    expect([...resultActions?.children ?? []]).toEqual([catalogAction, retryAction]);
    expect(retryAction?.classList.contains("primary-button--retry")).toBe(true);
    retryAction?.click();
    expect(root.querySelector('[data-testid="dog-board"]')).not.toBeNull();
    app.destroy();
  });

  it("首次通关先记录游戏进度，再显示通关结果并恢复游戏目录进度", () => {
    const storage = new MemoryStorage();
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage, userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    completeFirstLevel(root);
    expect(root.querySelector('[data-view="game-result"]')).not.toBeNull();
    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    for (const text of ["当前关卡", "通关奖励", "累计积分"]) expect(root.textContent).toContain(text);
    expect(root.querySelector(".game-result-card__stats")?.textContent).toContain("100");
    expect(root.textContent).toContain("下一关");
    const savedState = JSON.parse(storage.getItem("gamebox.state") ?? "null");
    expect(savedState.games[GAME_ID]).toMatchObject({ highestUnlockedLevel: 2, totalScore: 100, completedLevels: [1] });
    root.querySelector<HTMLButtonElement>('[data-action="catalog"]')?.click();
    expect(root.querySelector('[data-view="catalog"]')?.textContent).toContain("第 2 关");
    app.destroy();
    const refreshedRoot = document.createElement("div");
    const refreshedApp = mountApp(refreshedRoot, { store: new ProgressStore({ storage }) });
    expect(refreshedRoot.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(refreshedRoot.querySelector('[data-view="catalog"]')?.textContent).toContain("第 2 关");
    expect(refreshedRoot.querySelector('[data-view="catalog"]')?.textContent).not.toContain("累计积分");
    refreshedApp.destroy();
  });

  it("无法持久化时，通关结果显示警告", () => {
    const root = document.createElement("div");
    const app = mountApp(root, { store: new ProgressStore({ storage: new DamagedStorage(), userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000" }) });
    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    completeFirstLevel(root);
    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="persistence-warning"]')?.textContent).toContain("无法持久化");
    expect(root.textContent).toContain("刷新后进度可能丢失");
    app.destroy();
  });
});
