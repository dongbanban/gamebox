import { DOG_V13_CONFIG, type DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type { DogLegeDogGameState } from "@/games/dog-lege-dog/game/game-types";
import {
  getDogBlockVisualMetrics,
  renderDogBlock,
  syncDogBlockElement,
} from "@/games/dog-lege-dog/game/game-renderer-blocks";
import { fitDogBoardToFrame } from "@/games/dog-lege-dog/game/game-renderer-layout";
import {
  renderDogLoadoutArea,
  syncDogLoadoutSummary,
  updateDogLoadoutArea,
} from "@/games/dog-lege-dog/game/game-renderer-loadout";
import { renderDogSpecialMechanismModal } from "@/games/dog-lege-dog/game/game-renderer-mechanisms";
import { getActiveItemTargetBlockIds } from "@/games/dog-lege-dog/game/game-renderer-targets";
import {
  renderDogMatchFeedback,
  renderDogShuffleStatus,
  renderDogStatusMessage,
  renderDogTray,
  renderDogTraySlot,
  renderDogTraySlots,
  syncDogTraySlotElement,
} from "@/games/dog-lege-dog/game/game-renderer-tray";

export {
  fitDogBoardToFrame,
  getDogBlockVisualMetrics,
  renderDogBlock,
  renderDogLoadoutArea,
  renderDogSpecialMechanismModal,
  renderDogTraySlots,
  syncDogLoadoutSummary,
  updateDogLoadoutArea,
};

export function renderDogLegeDogGame(
  root: HTMLElement,
  state: DogLegeDogGameState,
  config: DogV13Config = DOG_V13_CONFIG,
): void {
  const gameRoot = root.querySelector<HTMLElement>("[data-game-content]") ?? root;
  const existingGame = gameRoot.querySelector<HTMLElement>('[data-testid="dog-game"]');
  const boardMetrics = getBoardMetrics(state, config);
  if (existingGame !== null) {
    updateDogLegeDogGame(existingGame, state, boardMetrics, config);
    return;
  }

  const { board } = state.level;
  const blocks = state.session.remainingBlocks;
  const itemTargetBlockIds = getActiveItemTargetBlockIds(state);
  const blockRenderOptions = createDogBlockRenderOptions(state, boardMetrics, itemTargetBlockIds, config);
  const labels = config.ui.copy.labels;
  const boardLabel = getDogBoardLabel(state, config);
  gameRoot.innerHTML = `
    <section class="dog-game" data-testid="dog-game" data-game-id="${state.gameId}" data-run-seed="${state.level.runSeed}" data-input-locked="${state.inputLocked}" data-feedback="${state.feedback}">
      <header class="dog-game__header">
        <div class="dog-game__level-tools">
          <div class="dog-game__level-mark" data-testid="dog-active-level" aria-label="${labels.activeLevel} ${state.level.number}">
            <span>${labels.level}</span>
            <strong>${state.level.number}</strong>
          </div>
          <button class="dog-special-mechanism-button" type="button" data-action="open-special-mechanisms" data-testid="dog-special-mechanism-button" aria-haspopup="dialog" aria-label="${labels.specialMechanism}">
            <span aria-hidden="true">?</span>
          </button>
          <span data-testid="dog-replay-current-level-slot">${renderReplayCurrentLevelButton(state, config)}</span>
        </div>
      </header>
      <div class="dog-board-frame">
        <div class="dog-board-scaler" style="--board-pixel-width: ${boardMetrics.pixelWidth}px; --board-pixel-height: ${boardMetrics.pixelHeight}px;">
          <div class="dog-board" data-testid="dog-board" data-shape="${board.shape}" data-surface-shape="rectangle" data-template-id="${board.templateId}" data-logical-width="${board.width}" data-logical-height="${board.height}" style="--board-columns: ${boardMetrics.columns}; --board-rows: ${boardMetrics.rows}; --board-pixel-width: ${boardMetrics.pixelWidth}px; --board-pixel-height: ${boardMetrics.pixelHeight}px;" role="group" aria-label="${boardLabel}">
            ${blocks.map((block) => renderDogBlock(block, blockRenderOptions)).join("")}
          </div>
        </div>
      </div>
      <div class="dog-loadout-slot" data-testid="dog-loadout-slot">${renderDogLoadoutArea(state, config)}</div>
      ${renderDogTray(state.session, state.feedback, state.items?.selectedItemTargetType ?? null, state.items?.selectedItemId ?? null, itemTargetBlockIds, config)}
      <div class="dog-animation-layer" data-testid="dog-animation-layer"></div>
    </section>
  `;
  fitDogBoardToFrame(gameRoot);
}

interface DogBoardMetrics {
  readonly columns: number;
  readonly rows: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
}

function getBoardMetrics(state: DogLegeDogGameState, config: DogV13Config): DogBoardMetrics {
  const { board } = state.level;
  const visual = getDogBlockVisualMetrics(config);
  return {
    columns: board.width / config.board.blockWidth,
    rows: board.height / config.board.blockHeight,
    pixelWidth: board.width * visual.unitWidthPx,
    pixelHeight: board.height * visual.unitHeightPx,
  };
}

function updateDogLegeDogGame(
  gameRoot: HTMLElement,
  state: DogLegeDogGameState,
  boardMetrics: DogBoardMetrics,
  config: DogV13Config,
): void {
  const { board } = state.level;
  const boardElement = gameRoot.querySelector<HTMLElement>('[data-testid="dog-board"]');
  const boardScaler = gameRoot.querySelector<HTMLElement>(".dog-board-scaler");
  const statusElement = gameRoot.querySelector<HTMLElement>('[data-testid="dog-status"]');
  const tray = gameRoot.querySelector<HTMLElement>('[data-testid="dog-tray-region"]');
  const traySlots = tray?.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
  const shuffleStatusElement = tray?.querySelector<HTMLElement>('[data-testid="dog-shuffle-status"]') ?? null;
  const loadoutSlot = gameRoot.querySelector<HTMLElement>('[data-testid="dog-loadout-slot"]');
  const replaySlot = gameRoot.querySelector<HTMLElement>('[data-testid="dog-replay-current-level-slot"]');
  const itemTargetBlockIds = getActiveItemTargetBlockIds(state);
  const boardGeometryChanged = boardElement !== null && hasBoardGeometryChanged(boardElement, boardScaler, board, boardMetrics);

  gameRoot.dataset.inputLocked = String(state.inputLocked);
  gameRoot.dataset.feedback = state.feedback;
  gameRoot.dataset.runSeed = state.level.runSeed;
  if (statusElement !== null) {
    statusElement.className = `dog-game__status dog-game__status--${state.session.status}`;
    statusElement.innerHTML = renderDogStatusMessage(state.session.status, config);
  }
  if (boardElement !== null) {
    boardElement.dataset.shape = board.shape;
    boardElement.dataset.surfaceShape = "rectangle";
    boardElement.dataset.templateId = board.templateId;
    boardElement.dataset.logicalWidth = String(board.width);
    boardElement.dataset.logicalHeight = String(board.height);
    boardElement.style.setProperty("--board-columns", String(boardMetrics.columns));
    boardElement.style.setProperty("--board-rows", String(boardMetrics.rows));
    boardElement.style.setProperty("--board-pixel-width", `${boardMetrics.pixelWidth}px`);
    boardElement.style.setProperty("--board-pixel-height", `${boardMetrics.pixelHeight}px`);
    boardElement.setAttribute("aria-label", getDogBoardLabel(state, config));
    syncDogBoard(boardElement, state, boardMetrics, itemTargetBlockIds, config);
  }
  boardScaler?.style.setProperty("--board-pixel-width", `${boardMetrics.pixelWidth}px`);
  boardScaler?.style.setProperty("--board-pixel-height", `${boardMetrics.pixelHeight}px`);
  if (traySlots !== null && traySlots !== undefined) {
    traySlots.style.setProperty("--dog-tray-columns", String(state.session.trayCapacity));
    traySlots.dataset.trayCapacity = String(state.session.trayCapacity);
    traySlots.dataset.effectiveTrayCapacity = String(state.session.effectiveTrayCapacity);
    traySlots.dataset.trayFreeCapacity = String(state.session.trayFreeCapacity);
    traySlots.dataset.lockedTraySlotCount = String(state.session.lockedTraySlotCount);
    syncDogTraySlots(
      traySlots,
      state.session,
      state.items?.selectedItemTargetType ?? null,
      state.items?.selectedItemId ?? null,
      itemTargetBlockIds,
      config,
    );
  }
  const shuffleStatusMarkup = renderDogShuffleStatus(state.session, config);
  if (shuffleStatusElement !== null) {
    if (shuffleStatusMarkup === "") {
      shuffleStatusElement.remove();
    } else {
      syncDogShuffleStatusElement(shuffleStatusElement, state.session, config);
    }
  } else if (shuffleStatusMarkup !== "" && tray !== null && tray !== undefined && traySlots !== null && traySlots !== undefined) {
    traySlots.insertAdjacentHTML("beforebegin", shuffleStatusMarkup);
  }
  if (loadoutSlot !== null) {
    updateDogLoadoutArea(loadoutSlot, state, config);
  }
  if (replaySlot !== null) {
    replaySlot.innerHTML = renderReplayCurrentLevelButton(state, config);
  }
  const matchEffect = tray?.querySelector<HTMLElement>('[data-testid="dog-match-effect"]');
  if (state.feedback === "match") {
    if (matchEffect === null && tray !== null && tray !== undefined) {
      tray.insertAdjacentHTML("afterbegin", renderDogMatchFeedback(state.feedback, config));
    }
  } else {
    matchEffect?.remove();
  }
  if (boardGeometryChanged) {
    fitDogBoardToFrame(gameRoot);
  }
}

function syncDogShuffleStatusElement(
  element: HTMLElement,
  session: DogLegeDogGameState["session"],
  config: DogV13Config,
): void {
  if (session.shuffle === null) {
    return;
  }

  const presentation = config.ui.copy.specialMechanisms.presentations.shuffle;
  element.dataset.shuffleState = session.shuffle.status;
  element.dataset.shuffleThreshold = String(session.shuffle.threshold);
  element.textContent = `${presentation.name}：${presentation.stateLabels[session.shuffle.status]}`;
}

function createDogBlockRenderOptions(
  state: DogLegeDogGameState,
  boardMetrics: DogBoardMetrics,
  targetBlockIds: readonly string[],
  config: DogV13Config,
) {
  return {
    boardPixelWidth: boardMetrics.pixelWidth,
    boardPixelHeight: boardMetrics.pixelHeight,
    selectableBlockIds: state.session.selectableBlockIds,
    inputLocked: state.inputLocked,
    itemTargetType: state.items?.selectedItemTargetType ?? null,
    itemTargetId: state.items?.selectedItemId ?? null,
    targetBlockIds,
    config,
  } as const;
}

function syncDogBoard(
  boardElement: HTMLElement,
  state: DogLegeDogGameState,
  boardMetrics: DogBoardMetrics,
  targetBlockIds: readonly string[],
  config: DogV13Config,
): void {
  const existingBlocks = new Map<string, HTMLElement>();
  const currentBlocks = [...boardElement.querySelectorAll<HTMLElement>('[data-testid="dog-block"]')];
  for (const block of currentBlocks) {
    const blockId = block.dataset.blockId;
    if (blockId === undefined || existingBlocks.has(blockId)) {
      block.remove();
      continue;
    }
    existingBlocks.set(blockId, block);
  }

  const nextBlocks: HTMLElement[] = [];
  const renderOptions = createDogBlockRenderOptions(state, boardMetrics, targetBlockIds, config);
  for (const block of state.session.remainingBlocks) {
    const current = existingBlocks.get(block.id);
    if (current === undefined) {
      nextBlocks.push(parseSingleElement(renderDogBlock(block, renderOptions)));
    } else {
      nextBlocks.push(syncDogBlockElement(current, block, renderOptions));
    }
  }

  const nextIds = new Set(state.session.remainingBlocks.map((block) => block.id));
  for (const [blockId, block] of existingBlocks) {
    if (!nextIds.has(blockId)) {
      block.remove();
    }
  }

  for (let index = 0; index < nextBlocks.length; index += 1) {
    const block = nextBlocks[index];
    if (boardElement.children[index] !== block) {
      boardElement.insertBefore(block, boardElement.children[index] ?? null);
    }
  }
}

function syncDogTraySlots(
  traySlots: HTMLOListElement,
  session: Parameters<typeof renderDogTraySlots>[0],
  itemTargetType: Parameters<typeof renderDogTraySlots>[1],
  itemTargetId: Parameters<typeof renderDogTraySlots>[2],
  targetBlockIds: Parameters<typeof renderDogTraySlots>[3],
  config: DogV13Config,
): void {
  const currentSlots = [...traySlots.children].filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );
  const currentBlocks = new Map<string, HTMLElement>();
  for (const slot of currentSlots) {
    const blockId = slot.dataset.blockId;
    if (blockId !== undefined) {
      currentBlocks.set(blockId, slot);
    }
  }

  const nextBlockIds = new Set(session.trayBlocks.map((block) => block.id));
  const preservedSlots = new Set(
    [...currentBlocks.entries()]
      .filter(([blockId]) => nextBlockIds.has(blockId))
      .map(([, slot]) => slot),
  );
  const usedSlots = new Set<HTMLElement>();
  const nextSlots: HTMLElement[] = [];
  const slotCount = Math.max(session.trayCapacity, session.trayBlocks.length);
  for (let index = 0; index < slotCount; index += 1) {
    const blockId = session.trayBlocks[index]?.id;
    let current = blockId === undefined ? currentSlots[index] : currentBlocks.get(blockId);
    if (
      current === undefined ||
      usedSlots.has(current) ||
      (blockId === undefined && preservedSlots.has(current))
    ) {
      current = currentSlots.find((slot) =>
        !usedSlots.has(slot) && !preservedSlots.has(slot),
      );
    }

    if (current === undefined) {
      current = parseSingleElement(
        renderDogTraySlot(
          session,
          index,
          itemTargetType,
          itemTargetId,
          targetBlockIds,
          config,
        ),
      );
    } else {
      usedSlots.add(current);
      syncDogTraySlotElement(
        current,
        session,
        index,
        itemTargetType,
        itemTargetId,
        targetBlockIds,
        config,
      );
    }
    nextSlots.push(current);
  }

  for (const slot of currentSlots) {
    if (!usedSlots.has(slot)) {
      slot.remove();
    }
  }
  for (let index = 0; index < nextSlots.length; index += 1) {
    const slot = nextSlots[index];
    if (traySlots.children[index] !== slot) {
      traySlots.insertBefore(slot, traySlots.children[index] ?? null);
    }
  }
}

