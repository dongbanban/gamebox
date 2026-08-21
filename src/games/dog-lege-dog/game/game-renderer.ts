import type {
  DogLegeDogLevel,
} from "@/games/dog-lege-dog/levels/first-level";
import { BLOCK_HEIGHT, BLOCK_WIDTH } from "@/games/dog-lege-dog/levels/level-types";
import { getDogPatternClassName, renderDogPatternAsset } from "@/games/dog-lege-dog/assets/game-assets";
import type { GameSessionSnapshot } from "@/games/dog-lege-dog/game/game-session";
import type {
  DogLegeDogGameState,
  DogVisualFeedback,
} from "@/games/dog-lege-dog/game/game-types";
import {
  DOG_ITEM_DEFINITIONS,
  renderDogLoadoutEditor,
  renderDogLoadoutSummary,
  type DogItemTargetType,
} from "@/games/dog-lege-dog/game/dog-loadout";
import { getDogItemUses } from "@/games/dog-lege-dog/game/dog-item-runtime";

export const DOG_BLOCK_VISUAL_SIZE_PX = 48;
export const DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX = DOG_BLOCK_VISUAL_SIZE_PX / BLOCK_WIDTH;
export const DOG_LOGICAL_UNIT_VISUAL_HEIGHT_PX = DOG_BLOCK_VISUAL_SIZE_PX / BLOCK_HEIGHT;
export const DOG_BOARD_SAFE_MARGIN_PX = DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX;
/** Backward-compatible square-unit alias for layout consumers. */
export const DOG_LOGICAL_UNIT_VISUAL_SIZE_PX = DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX;

export function renderDogLegeDogGame(root: HTMLElement, state: DogLegeDogGameState): void {
  const { board } = state.level;
  const { remainingBlocks, selectableBlockIds } = state.session;
  const blocks = remainingBlocks;
  const gameRoot = root.querySelector<HTMLElement>("[data-game-content]") ?? root;
  const existingGame = gameRoot.querySelector<HTMLElement>('[data-testid="dog-game"]');
  const boardColumns = board.width / BLOCK_WIDTH;
  const boardRows = board.height / BLOCK_HEIGHT;
  const boardPixelWidth = board.width * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX;
  const boardPixelHeight = board.height * DOG_LOGICAL_UNIT_VISUAL_HEIGHT_PX;

  if (existingGame !== null) {
    updateDogLegeDogGame(
      existingGame,
      state,
      boardColumns,
      boardRows,
      boardPixelWidth,
      boardPixelHeight,
    );
    return;
  }

  gameRoot.innerHTML = `
    <section
      class="dog-game"
      data-testid="dog-game"
      data-game-id="${state.gameId}"
      data-input-locked="${state.inputLocked}"
      data-feedback="${state.feedback}"
    >
      <header class="dog-game__header">
        <div class="dog-game__level-tools">
          <div class="dog-game__level-mark" data-testid="dog-active-level" aria-label="当前关卡 ${state.level.number}">
            <span>关卡</span>
            <strong>${state.level.number}</strong>
          </div>
          <button
            class="dog-special-mechanism-button"
            type="button"
            data-action="open-special-mechanisms"
            data-testid="dog-special-mechanism-button"
            aria-haspopup="dialog"
            aria-label="查看本关特殊机制"
          >
            <span aria-hidden="true">?</span>
          </button>
        </div>
      </header>
      <div class="dog-board-frame">
        <div class="dog-board-scaler" style="--board-pixel-width: ${boardPixelWidth}px; --board-pixel-height: ${boardPixelHeight}px;">
          <div
            class="dog-board"
            data-testid="dog-board"
            data-shape="${board.shape}"
            data-surface-shape="rectangle"
            data-template-id="${board.templateId}"
            data-logical-width="${board.width}"
            data-logical-height="${board.height}"
            style="--board-columns: ${boardColumns}; --board-rows: ${boardRows}; --board-pixel-width: ${boardPixelWidth}px; --board-pixel-height: ${boardPixelHeight}px;"
            role="group"
            aria-label="第 ${state.level.number} 关矩形棋盘，${blocks.length} 个层叠方块"
          >
            ${blocks
              .map((block) =>
                renderBlock(
                  block,
                  boardPixelWidth,
                  boardPixelHeight,
                  selectableBlockIds,
                  state.inputLocked,
                  state.items?.selectedItemTargetType ?? null,
                ),
              )
              .join("")}
          </div>
        </div>
      </div>
      <div class="dog-loadout-slot" data-testid="dog-loadout-slot">${renderLoadoutArea(state)}</div>
      ${renderTray(state.session, state.feedback, state.items?.selectedItemTargetType ?? null)}
      <div class="dog-animation-layer" data-testid="dog-animation-layer"></div>
    </section>
  `;
  fitDogBoardToFrame(gameRoot);
}

