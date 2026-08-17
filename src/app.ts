import {
  GAME_CATALOG,
  type GameLaunchHandle,
  type GameResult,
} from "./catalog";
import {
  createInitialGameProgress,
  ProgressStore,
  type LevelCompletionResult,
  type StoreSnapshot,
} from "./progress-store";

export interface MountAppOptions {
  store?: ProgressStore;
}

interface ActiveLevel {
  readonly gameId: string;
  readonly levelNumber: number;
}

export class GameboxApp {
  private readonly root: HTMLElement;
  private readonly store: ProgressStore;
  private activeGame: GameLaunchHandle | null = null;
  private activeLevel: ActiveLevel | null = null;
  private pendingCompletion: LevelCompletionResult | null = null;

  constructor(root: HTMLElement, options: MountAppOptions = {}) {
    this.root = root;
    this.store = options.store ?? new ProgressStore();
    replaceHistoryWithCatalog();
    this.root.addEventListener("click", this.handleClick);
    window.addEventListener("popstate", this.handlePopState);
  }

  render(): void {
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
            <span class="brand-lockup__mark" aria-hidden="true">🐶</span>
            <span class="brand-lockup__name">GAMEBOX</span>
          </div>
          <p class="eyebrow">浏览器小游戏合集 · 01</p>
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

    const cards = GAME_CATALOG.map((game, index) => {
      const progress = state.games[game.id] ?? createInitialGameProgress();
      return `
        <article class="catalog-item" data-game-id="${game.id}">
          <div class="catalog-item__cover-wrap">
            <img class="catalog-item__cover" src="${game.cover}" alt="${game.name}封面" />
            <span class="catalog-item__badge">${index === 0 ? "首个游戏" : "游戏"}</span>
          </div>
          <div class="catalog-item__content">
            <div class="catalog-item__heading">
              <div>
                <p class="eyebrow">DOG · TRIPLE</p>
                <h2>${game.name}</h2>
              </div>
              <span class="status-dot" aria-label="${game.playable ? "可以游玩" : "即将开放"}"></span>
            </div>
            <p class="catalog-item__description">${game.description}</p>
            <dl class="catalog-item__stats">
              <div>
                <dt>最高解锁关卡</dt>
                <dd>第 ${progress.highestUnlockedLevel} 关</dd>
              </div>
              <div>
                <dt>累计积分</dt>
                <dd>${progress.totalScore}</dd>
              </div>
            </dl>
            <button class="primary-button" type="button" data-action="enter-game" data-game-id="${game.id}" ${game.playable ? "" : "disabled"}>
              进入游戏 <span aria-hidden="true">↗</span>
            </button>
          </div>
        </article>
      `;
    }).join("");

    this.root.innerHTML = `
      <main class="catalog-view" data-view="catalog">
        <header class="catalog-header">
          <div>
            <div class="brand-lockup brand-lockup--compact">
              <span class="brand-lockup__mark" aria-hidden="true">🐶</span>
              <span class="brand-lockup__name">GAMEBOX</span>
            </div>
            <p class="eyebrow">你的游戏合集</p>
            <h1>游戏目录</h1>
          </div>
          <button class="text-button" type="button" data-action="reset">重置本地数据</button>
        </header>
        ${renderPersistenceNotice(snapshot.warning)}
        <section class="game-directory" aria-label="游戏目录">
          ${cards}
        </section>
        <p class="catalog-footer">更多游戏正在路上 · 当前浏览器身份：${state.userId.slice(0, 8)}…</p>
      </main>
    `;
  }

  private renderGameEntry(gameId: string | undefined, requestedLevelNumber?: number): void {
    const game = GAME_CATALOG.find((item) => item.id === gameId);
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
    setGameHistory(game.id, levelNumber);
    this.root.innerHTML = `
      <main class="game-entry-view" data-view="game-entry" data-game-id="${game.id}" data-level-number="${levelNumber}">
        <header class="game-entry-view__header">
          <div>
            <div class="brand-lockup brand-lockup--compact">
              <span class="brand-lockup__mark" aria-hidden="true">🐶</span>
              <span class="brand-lockup__name">GAMEBOX</span>
            </div>
            <p class="eyebrow">游戏入口已打开</p>
            <h1 id="game-entry-title">${game.name}</h1>
          </div>
          <button class="text-button" type="button" data-action="catalog">返回游戏目录</button>
        </header>
        ${renderLevelPicker(game.id, levelNumber, progress.highestUnlockedLevel)}
        <div class="game-entry-view__game" data-game-mount></div>
      </main>
    `;

    const gameMount = this.root.querySelector<HTMLElement>("[data-game-mount]");
    if (gameMount === null) {
      return;
    }

    this.activeLevel = { gameId: game.id, levelNumber };
    this.activeGame = game.launch(gameMount, {
      onResult: this.handleGameResult,
      onResultConfirmed: this.handleGameResultConfirmed,
      onSoundToggle: (soundEnabled) => this.store.setSoundEnabled(soundEnabled),
      soundEnabled: state.settings.soundEnabled,
      levelNumber,
    });
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
    return window.confirm("当前关卡不会保存，确认离开？");
  }

