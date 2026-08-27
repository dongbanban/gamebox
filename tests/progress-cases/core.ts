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

describe("ProgressStore · core", () => {
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

  it("保存并恢复不透明道具组，不写入局内状态", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => userId,
    });
    store.register();

    store.setGameLoadout(GAME_ID, ["triple-removal", "torch", "detector"]);

    expect(store.snapshot().state?.games[GAME_ID].loadout).toEqual([
      "triple-removal",
      "torch",
      "detector",
    ]);
    expect(JSON.parse(storage.getItem("gamebox.state") ?? "null")).toMatchObject({
      games: {
        [GAME_ID]: {
          loadout: ["triple-removal", "torch", "detector"],
        },
      },
    });

    const restoredStore = new ProgressStore({ storage });
    expect(restoredStore.snapshot().state?.games[GAME_ID].loadout).toEqual([
      "triple-removal",
      "torch",
      "detector",
    ]);
  });

  it("持久化道具组只接受三个不同 ID", () => {
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => userId,
    });
    store.register();

    expect(() => store.setGameLoadout(GAME_ID, ["one", "two"])).toThrow(
      "Game loadout requires unique non-empty item ids",
    );
    expect(() => store.setGameLoadout(GAME_ID, ["one", "two", "three", "four"])).toThrow(
      "Game loadout requires unique non-empty item ids",
    );
  });

  it("其他游戏保留不透明道具组，不受狗了个狗三项约束", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => userId,
    });
    store.register();

    store.setGameLoadout("other-game", ["alpha", "beta"]);

    expect(store.snapshot().state?.games["other-game"]?.loadout).toEqual([
      "alpha",
      "beta",
    ]);
    expect(new ProgressStore({ storage }).snapshot().state?.games["other-game"]?.loadout).toEqual([
      "alpha",
      "beta",
    ]);
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
      runSeed: "completion-reward-seed",
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
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

  it("第 99 关通关后保持关卡上限，并可恢复最终完成状态", () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore({
      storage,
      userIdFactory: () => userId,
    });
    store.register();

    for (let levelNumber = 1; levelNumber < MAX_LEVEL_NUMBER; levelNumber += 1) {
      store.recordLevelCompletion({
        gameId: GAME_ID,
        levelNumber,
        reward: 0,
      });
    }

    const finalCompletion = store.recordLevelCompletion({
      gameId: GAME_ID,
      levelNumber: MAX_LEVEL_NUMBER,
      reward: 999,
    });

    expect(finalCompletion.progress).toMatchObject({
      highestUnlockedLevel: MAX_LEVEL_NUMBER,
      totalScore: 999,
      completedLevels: Array.from(
        { length: MAX_LEVEL_NUMBER },
        (_, index) => index + 1,
      ),
    });
    expect(
      store.recordLevelCompletion({
        gameId: GAME_ID,
        levelNumber: MAX_LEVEL_NUMBER,
        reward: 999,
      }).firstCompletion,
    ).toBe(false);
    expect(new ProgressStore({ storage }).snapshot().state?.games[GAME_ID]).toMatchObject(
      finalCompletion.progress,
    );
  });

  it("拒绝超过 99 关的通关记录", () => {
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => userId,
    });
    store.register();

    expect(() =>
      store.recordLevelCompletion({
        gameId: GAME_ID,
        levelNumber: MAX_LEVEL_NUMBER + 1,
        reward: 1,
      }),
    ).toThrow("Level completion requires an integer from 1 to 99");
    expect(store.snapshot().state?.games[GAME_ID]).toMatchObject({
      highestUnlockedLevel: 1,
      completedLevels: [],
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
});