function updateDogLegeDogGame(
  gameRoot: HTMLElement,
  state: DogLegeDogGameState,
  boardColumns: number,
  boardRows: number,
  boardPixelWidth: number,
  boardPixelHeight: number,
): void {
  const { board } = state.level;
  const { remainingBlocks, selectableBlockIds } = state.session;
  const boardElement = gameRoot.querySelector<HTMLElement>('[data-testid="dog-board"]');
  const boardScaler = gameRoot.querySelector<HTMLElement>(".dog-board-scaler");
  const statusElement = gameRoot.querySelector<HTMLElement>('[data-testid="dog-status"]');
  const tray = gameRoot.querySelector<HTMLElement>('[data-testid="dog-tray-region"]');
  const traySlots = tray?.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
  const loadoutSlot = gameRoot.querySelector<HTMLElement>('[data-testid="dog-loadout-slot"]');

  gameRoot.dataset.inputLocked = String(state.inputLocked);
  gameRoot.dataset.feedback = state.feedback;

  if (statusElement !== null) {
    statusElement.className = `dog-game__status dog-game__status--${state.session.status}`;
    statusElement.innerHTML = renderStatusMessage(state.session.status);
  }

  if (boardElement !== null) {
    boardElement.dataset.shape = board.shape;
    boardElement.dataset.surfaceShape = "rectangle";
    boardElement.dataset.templateId = board.templateId;
    boardElement.dataset.logicalWidth = String(board.width);
    boardElement.dataset.logicalHeight = String(board.height);
    boardElement.style.setProperty("--board-columns", String(boardColumns));
    boardElement.style.setProperty("--board-rows", String(boardRows));
    boardElement.style.setProperty("--board-pixel-width", `${boardPixelWidth}px`);
    boardElement.style.setProperty("--board-pixel-height", `${boardPixelHeight}px`);
    boardElement.setAttribute(
      "aria-label",
      `第 ${state.level.number} 关矩形棋盘，${remainingBlocks.length} 个层叠方块`,
    );
    boardElement.innerHTML = remainingBlocks
      .map((block) =>
        renderBlock(
          block,
          boardPixelWidth,
          boardPixelHeight,
          selectableBlockIds,
          state.inputLocked,
          state.items?.selectedItemTargetType ?? null,
        ),
      )
      .join("");
  }
  boardScaler?.style.setProperty("--board-pixel-width", `${boardPixelWidth}px`);
  boardScaler?.style.setProperty("--board-pixel-height", `${boardPixelHeight}px`);

  if (traySlots !== null && traySlots !== undefined) {
    traySlots.style.setProperty("--dog-tray-columns", String(state.session.trayCapacity));
    traySlots.dataset.trayCapacity = String(state.session.trayCapacity);
    traySlots.innerHTML = renderTraySlots(
      state.session,
      state.items?.selectedItemTargetType ?? null,
    );
  }

  if (loadoutSlot !== null) {
    loadoutSlot.innerHTML = renderLoadoutArea(state);
  }

  const matchEffect = tray?.querySelector<HTMLElement>('[data-testid="dog-match-effect"]');
  if (state.feedback === "match") {
    if (matchEffect === null && tray !== null && tray !== undefined) {
      tray.insertAdjacentHTML("afterbegin", renderMatchFeedback(state.feedback));
    }
  } else {
    matchEffect?.remove();
  }

  fitDogBoardToFrame(gameRoot);
}

