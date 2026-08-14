/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { mountApp } from "../src/app";
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
});
