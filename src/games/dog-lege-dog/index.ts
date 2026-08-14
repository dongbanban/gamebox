import type { GameLaunchContext, GameResult } from "../../catalog";
import { GAME_ID } from "../../progress-store";
import {
  FIRST_LEVEL,
  getDogLegeDogLevel,
  type DogLegeDogLevel,
  type DogPatternType,
} from "./first-level";
import { GameSession, type GameSessionSnapshot } from "./game-session";
export {
  GAME_SESSION_TRAY_CAPACITY,
  GameSession,
  type GameSessionOptions,
  type GameSessionSnapshot,
  type GameSessionStatus,
} from "./game-session";

export {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_PATTERN_TYPES,
  FIRST_LEVEL,
  FIRST_LEVEL_GENERATOR_VERSION,
  FIRST_LEVEL_MAX_LAYERS,
  FIRST_LEVEL_NUMBER,
  FIRST_LEVEL_PATTERN_TYPES,
  FIRST_LEVEL_REWARD,
  FIRST_LEVEL_SEED,
  getDogLegeDogLevel,
} from "./first-level";
export type {
  DogBlock,
  DogBoard,
  DogBoardCell,
  DogBoardShape,
  DogLegeDogLevel,
  DogPatternType,
} from "./first-level";

export {
  DEFAULT_LEVEL_GENERATOR,
  DEFAULT_LEVEL_REWARD,
  DEFAULT_LEVEL_SEED,
  DOG_GAME_ID,
  DOG_SHAPE_TEMPLATES,
  LEVEL_GENERATOR_VERSION,
  LevelGenerator,
  generateDogLegeDogLevel,
  getBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  getShapePool,
  type DogShapeTemplate,
  type LevelGeneratorOptions,
  type LevelGeneratorRequest,
} from "./level-generator";

export interface DogLegeDogGameState {
  readonly gameId: typeof GAME_ID;
  readonly status: "ready" | GameSessionSnapshot["status"];
  readonly level: DogLegeDogLevel;
  readonly session: GameSessionSnapshot;
}

export interface DogLegeDogGame {
  start(): DogLegeDogGameState;
  getState(): DogLegeDogGameState;
  selectBlock(blockId: string): GameSessionSnapshot;
  destroy(): void;
}

export type DogLegeDogGameOptions = GameLaunchContext;

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
  疯狗: {
    className: "mad-dog",
    accent: "#d47bd0",
    marker: '<path d="M17 36 21 32l3 4 3-4 4 4-7 5Z" fill="#183b48"/>',
  },
  拆家狗: {
    className: "destructive-dog",
    accent: "#e8a15b",
    marker: '<path d="m17 35 5-3 2 3 2-3 5 3-2 7H19Z" fill="#183b48"/>',
  },
  龇牙狗: {
    className: "snarling-dog",
    accent: "#a8c86e",
    marker: '<path d="M17 33c4 4 10 4 14 0v7H17Z" fill="#fffdf8" stroke="#183b48" stroke-width="1.5"/>',
  },
  社恐狗: {
    className: "shy-dog",
    accent: "#a5a6d8",
    marker: '<path d="M17 35h14v7H17Z" fill="#183b48" opacity=".8"/>',
  },
  吃货狗: {
    className: "foodie-dog",
    accent: "#f0bd68",
    marker: '<circle cx="24" cy="37" r="6" fill="#183b48"/><circle cx="22" cy="35" r="1.5" fill="#fff3d7"/>',
  },
  傻狗: {
    className: "silly-dog",
    accent: "#8ec5c7",
    marker: '<path d="M18 34c4 3 8 3 12 0l-2 8H20Z" fill="#183b48"/>',
  },
};

export function createDogLegeDogGame(
  root: HTMLElement,
  options: DogLegeDogGameOptions = {},
): DogLegeDogGame {
  const level = getDogLegeDogLevel(options.levelNumber ?? FIRST_LEVEL.number);
  const session = new GameSession(level);
  let started = false;
  let destroyed = false;
  let hasInteracted = false;
  let resultReported = false;

  const selectBlock = (blockId: string): GameSessionSnapshot => {
    if (destroyed) {
      throw new Error("Cannot select a block in a destroyed 狗了个狗 game");
    }

    const canSelect = session.canSelectBlock(blockId);
    const nextState = session.selectBlock(blockId);
    if (canSelect) {
      hasInteracted = true;
    }

    if (started) {
      renderGame(root, createGameState(session, hasInteracted));
    }

    reportResult(nextState.status);

    return nextState;
  };

  function reportResult(status: GameSessionSnapshot["status"]): void {
    if (resultReported || (status !== "won" && status !== "lost")) {
      return;
    }

    resultReported = true;
    const result: GameResult = {
      gameId: GAME_ID,
      levelNumber: level.number,
      status,
      reward: status === "won" ? level.reward : 0,
    };
    options.onResult?.(result);
  }

  const handleBlockClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const block = target.closest<HTMLElement>('[data-testid="dog-block"]');
    const blockId = block?.dataset.blockId;
    if (blockId !== undefined) {
      selectBlock(blockId);
    }
  };

  root.addEventListener("click", handleBlockClick);

  return {
    start(): DogLegeDogGameState {
      if (destroyed) {
        throw new Error("Cannot start a destroyed 狗了个狗 game");
      }

      if (!started) {
        renderGame(root, createGameState(session, hasInteracted));
        started = true;
      }

      return createGameState(session, hasInteracted);
    },

    getState(): DogLegeDogGameState {
      return createGameState(session, hasInteracted);
    },

    selectBlock(blockId: string): GameSessionSnapshot {
      return selectBlock(blockId);
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      root.removeEventListener("click", handleBlockClick);
      root.replaceChildren();
      destroyed = true;
    },
  };
}

