export const STORAGE_KEY = "gamebox.state";
export const APP_STATE_VERSION = 1 as const;
export const GAME_ID = "dog-lege-dog";

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
      if (!isAppState(parsedState)) {
        this.markTemporary();
        return;
      }

      this.state = parsedState;
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

function isAppState(value: unknown): value is AppState {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.schemaVersion !== APP_STATE_VERSION ||
    typeof value.userId !== "string" ||
    !isValidUserId(value.userId) ||
    !isRecord(value.games) ||
    !isRecord(value.settings) ||
    typeof value.settings.soundEnabled !== "boolean" ||
    !isGameProgress(value.games[GAME_ID])
  ) {
    return false;
  }

  return Object.values(value.games).every(isGameProgress);
}

function isGameProgress(value: unknown): value is GameProgress {
  return (
    isRecord(value) &&
    Number.isInteger(value.highestUnlockedLevel) &&
    value.highestUnlockedLevel >= 1 &&
    Number.isInteger(value.totalScore) &&
    value.totalScore >= 0
  );
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
