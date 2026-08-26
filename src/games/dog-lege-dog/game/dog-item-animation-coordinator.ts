import {
  animateDogDemagnetizerEffect,
  animateDogDetectorReveal,
  animateDogItemEffect,
  animateDogTorchMeltEffect,
  animateDogTripleRemovalEffect,
  animateDogUnlockTrayEffect,
  type CancellableAnimation,
} from "@/games/dog-lege-dog/assets/animation-effects";
import { renderDogPatternAsset } from "@/games/dog-lege-dog/assets/game-assets";
import { DOG_PATTERN_TYPES } from "@/games/dog-lege-dog/levels/first-level";
import type { GameResult } from "@/game-contracts";
import type { GameSessionSnapshot } from "@/games/dog-lege-dog/game/game-session";
import type {
  DogItemActionResult,
  DogItemRuntimeSnapshot,
} from "@/games/dog-lege-dog/game/dog-item-runtime";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";
import type { DogGameRuntime } from "@/games/dog-lege-dog/game/dog-game-runtime-types";
import { DogFeedbackCoordinator } from "@/games/dog-lege-dog/game/dog-feedback-coordinator";
import { getItemEffectTripleCount } from "@/games/dog-lege-dog/game/dog-game-state";

export interface DogItemAnimationCoordinatorOptions {
  readonly root: HTMLElement;
  readonly runtime: Pick<
    DogGameRuntime,
    | "config"
    | "destroyed"
    | "endedAt"
    | "inputLocked"
    | "itemAnimation"
    | "itemRuntime"
    | "level"
    | "session"
  >;
  readonly feedback: DogFeedbackCoordinator;
  readonly render: (snapshot?: GameSessionSnapshot) => void;
  readonly createResult: (status: GameSessionSnapshot["status"]) => GameResult | null;
  readonly confirmResult: (result: GameResult, presentImmediately: boolean) => void;
}

export class DogItemAnimationCoordinator {
  private readonly options: DogItemAnimationCoordinatorOptions;

  constructor(options: DogItemAnimationCoordinatorOptions) {
    this.options = options;
  }

  start(
    itemId: DogItemId,
    visualFeedback: DogItemRuntimeSnapshot["visualFeedback"],
    effect: DogItemActionResult["effect"],
    targetRect: DOMRect | null,
    tripleSourceRects: ReadonlyMap<string, DOMRect>,
  ): void {
    const { runtime } = this.options;
    if (runtime.itemAnimation !== null) {
      return;
    }

    const animation = effect?.type === "triple-removal"
      ? animateDogTripleRemovalEffect({
          root: this.options.root,
          config: runtime.config,
          itemId,
          patternType: effect.patternType,
          blockIds: effect.blockIds,
          sourceRects: tripleSourceRects,
          target: targetRect,
        })
      : effect?.type === "melt"
        ? animateDogTorchMeltEffect({
            root: this.options.root,
            config: runtime.config,
            blockId: effect.blockId,
            location: effect.location,
            target: targetRect,
          })
        : effect?.type === "reveal"
          ? animateDogDetectorReveal({
              root: this.options.root,
              config: runtime.config,
              blockId: effect.blockId,
              patternMarkup: renderDogPatternAsset(
                runtime.level.blocks.find((block) => block.id === effect.blockId)?.patternType ??
                  DOG_PATTERN_TYPES[0],
                runtime.config,
              ),
            })
          : effect?.type === "demagnetize"
            ? animateDogDemagnetizerEffect({
                root: this.options.root,
                config: runtime.config,
                blockId: effect.blockId,
                target: targetRect,
              })
            : effect?.type === "unlock"
              ? animateDogUnlockTrayEffect({
                  root: this.options.root,
                  config: runtime.config,
                  slotIndex: effect.unlockedSlotIndex,
                })
              : animateDogItemEffect({
                  root: this.options.root,
                  config: runtime.config,
                  itemId,
                  visualFeedback,
                });
    runtime.itemAnimation = animation;
    void this.finish(animation);
  }

  private async finish(animation: CancellableAnimation): Promise<void> {
    const { runtime } = this.options;
    await animation.promise;
    if (runtime.destroyed || runtime.itemAnimation !== animation) {
      return;
    }

    runtime.itemAnimation = null;
    const itemRuntime = runtime.itemRuntime;
    itemRuntime?.completeAnimation();
    const completedEffect = itemRuntime?.getLastCompletedEffect();
    const result = this.options.createResult(runtime.session.getState().status);
    if (result !== null) {
      runtime.endedAt = Date.now();
      runtime.inputLocked = true;
      this.options.confirmResult(result, false);
    }

    const didMatch = completedEffect !== null &&
      completedEffect !== undefined &&
      (completedEffect.type === "melt" ||
        completedEffect.type === "triple-removal" ||
        completedEffect.type === "wildcard") &&
      completedEffect.removedCount > 0;
    await this.options.feedback.finishItemResult(
      result,
      didMatch,
      getItemEffectTripleCount(completedEffect),
    );
  }
}
