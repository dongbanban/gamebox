import type {
  GameLaunchContext,
  GameResult,
  GameResultAction,
  GameResultDisplay,
} from "../../../game-contracts";
import { FIRST_LEVEL, type DogLegeDogLevel } from "../levels/first-level";
import { DOG_GAME_ID, DOG_GAME_RESULT_DISPLAY } from "./game-config";
import { getDogLegeDogLevel } from "../levels/level-provider";
import { animateBlockFlight, type CancellableAnimation } from "../assets/animation-effects";
import { GameSession, type GameSessionSnapshot } from "./game-session";
import { createParticleEffects } from "../assets/particle-effects";
import { createSoundEffects } from "../assets/sound-effects";
import { renderDogLegeDogGame } from "./game-renderer";
import type {
  DogLegeDogGame,
  DogLegeDogGameOptions,
  DogLegeDogGameState,
  DogVisualFeedback,
} from "./game-types";

interface DogGameRuntime {
  readonly session: GameSession;
  started: boolean;
  destroyed: boolean;
  hasInteracted: boolean;
  inputLocked: boolean;
  feedback: DogVisualFeedback;
  soundEnabled: boolean;
  resultConfirmed: boolean;
  resultPresented: boolean;
  startedAt: number | null;
  endedAt: number | null;
  activeFlights: Set<CancellableAnimation>;
  matchFeedbackActive: boolean;
  matchAnimation: Promise<void> | null;
}

