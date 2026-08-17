import type { GameLaunchContext, GameResult } from "../../catalog";
import { GAME_ID } from "../../progress-store";
import {
  FIRST_LEVEL,
  type DogLegeDogLevel,
  type DogPatternType,
} from "./first-level";
import { getDogLegeDogLevel } from "./level-provider";
import {
  animateBlockFlight,
  type CancellableAnimation,
} from "./animation-effects";
import { GameSession, type GameSessionSnapshot } from "./game-session";
import { createParticleEffects, type ParticleEffect } from "./particle-effects";
import { createSoundEffects } from "./sound-effects";
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
} from "./first-level";
export { getDogLegeDogLevel } from "./level-provider";
export type {
  DogBlock,
  DogBoard,
  DogBoardCell,
  DogBoardShape,
  DogDifficultyRange,
  DogDifficultyTarget,
  DogLevelDifficulty,
  DogLevelGeneration,
  DogLevelGenerationFailure,
  DogLevelReplay,
  DogLevelReplayMode,
  DogLegeDogLevel,
  DogPatternType,
} from "./first-level";

export {
  DEFAULT_LEVEL_GENERATOR,
  DEFAULT_LEVEL_REWARD,
  DEFAULT_LEVEL_SEED,
  DOG_GAME_ID,
  DOG_SHAPE_TEMPLATES,
  calculateDifficultyMetrics,
  findSolvablePath,
  getDifficultyTarget,
  getLevelDifficultyMetrics,
  LEVEL_GENERATOR_VERSION,
  MAX_LEVEL_GENERATION_ATTEMPTS,
  LevelGenerator,
  generateDogLegeDogLevel,
  getBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  getShapePool,
  isDifficultyWithinTarget,
  isLevelSolvable,
  type LevelCandidateFilter,
  replayDogLegeDogLevel,
  replayDogLegeDogLevelAttempt,
  type DogShapeTemplate,
  type LevelGeneratorOptions,
  type LevelGeneratorRequest,
} from "./level-generator";

export interface DogLegeDogGameState {
  readonly gameId: typeof GAME_ID;
  readonly status: "ready" | GameSessionSnapshot["status"];
  readonly level: DogLegeDogLevel;
  readonly session: GameSessionSnapshot;
  readonly inputLocked: boolean;
  readonly feedback: DogVisualFeedback;
  readonly soundEnabled: boolean;
  readonly debug: {
    readonly elapsedMs: number;
  };
}

export type DogVisualFeedback = "idle" | "match" | "won" | "lost";

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

interface BlockSelectionOptions {
  readonly animate: boolean;
  readonly initializeAudio: boolean;
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
  let inputLocked = false;
  let feedback: DogVisualFeedback = "idle";
  let soundEnabled = options.soundEnabled ?? true;
  let resultConfirmed = false;
  let resultPresented = false;
  let startedAt: number | null = null;
  let endedAt: number | null = null;
  let activeFlight: CancellableAnimation | null = null;
  let feedbackVersion = 0;
  const soundEffects = createSoundEffects(soundEnabled);
  const particleEffects = createParticleEffects(root);

  const selectBlock = (blockId: string): GameSessionSnapshot => {
    if (destroyed) {
      throw new Error("Cannot select a block in a destroyed 狗了个狗 game");
    }

    return commitBlockSelection(blockId, {
      animate: true,
      initializeAudio: true,
    });
  };

  function commitBlockSelection(
    blockId: string,
    selectionOptions: BlockSelectionOptions,
  ): GameSessionSnapshot {
    if (inputLocked) {
      return session.getState();
    }

    if (selectionOptions.initializeAudio) {
      soundEffects.initialize();
    }

    const previousState = session.getState();
    const sourceElement = findBlockElement(root, blockId);
    const sourceRect = sourceElement?.getBoundingClientRect() ?? null;
    const patternMarkup = sourceElement?.querySelector<HTMLElement>(".dog-block__glyph")?.outerHTML ?? "";
    const patternType = sourceElement?.dataset.patternType;
    const canSelect = session.canSelectBlock(blockId);
    const nextState = session.selectBlock(blockId);
    if (!canSelect) {
      return nextState;
    }

    hasInteracted = true;
    const didMatch = nextState.tray.length < previousState.tray.length;
    const result = createResult(level, nextState.status);
    const selectionVersion = feedbackVersion + 1;
    feedbackVersion = selectionVersion;
    if (result !== null) {
      endedAt = Date.now();
      confirmResult(result, !selectionOptions.animate || !started);
    }

    if (!selectionOptions.animate || !started) {
      soundEffects.play("select");
      playFeedbackSounds(didMatch, result);
      feedback = "idle";
      inputLocked = false;
      renderStartedGame();
      if (result !== null) {
        presentResult(result);
      }
      return nextState;
    }

    inputLocked = true;
    feedback = didMatch ? "match" : result?.status ?? "idle";
    soundEffects.play("select");
    playFeedbackSounds(didMatch, result);
    renderStartedGame();

    const target = findTrayTarget(root, patternType);
    const flight = animateBlockFlight({
      root,
      patternMarkup,
      source: sourceRect,
      target: target?.getBoundingClientRect() ?? null,
    });
    activeFlight = flight;
    void finishAnimatedSelection(flight, feedback, result, didMatch, selectionVersion);

    return nextState;
  }

