import { describe, expect, it } from "vitest";
import {
  APP_STATE_VERSION,
  GAME_ID,
  ProgressStore,
  type StorageLike,
} from "@/progress-store";
import {
  DOG_V13_CONFIG,
  LevelGenerator,
} from "@/games/dog-lege-dog";

const MAX_LEVEL_NUMBER = DOG_V13_CONFIG.game.maxLevelNumber;

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

class WriteFailureStorage implements StorageLike {
  private readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  getItem(): string {
    return this.value;
  }

  setItem(): void {
    throw new Error("storage write failed");
  }

  removeItem(): void {
    throw new Error("storage write failed");
  }
}

const userId = "123e4567-e89b-12d3-a456-426614174000";

function createStoredState(games: Record<string, unknown>): string {
  return JSON.stringify({
    schemaVersion: APP_STATE_VERSION,
    userId,
    games,
    settings: { soundEnabled: true },
  });
}

function loadGameProgress(progress: unknown): ReturnType<ProgressStore["snapshot"]> {
  const storage = new MemoryStorage();
  storage.setItem(
    "gamebox.state",
    createStoredState({ [GAME_ID]: progress }),
  );
  return new ProgressStore({ storage }).snapshot();
}

describe("ProgressStore · recovery", () => {
  it("rejects a progress state with a completion gap", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "gamebox.state",
      createStoredState({
        [GAME_ID]: {
          highestUnlockedLevel: 4,
          totalScore: 120,
          completedLevels: [1, 3],
        },
      }),
    );

    const store = new ProgressStore({ storage });

    expect(store.snapshot().state).toBeNull();
    expect(store.snapshot().persistence).toBe("temporary");
    expect(store.snapshot().warning).toContain("无法持久化");
  });

  it("enters temporary play when legacy history is too large to infer safely", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "gamebox.state",
      createStoredState({
        [GAME_ID]: {
          highestUnlockedLevel: 1_000_002,
          totalScore: 120,
        },
      }),
    );
    const store = new ProgressStore({
      storage,
      userIdFactory: () => userId,
    });

    expect(store.snapshot().state).toBeNull();
    expect(store.snapshot().persistence).toBe("temporary");
    expect(store.snapshot().warning).toContain("无法持久化");

    const state = store.register();
    const completion = store.recordLevelCompletion({
      gameId: GAME_ID,
      levelNumber: 1,
      reward: 10,
    });

    expect(state.games[GAME_ID].completedLevels).toEqual([]);
    expect(completion.progress).toMatchObject({
      highestUnlockedLevel: 2,
      totalScore: 10,
      completedLevels: [1],
    });
    expect(store.snapshot().persistence).toBe("temporary");
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

  it("降级处理已有状态的写入失败，并保留当前内存状态", () => {
    const storage = new WriteFailureStorage(
      JSON.stringify({
        schemaVersion: APP_STATE_VERSION,
        userId,
        games: {
          [GAME_ID]: { highestUnlockedLevel: 2, totalScore: 100, completedLevels: [1] },
        },
        settings: { soundEnabled: true },
      }),
    );
    const store = new ProgressStore({ storage });

    store.setSoundEnabled(false);

    expect(store.snapshot().persistence).toBe("temporary");
    expect(store.snapshot().warning).toContain("无法持久化");
    expect(store.snapshot().state?.settings.soundEnabled).toBe(false);
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

  it("resets corrupted progress and permits persistent registration again", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "gamebox.state",
      createStoredState({
        [GAME_ID]: {
          highestUnlockedLevel: 3,
          totalScore: 120,
          completedLevels: [1, 3],
        },
      }),
    );
    const store = new ProgressStore({
      storage,
      userIdFactory: () => userId,
    });

    expect(store.snapshot().state).toBeNull();
    expect(store.snapshot().persistence).toBe("temporary");

    store.reset();
    expect(storage.getItem("gamebox.state")).toBeNull();
    expect(store.snapshot()).toMatchObject({
      state: null,
      persistence: "persistent",
      warning: null,
    });

    const registeredState = store.register();
    expect(store.snapshot()).toMatchObject({
      state: registeredState,
      persistence: "persistent",
      warning: null,
    });
    expect(new ProgressStore({ storage }).snapshot().state).toEqual(registeredState);
  });
});
