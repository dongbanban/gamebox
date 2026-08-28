export interface GameLaunchHandle {
  destroy(): void;
  setSoundEnabled?(soundEnabled: boolean): void;
}

export interface GameLaunchPreparation {
  readonly gameId: string;
  readonly levelNumber: number;
  readonly runSeed: string;
  readonly generatorVersion: number;
  readonly payload: unknown;
}

export interface GamePreparationContext {
  readonly gameId: string;
  readonly levelNumber: number;
  readonly runSeed: string;
  readonly config?: unknown;
  readonly signal: AbortSignal;
}

export type GamePreparationResult =
  | GameLaunchPreparation
  | Promise<GameLaunchPreparation>;

export type GamePreparer = (
  context: GamePreparationContext,
) => GamePreparationResult;

export interface GamePreparationFailureDetails {
  readonly gameId: string;
  readonly levelNumber: number;
  readonly runSeed: string;
  readonly generatorVersion: number;
  readonly workerFailure?: string;
  readonly fallbackFailure?: string;
}

export class GamePreparationError extends Error {
  readonly details: GamePreparationFailureDetails;

  constructor(details: GamePreparationFailureDetails) {
    super("Game preparation failed in worker and synchronous fallback");
    this.name = "GamePreparationError";
    this.details = Object.freeze({ ...details });
  }
}

export type GameResultStatus = "won" | "lost";

export type GameResultAction = "next-level" | "retry" | "catalog";

export interface GameResultDisplay {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}

export interface GameResultDisplayMetadata {
  readonly won: GameResultDisplay;
  readonly final?: GameResultDisplay;
  readonly lost: GameResultDisplay;
}

export interface GameResult {
  readonly gameId: string;
  readonly levelNumber: number;
  readonly status: GameResultStatus;
  readonly reward: number;
  readonly display: GameResultDisplay;
  readonly actions: readonly GameResultAction[];
  readonly isFinal?: boolean;
}

export interface GameLaunchContext {
  readonly onResult?: (result: GameResult) => void;
  readonly onResultConfirmed?: (result: GameResult) => void;
  readonly onLoadoutConfirmed?: (loadout: readonly string[]) => void;
  readonly onSoundToggle?: (soundEnabled: boolean) => void;
  readonly soundEnabled?: boolean;
  readonly levelNumber?: number;
  readonly runSeed?: string;
  readonly loadout?: readonly string[] | null;
  readonly config?: unknown;
  readonly preparation?: GameLaunchPreparation;
}

export type GameLauncher = (
  root: HTMLElement,
  context?: GameLaunchContext,
) => GameLaunchHandle;

export interface GameDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly cover: string;
  readonly playable: boolean;
  readonly prepareLaunch?: GamePreparer;
  readonly launch: GameLauncher;
  readonly resultDisplay: GameResultDisplayMetadata;
}

export type GameCatalogItem = GameDefinition;
