import { GAME_ID } from "../../progress-store";
import {
  FIRST_LEVEL,
  FIRST_LEVEL_PATTERN_TYPES,
  type DogLegeDogLevel,
  type DogPatternType,
} from "./first-level";

export {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  FIRST_LEVEL,
  FIRST_LEVEL_GENERATOR_VERSION,
  FIRST_LEVEL_MAX_LAYERS,
  FIRST_LEVEL_NUMBER,
  FIRST_LEVEL_PATTERN_TYPES,
  FIRST_LEVEL_SEED,
} from "./first-level";
export type { DogBlock, DogBoard, DogLegeDogLevel, DogPatternType } from "./first-level";

export interface DogLegeDogGameState {
  readonly gameId: typeof GAME_ID;
  readonly status: "ready";
  readonly level: DogLegeDogLevel;
}

export interface DogLegeDogGame {
  start(): DogLegeDogGameState;
  getState(): DogLegeDogGameState;
  destroy(): void;
}

interface PatternPresentation {
  readonly className: string;
  readonly accent: string;
  readonly marker: string;
}

const PATTERN_PRESENTATIONS: Record<DogPatternType, PatternPresentation> = {
  打工狗: {
    className: "working-dog",
    accent: "#ee8069",
    marker: '<rect x="17" y="35" width="14" height="7" rx="2" fill="#183b48"/><path d="M20 35c0-4 8-4 8 0" fill="none" stroke="#183b48" stroke-width="2"/>',
  },
  单身狗: {
    className: "single-dog",
    accent: "#ffc966",
    marker: '<path d="M24 42c-7-4-8-8-5-10 2-1 4 0 5 2 1-2 3-3 5-2 3 2 2 6-5 10Z" fill="#ee8069"/>',
  },
  舔狗: {
    className: "licking-dog",
    accent: "#76b89a",
    marker: '<path d="M24 31v8c0 4-6 4-6 0 0-2 2-3 6-3Z" fill="#ee8069"/>',
  },
  看门狗: {
    className: "guard-dog",
    accent: "#6c9dc4",
    marker: '<path d="m24 34 8 3-2 6h-12l-2-6 8-3Z" fill="#183b48"/><path d="M24 36v5" stroke="#ffc966" stroke-width="2"/>',
  },
};

export function createDogLegeDogGame(root: HTMLElement): DogLegeDogGame {
  const state: DogLegeDogGameState = {
    gameId: GAME_ID,
    status: "ready",
    level: FIRST_LEVEL,
  };
  let started = false;
  let destroyed = false;

  return {
    start(): DogLegeDogGameState {
      if (destroyed) {
        throw new Error("Cannot start a destroyed 狗了个狗 game");
      }

      if (!started) {
        renderGame(root, state);
        started = true;
      }

      return cloneState(state);
    },

    getState(): DogLegeDogGameState {
      return cloneState(state);
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      root.replaceChildren();
      destroyed = true;
    },
  };
}

export function startDogLegeDogGame(root: HTMLElement): DogLegeDogGame {
  const game = createDogLegeDogGame(root);
  game.start();
  return game;
}

function renderGame(root: HTMLElement, state: DogLegeDogGameState): void {
  const { board, blocks } = state.level;
  const boardColumns = board.width / blocks[0].width;
  const boardRows = board.height / blocks[0].height;

  root.innerHTML = `
    <section class="dog-game" data-testid="dog-game" data-game-id="${state.gameId}">
      <header class="dog-game__header">
        <div>
          <p class="eyebrow">固定首关 · ${state.level.seed}</p>
          <h2>第 ${state.level.number} 关</h2>
        </div>
        <dl class="dog-game__stats">
          <div><dt>方块</dt><dd>${blocks.length}</dd></div>
          <div><dt>图案</dt><dd>${FIRST_LEVEL_PATTERN_TYPES.length} 种</dd></div>
          <div><dt>层数</dt><dd>${state.level.maxLayers} 层</dd></div>
        </dl>
      </header>
      <div class="dog-board-frame">
        <div
          class="dog-board"
          data-testid="dog-board"
          data-shape="${board.shape}"
          data-logical-width="${board.width}"
          data-logical-height="${board.height}"
          style="--board-columns: ${boardColumns}; --board-rows: ${boardRows};"
          role="img"
          aria-label="第 ${state.level.number} 关矩形棋盘，${blocks.length} 个层叠方块"
        >
          ${blocks.map((block) => renderBlock(block, boardColumns, boardRows)).join("")}
        </div>
      </div>
      <p class="dog-game__hint">首关棋盘已准备好。下一步将加入选择方块与三消规则。</p>
    </section>
  `;
}

function renderBlock(
  block: DogLegeDogLevel["blocks"][number],
  boardColumns: number,
  boardRows: number,
): string {
  const presentation = PATTERN_PRESENTATIONS[block.patternType];
  const gridX = block.x / block.width;
  const gridY = block.y / block.height;
  const blockWidth = 100 / boardColumns;
  const blockHeight = 100 / boardRows;

  return `
    <span
      class="dog-block dog-block--${presentation.className}"
      data-testid="dog-block"
      data-block-id="${block.id}"
      data-pattern-type="${block.patternType}"
      data-x="${block.x}"
      data-y="${block.y}"
      data-z="${block.z}"
      style="--block-left: ${gridX * blockWidth}%; --block-top: ${gridY * blockHeight}%; --block-width: ${blockWidth}%; --block-height: ${blockHeight}%; --block-z: ${block.z};"
      aria-hidden="true"
    ><span class="dog-block__glyph">${renderPatternAsset(presentation)}</span></span>
  `;
}

function renderPatternAsset(presentation: PatternPresentation): string {
  return `
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true" focusable="false">
      <path d="M11 18 8 7l10 6c4-2 8-2 12 0l10-6-3 11c2 3 3 7 3 11 0 9-7 14-16 14S8 38 8 29c0-4 1-8 3-11Z" fill="${presentation.accent}"/>
      <path d="M13 25c0-5 5-9 11-9s11 4 11 9v7c0 5-5 8-11 8s-11-3-11-8Z" fill="#fff3d7"/>
      <circle cx="19" cy="26" r="2" fill="#183b48"/><circle cx="29" cy="26" r="2" fill="#183b48"/>
      <path d="M21 32c2 2 4 2 6 0" fill="none" stroke="#183b48" stroke-width="2" stroke-linecap="round"/>
      ${presentation.marker}
    </svg>
  `;
}

function cloneState(state: DogLegeDogGameState): DogLegeDogGameState {
  return {
    gameId: state.gameId,
    status: state.status,
    level: {
      ...state.level,
      board: { ...state.level.board },
      patternTypes: [...state.level.patternTypes],
      blocks: state.level.blocks.map((block) => ({ ...block })),
    },
  };
}
