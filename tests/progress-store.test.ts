import { describe, expect, it } from "vitest";
import {
  APP_STATE_VERSION,
  GAME_ID,
  ProgressStore,
  type StorageLike,
} from "../src/progress-store";

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

class UnavailableStorage implements StorageLike {
  getItem(): string {
    throw new Error("storage unavailable");
  }

  setItem(): void {
    throw new Error("storage unavailable");
  }

  removeItem(): void {
    throw new Error("storage unavailable");
  }
}

const userId = "123e4567-e89b-12d3-a456-426614174000";

describe("ProgressStore", () => {
  it("registers an anonymous user with versioned default state", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => userId,
    });

    const state = store.register();
    const savedState = JSON.parse(storage.getItem("gamebox.state") ?? "null");

    expect(state.userId).toBe(userId);
    expect(state.schemaVersion).toBe(APP_STATE_VERSION);
    expect(state.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 1,
      totalScore: 0,
    });
    expect(state.settings.soundEnabled).toBe(true);
    expect(savedState).toEqual(state);
    expect(store.snapshot().persistence).toBe("persistent");
  });

  it("loads a valid user so a returning user can skip registration", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "gamebox.state",
      JSON.stringify({
        schemaVersion: APP_STATE_VERSION,
        userId,
        games: {
          [GAME_ID]: { highestUnlockedLevel: 4, totalScore: 120 },
        },
        settings: { soundEnabled: false },
      }),
    );

    const store = new ProgressStore({ storage });

    expect(store.snapshot().state?.userId).toBe(userId);
    expect(store.snapshot().state?.games[GAME_ID].highestUnlockedLevel).toBe(4);
    expect(store.snapshot().state?.games[GAME_ID].completedLevels).toEqual([1, 2, 3]);
    expect(store.snapshot().state?.settings.soundEnabled).toBe(false);
  });

  it("首次通关幂等、隔离多游戏并恢复游戏进度", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => userId,
    });
    store.register();

    const firstCompletion = store.recordLevelCompletion({
      gameId: GAME_ID,
      levelNumber: 3,
      reward: 120,
    });
    const repeatedCompletion = store.recordLevelCompletion({
      gameId: GAME_ID,
      levelNumber: 3,
      reward: 120,
    });
    const otherGameCompletion = store.recordLevelCompletion({
      gameId: "other-game",
      levelNumber: 2,
      reward: 50,
    });

    expect(firstCompletion).toMatchObject({
      firstCompletion: true,
      reward: 120,
      progress: {
        highestUnlockedLevel: 4,
        totalScore: 120,
        completedLevels: [3],
      },
    });
    expect(repeatedCompletion).toMatchObject({
      firstCompletion: false,
      reward: 0,
      progress: {
        highestUnlockedLevel: 4,
        totalScore: 120,
        completedLevels: [3],
      },
    });
    expect(otherGameCompletion.progress).toMatchObject({
      highestUnlockedLevel: 3,
      totalScore: 50,
      completedLevels: [2],
    });
    expect(store.snapshot().state?.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 4,
      totalScore: 120,
    });

    const restoredStore = new ProgressStore({ storage });

    expect(restoredStore.snapshot().state?.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 4,
      totalScore: 120,
      completedLevels: [3],
    });
    expect(restoredStore.snapshot().state?.games["other-game"]).toMatchObject({
      highestUnlockedLevel: 3,
      totalScore: 50,
      completedLevels: [2],
    });
  });

  it("切换音效设置后持久化，并在新 store 中恢复", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => userId,
    });
    store.register();

    store.setSoundEnabled(false);

    expect(store.snapshot().state?.settings.soundEnabled).toBe(false);
    expect(new ProgressStore({ storage }).snapshot().state?.settings.soundEnabled).toBe(false);
  });

  it("falls back to temporary state when stored data is damaged", () => {
    const storage = new MemoryStorage();
    storage.setItem("gamebox.state", "not-json");
    const store = new ProgressStore({
      storage,
      userIdFactory: () => userId,
    });

    expect(store.snapshot().state).toBeNull();
    expect(store.snapshot().warning).toContain("无法持久化");

    const state = store.register();

    expect(state.userId).toBe(userId);
    expect(store.snapshot().persistence).toBe("temporary");
  });

  it("rejects a versioned state without the first game's progress", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "gamebox.state",
      JSON.stringify({
        schemaVersion: APP_STATE_VERSION,
        userId,
        games: {},
        settings: { soundEnabled: true },
      }),
    );

    const store = new ProgressStore({ storage });

    expect(store.snapshot().state).toBeNull();
    expect(store.snapshot().warning).toContain("无法持久化");
  });

  it("allows registration when browser storage is unavailable", () => {
    const store = new ProgressStore({
      storage: new UnavailableStorage(),
      userIdFactory: () => userId,
    });

    expect(store.snapshot().warning).toContain("无法持久化");
    expect(store.register().userId).toBe(userId);
    expect(store.snapshot().persistence).toBe("temporary");
  });

  it("resets user, progress, score, and settings", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => userId,
    });
    store.register();

    store.reset();

    expect(store.snapshot().state).toBeNull();
    expect(storage.getItem("gamebox.state")).toBeNull();
    expect(store.snapshot().persistence).toBe("persistent");
  });
});
