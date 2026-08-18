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
