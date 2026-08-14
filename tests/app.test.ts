/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { mountApp } from "../src/app";
import { FIRST_LEVEL } from "../src/games/dog-lege-dog";
import { ProgressStore, type StorageLike } from "../src/progress-store";

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

describe("注册与游戏目录 UI", () => {
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
    expect(root.textContent).toContain("狗了个狗");

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

    root.querySelector<HTMLButtonElement>('[data-action="catalog"]')?.click();

    expect(root.querySelector('[data-view="catalog"]')).not.toBeNull();
    expect(root.querySelector('[data-view="game-entry"]')).toBeNull();

    app.destroy();
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

    for (const blockNumber of [73, 76, 79, 82, 74, 77, 80]) {
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="first-level-block-${blockNumber}"]`,
        )
        ?.click();
    }

    expect(root.querySelector('[data-view="game-result"]')).not.toBeNull();
    expect(root.querySelector('[data-result="lost"]')).not.toBeNull();
    expect(root.textContent).toContain("第 1 关");
    expect(root.querySelector('[data-action="retry"]')).not.toBeNull();
    expect(root.querySelector('[data-action="catalog"]')).not.toBeNull();

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

    for (const block of [...FIRST_LEVEL.blocks].reverse()) {
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="${block.id}"]`,
        )
        ?.click();
    }

    expect(root.querySelector('[data-view="game-result"]')).not.toBeNull();
    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    expect(root.textContent).toContain("当前关卡");
    expect(root.textContent).toContain("通关奖励");
    expect(root.textContent).toContain("累计积分");
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
    expect(refreshedRoot.querySelector('[data-view="catalog"]')?.textContent).toContain(
      "100",
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

    for (const block of [...FIRST_LEVEL.blocks].reverse()) {
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="${block.id}"]`,
        )
        ?.click();
    }

    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="persistence-warning"]')?.textContent).toContain(
      "无法持久化",
    );
    expect(root.textContent).toContain("刷新后进度可能丢失");

    app.destroy();
  });
});
