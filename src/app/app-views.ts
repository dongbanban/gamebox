import {
  type GameDefinition,
  type GamePreparationFailureDetails,
  type GameResult,
  type GameResultAction,
} from "@/catalog";
import {
  createInitialGameProgress,
  type LevelCompletionResult,
  type StoreSnapshot,
} from "@/progress-store";
import {
  getDogPatternAssetUrl,
  renderDogPatternAsset,
} from "@/games/dog-lege-dog/assets/game-assets";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import {
  DOG_ITEM_DEFINITIONS,
  renderDogLoadoutEditor,
  type DogItemId,
} from "@/games/dog-lege-dog/game/dog-loadout";
import { getDogItemUses } from "@/games/dog-lege-dog/game/dog-item-runtime";

export function renderRegistrationView(
  snapshot: StoreSnapshot,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const copy = config.ui.copy.app;
  return `
    <main class="register-view" data-view="register">
      <div class="register-view__glow" aria-hidden="true"></div>
      <section class="register-panel" aria-labelledby="register-title">
        <div class="brand-lockup">
          ${renderDogBrandMark(config)}
          <span class="brand-lockup__name">${copy.brandName}</span>
        </div>
        <h1 id="register-title">${copy.registrationTitle}</h1>
        <p class="register-panel__intro">
          ${copy.registrationIntro}
        </p>
        <button class="primary-button primary-button--wide" type="button" data-action="register">
          ${copy.register}
        </button>
        ${renderPersistenceNotice(snapshot.warning)}
        <p class="register-panel__fine-print">${copy.registrationFinePrint}</p>
      </section>
    </main>
  `;
}

