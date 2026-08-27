import type {
  GameResult,
  GameResultAction,
  GameResultDisplay,
} from "@/game-contracts";
import type { GameSessionSnapshot } from "@/games/dog-lege-dog/game/game-session";
import type {
  DogLegeDogGameState,
} from "@/games/dog-lege-dog/game/game-types";
import type { DogGameRuntime } from "@/games/dog-lege-dog/game/dog-game-runtime-types";
import type { DogItemActionResult } from "@/games/dog-lege-dog/game/dog-item-runtime";

export function createDogGameState(
  runtime: DogGameRuntime,
  snapshot?: GameSessionSnapshot,
): DogLegeDogGameState {
  const sessionState = snapshot ?? runtime.session.getState();
  const itemState = runtime.itemRuntime?.getState() ?? null;
  const inputLocked = isDogGameInputLocked(runtime);

  return {
    gameId: runtime.config.game.id,
    status:
      sessionState.status === "playing" && !runtime.hasInteracted
        ? "ready"
        : sessionState.status,
    level: sessionState.level,
    session: sessionState,
    inputLocked,
    loadoutLocked:
      sessionState.status !== "playing" ||
      runtime.hasInteracted ||
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

export function isDogGameInputLocked(
  runtime: Pick<DogGameRuntime, "config" | "inputLocked" | "itemRuntime" | "meltAnimation">,
): boolean {
  const animationLocked = runtime.config.animation.inputLockedDuringAnimation &&
    (runtime.meltAnimation !== null || runtime.itemRuntime?.isInputLocked() === true);
  return runtime.inputLocked || animationLocked;
}

export function createDogResult(
  runtime: DogGameRuntime,
  status: GameSessionSnapshot["status"],
): GameResult | null {
  if (status !== "won" && status !== "lost") {
    return null;
  }

  const isFinal = status === "won" && runtime.level.number === runtime.config.game.maxLevelNumber;
  const resultDisplay: GameResultDisplay = {
    ...(isFinal ? runtime.config.ui.copy.result.final : runtime.config.ui.copy.result[status]),
  };
  const actions: readonly GameResultAction[] = isFinal
    ? ["catalog"]
    : status === "won"
      ? ["next-level", "catalog"]
      : ["retry", "catalog"];

  return {
    gameId: runtime.config.game.id,
    levelNumber: runtime.level.number,
    status,
    reward: status === "won" ? runtime.level.reward : 0,
    display: resultDisplay,
    actions,
    ...(isFinal ? { isFinal: true } : {}),
  };
}

export function getItemEffectTripleCount(
  effect: DogItemActionResult["effect"] | null | undefined,
): number {
  if (
    effect === null ||
    effect === undefined ||
    (effect.type !== "melt" &&
      effect.type !== "triple-removal" &&
      effect.type !== "wildcard")
  ) {
    return 0;
  }

  return effect.tripleCount;
}

function getElapsedMs(startedAt: number | null, endedAt: number | null): number {
  if (startedAt === null || endedAt === null) {
    return 0;
  }

  return Math.max(0, endedAt - startedAt);
}
