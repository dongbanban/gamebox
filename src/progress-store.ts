import { DOG_GAME_ID } from "./games/dog-lege-dog/game-config";

export const STORAGE_KEY = "gamebox.state";
export const APP_STATE_VERSION = 1 as const;
export const GAME_ID = DOG_GAME_ID;

const PERSISTENCE_WARNING = "本地数据无法持久化，当前为临时运行模式。";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface GameProgress {
  highestUnlockedLevel: number;
  totalScore: number;
  completedLevels: readonly number[];
}

export interface AppState {
  schemaVersion: typeof APP_STATE_VERSION;
  userId: string;
  games: Record<string, GameProgress>;
  settings: {
    soundEnabled: boolean;
  };
}

export type PersistenceMode = "persistent" | "temporary";

export interface StoreSnapshot {
  state: AppState | null;
  persistence: PersistenceMode;
  warning: string | null;
}

export interface LevelCompletionResult {
  readonly gameId: string;
  readonly levelNumber: number;
  readonly firstCompletion: boolean;
  readonly reward: number;
  readonly progress: GameProgress;
}

export interface LevelCompletion {
  readonly gameId: string;
  readonly levelNumber: number;
  readonly reward: number;
}

export interface ProgressStoreOptions {
  storage?: StorageLike;
  userIdFactory?: () => string;
}

export class ProgressStore {
  private readonly storage: StorageLike | null;
  private readonly userIdFactory: () => string;
  private state: AppState | null = null;
  private persistence: PersistenceMode = "persistent";
  private warning: string | null = null;

  constructor(options: ProgressStoreOptions = {}) {
    this.storage = options.storage ?? getBrowserStorage();
    this.userIdFactory = options.userIdFactory ?? createUserId;
    this.load();
  }

  snapshot(): StoreSnapshot {
    return {
      state: cloneState(this.state),
      persistence: this.persistence,
      warning: this.warning,
    };
  }

  register(): AppState {
    const generatedUserId = this.userIdFactory();
    const userId = isValidUserId(generatedUserId)
      ? generatedUserId
      : createUserId();
    const nextState = createInitialState(userId);
    this.state = nextState;
    this.persist();
    return cloneState(nextState) as AppState;
  }

  recordLevelCompletion(completion: LevelCompletion): LevelCompletionResult {
    if (this.state === null) {
      throw new Error("Cannot record level completion before registration");
    }

    assertCompletionInput(completion);

    const currentProgress =
      this.state.games[completion.gameId] ?? createInitialGameProgress();
    const firstCompletion = !currentProgress.completedLevels.includes(
      completion.levelNumber,
    );
    const nextProgress: GameProgress = {
      highestUnlockedLevel: Math.max(
        currentProgress.highestUnlockedLevel,
        completion.levelNumber + 1,
      ),
      totalScore:
        currentProgress.totalScore + (firstCompletion ? completion.reward : 0),
      completedLevels: firstCompletion
        ? [...currentProgress.completedLevels, completion.levelNumber].sort(
            (left, right) => left - right,
          )
        : [...currentProgress.completedLevels],
    };

    this.state = {
      ...this.state,
      games: {
        ...this.state.games,
        [completion.gameId]: nextProgress,
      },
    };
    this.persist();

    return {
      gameId: completion.gameId,
      levelNumber: completion.levelNumber,
      firstCompletion,
      reward: firstCompletion ? completion.reward : 0,
      progress: cloneGameProgress(nextProgress),
    };
  }