function renderLoadoutArea(state: DogLegeDogGameState): string {
  if (state.loadoutEditor !== null) {
    return renderDogLoadoutEditor({
      mode: state.loadoutEditor.mode,
      draft: state.loadoutEditor.draft,
      current: state.loadout,
      levelNumber: state.level.number,
      confirming: state.loadoutEditor.confirming,
      itemUses: Object.fromEntries(
        DOG_ITEM_DEFINITIONS.map((item) => [item.id, getDogItemUses(state.level, item.id)]),
      ),
    });
  }

  if (state.loadout === null || state.items === null) {
    return "";
  }

  const targetType = state.items.phase === "targeting" ? state.items.selectedItemTargetType : null;
  const targetPatterns = targetType === "tray-pattern"
    ? [...new Set(state.session.tray)]
    : state.level.patternTypes;
  return renderDogLoadoutSummary(
    state.loadout,
    state.loadoutLocked,
    state.items.items,
    { targetType, patterns: targetPatterns },
  );
}

export function fitDogBoardToFrame(root: HTMLElement): void {
  const frame = root.querySelector<HTMLElement>(".dog-board-frame");
  const scaler = root.querySelector<HTMLElement>(".dog-board-scaler");
  const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
  if (frame === null || scaler === null || board === null) {
    return;
  }

  const frameStyle = getComputedStyle(frame);
  const availableWidth =
    frame.clientWidth -
    Number.parseFloat(frameStyle.paddingLeft) -
    Number.parseFloat(frameStyle.paddingRight);
  const availableHeight =
    frame.clientHeight -
    Number.parseFloat(frameStyle.paddingTop) -
    Number.parseFloat(frameStyle.paddingBottom);
  const boardOuterWidth = board.offsetWidth;
  const boardOuterHeight = board.offsetHeight;
  if (boardOuterWidth <= 0 || boardOuterHeight <= 0) {
    return;
  }
  const widthScale = availableWidth > 0 ? availableWidth / boardOuterWidth : 1;
  const heightScale = availableHeight > 0 ? availableHeight / boardOuterHeight : 1;
  const scale = Math.min(1, widthScale, heightScale);

  board.style.setProperty("--board-display-scale", String(scale));
  scaler.style.width = `${boardOuterWidth * scale}px`;
  scaler.style.height = `${boardOuterHeight * scale}px`;
}