export function createDogLegeDogGame(
  root: HTMLElement,
  options: DogLegeDogGameOptions = {},
): DogLegeDogGame {
  const level = getDogLegeDogLevel(options.levelNumber ?? FIRST_LEVEL.number);
  const runtime: DogGameRuntime = {
    session: new GameSession(level),
    started: false,
    destroyed: false,
    hasInteracted: false,
    inputLocked: false,
    feedback: "idle",
    soundEnabled: options.soundEnabled ?? true,
    resultConfirmed: false,
    resultPresented: false,
    startedAt: null,
    endedAt: null,
    activeFlights: new Set(),
    matchFeedbackActive: false,
    matchAnimation: null,
  };
  const gameContentRoot =
    root.querySelector<HTMLElement>("[data-game-content]") ?? root;
  const soundEffects = createSoundEffects(runtime.soundEnabled);
  const particleEffects = createParticleEffects(root);

  const selectBlock = (blockId: string): GameSessionSnapshot => {
    if (runtime.destroyed) {
      throw new Error("Cannot select a block in a destroyed 狗了个狗 game");
    }

    return commitBlockSelection(blockId, true);
  };

  function commitBlockSelection(blockId: string, shouldAnimate: boolean): GameSessionSnapshot {
    if (runtime.inputLocked) {
      return runtime.session.getState();
    }

    soundEffects.initialize();

    const sourceElement = findBlockElement(root, blockId);
    const sourceRect = sourceElement?.getBoundingClientRect() ?? null;
    const patternMarkup = sourceElement?.querySelector<HTMLElement>(".dog-block__glyph")?.outerHTML ?? "";
    const patternType = sourceElement?.dataset.patternType;
    const selection = runtime.session.selectBlock(blockId);
    const nextState = selection.snapshot;
    if (!selection.selected) {
      return nextState;
    }

    runtime.hasInteracted = true;
    const didMatch = selection.removedCount > 0;
    const result = createResult(level, nextState.status);
    if (result !== null) {
      runtime.endedAt = Date.now();
      confirmResult(result, !shouldAnimate || !runtime.started);
    }

    if (!shouldAnimate || !runtime.started) {
      soundEffects.play("select");
      playFeedbackSounds(didMatch, result);
      runtime.feedback = "idle";
      runtime.matchFeedbackActive = false;
      runtime.inputLocked = false;
      renderStartedGame(nextState);
      if (result !== null) {
        presentResult(result);
      }
      return nextState;
    }

    runtime.inputLocked = result !== null;
    if (didMatch) {
      runtime.matchFeedbackActive = true;
      runtime.feedback = "match";
    } else if (result !== null) {
      runtime.feedback = result.status;
    } else if (!runtime.matchFeedbackActive) {
      runtime.feedback = "idle";
    }
    soundEffects.play("select");
    playFeedbackSounds(didMatch, result);
    renderStartedGame(nextState);

    const target = findTrayTarget(root, patternType);
    const flight = animateBlockFlight({
      root,
      patternMarkup,
      source: sourceRect,
      target: target?.getBoundingClientRect() ?? null,
    });
    runtime.activeFlights.add(flight);
    void finishAnimatedSelection(
      flight,
      result,
      didMatch,
    );

    return nextState;
  }

  async function finishAnimatedSelection(
    flight: CancellableAnimation,
    result: GameResult | null,
    didMatch: boolean,
  ): Promise<void> {
    await flight.promise;
    runtime.activeFlights.delete(flight);
    if (runtime.destroyed) {
      return;
    }

    if (result !== null) {
      if (didMatch) {
        await ensureMatchFeedback();
        if (runtime.destroyed) {
          return;
        }
      } else if (runtime.matchFeedbackActive) {
        await ensureMatchFeedback();
        if (runtime.destroyed) {
          return;
        }
      }

      runtime.feedback = result.status;
      renderStartedGame();
      await particleEffects.play(result.status);
      if (runtime.destroyed) {
        return;
      }
      runtime.inputLocked = false;
      runtime.feedback = "idle";
      runtime.matchFeedbackActive = false;
      renderStartedGame();
      presentResult(result);
      return;
    }

    if (didMatch) {
      void ensureMatchFeedback();
    }
  }

  function ensureMatchFeedback(): Promise<void> {
    if (runtime.matchAnimation !== null) {
      return runtime.matchAnimation;
    }

    if (!runtime.matchFeedbackActive) {
      return Promise.resolve();
    }

    if (runtime.feedback !== "match") {
      runtime.feedback = "match";
      renderStartedGame();
    }

    let animation: Promise<void>;
    animation = particleEffects.play("match").then(() => {
      if (runtime.matchAnimation === animation) {
        runtime.matchAnimation = null;
      }
      if (runtime.destroyed || !runtime.matchFeedbackActive) {
        return;
      }

      runtime.matchFeedbackActive = false;
      if (runtime.feedback === "match") {
        runtime.feedback = "idle";
        renderStartedGame();
      }
    });
    runtime.matchAnimation = animation;
    return animation;
  }

  function confirmResult(result: GameResult, presentImmediately: boolean): void {
    if (runtime.resultConfirmed) {
      return;
    }

    runtime.resultConfirmed = true;
    options.onResultConfirmed?.(result);
    if (options.onResultConfirmed === undefined && presentImmediately) {
      presentResult(result);
    }
  }

  function presentResult(result: GameResult): void {
    if (runtime.resultPresented) {
      return;
    }

    runtime.resultPresented = true;
    options.onResult?.(result);
  }

  function renderStartedGame(snapshot?: GameSessionSnapshot): void {
    if (runtime.started) {
      renderDogLegeDogGame(
        root,
        createGameState(runtime, snapshot),
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
    commitBlockSelection(blockId, true);
  };

  const handleClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (actionElement?.dataset.action === "toggle-sound") {
      soundEffects.initialize();
      runtime.soundEnabled = !runtime.soundEnabled;
      soundEffects.setEnabled(runtime.soundEnabled);
      options.onSoundToggle?.(runtime.soundEnabled);
      renderStartedGame();
      return;
    }

    const eventDetail = "detail" in event && typeof event.detail === "number" ? event.detail : 0;
    if (eventDetail > 0) {
      return;
    }

    const blockId = getBlockId(event);
    if (blockId !== undefined) {
      commitBlockSelection(blockId, false);
    }
  };

  root.addEventListener("pointerup", handlePointerUp);
  root.addEventListener("click", handleClick);

  return {
    start(): DogLegeDogGameState {
      if (runtime.destroyed) {
        throw new Error("Cannot start a destroyed 狗了个狗 game");
      }

      if (!runtime.started) {
        runtime.startedAt = Date.now();
        renderDogLegeDogGame(root, createGameState(runtime));
        runtime.started = true;
        if (runtime.soundEnabled) {
          soundEffects.initialize();
        }
      }

      return createGameState(runtime);
    },

    getState(): DogLegeDogGameState {
      return createGameState(runtime);
    },

    setSoundEnabled(soundEnabled: boolean): void {
      if (runtime.destroyed) {
        return;
      }

      runtime.soundEnabled = soundEnabled;
      if (soundEnabled) {
        soundEffects.initialize();
      }
      soundEffects.setEnabled(soundEnabled);
    },

    selectBlock(blockId: string): GameSessionSnapshot {
      return selectBlock(blockId);
    },

    destroy(): void {
      if (runtime.destroyed) {
        return;
      }

      runtime.destroyed = true;
      for (const flight of runtime.activeFlights) {
        flight.cancel();
      }
      runtime.activeFlights.clear();
      particleEffects.destroy();
      soundEffects.destroy();
      root.removeEventListener("pointerup", handlePointerUp);
      root.removeEventListener("click", handleClick);
      gameContentRoot.replaceChildren();
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

function createGameState(
  runtime: DogGameRuntime,
  snapshot?: GameSessionSnapshot,
): DogLegeDogGameState {
  const sessionState = snapshot ?? runtime.session.getState();

  return {
    gameId: DOG_GAME_ID,
    status:
      sessionState.status === "playing" && !runtime.hasInteracted ? "ready" : sessionState.status,
    level: sessionState.level,
    session: sessionState,
    inputLocked: runtime.inputLocked,
    feedback: runtime.feedback,
    soundEnabled: runtime.soundEnabled,
    debug: { elapsedMs: getElapsedMs(runtime.startedAt, runtime.endedAt) },
  };
}

function createResult(
  level: DogLegeDogLevel,
  status: GameSessionSnapshot["status"],
): GameResult | null {
  if (status !== "won" && status !== "lost") {
    return null;
  }

  const resultDisplay: GameResultDisplay = {
    ...DOG_GAME_RESULT_DISPLAY[status],
  };
  const actions: readonly GameResultAction[] =
    status === "won" ? ["next-level", "catalog"] : ["retry", "catalog"];

  return {
    gameId: DOG_GAME_ID,
    levelNumber: level.number,
    status,
    reward: status === "won" ? level.reward : 0,
    display: resultDisplay,
    actions,
  };
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