export function startDogLegeDogGame(
  root: HTMLElement,
  options: DogLegeDogGameOptions = {},
): DogLegeDogGame {
  const game = createDogLegeDogGame(root, options);
  game.start();
  return game;
}

function renderGame(root: HTMLElement, state: DogLegeDogGameState): void {
  const { board } = state.level;
  const { remainingBlocks, selectableBlockIds } = state.session;
  const blocks = remainingBlocks;
  const blockSize = state.level.blocks[0];
  const boardColumns = board.width / blockSize.width;
  const boardRows = board.height / blockSize.height;

  root.innerHTML = `
    <section class="dog-game" data-testid="dog-game" data-game-id="${state.gameId}">
      <header class="dog-game__header">
        <div>
            <p class="eyebrow">${state.level.number === FIRST_LEVEL.number ? "固定首关" : "稳定关卡"} · ${state.level.seed}</p>
          <h2>第 ${state.level.number} 关</h2>
        </div>
        <dl class="dog-game__stats">
          <div><dt>剩余方块</dt><dd>${blocks.length}</dd></div>
          <div><dt>图案</dt><dd>${state.level.patternTypes.length} 种</dd></div>
          <div><dt>层数</dt><dd>${state.level.maxLayers} 层</dd></div>
        </dl>
      </header>
      <p class="dog-game__status dog-game__status--${state.session.status}" data-testid="dog-status" role="status">
        ${renderStatusMessage(state.session.status)}
      </p>
      <div class="dog-board-frame">
        <div
          class="dog-board"
          data-testid="dog-board"
          data-shape="${board.shape}"
          data-template-id="${board.templateId}"
          data-logical-width="${board.width}"
          data-logical-height="${board.height}"
          style="--board-columns: ${boardColumns}; --board-rows: ${boardRows};"
          role="img"
          aria-label="第 ${state.level.number} 关${renderShapeLabel(board.shape)}棋盘，${blocks.length} 个层叠方块"
        >
          ${blocks.map((block) => renderBlock(block, boardColumns, boardRows, selectableBlockIds)).join("")}
        </div>
      </div>
      ${renderTray(state.session)}
    </section>
  `;
}

function renderShapeLabel(shape: DogLegeDogLevel["board"]["shape"]): string {
  const labels: Record<DogLegeDogLevel["board"]["shape"], string> = {
    rectangle: "长方形",
    star: "五角星形",
    heart: "爱心形",
    irregular: "不规则形",
  };
  return labels[shape];
}

function renderBlock(
  block: DogLegeDogLevel["blocks"][number],
  boardColumns: number,
  boardRows: number,
  selectableBlockIds: readonly string[],
): string {
  const presentation = PATTERN_PRESENTATIONS[block.patternType];
  const gridX = block.x / block.width;
  const gridY = block.y / block.height;
  const blockWidth = 100 / boardColumns;
  const blockHeight = 100 / boardRows;
  const selectable = selectableBlockIds.includes(block.id);

  return `
    <button
      type="button"
      class="dog-block dog-block--${presentation.className}"
      data-testid="dog-block"
      data-block-id="${block.id}"
      data-pattern-type="${block.patternType}"
      data-x="${block.x}"
      data-y="${block.y}"
      data-z="${block.z}"
      aria-label="可选择方块"
      ${selectable ? "" : "disabled"}
      style="--block-left: ${gridX * blockWidth}%; --block-top: ${gridY * blockHeight}%; --block-width: ${blockWidth}%; --block-height: ${blockHeight}%; --block-z: ${block.z};"
    ><span class="dog-block__glyph">${renderPatternAsset(presentation)}</span></button>
  `;
}

function renderTray(session: GameSessionSnapshot): string {
  const slots = Array.from({ length: session.trayCapacity }, (_, index) => {
    const patternType = session.tray[index];
    if (patternType === undefined) {
      return '<li class="dog-tray__slot" data-testid="dog-tray-slot" aria-label="空暂存槽"></li>';
    }

    const presentation = PATTERN_PRESENTATIONS[patternType];
    return `
      <li class="dog-tray__slot dog-tray__slot--filled" data-testid="dog-tray-slot" data-pattern-type="${patternType}" aria-label="${patternType}">
        <span class="dog-block__glyph">${renderPatternAsset(presentation)}</span>
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

  return "选择没有遮挡的方块，凑齐三个相同图案。";
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

function createGameState(session: GameSession, hasInteracted: boolean): DogLegeDogGameState {
  const sessionState = session.getState();

  return {
    gameId: GAME_ID,
    status: sessionState.status === "playing" && !hasInteracted ? "ready" : sessionState.status,
    level: sessionState.level,
    session: sessionState,
  };
}