  async function finishAnimatedSelection(
    flight: CancellableAnimation,
    selectionFeedback: DogVisualFeedback,
    result: GameResult | null,
    didMatch: boolean,
    selectionVersion: number,
  ): Promise<void> {
    await flight.promise;
    if (destroyed || activeFlight !== flight) {
      return;
    }

    activeFlight = null;
    if (result !== null) {
      if (didMatch) {
        await playParticleFeedback("match");
        if (destroyed) {
          return;
        }
        feedback = "won";
        renderStartedGame();
      }

      await playParticleFeedback(result.status);
      if (destroyed) {
        return;
      }
      inputLocked = false;
      feedback = "idle";
      renderStartedGame();
      presentResult(result);
      return;
    }

    inputLocked = false;
    renderStartedGame();
    if (isParticleFeedback(selectionFeedback)) {
      void playParticleFeedback(selectionFeedback).then(() => {
        if (
          !destroyed &&
          feedbackVersion === selectionVersion &&
          activeFlight === null &&
          feedback === selectionFeedback
        ) {
          feedback = "idle";
          renderStartedGame();
        }
      });
    }
  }

  async function playParticleFeedback(effect: ParticleEffect): Promise<void> {
    await particleEffects.play(effect);
  }

  function confirmResult(result: GameResult, presentImmediately: boolean): void {
    if (resultConfirmed) {
      return;
    }

    resultConfirmed = true;
    options.onResultConfirmed?.(result);
    if (options.onResultConfirmed === undefined && presentImmediately) {
      presentResult(result);
    }
  }

  function presentResult(result: GameResult): void {
    if (resultPresented) {
      return;
    }

    resultPresented = true;
    options.onResult?.(result);
  }

  function renderStartedGame(): void {
    if (started) {
      renderGame(
        root,
        createGameState(
          session,
          hasInteracted,
          inputLocked,
          feedback,
          soundEnabled,
          getElapsedMs(startedAt, endedAt),
        ),
      );
    }
  }

  function playFeedbackSounds(didMatch: boolean, result: GameResult | null): void {
    if (didMatch) {
      soundEffects.play("match");
    }
    if (result !== null) {
      soundEffects.play(result.status);
    }
  }

  const handlePointerUp = (event: Event): void => {
    const blockId = getBlockId(event);
    if (blockId === undefined) {
      return;
    }

    event.preventDefault();
    commitBlockSelection(blockId, {
      animate: true,
      initializeAudio: true,
    });
  };

  const handleClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (actionElement?.dataset.action === "toggle-sound") {
      soundEffects.initialize();
      soundEnabled = !soundEnabled;
      soundEffects.setEnabled(soundEnabled);
      options.onSoundToggle?.(soundEnabled);
      renderStartedGame();
      return;
    }

    const eventDetail = "detail" in event && typeof event.detail === "number" ? event.detail : 0;
    if (eventDetail > 0) {
      return;
    }

