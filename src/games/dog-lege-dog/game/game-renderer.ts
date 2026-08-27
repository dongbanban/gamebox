import { DOG_V13_CONFIG, type DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type { DogLegeDogGameState } from "@/games/dog-lege-dog/game/game-types";
import {
  DOG_BLOCK_VISUAL_SIZE_PX,
  DOG_BOARD_SAFE_MARGIN_PX,
  DOG_LOGICAL_UNIT_VISUAL_HEIGHT_PX,
  DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX,
  getDogBlockVisualMetrics,
  renderDogBlock,
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
  renderDogStatusMessage,
  renderDogTray,
  renderDogTraySlots,
} from "@/games/dog-lege-dog/game/game-renderer-tray";

export {
  DOG_BLOCK_VISUAL_SIZE_PX,
  DOG_BOARD_SAFE_MARGIN_PX,
  DOG_LOGICAL_UNIT_VISUAL_HEIGHT_PX,
  DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX,
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
        </div>
      </header>
      <div class="dog-board-frame">
        <div class="dog-board-scaler" style="--board-pixel-width: ${boardMetrics.pixelWidth}px; --board-pixel-height: ${boardMetrics.pixelHeight}px;">
          <div class="dog-board" data-testid="dog-board" data-shape="${board.shape}" data-surface-shape="rectangle" data-template-id="${board.templateId}" data-logical-width="${board.width}" data-logical-height="${board.height}" style="--board-columns: ${boardMetrics.columns}; --board-rows: ${boardMetrics.rows}; --board-pixel-width: ${boardMetrics.pixelWidth}px; --board-pixel-height: ${boardMetrics.pixelHeight}px;" role="group" aria-label="${boardLabel}">
            ${blocks.map((block) => renderDogBlock(block, {
              boardPixelWidth: boardMetrics.pixelWidth,
              boardPixelHeight: boardMetrics.pixelHeight,
              selectableBlockIds: state.session.selectableBlockIds,
              inputLocked: state.inputLocked,
              itemTargetType: state.items?.selectedItemTargetType ?? null,
              itemTargetId: state.items?.selectedItemId ?? null,
              targetBlockIds: itemTargetBlockIds,
              config,
            })).join("")}
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
  const loadoutSlot = gameRoot.querySelector<HTMLElement>('[data-testid="dog-loadout-slot"]');
  const itemTargetBlockIds = getActiveItemTargetBlockIds(state);

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
    boardElement.innerHTML = state.session.remainingBlocks.map((block) => renderDogBlock(block, {
      boardPixelWidth: boardMetrics.pixelWidth,
      boardPixelHeight: boardMetrics.pixelHeight,
      selectableBlockIds: state.session.selectableBlockIds,
      inputLocked: state.inputLocked,
      itemTargetType: state.items?.selectedItemTargetType ?? null,
      itemTargetId: state.items?.selectedItemId ?? null,
      targetBlockIds: itemTargetBlockIds,
      config,
    })).join("");
  }
  boardScaler?.style.setProperty("--board-pixel-width", `${boardMetrics.pixelWidth}px`);
  boardScaler?.style.setProperty("--board-pixel-height", `${boardMetrics.pixelHeight}px`);
  if (traySlots !== null && traySlots !== undefined) {
    traySlots.style.setProperty("--dog-tray-columns", String(state.session.trayCapacity));
    traySlots.dataset.trayCapacity = String(state.session.trayCapacity);
    traySlots.dataset.effectiveTrayCapacity = String(state.session.effectiveTrayCapacity);
    traySlots.dataset.trayFreeCapacity = String(state.session.trayFreeCapacity);
    traySlots.dataset.lockedTraySlotCount = String(state.session.lockedTraySlotCount);
    traySlots.innerHTML = renderDogTraySlots(state.session, state.items?.selectedItemTargetType ?? null, state.items?.selectedItemId ?? null, itemTargetBlockIds, config);
  }
  if (loadoutSlot !== null) {
    updateDogLoadoutArea(loadoutSlot, state, config);
  }
  const matchEffect = tray?.querySelector<HTMLElement>('[data-testid="dog-match-effect"]');
  if (state.feedback === "match") {
    if (matchEffect === null && tray !== null && tray !== undefined) {
      tray.insertAdjacentHTML("afterbegin", renderDogMatchFeedback(state.feedback, config));
    }
  } else {
    matchEffect?.remove();
  }
  fitDogBoardToFrame(gameRoot);
}

function getDogBoardLabel(state: DogLegeDogGameState, config: DogV13Config): string {
  return config.ui.copy.labels.board
    .replace("{level}", String(state.level.number))
    .replace("{blockCount}", String(state.session.remainingBlocks.length));
}
