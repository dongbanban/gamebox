import type { GameResult } from "@/game-contracts";
import { loadDogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import { LevelGenerator } from "@/games/dog-lege-dog/levels/level-generation-engine";
import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-types";
import { createRunSeed } from "@/games/dog-lege-dog/levels/level-random";
import {
  renderDogSpecialMechanismModal,
  renderDogLegeDogGame,
  fitDogBoardToFrame,
} from "@/games/dog-lege-dog/game/game-renderer";
import { createParticleEffects } from "@/games/dog-lege-dog/assets/particle-effects";
import { createSoundEffects } from "@/games/dog-lege-dog/assets/sound-effects";
import {
  DogItemRuntime,
  type DogItemActionResult,
  type DogItemTarget,
} from "@/games/dog-lege-dog/game/dog-item-runtime";
import {
  isDogItemId,
  isValidDogLoadout,
  normalizeDogLoadout,
} from "@/games/dog-lege-dog/game/dog-loadout";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";
import {
  DogFeedbackCoordinator,
} from "@/games/dog-lege-dog/game/dog-feedback-coordinator";
import {
  DogBlockAnimationCoordinator,
} from "@/games/dog-lege-dog/game/dog-block-animation-coordinator";
import {
  DogItemAnimationCoordinator,
} from "@/games/dog-lege-dog/game/dog-item-animation-coordinator";
import { bindDogInputController } from "@/games/dog-lege-dog/game/dog-input-controller";
import { DogLoadoutController } from "@/games/dog-lege-dog/game/dog-loadout-controller";
import {
  captureDogTripleRemovalSourceRects,
  findDogItemTargetElement,
} from "@/games/dog-lege-dog/game/dog-game-dom";
import {
  createDogGameState,
  createDogResult,
  isDogGameInputLocked,
} from "@/games/dog-lege-dog/game/dog-game-state";
import type {
  DogLegeDogGame,
  DogLegeDogGameOptions,
  DogLegeDogGameState,
} from "@/games/dog-lege-dog/game/game-types";
import {
  GameSession,
  type GameSessionSnapshot,
} from "@/games/dog-lege-dog/game/game-session";
import type { DogGameRuntime } from "@/games/dog-lege-dog/game/dog-game-runtime-types";

export function createDogLegeDogGame(
  root: HTMLElement,
  options: DogLegeDogGameOptions = {},
): DogLegeDogGame {
  const config = loadDogV13Config(options.config);
  const level = options.level ?? createLevel(options, config);
  const managesLoadout =
    options.loadout !== undefined || options.onLoadoutConfirmed !== undefined;
  const initialLoadout = managesLoadout
    ? normalizeDogLoadout(options.loadout, config.items.loadoutSize)
    : null;
  const initialSession = new GameSession({ level, config });
  const runtime: DogGameRuntime = {
    level,
    config,
    session: initialSession,
    started: false,
    destroyed: false,
    hasInteracted: false,
    inputLocked: managesLoadout && initialLoadout === null,
    feedback: "idle",
    soundEnabled: options.soundEnabled ?? true,
    resultConfirmed: false,
    resultPresented: false,
    startedAt: null,
    endedAt: null,
    activeFlights: new Set(),
    matchFeedbackActive: false,
    matchAnimation: null,
    meltAnimation: null,
    loadout: initialLoadout,
    itemRuntime: initialLoadout === null
      ? null
      : new DogItemRuntime({
          config,
          level,
          session: initialSession,
          loadout: initialLoadout,
        }),
    itemAnimation: null,
    loadoutEditor: managesLoadout && initialLoadout === null
      ? { mode: "initial", draft: [], confirming: false }
      : null,
  };
  const gameContentRoot = root.querySelector<HTMLElement>("[data-game-content]") ?? root;
  const soundEffects = createSoundEffects(runtime.soundEnabled, config);
  const particleEffects = createParticleEffects(root, config);

  const renderStartedGame = (snapshot?: GameSessionSnapshot): void => {
    if (runtime.started) {
      renderDogLegeDogGame(root, createDogGameState(runtime, snapshot), runtime.config);
    }
  };
  const confirmResult = (result: GameResult, presentImmediately: boolean): void => {
    if (runtime.resultConfirmed) {
      return;
    }
    runtime.resultConfirmed = true;
    options.onResultConfirmed?.(result);
    if (options.onResultConfirmed === undefined && presentImmediately) {
      presentResult(result);
    }
  };
  const presentResult = (result: GameResult): void => {
    if (runtime.resultPresented) {
      return;
    }
    runtime.resultPresented = true;
    options.onResult?.(result);
  };
  const feedback = new DogFeedbackCoordinator({
    root,
    runtime,
    soundEffects,
    particleEffects,
    render: renderStartedGame,
    presentResult,
  });
  const blockAnimations = new DogBlockAnimationCoordinator({
    root,
    runtime,
    soundEffects,
    feedback,
    render: renderStartedGame,
    createResult: (status) => createDogResult(runtime, status),
    confirmResult,
    presentResult,
  });
  const itemAnimations = new DogItemAnimationCoordinator({
    root,
    runtime,
    feedback,
    render: renderStartedGame,
    createResult: (status) => createDogResult(runtime, status),
    confirmResult,
  });
  const loadout = new DogLoadoutController({
    runtime,
    render: renderStartedGame,
    commitLoadout,
  });
  const input = bindDogInputController({
    root,
    runtime,
    selectBlock: (blockId, shouldAnimate) => {
      blockAnimations.selectBlock(blockId, shouldAnimate);
    },
    startItem,
    confirmItemTarget,
    cancelItemTarget,
    toggleLoadout: loadout.toggle.bind(loadout),
    openLoadoutEditor: loadout.open.bind(loadout),
    cancelLoadoutEditor: loadout.cancel.bind(loadout),
    requestLoadoutConfirmation: loadout.requestConfirmation.bind(loadout),
    cancelLoadoutConfirmation: loadout.cancelConfirmation.bind(loadout),
    applyLoadoutChange: loadout.applyChange.bind(loadout),
    openSpecialMechanisms,
    closeSpecialMechanisms,
    toggleSound,
  });
  const handleViewportResize = (): void => fitDogBoardToFrame(root);
  window.addEventListener("resize", handleViewportResize);

  function startItem(itemId: string | undefined): void {
    const itemRuntime = runtime.itemRuntime;
    if (
      itemRuntime === null ||
      itemId === undefined ||
      !isDogItemId(itemId) ||
      isDogGameInputLocked(runtime) ||
      runtime.activeFlights.size > 0 ||
      runtime.matchAnimation !== null
    ) {
      return;
    }

    soundEffects.initialize();
    applyItemAction(itemRuntime.begin(itemId));
  }

  function confirmItemTarget(target: DogItemTarget): void {
    const itemRuntime = runtime.itemRuntime;
    if (itemRuntime === null) {
      return;
    }

    const targetRect = findDogItemTargetElement(root, target)?.getBoundingClientRect() ?? null;
    const tripleSourceRects = target.type === "tray-block" &&
      itemRuntime.getState().selectedItemId === "triple-removal"
      ? captureDogTripleRemovalSourceRects(
          root,
          runtime.session.getTripleRemovalPlanForTrayBlock(target.blockId)?.blockIds ?? [],
        )
      : new Map<string, DOMRect>();
    applyItemAction(itemRuntime.confirmTarget(target), targetRect, tripleSourceRects);
  }

  function applyItemAction(
    action: DogItemActionResult,
    targetRect: DOMRect | null = null,
    tripleSourceRects: ReadonlyMap<string, DOMRect> = new Map(),
  ): void {
    if (action.accepted && action.success) {
      runtime.hasInteracted = true;
    }
    renderStartedGame();
    if (action.accepted && action.success && action.itemId !== null) {
      itemAnimations.start(
        action.itemId,
        action.snapshot.visualFeedback,
        action.effect,
        targetRect,
        tripleSourceRects,
      );
    }
  }

  function cancelItemTarget(): void {
    if (runtime.itemRuntime?.getState().phase !== "targeting") {
      return;
    }
    runtime.itemRuntime.cancel();
    renderStartedGame();
  }

  function openSpecialMechanisms(): void {
    const gameRoot = root.querySelector<HTMLElement>('[data-testid="dog-game"]');
    if (
      gameRoot === null ||
      gameRoot.querySelector('[data-testid="dog-special-mechanism-modal"]') !== null
    ) {
      return;
    }
    gameRoot.insertAdjacentHTML("beforeend", renderDogSpecialMechanismModal(level, config));
    gameRoot.querySelector<HTMLButtonElement>(".dog-special-mechanism-modal__close")?.focus();
  }

  function closeSpecialMechanisms(): void {
    root.querySelector('[data-testid="dog-special-mechanism-modal"]')?.remove();
  }

  function toggleSound(): void {
    soundEffects.initialize();
    runtime.soundEnabled = !runtime.soundEnabled;
    soundEffects.setEnabled(runtime.soundEnabled);
    options.onSoundToggle?.(runtime.soundEnabled);
    renderStartedGame();
  }

  function commitLoadout(draft: readonly DogItemId[], mode: "initial" | "change"): void {
    if (!isValidDogLoadout(draft, config.items.loadoutSize)) {
      return;
    }
    try {
      options.onLoadoutConfirmed?.([...draft]);
    } catch {
      return;
    }

    runtime.loadout = [...draft];
    runtime.loadoutEditor = null;
    runtime.inputLocked = false;
    if (mode === "change") {
      runtime.session = new GameSession({ level, config });
      runtime.itemAnimation?.cancel();
      runtime.itemAnimation = null;
      runtime.hasInteracted = false;
      runtime.resultConfirmed = false;
      runtime.resultPresented = false;
      runtime.feedback = "idle";
      runtime.matchFeedbackActive = false;
      runtime.matchAnimation = null;
    }
    runtime.itemRuntime = new DogItemRuntime({
      config,
      level,
      session: runtime.session,
      loadout: runtime.loadout,
    });
    renderStartedGame();
  }

  return {
    start(): DogLegeDogGameState {
      if (runtime.destroyed) {
        throw new Error("Cannot start a destroyed 狗了个狗 game");
      }
      if (!runtime.started) {
        runtime.startedAt = Date.now();
        renderDogLegeDogGame(root, createDogGameState(runtime), runtime.config);
        runtime.started = true;
        if (runtime.soundEnabled) {
          soundEffects.initialize();
        }
      }
      return createDogGameState(runtime);
    },

    getState(): DogLegeDogGameState {
      return createDogGameState(runtime);
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
      return blockAnimations.selectBlock(blockId, true);
    },

    destroy(): void {
      if (runtime.destroyed) {
        return;
      }
      runtime.destroyed = true;
      input.destroy();
      for (const flight of runtime.activeFlights) {
        flight.cancel();
      }
      runtime.activeFlights.clear();
      runtime.itemAnimation?.cancel();
      runtime.itemAnimation = null;
      particleEffects.destroy();
      soundEffects.destroy();
      window.removeEventListener("resize", handleViewportResize);
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

function createLevel(
  options: DogLegeDogGameOptions,
  config: ReturnType<typeof loadDogV13Config>,
): DogLegeDogLevel {
  return new LevelGenerator({ config }).generate({
    levelNumber: options.levelNumber ?? config.game.firstLevelNumber,
    runSeed: options.runSeed ?? createRunSeed(),
    generatorVersion: config.game.generatorVersion,
  });
}
