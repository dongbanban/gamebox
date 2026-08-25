import {
  GAME_CATALOG,
  type GameDefinition,
  type GameLaunchHandle,
  type GameResult,
  type GameResultAction,
} from "@/catalog";
import {
  createInitialGameProgress,
  ProgressStore,
  type LevelCompletionResult,
  type StoreSnapshot,
} from "@/progress-store";
import { renderDogPatternAsset } from "@/games/dog-lege-dog/assets/game-assets";
import { DOG_GAME_ID } from "@/games/dog-lege-dog/game/game-config";
import { createRunSeed } from "@/games/dog-lege-dog/levels/level-random";
import {
  areDogLoadoutsEqual,
  DOG_ITEM_DEFINITIONS,
  isDogItemId,
  isValidDogLoadout,
  renderDogLoadoutEditor,
  type DogItemId,
} from "@/games/dog-lege-dog/game/dog-loadout";
import { getDogItemUses } from "@/games/dog-lege-dog/game/dog-item-runtime";
import { getDogSpecialMechanismConfigs } from "@/games/dog-lege-dog/game/special-mechanisms";

export interface MountAppOptions {
  store?: ProgressStore;
  catalog?: readonly GameDefinition[];
  runSeedFactory?: () => string;
}

interface ActiveLevel {
  readonly gameId: string;
  readonly levelNumber: number;
}

interface ResultViewState {
  readonly result: GameResult;
  readonly completion?: LevelCompletionResult;
}

export class GameboxApp {
  private readonly root: HTMLElement;
  private readonly store: ProgressStore;
  private readonly catalog: readonly GameDefinition[];
  private readonly runSeedFactory: (() => string) | undefined;
  private activeGame: GameLaunchHandle | null = null;
  private activeLevel: ActiveLevel | null = null;
  private nextLevelTarget: ActiveLevel | null = null;
  private pendingCompletion: LevelCompletionResult | null = null;
  private leaveProtectionEnabled = false;
  private activeRunSeed: string | undefined;
  private resultRunSeed: string | undefined;
  private resultState: ResultViewState | null = null;
  private resultLoadoutDraft: readonly DogItemId[] = [];
  private resultLoadoutConfirming = false;

  constructor(root: HTMLElement, options: MountAppOptions = {}) {
    this.root = root;
    this.store = options.store ?? new ProgressStore();
    this.catalog = options.catalog ?? GAME_CATALOG;
    this.runSeedFactory = options.runSeedFactory;
    replaceHistoryWithCatalog();
    this.root.addEventListener("click", this.handleClick);
    window.addEventListener("popstate", this.handlePopState);
  }

  render(): void {
    this.resultState = null;
    this.resultRunSeed = undefined;
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
      updateSoundButton(this.root, soundEnabled);
      return;
    }

    if (action === "edit-loadout") {
      this.openResultLoadoutEditor();
      return;
    }

    if (action === "toggle-loadout") {
      this.toggleResultLoadout(actionElement?.dataset.loadoutId);
      return;
    }

    if (action === "cancel-loadout") {
      this.closeResultLoadoutEditor();
      return;
    }

    if (action === "confirm-loadout") {
      this.requestResultLoadoutConfirmation();
      return;
    }

    if (action === "cancel-loadout-confirmation") {
      this.resultLoadoutConfirming = false;
      this.renderResultLoadoutEditor();
      return;
    }

    if (action === "apply-loadout-change") {
      this.applyResultLoadoutChange();
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
      "确认重置本地数据？用户、游戏进度、积分与应用设置都会被清除。",
    );
    if (!confirmed) {
      return;
    }