  private readonly handleGameResultConfirmed = (result: GameResult): void => {
    if (result.status === "won") {
      this.pendingCompletion = this.store.recordLevelCompletion(result);
    }
  };

  private readonly handleGameResult = (result: GameResult): void => {
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
    const snapshot = this.store.snapshot();
    const persistenceMessage =
      snapshot.persistence === "persistent"
        ? `第 ${result.levelNumber} 关完成，进度已保存。`
        : `第 ${result.levelNumber} 关完成。当前为临时运行模式，刷新后进度可能丢失。`;
    this.renderGameResult(result, "won", `
          <p class="eyebrow">狗了个狗 · 关卡结果</p>
          <h1 id="game-result-title">通关！</h1>
          <p class="game-result-card__intro">${persistenceMessage}</p>
          ${renderPersistenceNotice(snapshot.warning)}
          <dl class="game-result-card__stats">
            <div><dt>当前关卡</dt><dd>第 ${result.levelNumber} 关</dd></div>
            <div><dt>通关奖励</dt><dd>${completion.reward}</dd></div>
            <div><dt>累计积分</dt><dd>${completion.progress.totalScore}</dd></div>
            <div><dt>下一关</dt><dd>第 ${result.levelNumber + 1} 关</dd></div>
          </dl>
          <button class="primary-button primary-button--wide" type="button" data-action="catalog">
            返回游戏目录
          </button>
    `);
  }

  private renderLossResult(result: GameResult): void {
    this.renderGameResult(result, "lost", `
          <p class="eyebrow">狗了个狗 · 关卡结果</p>
          <h1 id="game-result-title">失败</h1>
          <p class="game-result-card__intro">第 ${result.levelNumber} 关暂存槽已满，进度未改变。</p>
          ${renderPersistenceNotice(this.store.snapshot().warning)}
          <div class="game-result-card__actions">
            <button class="primary-button primary-button--wide" type="button" data-action="retry" data-game-id="${result.gameId}" data-level-number="${result.levelNumber}">
              重新挑战
            </button>
            <button class="text-button" type="button" data-action="catalog">返回游戏目录</button>
          </div>
    `);
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
    this.activeGame?.destroy();
    this.activeGame = null;
    this.activeLevel = null;
    this.pendingCompletion = null;
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

function renderLevelPicker(
  gameId: string,
  selectedLevelNumber: number,
  highestUnlockedLevel: number,
): string {
  const visibleLevelCount = Math.max(5, highestUnlockedLevel + 1);
  const buttons = Array.from({ length: visibleLevelCount }, (_, index) => {
    const levelNumber = index + 1;
    const unlocked = levelNumber <= highestUnlockedLevel;
    const selected = levelNumber === selectedLevelNumber;
    return `
      <button
        class="level-button${selected ? " level-button--selected" : ""}"
        type="button"
        data-action="select-level"
        data-game-id="${gameId}"
        data-level-number="${levelNumber}"
        aria-current="${selected ? "true" : "false"}"
        aria-label="第 ${levelNumber} 关${unlocked ? "" : "，已锁定"}"
        ${unlocked ? "" : "disabled"}
      >${unlocked ? `第 ${levelNumber} 关` : `锁定 · 第 ${levelNumber} 关`}</button>
    `;
  }).join("");

  return `
    <section class="level-picker" data-testid="level-picker" aria-label="关卡选择">
      <div class="level-picker__heading">
        <h2>关卡选择</h2>
        <span>已解锁至第 ${highestUnlockedLevel} 关</span>
      </div>
      <div class="level-picker__list">${buttons}</div>
    </section>
  `;
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
