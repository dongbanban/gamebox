/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { mountApp } from "../src/app";
import { FIRST_LEVEL } from "../src/games/dog-lege-dog";
import { ProgressStore, type StorageLike } from "../src/progress-store";

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
  vi.useRealTimers();
});

describe("游戏公开音效行为", () => {
  it("默认开启时进入游戏立即尝试播放背景音乐", () => {
    const previousUserAgent = window.navigator.userAgent;
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0",
    });
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockImplementation(() => Promise.resolve());
    const pauseSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    const root = document.createElement("div");

    try {
      const game = startGame(root);

      expect(playSpy).toHaveBeenCalledTimes(1);

      game.destroy();
    } finally {
      playSpy.mockRestore();
      pauseSpy.mockRestore();
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value: previousUserAgent,
      });
    }

    function startGame(gameRoot: HTMLElement) {
      const app = mountApp(gameRoot, {
        store: new ProgressStore({
          storage: new MemoryStorage(),
          userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
        }),
      });
      gameRoot.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
      gameRoot.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
      return app;
    }
  });

  it("首次交互后可静音，静音切换立即更新且不阻塞方块选择", () => {
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage: new MemoryStorage(),
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
    expect(root.querySelector('[data-testid="dog-game"]')?.getAttribute("data-input-locked")).toBe(
      "false",
    );

    root.querySelector<HTMLButtonElement>('[data-testid="dog-block"]:not([disabled])')?.click();
    expect(root.querySelectorAll('[data-testid="dog-tray-slot"][data-pattern-type]')).toHaveLength(1);

    app.destroy();
  });

  it("关闭音效后，公开反馈状态仍可完成通关流程", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const app = mountApp(root, {
      store: new ProgressStore({
        storage: new MemoryStorage(),
        userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    });

    root.querySelector<HTMLButtonElement>('[data-action="register"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]')?.click();

    for (const blockId of FIRST_LEVEL.solutionPath) {
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="${blockId}"]`,
        )
        ?.click();
      await vi.runAllTimersAsync();
    }

    expect(root.querySelector('[data-result="won"]')).not.toBeNull();
    expect(root.querySelector('[data-action="toggle-sound"]')).toBeNull();
    app.destroy();
  });
});