  setSoundEnabled(soundEnabled: boolean): void {
    if (this.state === null || this.state.settings.soundEnabled === soundEnabled) {
      return;
    }

    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        soundEnabled,
      },
    };
    this.persist();
  }

  reset(): void {
    this.state = null;

    if (!this.storage) {
      this.markTemporary();
      return;
    }

    try {
      this.storage.removeItem(STORAGE_KEY);
      this.persistence = "persistent";
      this.warning = null;
    } catch {
      this.markTemporary();
    }
  }

  private load(): void {
    if (!this.storage) {
      this.markTemporary();
      return;
    }

    try {
      const rawState = this.storage.getItem(STORAGE_KEY);
      if (rawState === null) {
        return;
      }

      const parsedState: unknown = JSON.parse(rawState);
      const normalizedState = normalizeAppState(parsedState);
      if (normalizedState === null) {
        this.markTemporary();
        return;
      }

      this.state = normalizedState;
    } catch {
      this.markTemporary();
    }
  }

  private persist(): void {
    if (this.persistence === "temporary" || !this.storage || !this.state) {
      if (!this.storage) {
        this.markTemporary();
      }
      return;
    }

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      this.markTemporary();
    }
  }

  private markTemporary(): void {
    this.persistence = "temporary";
    this.warning = PERSISTENCE_WARNING;
  }
}

export function createInitialState(userId: string): AppState {
  return {
    schemaVersion: APP_STATE_VERSION,
    userId,
    games: {
      [GAME_ID]: createInitialGameProgress(),
    },
    settings: {
      soundEnabled: true,
    },
  };
}

export function createInitialGameProgress(): GameProgress {
  return {
    highestUnlockedLevel: 1,
    totalScore: 0,
    completedLevels: [],
  };
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createUserId(): string {
  const browserCrypto = globalThis.crypto;
  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  if (typeof browserCrypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    browserCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return formatUuid(bytes);
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function normalizeAppState(value: unknown): AppState | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.schemaVersion !== APP_STATE_VERSION ||
    typeof value.userId !== "string" ||
    !isValidUserId(value.userId) ||
    !isRecord(value.games) ||
    !isRecord(value.settings) ||
    typeof value.settings.soundEnabled !== "boolean"
  ) {
    return null;
  }

  const games: Record<string, GameProgress> = {};
  for (const [gameId, rawProgress] of Object.entries(value.games)) {
    const progress = normalizeGameProgress(rawProgress);
    if (progress === null) {
      return null;
    }

    games[gameId] = progress;
  }

  if (games[GAME_ID] === undefined) {
    return null;
  }

  return {
    schemaVersion: APP_STATE_VERSION,
    userId: value.userId,
    games,
    settings: {
      soundEnabled: value.settings.soundEnabled,
    },
  };
}

function normalizeGameProgress(value: unknown): GameProgress | null {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.highestUnlockedLevel) ||
    value.highestUnlockedLevel < 1 ||
    !Number.isInteger(value.totalScore) ||
    value.totalScore < 0
  ) {
    return null;
  }

  const completedLevels =
    value.completedLevels === undefined
      ? inferCompletedLevels(value.highestUnlockedLevel)
      : value.completedLevels;
  if (
    !Array.isArray(completedLevels) ||
    !completedLevels.every(
      (levelNumber) => Number.isInteger(levelNumber) && levelNumber >= 1,
    )
  ) {
    return null;
  }

  return {
    highestUnlockedLevel: value.highestUnlockedLevel,
    totalScore: value.totalScore,
    completedLevels: [...new Set(completedLevels)].sort(
      (left, right) => left - right,
    ),
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidUserId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function cloneState(state: AppState | null): AppState | null {
  return state === null ? null : structuredClone(state);
}

function cloneGameProgress(progress: GameProgress): GameProgress {
  return {
    ...progress,
    completedLevels: [...progress.completedLevels],
  };
}

function inferCompletedLevels(highestUnlockedLevel: number): number[] {
  return Array.from(
    { length: Math.max(0, highestUnlockedLevel - 1) },
    (_, index) => index + 1,
  );
}

function assertCompletionInput(completion: LevelCompletion): void {
  if (completion.gameId.trim() === "") {
    throw new Error("Cannot record level completion without a game id");
  }

  if (!Number.isSafeInteger(completion.levelNumber) || completion.levelNumber < 1) {
    throw new Error("Level completion requires a positive integer level number");
  }

  if (!Number.isSafeInteger(completion.reward) || completion.reward < 0) {
    throw new Error("Level completion requires a non-negative integer reward");
  }
}
