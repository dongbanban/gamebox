import { describe, expect, it } from "vitest";
import {
  APP_STATE_VERSION,
  GAME_ID,
  ProgressStore,
  type StorageLike,
} from "../src/progress-store";
import {
  LEVEL_GENERATOR_VERSION,
  LevelGenerator,
} from "../src/games/dog-lege-dog";

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
    expect(store.snapshot().state?.games[GAME_ID].totalScore).toBe(120);
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

    store.recordLevelCompletion({
      gameId: GAME_ID,
      levelNumber: 1,
      reward: 0,
    });
    store.recordLevelCompletion({
      gameId: GAME_ID,
      levelNumber: 2,
      reward: 0,
    });
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
      levelNumber: 1,
      reward: 50,
    });

    expect(firstCompletion).toMatchObject({
      firstCompletion: true,
      reward: 120,
      progress: {
        highestUnlockedLevel: 4,
        totalScore: 120,
        completedLevels: [1, 2, 3],
      },
    });
    expect(repeatedCompletion).toMatchObject({
      firstCompletion: false,
      reward: 0,
      progress: {
        highestUnlockedLevel: 4,
        totalScore: 120,
        completedLevels: [1, 2, 3],
      },
    });
    expect(otherGameCompletion.progress).toMatchObject({
      highestUnlockedLevel: 2,
      totalScore: 50,
      completedLevels: [1],
    });
    expect(store.snapshot().state?.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 4,
      totalScore: 120,
    });

    const restoredStore = new ProgressStore({ storage });

    expect(restoredStore.snapshot().state?.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 4,
      totalScore: 120,
      completedLevels: [1, 2, 3],
    });
    expect(restoredStore.snapshot().state?.games["other-game"]).toMatchObject({
      highestUnlockedLevel: 2,
      totalScore: 50,
      completedLevels: [1],
    });
  });

  it("首次完成公开关卡时记录实际奖励、完成历史与下一关解锁", () => {
    const level = new LevelGenerator().generate({
      levelNumber: 6,
      seed: "completion-reward-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => userId,
    });
    store.register();

    for (const levelNumber of [1, 2, 3, 4, 5]) {
      store.recordLevelCompletion({
        gameId: GAME_ID,
        levelNumber,
        reward: 0,
      });
    }

    const firstCompletion = store.recordLevelCompletion({
      gameId: GAME_ID,
      levelNumber: level.number,
      reward: level.reward,
    });
    const repeatedCompletion = store.recordLevelCompletion({
      gameId: GAME_ID,
      levelNumber: level.number,
      reward: level.reward,
    });

    expect(firstCompletion).toMatchObject({
      firstCompletion: true,
      reward: level.reward,
      progress: {
        highestUnlockedLevel: level.number + 1,
        totalScore: level.reward,
        completedLevels: [1, 2, 3, 4, 5, level.number],
      },
    });
    expect(repeatedCompletion).toMatchObject({
      firstCompletion: false,
      reward: 0,
      progress: {
        highestUnlockedLevel: level.number + 1,
        totalScore: level.reward,
        completedLevels: [1, 2, 3, 4, 5, level.number],
      },
    });
  });

  it("rejects recording a locked level without inferring skipped history", () => {
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => userId,
    });
    store.register();

    expect(() =>
      store.recordLevelCompletion({
        gameId: GAME_ID,
        levelNumber: 3,
        reward: 120,
      }),
    ).toThrow("Cannot record a locked level completion");
    expect(store.snapshot().state?.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 1,
      totalScore: 0,
      completedLevels: [],
    });
  });

  it("rejects a completion that would make cumulative score unsafe", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "gamebox.state",
      createStoredState({
        [GAME_ID]: {
          highestUnlockedLevel: 2,
          totalScore: Number.MAX_SAFE_INTEGER,
          completedLevels: [1],
        },
      }),
    );
    const store = new ProgressStore({ storage });

    expect(() =>
      store.recordLevelCompletion({
        gameId: GAME_ID,
        levelNumber: 2,
        reward: 1,
      }),
    ).toThrow("Cumulative score must be a safe integer");
    expect(store.snapshot().state?.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 2,
      totalScore: Number.MAX_SAFE_INTEGER,
      completedLevels: [1],
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

  it.each([
    ["最高解锁关卡为零", { highestUnlockedLevel: 0, totalScore: 0, completedLevels: [] }],
    ["最高解锁关卡为小数", { highestUnlockedLevel: 1.5, totalScore: 0, completedLevels: [] }],
    ["累计积分为负数", { highestUnlockedLevel: 1, totalScore: -1, completedLevels: [] }],
    ["累计积分为小数", { highestUnlockedLevel: 1, totalScore: 0.5, completedLevels: [] }],
    ["完成关卡包含非正整数", { highestUnlockedLevel: 2, totalScore: 0, completedLevels: [0] }],
    ["完成关卡包含小数", { highestUnlockedLevel: 2, totalScore: 0, completedLevels: [1.5] }],
  ])("rejects progress when %s", (_reason, progress) => {
    const snapshot = loadGameProgress(progress);

    expect(snapshot.state).toBeNull();
    expect(snapshot.persistence).toBe("temporary");
    expect(snapshot.warning).toContain("无法持久化");
  });

  it.each([
    ["重复", [1, 1]],
    ["乱序", [2, 1]],
    ["不连续", [1, 3]],
    ["包含当前最高解锁关卡", [1, 2, 3]],
    ["高于当前最高解锁关卡", [1, 2, 4]],
  ])("rejects %s completion history instead of normalizing it", (_reason, completedLevels) => {
    const snapshot = loadGameProgress({
      highestUnlockedLevel: 3,
      totalScore: 120,
      completedLevels,
    });

    expect(snapshot.state).toBeNull();
    expect(snapshot.persistence).toBe("temporary");
    expect(snapshot.warning).toContain("无法持久化");
  });

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