function renderBlock(
  block: DogLegeDogLevel["blocks"][number],
  boardPixelWidth: number,
  boardPixelHeight: number,
  selectableBlockIds: readonly string[],
  inputLocked: boolean,
  itemTargetType: DogItemTargetType | null,
): string {
  const className = getDogPatternClassName(block.patternType);
  const mechanismClass = getSpecialMechanismClass(block.specialMechanism?.type);
  const mechanismAttributes = renderSpecialMechanismAttributes(block.specialMechanism);
  const blockWidth = BLOCK_WIDTH * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX;
  const blockHeight = BLOCK_HEIGHT * DOG_LOGICAL_UNIT_VISUAL_HEIGHT_PX;
  const left = clampVisualBlockPosition(
    block.x * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX,
    DOG_BOARD_SAFE_MARGIN_PX,
    boardPixelWidth - blockWidth - DOG_BOARD_SAFE_MARGIN_PX,
  );
  const top = clampVisualBlockPosition(
    block.y * DOG_LOGICAL_UNIT_VISUAL_HEIGHT_PX,
    DOG_BOARD_SAFE_MARGIN_PX,
    boardPixelHeight - blockHeight - DOG_BOARD_SAFE_MARGIN_PX,
  );
  const selectingBlockTarget = itemTargetType === "block";
  const selectable = selectingBlockTarget || (!inputLocked && selectableBlockIds.includes(block.id));
  const targetAttributes = selectingBlockTarget ? 'data-item-targetable="true"' : "";

  return `
    <button
      type="button"
      class="dog-block dog-block--${className}${mechanismClass}"
      data-testid="dog-block"
      data-block-id="${block.id}"
      data-pattern-type="${block.patternType}"
      ${mechanismAttributes}
      ${targetAttributes}
      data-x="${block.x}"
      data-y="${block.y}"
      data-z="${block.z}"
      aria-label="${selectingBlockTarget ? "选择道具目标" : "可选择方块"}"
      ${selectable ? "" : "disabled"}
      style="--block-left: ${left}px; --block-top: ${top}px; --block-width: ${blockWidth}px; --block-height: ${blockHeight}px; --block-z: ${block.z};"
    ><span class="dog-block__glyph">${renderDogPatternAsset(block.patternType)}</span></button>
  `;
}

function clampVisualBlockPosition(
  position: number,
  minPosition: number,
  maxPosition: number,
): number {
  return Math.min(Math.max(position, minPosition), maxPosition);
}

function renderTray(
  session: GameSessionSnapshot,
  feedback: DogVisualFeedback,
  itemTargetType: DogItemTargetType | null,
): string {
  return `
    <section class="dog-tray" data-testid="dog-tray-region" aria-label="暂存槽">
      ${renderMatchFeedback(feedback)}
      <ol class="dog-tray__slots" data-testid="dog-tray" data-tray-capacity="${session.trayCapacity}" style="--dog-tray-columns: ${session.trayCapacity};">${renderTraySlots(session, itemTargetType)}</ol>
      <p class="dog-game__status dog-game__status--${session.status}" data-testid="dog-status" role="status">${renderStatusMessage(session.status)}</p>
      <div class="dog-effects-layer" data-testid="dog-effects-layer">
        <canvas class="dog-effects-canvas" data-testid="dog-effects-canvas"></canvas>
      </div>
    </section>
  `;
}

interface DogSpecialMechanismPresentation {
  readonly name: string;
  readonly icon: string;
  readonly description: string;
}

const DOG_SPECIAL_MECHANISM_PRESENTATIONS: Readonly<Record<string, DogSpecialMechanismPresentation>> =
  Object.freeze({
    freeze: Object.freeze({
      name: "冻结方块",
      icon: "❄",
      description: "冻结方块进入暂存槽后暂不参与三消；其他图案完成 2 次三消后自动融化。火把可将其解冻为普通方块，万能方块可直接消除。",
    }),
  });