function parseSingleElement(markup: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  const element = template.content.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    throw new Error("Expected renderer markup to contain one element");
  }
  return element;
}

function hasBoardGeometryChanged(
  boardElement: HTMLElement,
  boardScaler: HTMLElement | null,
  board: DogLegeDogGameState["level"]["board"],
  metrics: DogBoardMetrics,
): boolean {
  return boardElement.dataset.shape !== board.shape ||
    boardElement.dataset.surfaceShape !== "rectangle" ||
    boardElement.dataset.templateId !== board.templateId ||
    boardElement.dataset.logicalWidth !== String(board.width) ||
    boardElement.dataset.logicalHeight !== String(board.height) ||
    boardElement.style.getPropertyValue("--board-columns") !== String(metrics.columns) ||
    boardElement.style.getPropertyValue("--board-rows") !== String(metrics.rows) ||
    boardElement.style.getPropertyValue("--board-pixel-width") !== `${metrics.pixelWidth}px` ||
    boardElement.style.getPropertyValue("--board-pixel-height") !== `${metrics.pixelHeight}px` ||
    boardScaler?.style.getPropertyValue("--board-pixel-width") !== `${metrics.pixelWidth}px` ||
    boardScaler?.style.getPropertyValue("--board-pixel-height") !== `${metrics.pixelHeight}px`;
}

function getDogBoardLabel(state: DogLegeDogGameState, config: DogV13Config): string {
  return config.ui.copy.labels.board
    .replace("{level}", String(state.level.number))
    .replace("{blockCount}", String(state.session.remainingBlocks.length));
}

function renderReplayCurrentLevelButton(
  state: DogLegeDogGameState,
  config: DogV13Config,
): string {
  if (
    state.status !== "ready" &&
    state.status !== "playing"
  ) {
    return "";
  }

  const label = config.ui.copy.app.actions.replayCurrentLevel;
  const disabled = state.inputLocked || state.loadoutEditor !== null
    ? ' disabled aria-disabled="true"'
    : "";
  return `<button class="primary-button dog-game__replay-button" type="button" data-action="replay-current-level" data-testid="dog-replay-current-level" data-game-id="${state.gameId}" data-level-number="${state.level.number}" aria-label="${label}"${disabled}>${label}</button>`;
}
