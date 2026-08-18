import type { DogLegeDogLevel } from "../levels/first-level";
import { getDogPatternClassName, renderDogPatternAsset } from "../assets/game-assets";
import type { GameSessionSnapshot } from "./game-session";
import type { DogLegeDogGameState, DogVisualFeedback } from "./game-types";
import type { DogBoard } from "../levels/level-types";

export function renderDogLegeDogGame(root: HTMLElement, state: DogLegeDogGameState): void {
  const { board } = state.level;
  const { remainingBlocks, selectableBlockIds } = state.session;
  const blocks = remainingBlocks;
  const gameRoot = root.querySelector<HTMLElement>("[data-game-content]") ?? root;
  const blockSize = state.level.blocks[0];
  const boardColumns = board.width / blockSize.width;
  const boardRows = board.height / blockSize.height;
  const boardClipPath = renderBoardClipPath(board);

  gameRoot.innerHTML = `
    <section
      class="dog-game"
      data-testid="dog-game"
      data-game-id="${state.gameId}"
      data-input-locked="${state.inputLocked}"
      data-feedback="${state.feedback}"
    >
      <header class="dog-game__header">
        <div class="dog-game__level-mark" data-testid="dog-active-level" aria-label="当前关卡 ${state.level.number}">
          <span>关卡</span>
          <strong>${state.level.number}</strong>
        </div>
        ${state.level.number === 1 ? "" : `
          <dl class="dog-game__stats">
            <div><dt>剩余方块</dt><dd>${blocks.length}</dd></div>
            <div><dt>图案</dt><dd>${state.level.patternTypes.length} 种</dd></div>
            <div><dt>层数</dt><dd>${state.level.maxLayers} 层</dd></div>
          </dl>
        `}
      </header>
      <p class="dog-game__status dog-game__status--${state.session.status}" data-testid="dog-status" role="status">
        ${renderStatusMessage(state.session.status)}
      </p>
      ${renderFeedback(state.feedback)}
      <div class="dog-board-frame">
        <div
          class="dog-board"
          data-testid="dog-board"
          data-shape="${board.shape}"
          data-template-id="${board.templateId}"
          data-logical-width="${board.width}"
          data-logical-height="${board.height}"
          style="--board-columns: ${boardColumns}; --board-rows: ${boardRows}; clip-path: polygon(${boardClipPath});"
          role="group"
          aria-label="第 ${state.level.number} 关不规则形棋盘，${blocks.length} 个层叠方块"
        >
          ${blocks
            .map((block) => renderBlock(block, boardColumns, boardRows, selectableBlockIds, state.inputLocked))
            .join("")}
        </div>
      </div>
      ${renderTray(state.session)}
      <div class="dog-effects-layer" data-testid="dog-effects-layer">
        <canvas class="dog-effects-canvas" data-testid="dog-effects-canvas"></canvas>
      </div>
      <div class="dog-animation-layer" data-testid="dog-animation-layer"></div>
    </section>
  `;
}

interface BoardPoint {
  readonly x: number;
  readonly y: number;
}

function renderBoardClipPath(board: DogBoard): string {
  const rowBounds = new Map<number, { minX: number; maxX: number }>();
  for (const cell of board.playableCells) {
    const current = rowBounds.get(cell.y);
    if (current === undefined) {
      rowBounds.set(cell.y, { minX: cell.x, maxX: cell.x });
      continue;
    }

    current.minX = Math.min(current.minX, cell.x);
    current.maxX = Math.max(current.maxX, cell.x);
  }

  const rows = [...rowBounds.entries()].sort(([firstY], [secondY]) => firstY - secondY);
  const points: BoardPoint[] = [];
  for (const [y, bounds] of rows) {
    points.push({ x: bounds.maxX + 1, y });
    points.push({ x: bounds.maxX + 1, y: y + 1 });
  }
  for (const [y, bounds] of [...rows].reverse()) {
    points.push({ x: bounds.minX, y: y + 1 });
    points.push({ x: bounds.minX, y });
  }

  return simplifyPolygon(points)
    .map((point) => `${((point.x / board.width) * 100).toFixed(3)}% ${((point.y / board.height) * 100).toFixed(3)}%`)
    .join(", ");
}

function simplifyPolygon(points: readonly BoardPoint[]): readonly BoardPoint[] {
  const simplified: BoardPoint[] = [];
  for (const point of points) {
    const previous = simplified.at(-1);
    if (previous?.x === point.x && previous.y === point.y) {
      continue;
    }
    simplified.push(point);
  }

  let changed = true;
  while (changed && simplified.length > 2) {
    changed = false;
    for (let index = 0; index < simplified.length; index += 1) {
      const previous = simplified[(index - 1 + simplified.length) % simplified.length];
      const current = simplified[index];
      const next = simplified[(index + 1) % simplified.length];
      if (
        (previous.x === current.x && current.x === next.x) ||
        (previous.y === current.y && current.y === next.y)
      ) {
        simplified.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return simplified;
}

function renderBlock(
  block: DogLegeDogLevel["blocks"][number],
  boardColumns: number,
  boardRows: number,
  selectableBlockIds: readonly string[],
  inputLocked: boolean,
): string {
  const className = getDogPatternClassName(block.patternType);
  const gridX = block.x / block.width;
  const gridY = block.y / block.height;
  const blockWidth = 100 / boardColumns;
  const blockHeight = 100 / boardRows;
  const selectable = !inputLocked && selectableBlockIds.includes(block.id);

  return `
    <button
      type="button"
      class="dog-block dog-block--${className}"
      data-testid="dog-block"
      data-block-id="${block.id}"
      data-pattern-type="${block.patternType}"
      data-x="${block.x}"
      data-y="${block.y}"
      data-z="${block.z}"
      aria-label="可选择方块"
      ${selectable ? "" : "disabled"}
      style="--block-left: ${gridX * blockWidth}%; --block-top: ${gridY * blockHeight}%; --block-width: ${blockWidth}%; --block-height: ${blockHeight}%; --block-z: ${block.z};"
    ><span class="dog-block__glyph">${renderDogPatternAsset(block.patternType)}</span></button>
  `;
}

function renderTray(session: GameSessionSnapshot): string {
  const slots = Array.from({ length: session.trayCapacity }, (_, index) => {
    const patternType = session.tray[index];
    if (patternType === undefined) {
      return '<li class="dog-tray__slot" data-testid="dog-tray-slot" aria-label="空暂存槽"></li>';
    }

    return `
      <li class="dog-tray__slot dog-tray__slot--filled dog-block--${getDogPatternClassName(patternType)}" data-testid="dog-tray-slot" data-pattern-type="${patternType}" aria-label="${patternType}">
        <span class="dog-block__glyph">${renderDogPatternAsset(patternType)}</span>
      </li>
    `;
  }).join("");

  return `
    <section class="dog-tray" aria-label="暂存槽">
      <div class="dog-tray__heading">
        <h3>暂存槽</h3>
        <span>${session.tray.length}/${session.trayCapacity}</span>
      </div>
      <ol class="dog-tray__slots" data-testid="dog-tray">${slots}</ol>
    </section>
  `;
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

function renderFeedback(feedback: DogVisualFeedback): string {
  if (feedback === "idle") {
    return "";
  }

  const messages: Record<Exclude<DogVisualFeedback, "idle">, string> = {
    match: "三消！",
    won: "通关反馈",
    lost: "失败反馈",
  };
  return `<p class="dog-feedback dog-feedback--${feedback}" data-testid="dog-feedback">${messages[feedback]}</p>`;
}
