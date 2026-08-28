import {
  type GameDefinition,
  type GameLaunchContext,
  type GameLaunchHandle,
  type GameLaunchPreparation,
  GamePreparationError,
  type GamePreparationFailureDetails,
  type GamePreparationResult,
} from "@/game-contracts";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";

interface ActiveLaunch {
  readonly gameId: string;
  readonly levelNumber: number;
  readonly runSeed: string;
  readonly abortController: AbortController;
  handle: GameLaunchHandle | null;
}

interface PendingPreparation {
  readonly gameId: string;
  readonly levelNumber: number;
  readonly runSeed: string;
  readonly preparation: GamePreparationResult;
  readonly abortController: AbortController;
}

export interface AppGameLaunchRequest {
  readonly game: GameDefinition;
  readonly mount: HTMLElement;
  readonly levelNumber: number;
  readonly requestedRunSeed?: string;
  readonly getSoundEnabled: () => boolean;
  readonly loadout: readonly string[] | null;
  readonly config: DogV13Config;
  readonly createRunSeed: () => string;
  readonly launchContext: Pick<
    GameLaunchContext,
    "onResult" | "onResultConfirmed" | "onLoadoutConfirmed" | "onSoundToggle"
  >;
  readonly onStarting: (runSeed: string) => void;
  readonly onLaunched: () => void;
  readonly onFailure: (details: GamePreparationFailureDetails) => void;
  readonly onLaunchFailure: () => void;
}

export interface AppGamePrefetchRequest {
  readonly game: GameDefinition;
  readonly levelNumber: number;
  readonly config: DogV13Config;
  readonly createRunSeed: () => string;
}

export class AppGameLaunchCoordinator {
  private active: ActiveLaunch | null = null;
  private prefetched: PendingPreparation | null = null;

  start(request: AppGameLaunchRequest): void {
    this.cancelActive();
    const prefetched = this.takePrefetched(
      request.game.id,
      request.levelNumber,
      request.requestedRunSeed,
    );
    const runSeed = prefetched?.runSeed ??
      request.requestedRunSeed ??
      request.createRunSeed();
    const active: ActiveLaunch = {
      gameId: request.game.id,
      levelNumber: request.levelNumber,
      runSeed,
      abortController: prefetched?.abortController ?? new AbortController(),
      handle: null,
    };
    this.active = active;
    request.onStarting(runSeed);

    let preparation: GamePreparationResult | undefined;
    try {
      preparation = prefetched?.preparation ?? request.game.prepareLaunch?.({
        gameId: request.game.id,
        levelNumber: request.levelNumber,
        runSeed,
        config: request.config,
        signal: active.abortController.signal,
      });
    } catch (error) {
      this.fail(active, request, error);
      return;
    }

    if (isPromiseLike(preparation)) {
      void preparation.then(
        (prepared) => this.launch(active, request, prepared),
        (error: unknown) => this.fail(active, request, error),
      );
      return;
    }
    this.launch(active, request, preparation);
  }

  prefetch(request: AppGamePrefetchRequest): void {
    this.discardPrefetched();
    if (request.game.prepareLaunch === undefined) return;
    const runSeed = request.createRunSeed();
    const abortController = new AbortController();
    let preparation: GamePreparationResult;
    try {
      preparation = request.game.prepareLaunch({
        gameId: request.game.id,
        levelNumber: request.levelNumber,
        runSeed,
        config: request.config,
        signal: abortController.signal,
      });
    } catch {
      abortController.abort();
      return;
    }
    const pending: PendingPreparation = {
      gameId: request.game.id,
      levelNumber: request.levelNumber,
      runSeed,
      preparation,
      abortController,
    };
    this.prefetched = pending;
    if (isPromiseLike(preparation)) {
      void preparation.catch(() => {
        if (this.prefetched === pending) this.discardPrefetched();
      });
    }
  }

  isActiveGame(gameId: string, levelNumber: number): boolean {
    return this.active !== null &&
      this.active.handle !== null &&
      this.active.gameId === gameId &&
      this.active.levelNumber === levelNumber;
  }

  hasActiveGame(): boolean {
    return this.active !== null && this.active.handle !== null;
  }

  setSoundEnabled(soundEnabled: boolean): void {
    this.active?.handle?.setSoundEnabled?.(soundEnabled);
  }

  cancelActive(): void {
    const active = this.active;
    this.active = null;
    active?.abortController.abort();
    active?.handle?.destroy();
  }

  discardPrefetched(): void {
    this.prefetched?.abortController.abort();
    this.prefetched = null;
  }

  private launch(
    active: ActiveLaunch,
    request: AppGameLaunchRequest,
    preparation: GameLaunchPreparation | undefined,
  ): void {
    if (this.active !== active) return;
    try {
      const handle = request.game.launch(request.mount, {
        ...request.launchContext,
        soundEnabled: request.getSoundEnabled(),
        levelNumber: request.levelNumber,
        runSeed: active.runSeed,
        loadout: request.loadout,
        config: request.config,
        preparation,
      });
      if (this.active !== active) {
        handle.destroy();
        return;
      }
      active.handle = handle;
      request.onLaunched();
    } catch {
      if (this.active === active) request.onLaunchFailure();
    }
  }

  private fail(
    active: ActiveLaunch,
    request: AppGameLaunchRequest,
    error: unknown,
  ): void {
    if (this.active !== active || isAbortError(error)) return;
    request.onFailure(getPreparationFailureDetails(
      error,
      request.game.id,
      request.levelNumber,
      active.runSeed,
      request.config.game.generatorVersion,
    ));
  }

  private takePrefetched(
    gameId: string,
    levelNumber: number,
    requestedRunSeed: string | undefined,
  ): PendingPreparation | null {
    const pending = this.prefetched;
    if (
      pending !== null &&
      pending.gameId === gameId &&
      pending.levelNumber === levelNumber &&
      (requestedRunSeed === undefined || requestedRunSeed === pending.runSeed)
    ) {
      this.prefetched = null;
      return pending;
    }
    this.discardPrefetched();
    return null;
  }
}

function isPromiseLike(
  preparation: GamePreparationResult | undefined,
): preparation is Promise<GameLaunchPreparation> {
  return preparation !== undefined && "then" in preparation;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getPreparationFailureDetails(
  error: unknown,
  gameId: string,
  levelNumber: number,
  runSeed: string,
  generatorVersion: number,
): GamePreparationFailureDetails {
  if (error instanceof GamePreparationError) return error.details;
  return {
    gameId,
    levelNumber,
    runSeed,
    generatorVersion,
    fallbackFailure: error instanceof Error ? error.message : String(error),
  };
}
