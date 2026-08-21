import type {
  GameLaunchContext,
  GameResult,
  GameResultAction,
  GameResultDisplay,
} from "@/game-contracts";
import {
  DOG_PATTERN_TYPES,
  FIRST_LEVEL,
  type DogLegeDogLevel,
} from "@/games/dog-lege-dog/levels/first-level";
import { DOG_GAME_ID, DOG_GAME_RESULT_DISPLAY } from "@/games/dog-lege-dog/game/game-config";
import { getDogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-provider";
import { createRunSeed } from "@/games/dog-lege-dog/levels/level-random";
import {
  animateBlockFlight,
  animateDogItemEffect,
  type CancellableAnimation,
} from "@/games/dog-lege-dog/assets/animation-effects";
import { GameSession, type GameSessionSnapshot } from "@/games/dog-lege-dog/game/game-session";
import {
  DogItemRuntime,
  type DogItemActionResult,
  type DogItemTarget,
  type DogItemRuntimeSnapshot,
} from "@/games/dog-lege-dog/game/dog-item-runtime";
import { createParticleEffects } from "@/games/dog-lege-dog/assets/particle-effects";
import { createSoundEffects } from "@/games/dog-lege-dog/assets/sound-effects";
import {
  fitDogBoardToFrame,
  renderDogLegeDogGame,
} from "@/games/dog-lege-dog/game/game-renderer";
import {
  areDogLoadoutsEqual,
  isDogItemId,
  isValidDogLoadout,
  normalizeDogLoadout,
} from "@/games/dog-lege-dog/game/dog-loadout";
import type {
  DogLoadoutEditorState,
  DogLegeDogGame,
  DogLegeDogGameOptions,
  DogLegeDogGameState,
  DogVisualFeedback,
} from "@/games/dog-lege-dog/game/game-types";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";

interface DogGameRuntime {
  session: GameSession;
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
  loadout: readonly DogItemId[] | null;
  itemRuntime: DogItemRuntime | null;
  itemAnimation: CancellableAnimation | null;
  loadoutEditor: DogLoadoutEditorState | null;
}

export function createDogLegeDogGame(
  root: HTMLElement,
  options: DogLegeDogGameOptions = {},
): DogLegeDogGame {
  const level = getDogLegeDogLevel(
    options.levelNumber ?? FIRST_LEVEL.number,
    options.runSeed ?? createRunSeed(),
  );
  const managesLoadout =
    options.loadout !== undefined || options.onLoadoutConfirmed !== undefined;
  const initialLoadout = managesLoadout
    ? normalizeDogLoadout(options.loadout)
    : null;
  const initialSession = new GameSession(level);
  const runtime: DogGameRuntime = {
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
    loadout: initialLoadout,
    itemRuntime:
      initialLoadout === null
        ? null
        : new DogItemRuntime({
            level,
            session: initialSession,
            loadout: initialLoadout,
          }),
    itemAnimation: null,
    loadoutEditor:
      managesLoadout && initialLoadout === null
        ? { mode: "initial", draft: [], confirming: false }
        : null,
  };
  const gameContentRoot =
    root.querySelector<HTMLElement>("[data-game-content]") ?? root;
  const soundEffects = createSoundEffects(runtime.soundEnabled);
  const particleEffects = createParticleEffects(root);
  const handleViewportResize = (): void => fitDogBoardToFrame(root);
  window.addEventListener("resize", handleViewportResize);

  const selectBlock = (blockId: string): GameSessionSnapshot => {
    if (runtime.destroyed) {
      throw new Error("Cannot select a block in a destroyed 狗了个狗 game");
    }

    return commitBlockSelection(blockId, true);
  };

  function commitBlockSelection(blockId: string, shouldAnimate: boolean): GameSessionSnapshot {
    if (runtime.itemRuntime?.getState().phase === "targeting" || isGameInputLocked()) {
      return runtime.session.getState();
    }

    soundEffects.initialize();

    const sourceElement = findBlockElement(root, blockId);
    const sourceRect = sourceElement?.getBoundingClientRect() ?? null;
    const patternMarkup = sourceElement?.querySelector<HTMLElement>(".dog-block__glyph")?.outerHTML ?? "";
    const patternType = sourceElement?.dataset.patternType;
    const trayRectsBeforeSelection = captureTrayBlockRects(root);
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
      playMeltAnimations(root, selection.meltedBlockIds, trayRectsBeforeSelection);
      if (result !== null) {
        presentResult(result);
      }
      return nextState;
    }

    runtime.inputLocked = didMatch || result !== null;
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
    const target = findTrayTarget(root, patternType);
    const flight = animateBlockFlight({
      root,
      patternMarkup,
      source: sourceRect,
      target: target?.getBoundingClientRect() ?? null,
    });
    runtime.activeFlights.add(flight);
    renderStartedGame(nextState);
    playMeltAnimations(root, selection.meltedBlockIds, trayRectsBeforeSelection);
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
      return;
    }

    renderStartedGame();
  }

  function ensureMatchFeedback(): Promise<void> {
    if (runtime.matchAnimation !== null) {
      return runtime.matchAnimation;
    }

    if (!runtime.matchFeedbackActive) {
      return Promise.resolve();
    }

    runtime.inputLocked = true;

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
      if (runtime.session.getState().status === "playing") {
        runtime.inputLocked = false;
      }
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

  function captureTrayBlockRects(rootElement: HTMLElement): ReadonlyMap<string, DOMRect> {
    const rects = new Map<string, DOMRect>();
    for (const slot of rootElement.querySelectorAll<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-block-id]',
    )) {
      const blockId = slot.dataset.blockId;
      if (blockId !== undefined) {
        rects.set(blockId, slot.getBoundingClientRect());
      }
    }
    return rects;
  }

  function playMeltAnimations(
    rootElement: HTMLElement,
    meltedBlockIds: readonly string[],
    fallbackRects: ReadonlyMap<string, DOMRect>,
  ): void {
    const layer = rootElement.querySelector<HTMLElement>(
      '[data-testid="dog-animation-layer"]',
    );
    if (layer === null) {
      return;
    }

    const layerRect = layer.getBoundingClientRect();
    const traySlots = [...rootElement.querySelectorAll<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-block-id]',
    )];
    for (const blockId of meltedBlockIds) {
      const target = traySlots.find((slot) => slot.dataset.blockId === blockId);
      const targetRect = target?.getBoundingClientRect() ?? fallbackRects.get(blockId);
      if (targetRect === undefined) {
        continue;
      }

      const effect = document.createElement("div");
      effect.className = "dog-melt-effect";
      effect.dataset.meltBlockId = blockId;
      effect.setAttribute("aria-hidden", "true");
      effect.innerHTML = `
        <span class="dog-melt-effect__flake">❄</span>
        <span class="dog-melt-effect__drop dog-melt-effect__drop--1"></span>
        <span class="dog-melt-effect__drop dog-melt-effect__drop--2"></span>
        <span class="dog-melt-effect__drop dog-melt-effect__drop--3"></span>
        <span class="dog-melt-effect__drop dog-melt-effect__drop--4"></span>
      `;
      Object.assign(effect.style, {
        left: `${targetRect.left - layerRect.left}px`,
        top: `${targetRect.top - layerRect.top}px`,
        width: `${targetRect.width || 48}px`,
        height: `${targetRect.height || 48}px`,
      });
      layer.append(effect);

      const remove = (): void => effect.remove();
      const handleAnimationEnd = (event: AnimationEvent): void => {
        if (event.animationName === "dog-freeze-melt") {
          effect.removeEventListener("animationend", handleAnimationEnd);
          remove();
        }
      };
      effect.addEventListener("animationend", handleAnimationEnd);
      window.setTimeout(() => {
        effect.removeEventListener("animationend", handleAnimationEnd);
        remove();
      }, 1400);
    }
  }

  const handlePointerUp = (event: Event): void => {
    if (runtime.itemRuntime?.getState().phase === "targeting") {
      const itemTarget = getItemTarget(event);
      if (itemTarget !== undefined) {
        event.preventDefault();
        confirmItemTarget(itemTarget);
      }
      return;
    }

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
    const action = actionElement?.dataset.action;
    if (action === "toggle-loadout") {
      toggleLoadout(actionElement?.dataset.loadoutId);
      return;
    }
    if (action === "edit-loadout") {
      openLoadoutEditor();
      return;
    }
    if (action === "cancel-loadout") {
      cancelLoadoutEditor();
      return;
    }
    if (action === "confirm-loadout") {
      requestLoadoutConfirmation();
      return;
    }
    if (action === "cancel-loadout-confirmation") {
      cancelLoadoutConfirmation();
      return;
    }
    if (action === "apply-loadout-change") {
      applyLoadoutChange();
      return;
    }
    if (action === "use-item") {
      startItem(actionElement?.dataset.itemId);
      return;
    }
    if (action === "cancel-item-target") {
      cancelItemTarget();
      return;
    }
    if (action === "select-item-pattern") {
      const patternType = actionElement?.dataset.patternType;
      if (isDogPatternType(patternType)) {
        confirmItemTarget({ type: "pattern", patternType });
      }
      return;
    }
    if (action === "toggle-sound") {
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

    if (runtime.itemRuntime?.getState().phase === "targeting") {
      const itemTarget = getItemTarget(event);
      if (itemTarget !== undefined) {
        confirmItemTarget(itemTarget);
      }
      return;
    }

    const blockId = getBlockId(event);
    if (blockId !== undefined) {
      commitBlockSelection(blockId, false);
    }
  };

  function startItem(itemId: string | undefined): void {
    if (
      runtime.itemRuntime === null ||
      itemId === undefined ||
      !isDogItemId(itemId) ||
      runtime.inputLocked ||
      runtime.activeFlights.size > 0 ||
      runtime.matchAnimation !== null
    ) {
      return;
    }

    soundEffects.initialize();
    const action = runtime.itemRuntime.begin(itemId);
    applyItemAction(action);
  }

  function confirmItemTarget(target: DogItemTarget): void {
    if (runtime.itemRuntime === null) {
      return;
    }

    const action = runtime.itemRuntime.confirmTarget(target);
    applyItemAction(action);
  }

  function applyItemAction(action: DogItemActionResult): void {
    renderStartedGame();
    if (action.accepted && action.success && action.itemId !== null) {
      startItemAnimation(action.itemId, action.snapshot.visualFeedback);
    }
  }

  function cancelItemTarget(): void {
    if (runtime.itemRuntime?.getState().phase !== "targeting") {
      return;
    }

    runtime.itemRuntime.cancel();
    renderStartedGame();
  }

  function startItemAnimation(
    itemId: DogItemId,
    visualFeedback: DogItemRuntimeSnapshot["visualFeedback"],
  ): void {
    if (runtime.itemAnimation !== null) {
      return;
    }

    const animation = animateDogItemEffect({
      root,
      itemId,
      visualFeedback,
    });
    runtime.itemAnimation = animation;
    void finishItemAnimation(animation);
  }

  async function finishItemAnimation(animation: CancellableAnimation): Promise<void> {
    await animation.promise;
    if (runtime.destroyed || runtime.itemAnimation !== animation) {
      return;
    }

    runtime.itemAnimation = null;
    runtime.itemRuntime?.completeAnimation();
    renderStartedGame();
  }

  function isGameInputLocked(): boolean {
    return runtime.inputLocked || runtime.itemRuntime?.isInputLocked() === true;
  }

  function getItemTarget(event: Event): DogItemTarget | undefined {
    const target = event.target;
    if (!(target instanceof Element)) {
      return undefined;
    }

    const targetElement = target.closest<HTMLElement>('[data-item-targetable="true"]');
    const itemTargetType = runtime.itemRuntime?.getState().selectedItemTargetType;
    if (targetElement === null || itemTargetType !== "block") {
      return undefined;
    }

    const blockId = targetElement.dataset.blockId;
    if (blockId === undefined) {
      return undefined;
    }

    return targetElement.dataset.testid === "dog-tray-slot"
      ? { type: "tray-block", blockId }
      : { type: "block", blockId };
  }

  function isDogPatternType(
    value: string | undefined,
  ): value is (typeof DOG_PATTERN_TYPES)[number] {
    return value !== undefined && DOG_PATTERN_TYPES.includes(value as (typeof DOG_PATTERN_TYPES)[number]);
  }

  function toggleLoadout(itemId: string | undefined): void {
    if (runtime.loadoutEditor === null || itemId === undefined || !isDogItemId(itemId)) {
      return;
    }

    const draft = runtime.loadoutEditor.draft;
    const nextDraft = draft.includes(itemId)
      ? draft.filter((selectedItemId) => selectedItemId !== itemId)
      : draft.length < 3
        ? [...draft, itemId]
        : draft;
    runtime.loadoutEditor = {
      ...runtime.loadoutEditor,
      draft: nextDraft,
      confirming: false,
    };
    renderStartedGame();
  }

  function openLoadoutEditor(): void {
    if (
      runtime.loadout === null ||
      runtime.inputLocked ||
      runtime.activeFlights.size > 0 ||
      runtime.matchAnimation !== null ||
      runtime.session.getState().status !== "playing"
    ) {
      return;
    }

    runtime.inputLocked = true;
    runtime.loadoutEditor = {
      mode: "change",
      draft: [...runtime.loadout],
      confirming: false,
    };
    renderStartedGame();
  }

  function cancelLoadoutEditor(): void {
    if (runtime.loadoutEditor === null) {
      return;
    }

    if (runtime.loadoutEditor.mode === "initial") {
      runtime.loadoutEditor = {
        ...runtime.loadoutEditor,
        draft: [],
        confirming: false,
      };
      renderStartedGame();
      return;
    }

    runtime.loadoutEditor = null;
    runtime.inputLocked = false;
    renderStartedGame();
  }

  function requestLoadoutConfirmation(): void {
    const editor = runtime.loadoutEditor;
    if (editor === null || !isValidDogLoadout(editor.draft)) {
      return;
    }

    if (editor.mode === "change") {
      if (areDogLoadoutsEqual(runtime.loadout, editor.draft)) {
        cancelLoadoutEditor();
        return;
      }

      runtime.loadoutEditor = { ...editor, confirming: true };
      renderStartedGame();
      return;
    }

    commitLoadout(editor.draft, editor.mode);
  }

  function cancelLoadoutConfirmation(): void {
    if (runtime.loadoutEditor === null || !runtime.loadoutEditor.confirming) {
      return;
    }

    runtime.loadoutEditor = {
      ...runtime.loadoutEditor,
      confirming: false,
    };
    renderStartedGame();
  }

  function applyLoadoutChange(): void {
    const editor = runtime.loadoutEditor;
    if (editor === null || editor.mode !== "change" || !editor.confirming) {
      return;
    }

    commitLoadout(editor.draft, editor.mode);
  }

  function commitLoadout(draft: readonly DogItemId[], mode: "initial" | "change"): void {
    if (!isValidDogLoadout(draft)) {
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
      runtime.session = new GameSession(level);
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
      level,
      session: runtime.session,
      loadout: runtime.loadout,
    });
    renderStartedGame();
  }

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
      runtime.itemAnimation?.cancel();
      runtime.itemAnimation = null;
      particleEffects.destroy();
      soundEffects.destroy();
      root.removeEventListener("pointerup", handlePointerUp);
      root.removeEventListener("click", handleClick);
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

function createGameState(
  runtime: DogGameRuntime,
  snapshot?: GameSessionSnapshot,
): DogLegeDogGameState {
  const sessionState = snapshot ?? runtime.session.getState();
  const itemState = runtime.itemRuntime?.getState() ?? null;
  const inputLocked = runtime.inputLocked || runtime.itemRuntime?.isInputLocked() === true;

  return {
    gameId: DOG_GAME_ID,
    status:
      sessionState.status === "playing" && !runtime.hasInteracted ? "ready" : sessionState.status,
    level: sessionState.level,
    session: sessionState,
    inputLocked,
    loadoutLocked:
      sessionState.status !== "playing" ||
      inputLocked ||
      runtime.activeFlights.size > 0 ||
      runtime.matchAnimation !== null,
    feedback: runtime.feedback,
    soundEnabled: runtime.soundEnabled,
    loadout: runtime.loadout,
    items: itemState,
    loadoutEditor:
      runtime.loadoutEditor === null
        ? null
        : Object.freeze({
            ...runtime.loadoutEditor,
            draft: Object.freeze([...runtime.loadoutEditor.draft]),
          }),
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
