import { GAME_CATALOG } from "./catalog";
import {
  createInitialGameProgress,
  GAME_ID,
  ProgressStore,
  type StoreSnapshot,
} from "./progress-store";

export interface MountAppOptions {
  store?: ProgressStore;
}

export class GameboxApp {
  private readonly root: HTMLElement;
  private readonly store: ProgressStore;

  constructor(root: HTMLElement, options: MountAppOptions = {}) {
    this.root = root;
    this.store = options.store ?? new ProgressStore();
    this.root.addEventListener("click", this.handleClick);
  }

  render(): void {
    const snapshot = this.store.snapshot();
    if (snapshot.state === null) {
      this.renderRegistration(snapshot);
      return;
    }

    this.renderCatalog(snapshot);
  }

  destroy(): void {
    this.root.removeEventListener("click", this.handleClick);
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
      this.renderGameEntry();
      return;
    }

    if (action === "catalog") {
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
            <button class="primary-button" type="button" data-action="enter-game" ${game.playable ? "" : "disabled"}>
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

  private renderGameEntry(): void {
    const game = GAME_CATALOG.find((item) => item.id === GAME_ID);
    if (game === undefined) {
      this.render();
      return;
    }

    this.root.innerHTML = `
      <main class="game-entry-view" data-view="game-entry">
        <div class="game-entry-view__cover-wrap">
          <img class="game-entry-view__cover" src="${game.cover}" alt="${game.name}封面" />
        </div>
        <section class="game-entry-view__content" aria-labelledby="game-entry-title">
          <p class="eyebrow">游戏入口已打开</p>
          <h1 id="game-entry-title">${game.name}</h1>
          <p>首关挑战即将开始。返回游戏目录可继续浏览其他游戏。</p>
          <button class="primary-button" type="button" data-action="catalog">返回游戏目录</button>
        </section>
      </main>
    `;
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

export { GAME_ID };