export function renderDogSpecialMechanismModal(level: DogLegeDogLevel): string {
  const mechanismTypes = Array.from(
    new Set(
      level.blocks
        .map((block) => block.specialMechanism?.type)
        .filter((type): type is string => type !== undefined),
    ),
  );
  const mechanismCards = mechanismTypes.length === 0
    ? `<p class="dog-special-mechanism-modal__empty" data-testid="dog-special-mechanism-empty">本关暂无特殊机制。</p>`
    : mechanismTypes.map((type) => {
      const presentation = DOG_SPECIAL_MECHANISM_PRESENTATIONS[type] ?? {
        name: type,
        icon: "✦",
        description: "本关包含特殊规则，请结合棋盘上的视觉提示操作。",
      };
      return `
        <li class="dog-special-mechanism-card" data-testid="dog-special-mechanism" data-special-mechanism="${type}">
          <span class="dog-special-mechanism-card__icon" aria-hidden="true">${presentation.icon}</span>
          <div>
            <strong>${presentation.name}</strong>
            <p>${presentation.description}</p>
          </div>
        </li>
      `;
    }).join("");

  return `
    <div class="dog-special-mechanism-modal" data-testid="dog-special-mechanism-modal" role="dialog" aria-modal="true" aria-labelledby="dog-special-mechanism-title">
      <button class="dog-special-mechanism-modal__backdrop" type="button" data-action="close-special-mechanisms" aria-label="关闭特殊机制说明"></button>
      <section class="dog-special-mechanism-modal__dialog">
        <header class="dog-special-mechanism-modal__heading">
          <div>
            <span class="dog-special-mechanism-modal__eyebrow">关卡 ${level.number}</span>
            <h2 id="dog-special-mechanism-title">本关特殊机制</h2>
            <p class="dog-special-mechanism-modal__hint">无需使用道具也可应对本关机制。</p>
          </div>
          <button class="dog-special-mechanism-modal__close" type="button" data-action="close-special-mechanisms" aria-label="关闭特殊机制说明">×</button>
        </header>
        <ul class="dog-special-mechanism-modal__list">${mechanismCards}</ul>
      </section>
    </div>
  `;
}

function renderTraySlots(
  session: GameSessionSnapshot,
  itemTargetType: DogItemTargetType | null = null,
): string {
  return Array.from({ length: session.trayCapacity }, (_, index) => {
    const block = session.trayBlocks[index];
    if (block === undefined) {
      return '<li class="dog-tray__slot" data-testid="dog-tray-slot" aria-label="空暂存槽"></li>';
    }

    const mechanismClass = getSpecialMechanismClass(block.specialMechanism?.type);
    const mechanismAttributes = renderSpecialMechanismAttributes(block.specialMechanism);
    const targetAttributes = itemTargetType === "block"
      ? 'data-item-targetable="true" role="button" tabindex="0"'
      : "";
    return `
      <li class="dog-tray__slot dog-tray__slot--filled dog-block--${getDogPatternClassName(block.patternType)}${mechanismClass}" data-testid="dog-tray-slot" data-block-id="${block.id}" data-pattern-type="${block.patternType}" ${mechanismAttributes} ${targetAttributes} aria-label="${itemTargetType === "block" ? "选择道具目标" : block.patternType}">
        <span class="dog-block__glyph">${renderDogPatternAsset(block.patternType)}</span>
      </li>
    `;
  }).join("");
}

function getSpecialMechanismClass(type: string | undefined): string {
  if (type === undefined) {
    return "";
  }

  return ` dog-block--special dog-block--special-${type.replace(/[^a-z0-9-]/gi, "-")}`;
}

function renderSpecialMechanismAttributes(
  mechanism: DogLegeDogLevel["blocks"][number]["specialMechanism"],
): string {
  if (mechanism === undefined) {
    return "";
  }

  const status = mechanism.state.status;
  const completedTriples = mechanism.state.completedTriples;
  return [
    `data-special-mechanism="${mechanism.type}"`,
    typeof status === "string" ? `data-special-mechanism-state="${status}"` : "",
    typeof completedTriples === "number"
      ? `data-special-mechanism-progress="${completedTriples}"`
      : "",
  ].filter(Boolean).join(" ");
}

function renderStatusMessage(status: GameSessionSnapshot["status"]): string {
  if (status === "won") {
    return "通关！棋盘已清空。";
  }

  if (status === "lost") {
    return "失败！暂存槽已满。";
  }

  return "";
}

function renderMatchFeedback(feedback: DogVisualFeedback): string {
  if (feedback !== "match") {
    return "";
  }

  return `
    <div class="dog-match-effect" data-testid="dog-match-effect" role="status" aria-label="三消成功">
      <span class="dog-match-effect__ring"></span>
      ${Array.from({ length: 8 }, (_, index) => `<span class="dog-match-effect__spark dog-match-effect__spark--${index + 1}"></span>`).join("")}
    </div>
  `;
}