    const blockId = getBlockId(event);
    if (blockId !== undefined) {
      commitBlockSelection(blockId, {
        animate: false,
        initializeAudio: true,
      });
    }
  };

  root.addEventListener("pointerup", handlePointerUp);
  root.addEventListener("click", handleClick);

  return {
    start(): DogLegeDogGameState {
      if (destroyed) {
        throw new Error("Cannot start a destroyed 狗了个狗 game");
      }

      if (!started) {
        startedAt = Date.now();
        renderGame(
          root,
          createGameState(
            session,
            hasInteracted,
            inputLocked,
            feedback,
            soundEnabled,
            getElapsedMs(startedAt, endedAt),
          ),
        );
        started = true;
      }

      return createGameState(
        session,
        hasInteracted,
        inputLocked,
        feedback,
        soundEnabled,
        getElapsedMs(startedAt, endedAt),
      );
    },

    getState(): DogLegeDogGameState {
      return createGameState(
        session,
        hasInteracted,
        inputLocked,
        feedback,
        soundEnabled,
        getElapsedMs(startedAt, endedAt),
      );
    },

    selectBlock(blockId: string): GameSessionSnapshot {
      return selectBlock(blockId);
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      activeFlight?.cancel();
      activeFlight = null;
      particleEffects.destroy();
      soundEffects.destroy();
      root.removeEventListener("pointerup", handlePointerUp);
      root.removeEventListener("click", handleClick);
      root.replaceChildren();
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
    <section
      class="dog-game"
      data-testid="dog-game"
      data-game-id="${state.gameId}"
      data-input-locked="${state.inputLocked}"
      data-feedback="${state.feedback}"
    >
      <header class="dog-game__header">
        <div>
          <p class="eyebrow">${state.level.number === FIRST_LEVEL.number ? "固定首关" : "稳定关卡"} · ${state.level.seed}</p>
          <h2>第 ${state.level.number} 关</h2>
        </div>
        <div class="dog-game__tools">
          <button
            class="sound-button"
            type="button"
            data-action="toggle-sound"
            data-sound-enabled="${state.soundEnabled}"
          >
            <span>${state.soundEnabled ? "♫" : "∅"}</span>
            ${state.soundEnabled ? "音效开启" : "音效关闭"}
          </button>
          <dl class="dog-game__stats">
            <div><dt>剩余方块</dt><dd>${blocks.length}</dd></div>
            <div><dt>图案</dt><dd>${state.level.patternTypes.length} 种</dd></div>
            <div><dt>层数</dt><dd>${state.level.maxLayers} 层</dd></div>
          </dl>
        </div>
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
          style="--board-columns: ${boardColumns}; --board-rows: ${boardRows};"
          role="img"
          aria-label="第 ${state.level.number} 关${renderShapeLabel(board.shape)}棋盘，${blocks.length} 个层叠方块"
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
  inputLocked: boolean,
): string {
  const presentation = PATTERN_PRESENTATIONS[block.patternType];
  const gridX = block.x / block.width;
  const gridY = block.y / block.height;
  const blockWidth = 100 / boardColumns;
  const blockHeight = 100 / boardRows;
  const selectable = !inputLocked && selectableBlockIds.includes(block.id);

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

function createGameState(
  session: GameSession,
  hasInteracted: boolean,
  inputLocked: boolean,
  feedback: DogVisualFeedback,
  soundEnabled: boolean,
  elapsedMs: number,
): DogLegeDogGameState {
  const sessionState = session.getState();

  return {
    gameId: GAME_ID,
    status: sessionState.status === "playing" && !hasInteracted ? "ready" : sessionState.status,
    level: sessionState.level,
    session: sessionState,
    inputLocked,
    feedback,
    soundEnabled,
    debug: { elapsedMs },
  };
}

function createResult(
  level: DogLegeDogLevel,
  status: GameSessionSnapshot["status"],
): GameResult | null {
  if (status !== "won" && status !== "lost") {
    return null;
  }

  return {
    gameId: GAME_ID,
    levelNumber: level.number,
    status,
    reward: status === "won" ? level.reward : 0,
  };
}

function isParticleFeedback(feedback: DogVisualFeedback): feedback is ParticleEffect {
  return feedback !== "idle";
}

function findBlockElement(root: HTMLElement, blockId: string): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>('[data-testid="dog-block"]')].find(
    (block) => block.dataset.blockId === blockId,
  ) ?? null;
}

function findTrayTarget(root: HTMLElement, patternType: string | undefined): HTMLElement | null {
  const slots = [...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"]')];
  return (
    slots.find((slot) => patternType !== undefined && slot.dataset.patternType === patternType) ??
    slots.find((slot) => slot.dataset.patternType === undefined) ??
    slots[0] ??
    null
  );
}

function getBlockId(event: Event): string | undefined {
  const target = event.target;
  if (!(target instanceof Element)) {
    return undefined;
  }

  return target.closest<HTMLElement>('[data-testid="dog-block"]')?.dataset.blockId;
}

function getElapsedMs(startedAt: number | null, endedAt: number | null): number {
  if (startedAt === null || endedAt === null) {
    return 0;
  }

  return Math.max(0, endedAt - startedAt);
}
