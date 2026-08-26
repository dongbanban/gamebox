import {
  GAME_CATALOG,
  type GameDefinition,
  type GameLaunchHandle,
  type GameResult,
} from "@/catalog";
import {
  createInitialGameProgress,
  ProgressStore,
  type LevelCompletionResult,
  type StoreSnapshot,
} from "@/progress-store";
import {
  loadDogV13Config,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/game-config";
import { createRunSeed } from "@/games/dog-lege-dog/levels/level-random";
import { ResultLoadoutController } from "@/app/app-loadout";
import {
  getHistoryRoute,
  replaceHistoryWithCatalog,
  restoreGameHistory,
  setGameHistory,
  type ActiveLevel,
} from "@/app/app-history";
import {
  renderCatalogView,
  renderGameEntryView,
  renderGameResultView,
  renderRegistrationView,
  updateSoundButton,
} from "@/app/app-views";

export interface MountAppOptions {
  store?: ProgressStore;
  catalog?: readonly GameDefinition[];
  runSeedFactory?: () => string;
  config?: unknown;
}

interface ResultViewState {
  readonly result: GameResult;
  readonly completion?: LevelCompletionResult;
}

export class GameboxApp {
  private readonly root: HTMLElement;
  private readonly store: ProgressStore;
  private readonly catalog: readonly GameDefinition[];
  private readonly config: DogV13Config;
  private readonly runSeedFactory: (() => string) | undefined;
  private activeGame: GameLaunchHandle | null = null;
  private activeLevel: ActiveLevel | null = null;
  private nextLevelTarget: ActiveLevel | null = null;
  private pendingCompletion: LevelCompletionResult | null = null;
  private leaveProtectionEnabled = false;
  private activeRunSeed: string | undefined;
  private resultRunSeed: string | undefined;
  private resultState: ResultViewState | null = null;
  private readonly resultLoadout: ResultLoadoutController;

  constructor(root: HTMLElement, options: MountAppOptions = {}) {
    this.root = root;
    this.store = options.store ?? new ProgressStore();
    this.catalog = options.catalog ?? GAME_CATALOG;
    this.config = loadDogV13Config(options.config);
    this.runSeedFactory = options.runSeedFactory;
    this.resultLoadout = new ResultLoadoutController({
      root,
      store: this.store,
      getResult: () => this.resultState?.result ?? null,
      getResultRunSeed: () => this.resultRunSeed,
      config: this.config,
      onApplied: this.handleResultLoadoutApplied,
    });
    replaceHistoryWithCatalog();
    this.root.addEventListener("click", this.handleClick);
    window.addEventListener("popstate", this.handlePopState);
  }

  render(): void {
    this.resultState = null;
    this.resultRunSeed = undefined;
    this.resultLoadout.reset();
    this.disposeActiveGame();
    const snapshot = this.store.snapshot();
    if (snapshot.state === null) {
      this.renderRegistration(snapshot);
      return;
    }

    this.renderCatalog(snapshot);
  }

  destroy(): void {
    this.disposeActiveGame();
    this.root.removeEventListener("click", this.handleClick);
    window.removeEventListener("popstate", this.handlePopState);
  }

  private readonly handleClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-action]");
    const action = actionElement?.dataset.action;
    if (action === "register") {
      this.store.register();
      this.render();
      return;
    }

    if (action === "reset") {
      this.resetWithConfirmation();
      return;
    }

    if (action === "toggle-sound") {
      const state = this.store.snapshot().state;
      if (state === null) {
        return;
      }

      const soundEnabled = !state.settings.soundEnabled;
      this.store.setSoundEnabled(soundEnabled);
      this.activeGame?.setSoundEnabled?.(soundEnabled);
      updateSoundButton(this.root, soundEnabled, this.config);
      return;
    }

    if (action === "edit-loadout") {
      this.resultLoadout.open();
      return;
    }

    if (action === "toggle-loadout") {
      this.resultLoadout.toggle(actionElement?.dataset.loadoutId);
      return;
    }

    if (action === "cancel-loadout") {
      this.resultLoadout.close();
      return;
    }

    if (action === "confirm-loadout") {
      this.resultLoadout.requestConfirmation();
      return;
    }

    if (action === "cancel-loadout-confirmation") {
      this.resultLoadout.cancelConfirmation();
      return;
    }

    if (action === "apply-loadout-change") {
      this.resultLoadout.apply();
      return;
    }

    if (action === "enter-game") {
      this.renderGameEntry(actionElement?.dataset.gameId);
      return;
    }

    if (action === "retry") {
      this.renderGameEntry(
        actionElement?.dataset.gameId,
        parseLevelNumber(actionElement?.dataset.levelNumber),
      );
      return;
    }

    if (action === "next-level") {
      this.renderNextLevel(
        actionElement?.dataset.gameId,
        parseLevelNumber(actionElement?.dataset.levelNumber),
      );
      return;
    }

    if (action === "select-level") {
      this.renderGameEntry(
        actionElement?.dataset.gameId,
        parseLevelNumber(actionElement?.dataset.levelNumber),
      );
      return;
    }

    if (action === "catalog") {
      this.leaveToCatalog();
    }
  };

  private readonly handlePopState = (): void => {
    if (this.activeGame !== null) {
      if (this.confirmLeave()) {
        this.disposeActiveGame();
        replaceHistoryWithCatalog();
        this.render();
      } else {
        restoreGameHistory(this.activeLevel);
      }
      return;
    }

    if (getHistoryRoute() === "catalog") {
      this.render();
    }
  };

  private resetWithConfirmation(): void {
    const confirmed = window.confirm(
      this.config.ui.copy.app.resetConfirmation,
    );
    if (!confirmed) {
      return;
    }

    this.store.reset();
    this.render();
  }

  private renderRegistration(snapshot: StoreSnapshot): void {
    this.root.innerHTML = renderRegistrationView(snapshot, this.config);
  }

  private renderCatalog(snapshot: StoreSnapshot): void {
    this.root.innerHTML = renderCatalogView(this.catalog, snapshot, this.config);
  }

  private renderGameEntry(
    gameId: string | undefined,
    requestedLevelNumber?: number,
    requestedRunSeed?: string,
  ): void {
    const game = this.catalog.find((item) => item.id === gameId);
    const snapshot = this.store.snapshot();
    const state = snapshot.state;
    if (game === undefined || !game.playable || state === null) {
      this.render();
      return;
    }

    const progress = state.games[game.id] ?? createInitialGameProgress();
    const levelNumber = requestedLevelNumber ?? progress.highestUnlockedLevel;
    if (
      levelNumber < 1 ||
      levelNumber > progress.highestUnlockedLevel ||
      levelNumber > this.config.game.maxLevelNumber
    ) {
      return;
    }

    const isSameActiveLevel =
      this.activeGame !== null &&
      this.activeLevel?.gameId === game.id &&
      this.activeLevel?.levelNumber === levelNumber;
    if (isSameActiveLevel) {
      return;
    }

    if (this.activeGame !== null && !this.confirmLeave()) {
      return;
    }

    this.disposeActiveGame();
    this.resultState = null;
    this.resultRunSeed = undefined;
    setGameHistory(game.id, levelNumber);
    this.root.innerHTML = renderGameEntryView(
      game.id,
      levelNumber,
      state.settings.soundEnabled,
      this.config,
    );

    const gameMount = this.root.querySelector<HTMLElement>("[data-game-content]");
    if (gameMount === null) {
      return;
    }

    this.activeLevel = { gameId: game.id, levelNumber };
    this.activeRunSeed = requestedRunSeed ?? this.runSeedFactory?.() ?? createRunSeed();
    try {
      this.activeGame = game.launch(gameMount, {
        onResult: this.handleGameResult,
        onResultConfirmed: this.handleGameResultConfirmed,
        onLoadoutConfirmed: (loadout) => this.handleLoadoutConfirmed(game.id, loadout),
        soundEnabled: state.settings.soundEnabled,
        levelNumber,
        runSeed: this.activeRunSeed,
        loadout: progress.loadout,
        config: this.config,
      });
      this.enableLeaveProtection();
    } catch {
      this.disposeActiveGame();
      replaceHistoryWithCatalog();
      this.render();
    }
  }

  private leaveToCatalog(): void {
    if (this.activeGame !== null && !this.confirmLeave()) {
      return;
    }

    this.disposeActiveGame();
    replaceHistoryWithCatalog();
    this.render();
  }

  private confirmLeave(): boolean {
    if (!this.leaveProtectionEnabled) {
      return true;
    }

    return window.confirm(this.config.ui.copy.app.leaveConfirmation);
  }

  private readonly handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (this.activeGame === null) {
      return;
    }

    event.preventDefault();
  };

  private readonly handleGameResultConfirmed = (result: GameResult): void => {
    this.disableLeaveProtection();
    if (result.status === "won") {
      this.pendingCompletion = this.store.recordLevelCompletion(result);
    }
  };

  private readonly handleLoadoutConfirmed = (
    gameId: string,
    loadout: readonly string[],
  ): void => {
    this.store.setGameLoadout(gameId, loadout);
  };

  private readonly handleGameResult = (result: GameResult): void => {
    this.resultRunSeed = this.activeRunSeed;
    if (result.status === "won") {
      const completion =
        this.pendingCompletion ?? this.store.recordLevelCompletion(result);
      this.pendingCompletion = null;
      this.renderWinResult(result, completion);
      return;
    }

    this.renderLossResult(result);
  };

  private renderWinResult(result: GameResult, completion: LevelCompletionResult): void {
    this.resultState = { result, completion };
    this.renderGameResult(result, "won", completion);
    this.nextLevelTarget = result.isFinal === true
      ? null
      : {
          gameId: result.gameId,
          levelNumber: result.levelNumber + 1,
        };
  }

  private renderLossResult(result: GameResult): void {
    this.resultState = { result };
    this.renderGameResult(result, "lost");
    this.nextLevelTarget = null;
  }

  private renderNextLevel(gameId: string | undefined, levelNumber: number | undefined): void {
    const state = this.store.snapshot().state;
    const game = this.catalog.find((item) => item.id === gameId);
    const progress = gameId === undefined ? undefined : state?.games[gameId];
    const nextLevelTarget = this.nextLevelTarget;
    if (
      game === undefined ||
      !game.playable ||
      levelNumber === undefined ||
      progress === undefined ||
      nextLevelTarget === null ||
      nextLevelTarget.gameId !== gameId ||
      nextLevelTarget.levelNumber !== levelNumber
    ) {
      this.render();
      return;
    }

    if (
      levelNumber > progress.highestUnlockedLevel ||
      levelNumber > this.config.game.maxLevelNumber
    ) {
      this.render();
      return;
    }

    this.renderGameEntry(game.id, levelNumber);
  }

  private renderGameResult(
    result: GameResult,
    status: "won" | "lost",
    completion?: LevelCompletionResult,
  ): void {
    this.disposeActiveGame();
    this.root.innerHTML = renderGameResultView(
      result,
      status,
      this.store.snapshot(),
      completion,
      this.config,
    );
  }

  private disposeActiveGame(): void {
    this.disableLeaveProtection();
    this.activeGame?.destroy();
    this.activeGame = null;
    this.activeLevel = null;
    this.activeRunSeed = undefined;
    this.nextLevelTarget = null;
    this.pendingCompletion = null;
  }

  private readonly handleResultLoadoutApplied = (
    result: GameResult,
    runSeed: string | undefined,
  ): void => {
    const nextLevelNumber = result.status === "won" ? result.levelNumber + 1 : result.levelNumber;
    this.resultState = null;
    this.resultRunSeed = undefined;
    this.renderGameEntry(result.gameId, nextLevelNumber, runSeed);
  };

  private enableLeaveProtection(): void {
    if (this.leaveProtectionEnabled) {
      return;
    }

    window.addEventListener("beforeunload", this.handleBeforeUnload);
    this.leaveProtectionEnabled = true;
  }

  private disableLeaveProtection(): void {
    if (!this.leaveProtectionEnabled) {
      return;
    }

    window.removeEventListener("beforeunload", this.handleBeforeUnload);
    this.leaveProtectionEnabled = false;
  }
}

export function mountApp(root: HTMLElement, options: MountAppOptions = {}): GameboxApp {
  const app = new GameboxApp(root, options);
  app.render();
  return app;
}

function parseLevelNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const levelNumber = Number(value);
  return Number.isSafeInteger(levelNumber) && levelNumber > 0 ? levelNumber : undefined;
}