    this.store.reset();
    this.render();
  }

  private renderRegistration(snapshot: StoreSnapshot): void {
    this.root.innerHTML = `
      <main class="register-view" data-view="register">
        <div class="register-view__glow" aria-hidden="true"></div>
        <section class="register-panel" aria-labelledby="register-title">
          <div class="brand-lockup">
            ${renderDogBrandMark()}
            <span class="brand-lockup__name">GAMEBOX</span>
          </div>
          <h1 id="register-title">开始你的第一局</h1>
          <p class="register-panel__intro">
            一次点击创建本地匿名身份，游戏进度只保存在当前浏览器。
          </p>
          <button class="primary-button primary-button--wide" type="button" data-action="register">
            匿名注册
          </button>
          ${renderPersistenceNotice(snapshot.warning)}
          <p class="register-panel__fine-print">不需要姓名、密码或邮箱。</p>
        </section>
      </main>
    `;
  }

  private renderCatalog(snapshot: StoreSnapshot): void {
    const state = snapshot.state;
    if (state === null) {
      this.renderRegistration(snapshot);
      return;
    }

    const cards = this.catalog.map((game) => {
      const progress = state.games[game.id] ?? createInitialGameProgress();
      return `
        <article class="catalog-item" data-game-id="${game.id}">
          <div class="catalog-item__cover-wrap">
            <img class="catalog-item__cover" src="${game.cover}" crossorigin="anonymous" alt="${game.name}封面" />
          </div>
          <div class="catalog-item__content">
            <div class="catalog-item__heading">
              <h2>${game.name}</h2>
            </div>
            <p class="catalog-item__description">${game.description}</p>
            <div class="catalog-item__actions">
              <dl class="catalog-item__level">
                <dt>最高解锁关卡</dt>
                <dd>第 ${progress.highestUnlockedLevel} 关</dd>
              </dl>
              <button class="primary-button" type="button" data-action="enter-game" data-game-id="${game.id}" ${game.playable ? "" : "disabled"}>
                开始游戏
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    this.root.innerHTML = `
      <main class="catalog-view" data-view="catalog">
        <header class="catalog-header">
          <div>
            <div class="brand-lockup brand-lockup--compact">
              ${renderDogBrandMark()}
              <span class="brand-lockup__name">GAMEBOX</span>
            </div>
            <h1>游戏目录</h1>
          </div>
          <button class="text-button" type="button" data-action="reset">重置本地数据</button>
        </header>
        ${renderPersistenceNotice(snapshot.warning)}
        <section class="game-directory" aria-label="游戏目录">
          ${cards}
        </section>
      </main>
    `;
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
    if (levelNumber < 1 || levelNumber > progress.highestUnlockedLevel) {
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
    this.root.innerHTML = `
      <main class="game-entry-view" data-view="game-entry" data-game-id="${game.id}" data-level-number="${levelNumber}">
        <h1 class="sr-only">活动游戏</h1>
        <header class="game-entry-view__header">
          <div class="game-entry-view__brand">
            ${renderCatalogIconButton("icon-button game-entry-view__catalog-button")}
            <div class="brand-lockup brand-lockup--compact">
              ${renderDogBrandMark()}
              <span class="brand-lockup__name">GAMEBOX</span>
            </div>
          </div>
          ${renderSoundButton(state.settings.soundEnabled)}
        </header>
        <div class="game-entry-view__game">
          <div data-game-content></div>
        </div>
      </main>
    `;

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

    return window.confirm("当前关卡不会保存，确认离开？");
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
    const snapshot = this.store.snapshot();
    const persistenceMessage =
      snapshot.persistence === "persistent"
        ? "进度已保存。"
        : "当前为临时运行模式，刷新后进度可能丢失。";
    this.renderGameResult(result, "won", `
          <p class="eyebrow">${result.display.eyebrow}</p>
          <h1 id="game-result-title">${result.display.title}</h1>
          <p class="game-result-card__intro">第 ${result.levelNumber} 关${result.display.description}${persistenceMessage}</p>
          ${renderPersistenceNotice(snapshot.warning)}
          <dl class="game-result-card__stats">
            <div><dt>当前关卡</dt><dd>第 ${result.levelNumber} 关</dd></div>
            <div><dt>通关奖励</dt><dd>${completion.reward}</dd></div>
            <div><dt>累计积分</dt><dd>${completion.progress.totalScore}</dd></div>
            <div><dt>下一关</dt><dd>第 ${result.levelNumber + 1} 关</dd></div>
          </dl>
          ${renderLoadoutChangeAction(result)}
          ${renderResultActions(result)}
    `);
    this.nextLevelTarget = {
      gameId: result.gameId,
      levelNumber: result.levelNumber + 1,
    };
  }

  private renderLossResult(result: GameResult): void {
    this.resultState = { result };
    this.renderGameResult(result, "lost", `
          <p class="eyebrow">${result.display.eyebrow}</p>
          <h1 id="game-result-title">${result.display.title}</h1>
          <p class="game-result-card__intro">第 ${result.levelNumber} 关${result.display.description}</p>
          ${renderPersistenceNotice(this.store.snapshot().warning)}
          ${renderLoadoutChangeAction(result)}
          ${renderResultActions(result)}
    `);
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

    if (levelNumber > progress.highestUnlockedLevel) {
      this.render();
      return;
    }

    this.renderGameEntry(game.id, levelNumber);
  }

  private renderGameResult(
    result: GameResult,
    status: "won" | "lost",
    content: string,
  ): void {
    this.disposeActiveGame();
    this.root.innerHTML = `
      <main class="game-result-view" data-view="game-result" data-result="${status}" data-game-id="${result.gameId}">
        <section class="game-result-card game-result-card--${status}" aria-labelledby="game-result-title">
          ${content}
        </section>
      </main>
    `;
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

  private openResultLoadoutEditor(): void {
    const resultState = this.resultState;
    const loadout = resultState?.result.gameId === DOG_GAME_ID
      ? this.store.snapshot().state?.games[DOG_GAME_ID]?.loadout
      : null;
    if (
      resultState === null ||
      resultState === undefined ||
      resultState.result.gameId !== DOG_GAME_ID ||
      !isValidDogLoadout(loadout)
    ) {
      return;
    }

    this.resultLoadoutDraft = [...loadout];
    this.resultLoadoutConfirming = false;
    this.renderResultLoadoutEditor();
  }

  private toggleResultLoadout(itemId: string | undefined): void {
    if (!this.resultState || itemId === undefined || !isDogItemId(itemId)) {
      return;
    }

    const draft = this.resultLoadoutDraft;
    this.resultLoadoutDraft = draft.includes(itemId)
      ? draft.filter((selectedItemId) => selectedItemId !== itemId)
      : draft.length < 3
        ? [...draft, itemId]
        : draft;
    this.resultLoadoutConfirming = false;
    this.renderResultLoadoutEditor();
  }

  private closeResultLoadoutEditor(): void {
    this.root.querySelector('[data-testid="dog-result-loadout-editor"]')?.remove();
    this.resultLoadoutDraft = [];
    this.resultLoadoutConfirming = false;
  }

  private requestResultLoadoutConfirmation(): void {
    const current = this.store.snapshot().state?.games[DOG_GAME_ID]?.loadout;
    if (
      !this.resultState ||
      !isValidDogLoadout(current) ||
      !isValidDogLoadout(this.resultLoadoutDraft)
    ) {
      return;
    }

    if (areDogLoadoutsEqual(current, this.resultLoadoutDraft)) {
      this.closeResultLoadoutEditor();
      return;
    }

    this.resultLoadoutConfirming = true;
    this.renderResultLoadoutEditor();
  }

  private applyResultLoadoutChange(): void {
    const resultState = this.resultState;
    const current = this.store.snapshot().state?.games[DOG_GAME_ID]?.loadout;
    if (
      resultState === null ||
      resultState === undefined ||
      resultState.result.gameId !== DOG_GAME_ID ||
      !this.resultLoadoutConfirming ||
      !isValidDogLoadout(current) ||
      !isValidDogLoadout(this.resultLoadoutDraft) ||
      areDogLoadoutsEqual(current, this.resultLoadoutDraft)
    ) {
      return;
    }

    this.store.setGameLoadout(DOG_GAME_ID, this.resultLoadoutDraft);
    const result = resultState.result;
    const nextLevelNumber = result.status === "won" ? result.levelNumber + 1 : result.levelNumber;
    const runSeed = result.status === "lost" ? this.resultRunSeed : undefined;
    this.resultState = null;
    this.resultRunSeed = undefined;
    this.resultLoadoutDraft = [];
    this.resultLoadoutConfirming = false;
    this.renderGameEntry(result.gameId, nextLevelNumber, runSeed);
  }

  private renderResultLoadoutEditor(): void {
    const resultState = this.resultState;
    if (resultState === null || resultState.result.gameId !== DOG_GAME_ID) {
      return;
    }

    let editorRoot = this.root.querySelector<HTMLElement>(
      '[data-testid="dog-result-loadout-editor"]',
    );
    if (editorRoot === null) {
      const resultCard = this.root.querySelector<HTMLElement>(".game-result-card");
      if (resultCard === null) {
        return;
      }

      resultCard.insertAdjacentHTML(
        "beforeend",
        '<div data-testid="dog-result-loadout-editor"></div>',
      );
      editorRoot = resultCard.querySelector<HTMLElement>(
        '[data-testid="dog-result-loadout-editor"]',
      );
    }
    if (editorRoot === null) {
      return;
    }

    const current = this.store.snapshot().state?.games[DOG_GAME_ID]?.loadout;
    if (!isValidDogLoadout(current)) {
      return;
    }

    const levelNumber = resultState.result.status === "won"
      ? resultState.result.levelNumber + 1
      : resultState.result.levelNumber;
    editorRoot.innerHTML = renderDogLoadoutEditor({
      mode: "change",
      draft: this.resultLoadoutDraft,
      current,
      levelNumber,
      confirming: this.resultLoadoutConfirming,
      changeTarget: resultState.result.status === "won" ? "next" : "current",
      itemUses: Object.fromEntries(
        DOG_ITEM_DEFINITIONS.map((item) => [
          item.id,
          getDogItemUses(
            {
              number: levelNumber,
              specialMechanisms: getDogSpecialMechanismConfigs(levelNumber),
            },
            item.id,
          ),
        ]),
      ),
    });
  }

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

function renderPersistenceNotice(warning: string | null): string {
  if (warning === null) {
    return "";
  }

  return `
    <p class="persistence-notice" data-testid="persistence-warning" role="status">
      <span aria-hidden="true">!</span>
      ${warning}
    </p>
  `;
}

function renderDogBrandMark(): string {
  return `<span class="brand-lockup__mark brand-lockup__mark--dog" aria-hidden="true">${renderDogPatternAsset("傻狗")}</span>`;
}

function renderCatalogIconButton(className = "icon-button"): string {
  return `
    <button
      class="${className}"
      type="button"
      data-action="catalog"
      aria-label="返回游戏目录"
      title="返回游戏目录"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
      </svg>
    </button>
  `;
}

function renderSoundButton(soundEnabled: boolean): string {
  return `
    <button
      class="sound-button"
      type="button"
      data-action="toggle-sound"
      data-sound-enabled="${soundEnabled}"
      aria-label="${soundEnabled ? "音效开启" : "音效关闭"}"
      aria-pressed="${soundEnabled}"
    >
      ${renderSoundButtonContent(soundEnabled)}
    </button>
  `;
}

function renderSoundButtonContent(soundEnabled: boolean): string {
  return `
    <span class="sound-button__icon" aria-hidden="true">${soundEnabled ? "♫" : "♩̸"}</span>
  `;
}

function updateSoundButton(root: HTMLElement, soundEnabled: boolean): void {
  const button = root.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]');
  if (button === null) {
    return;
  }

  button.dataset.soundEnabled = String(soundEnabled);
  button.setAttribute("aria-label", soundEnabled ? "音效开启" : "音效关闭");
  button.setAttribute("aria-pressed", String(soundEnabled));
  button.innerHTML = renderSoundButtonContent(soundEnabled);
}

function renderResultActions(result: GameResult): string {
  const isRetryResult = result.actions.includes("retry");
  const hasCatalogAction = result.actions.includes("catalog");
  const orderedActions: readonly GameResultAction[] = hasCatalogAction
    ? ["catalog", ...result.actions.filter((action) => action !== "catalog")]
    : result.actions;
  const actions = orderedActions.map((action) => renderResultAction(action, result)).filter(Boolean);
  const splitClassName =
    hasCatalogAction && orderedActions.length === 2
      ? " game-result-card__actions--split"
      : "";
  const retryClassName = isRetryResult ? " game-result-card__actions--retry" : "";
  return `<div class="game-result-card__actions${splitClassName}${retryClassName}">${actions.join("")}</div>`;
}

function renderLoadoutChangeAction(result: GameResult): string {
  if (result.gameId !== DOG_GAME_ID) {
    return "";
  }

  return `
    <button class="text-button game-result-card__loadout-action" type="button" data-action="edit-loadout">
      更换道具组
    </button>
  `;
}

function renderResultAction(action: GameResultAction, result: GameResult): string {
  if (action === "next-level") {
    return `
      <button class="primary-button primary-button--wide primary-button--next" type="button" data-action="next-level" data-game-id="${result.gameId}" data-level-number="${result.levelNumber + 1}">
        进入下一关
      </button>
    `;
  }

  if (action === "retry") {
    return `
      <button class="primary-button primary-button--wide primary-button--retry" type="button" data-action="retry" data-game-id="${result.gameId}" data-level-number="${result.levelNumber}">
        重新挑战
      </button>
    `;
  }

  if (action === "catalog") {
    return renderCatalogIconButton("text-button icon-button");
  }

  return "";
}

function parseLevelNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const levelNumber = Number(value);
  return Number.isSafeInteger(levelNumber) && levelNumber > 0 ? levelNumber : undefined;
}

type GameboxHistoryState = {
  readonly gameboxRoute: "catalog" | "game";
  readonly gameId?: string;
  readonly levelNumber?: number;
};

function setGameHistory(gameId: string, levelNumber: number): void {
  const nextState: GameboxHistoryState = {
    gameboxRoute: "game",
    gameId,
    levelNumber,
  };
  if (getHistoryRoute() === "game") {
    window.history.replaceState(nextState, "", getCurrentUrl());
    return;
  }

  window.history.pushState(nextState, "", getCurrentUrl());
}

function restoreGameHistory(activeLevel: ActiveLevel | null): void {
  if (activeLevel === null) {
    return;
  }

  setGameHistory(activeLevel.gameId, activeLevel.levelNumber);
}

function replaceHistoryWithCatalog(): void {
  window.history.replaceState({ gameboxRoute: "catalog" } satisfies GameboxHistoryState, "", getCurrentUrl());
}

function getHistoryRoute(): GameboxHistoryState["gameboxRoute"] | null {
  const state: unknown = window.history.state;
  if (
    typeof state !== "object" ||
    state === null ||
    !("gameboxRoute" in state) ||
    (state.gameboxRoute !== "catalog" && state.gameboxRoute !== "game")
  ) {
    return null;
  }

  return state.gameboxRoute;
}

function getCurrentUrl(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