export function renderCatalogView(
  catalog: readonly GameDefinition[],
  snapshot: StoreSnapshot,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const copy = config.ui.copy.app;
  const state = snapshot.state;
  if (state === null) {
    return renderRegistrationView(snapshot, config);
  }

  const cards = catalog.map((game) => {
    const progress = state.games[game.id] ?? createInitialGameProgress();
    const cover = game.id === config.game.id
      ? getDogPatternAssetUrl("傻狗", config)
      : game.cover;
    return `
      <article class="catalog-item" data-game-id="${game.id}">
        <div class="catalog-item__cover-wrap">
          <img class="catalog-item__cover" src="${cover}" crossorigin="anonymous" alt="${game.name}封面" />
        </div>
        <div class="catalog-item__content">
          <div class="catalog-item__heading">
            <h2>${game.name}</h2>
          </div>
          <p class="catalog-item__description">${game.description}</p>
          <div class="catalog-item__actions">
            <dl class="catalog-item__level">
              <dt>${copy.highestUnlockedLevel}</dt>
              <dd>第 ${progress.highestUnlockedLevel} 关</dd>
            </dl>
            <button class="primary-button" type="button" data-action="enter-game" data-game-id="${game.id}" ${game.playable ? "" : "disabled"}>
              ${copy.startGame}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  return `
    <main class="catalog-view" data-view="catalog">
      <header class="catalog-header">
        <div>
          <div class="brand-lockup brand-lockup--compact">
            ${renderDogBrandMark(config)}
            <span class="brand-lockup__name">${copy.brandName}</span>
          </div>
          <h1>${copy.catalogTitle}</h1>
        </div>
        <button class="text-button" type="button" data-action="reset">${copy.reset}</button>
      </header>
      ${renderPersistenceNotice(snapshot.warning)}
      <section class="game-directory" aria-label="${copy.catalogAriaLabel}">
        ${cards}
      </section>
    </main>
  `;
}

export function renderGameEntryView(
  gameId: string,
  levelNumber: number,
  soundEnabled: boolean,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const copy = config.ui.copy.app;
  return `
    <main class="game-entry-view" data-view="game-entry" data-game-id="${gameId}" data-level-number="${levelNumber}">
      <h1 class="sr-only">${copy.activeGame}</h1>
      <header class="game-entry-view__header">
        <div class="game-entry-view__brand">
          ${renderCatalogIconButton("icon-button game-entry-view__catalog-button", config)}
          <div class="brand-lockup brand-lockup--compact">
            ${renderDogBrandMark(config)}
            <span class="brand-lockup__name">${copy.brandName}</span>
          </div>
        </div>
        ${renderSoundButton(soundEnabled, config)}
      </header>
      <div class="game-entry-view__game">
        <div data-game-content>
          ${renderGameGenerationLoading(levelNumber, config)}
        </div>
      </div>
    </main>
  `;
}

export function renderGameGenerationError(
  details: GamePreparationFailureDetails,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const copy = config.ui.copy.app.generation;
  const diagnostics = [
    renderGenerationDiagnostic(copy.runSeed, details.runSeed),
    renderGenerationDiagnostic(copy.generatorVersion, String(details.generatorVersion)),
    details.workerFailure === undefined
      ? ""
      : renderGenerationDiagnostic(copy.workerFailure, details.workerFailure),
    details.fallbackFailure === undefined
      ? ""
      : renderGenerationDiagnostic(copy.fallbackFailure, details.fallbackFailure),
  ].join("");
  return `
    <section class="game-generation-state game-generation-state--error" data-testid="game-generation-error" role="alert">
      <p class="eyebrow">${escapeHtml(copy.errorTitle)}</p>
      <h2>${escapeHtml(copy.errorTitle)}</h2>
      <p>${escapeHtml(copy.errorDescription)}</p>
      <dl class="game-generation-state__diagnostics">${diagnostics}</dl>
      <button class="primary-button" type="button" data-action="retry-generation" data-game-id="${escapeHtml(details.gameId)}" data-level-number="${details.levelNumber}">
        ${escapeHtml(copy.retry)}
      </button>
    </section>
  `;
}

function renderGameGenerationLoading(
  levelNumber: number,
  config: DogV13Config,
): string {
  const copy = config.ui.copy.app.generation;
  const title = copy.loadingTitle.replace("{levelNumber}", String(levelNumber));
  return `
    <section class="game-generation-state" data-testid="game-generation-loading" role="status" aria-live="polite">
      <span class="game-generation-state__spinner" aria-hidden="true"></span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(copy.loadingDescription)}</p>
    </section>
  `;
}

function renderGenerationDiagnostic(label: string, value: string): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderGameResultView(
  result: GameResult,
  status: "won" | "lost",
  snapshot: StoreSnapshot,
  completion?: LevelCompletionResult,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const copy = config.ui.copy.app;
  const persistenceMessage = snapshot.persistence === "persistent"
    ? copy.persistenceSaved
    : copy.persistenceTemporary;
  const content = status === "won" && completion !== undefined
    ? renderWinResultContent(result, completion, snapshot, persistenceMessage, config)
    : renderLossResultContent(result, snapshot, config);
  const finalClassName = result.isFinal === true ? " game-result-card--final" : "";
  return `
    <main class="game-result-view" data-view="game-result" data-result="${status}" data-game-id="${result.gameId}">
      <section class="game-result-card game-result-card--${status}${finalClassName}" data-final="${result.isFinal === true}" aria-labelledby="game-result-title">
        ${content}
      </section>
    </main>
  `;
}

export interface ResultLoadoutEditorOptions {
  readonly draft: readonly DogItemId[];
  readonly current: readonly DogItemId[];
  readonly levelNumber: number;
  readonly confirming: boolean;
  readonly changeTarget: "current" | "next";
  readonly config?: DogV13Config;
}

export function renderResultLoadoutEditor({
  draft,
  current,
  levelNumber,
  confirming,
  changeTarget,
  config = DOG_V13_CONFIG,
}: ResultLoadoutEditorOptions): string {
  return renderDogLoadoutEditor({
    mode: "change",
    draft,
    current,
    levelNumber,
    confirming,
    changeTarget,
    config,
    loadoutSize: config.items.loadoutSize,
    itemUses: Object.fromEntries(
      DOG_ITEM_DEFINITIONS.map((item) => [
        item.id,
        getDogItemUses({ number: levelNumber }, item.id, config),
      ]),
    ),
  });
}

export function updateSoundButton(
  root: HTMLElement,
  soundEnabled: boolean,
  config: DogV13Config = DOG_V13_CONFIG,
): void {
  const button = root.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]');
  if (button === null) {
    return;
  }

  button.dataset.soundEnabled = String(soundEnabled);
  const copy = config.ui.copy.app;
  button.setAttribute("aria-label", soundEnabled ? copy.soundEnabled : copy.soundDisabled);
  button.setAttribute("aria-pressed", String(soundEnabled));
  button.innerHTML = renderSoundButtonContent(soundEnabled);
}

function renderWinResultContent(
  result: GameResult,
  completion: LevelCompletionResult,
  snapshot: StoreSnapshot,
  persistenceMessage: string,
  config: DogV13Config,
): string {
  const copy = config.ui.copy.app;
  const isFinal = result.isFinal === true;
  if (isFinal) {
    return `
      <p class="eyebrow">${result.display.eyebrow}</p>
      <h1 id="game-result-title">${result.display.title}</h1>
      <p class="game-result-card__intro">${result.display.description}${persistenceMessage}</p>
      ${renderPersistenceNotice(snapshot.warning)}
      <dl class="game-result-card__stats">
        <div><dt>${copy.result.completedLevel}</dt><dd>${config.game.maxLevelNumber} / ${config.game.maxLevelNumber}</dd></div>
        <div><dt>${copy.result.finalReward}</dt><dd>${completion.reward}</dd></div>
        <div><dt>${copy.result.totalScore}</dt><dd>${completion.progress.totalScore}</dd></div>
        <div><dt>${copy.result.finalTitle}</dt><dd>${copy.result.finalTitleValue}</dd></div>
      </dl>
      ${renderResultActions(result, config)}
    `;
  }

  return `
    <p class="eyebrow">${result.display.eyebrow}</p>
    <h1 id="game-result-title">${result.display.title}</h1>
    <p class="game-result-card__intro">第 ${result.levelNumber} 关${result.display.description}${persistenceMessage}</p>
    ${renderPersistenceNotice(snapshot.warning)}
    <dl class="game-result-card__stats">
        <div><dt>${copy.result.currentLevel}</dt><dd>第 ${result.levelNumber} 关</dd></div>
        <div><dt>${copy.result.reward}</dt><dd>${completion.reward}</dd></div>
        <div><dt>${copy.result.totalScore}</dt><dd>${completion.progress.totalScore}</dd></div>
        <div><dt>${copy.result.nextLevel}</dt><dd>第 ${result.levelNumber + 1} 关</dd></div>
      </dl>
    ${renderLoadoutChangeAction(result, config)}
    ${renderResultActions(result, config)}
  `;
}

function renderLossResultContent(
  result: GameResult,
  snapshot: StoreSnapshot,
  config: DogV13Config,
): string {
  return `
    <p class="eyebrow">${result.display.eyebrow}</p>
    <h1 id="game-result-title">${result.display.title}</h1>
    <p class="game-result-card__intro">第 ${result.levelNumber} 关${result.display.description}</p>
    ${renderPersistenceNotice(snapshot.warning)}
    ${renderLoadoutChangeAction(result, config)}
    ${renderResultActions(result, config)}
  `;
}

export function renderPersistenceNotice(warning: string | null): string {
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

function renderDogBrandMark(config: DogV13Config): string {
  return `<span class="brand-lockup__mark brand-lockup__mark--dog" aria-hidden="true">${renderDogPatternAsset("傻狗", config)}</span>`;
}

function renderCatalogIconButton(
  className = "icon-button",
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const label = config.ui.copy.app.returnCatalog;
  return `
    <button class="${className}" type="button" data-action="catalog" aria-label="${label}" title="${label}">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
      </svg>
    </button>
  `;
}

function renderSoundButton(soundEnabled: boolean, config: DogV13Config): string {
  const copy = config.ui.copy.app;
  return `
    <button class="sound-button" type="button" data-action="toggle-sound" data-sound-enabled="${soundEnabled}" aria-label="${soundEnabled ? copy.soundEnabled : copy.soundDisabled}" aria-pressed="${soundEnabled}">
      ${renderSoundButtonContent(soundEnabled)}
    </button>
  `;
}

function renderSoundButtonContent(soundEnabled: boolean): string {
  return `<span class="sound-button__icon" aria-hidden="true">${soundEnabled ? "♫" : "♩̸"}</span>`;
}

function renderResultActions(result: GameResult, config: DogV13Config): string {
  const isRetryResult = result.actions.includes("retry");
  const hasCatalogAction = result.actions.includes("catalog");
  const orderedActions: readonly GameResultAction[] = hasCatalogAction
    ? ["catalog", ...result.actions.filter((action) => action !== "catalog")]
    : result.actions;
  const actions = orderedActions
    .map((action) => renderResultAction(action, result, config))
    .filter((action): action is string => action.length > 0);
  const splitClassName = hasCatalogAction && orderedActions.length === 2
    ? " game-result-card__actions--split"
    : "";
  const retryClassName = isRetryResult ? " game-result-card__actions--retry" : "";
  return `<div class="game-result-card__actions${splitClassName}${retryClassName}">${actions.join("")}</div>`;
}

function renderLoadoutChangeAction(result: GameResult, config: DogV13Config): string {
  if (result.gameId !== config.game.id || result.isFinal === true) {
    return "";
  }

  return `<button class="text-button game-result-card__loadout-action" type="button" data-action="edit-loadout">${config.ui.copy.app.actions.loadout}</button>`;
}

function renderResultAction(
  action: GameResultAction,
  result: GameResult,
  config: DogV13Config,
): string {
  if (action === "next-level") {
    if (result.isFinal === true || result.levelNumber >= config.game.maxLevelNumber) {
      return "";
    }

    return `<button class="primary-button primary-button--wide primary-button--next" type="button" data-action="next-level" data-game-id="${result.gameId}" data-level-number="${result.levelNumber + 1}">${config.ui.copy.app.actions.nextLevel}</button>`;
  }

  if (action === "retry") {
    return `<button class="primary-button primary-button--wide primary-button--retry" type="button" data-action="retry" data-game-id="${result.gameId}" data-level-number="${result.levelNumber}">${config.ui.copy.app.actions.retry}</button>`;
  }

  if (action === "catalog") {
    return renderCatalogIconButton("text-button icon-button", config);
  }

  return "";
}
