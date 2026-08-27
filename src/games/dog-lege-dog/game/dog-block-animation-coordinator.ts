import type { GameResult } from "@/game-contracts";
import {
  animateBlockFlight,
  animateDogIllusionReveal,
  animateDogMagneticAttractionEffect,
  animateDogTwinSplitEffect,
  type CancellableAnimation,
} from "@/games/dog-lege-dog/assets/animation-effects";
import type { SoundEffects } from "@/games/dog-lege-dog/assets/sound-effects";
import { renderDogPatternAsset } from "@/games/dog-lege-dog/assets/game-assets";
import {
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
  getDogIllusionDisguisedPattern,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  GameSessionSelectionResult,
  GameSessionSnapshot,
} from "@/games/dog-lege-dog/game/game-session";
import type {
  DogBlock,
  DogPatternType,
} from "@/games/dog-lege-dog/levels/level-types";
import type { DogGameRuntime } from "@/games/dog-lege-dog/game/dog-game-runtime-types";
import { isDogGameInputLocked } from "@/games/dog-lege-dog/game/dog-game-state";
import {
  captureDogTrayBlockRects,
  findDogBlockElement,
  findDogTrayBlockElement,
  findDogTrayInsertionTarget,
  findDogTrayTarget,
} from "@/games/dog-lege-dog/game/dog-game-dom";
import { DogFeedbackCoordinator } from "@/games/dog-lege-dog/game/dog-feedback-coordinator";

export interface DogBlockAnimationCoordinatorOptions {
  readonly root: HTMLElement;
  readonly runtime: Pick<
    DogGameRuntime,
    | "activeFlights"
    | "config"
    | "destroyed"
    | "endedAt"
    | "feedback"
    | "hasInteracted"
    | "inputLocked"
    | "itemRuntime"
    | "meltAnimation"
    | "matchFeedbackActive"
    | "session"
    | "started"
  >;
  readonly soundEffects: SoundEffects;
  readonly feedback: DogFeedbackCoordinator;
  readonly render: (snapshot?: GameSessionSnapshot) => void;
  readonly createResult: (status: GameSessionSnapshot["status"]) => GameResult | null;
  readonly confirmResult: (result: GameResult, presentImmediately: boolean) => void;
  readonly presentResult: (result: GameResult) => void;
}

export class DogBlockAnimationCoordinator {
  private readonly options: DogBlockAnimationCoordinatorOptions;

  constructor(options: DogBlockAnimationCoordinatorOptions) {
    this.options = options;
  }

  selectBlock(blockId: string, shouldAnimate: boolean): GameSessionSnapshot {
    const { runtime } = this.options;
    if (runtime.destroyed) {
      throw new Error("Cannot select a block in a destroyed 狗了个狗 game");
    }
    if (runtime.itemRuntime?.getState().phase === "targeting" || isDogGameInputLocked(runtime)) {
      return runtime.session.getState();
    }

    const { root, soundEffects } = this.options;
    soundEffects.initialize();
    const sourceElement = findDogBlockElement(root, blockId);
    const sourceBlock = runtime.session.getState().remainingBlocks.find(
      (block) => block.id === blockId,
    );
    const sourceRect = sourceElement?.getBoundingClientRect() ?? null;
    const isIllusion = sourceBlock?.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE;
    const isMagnetic = sourceBlock?.specialMechanism?.type === DOG_MAGNETIC_MECHANISM_TYPE;
    const isTwin = sourceBlock?.specialMechanism?.type === DOG_TWIN_MECHANISM_TYPE;
    const patternMarkup = isIllusion && sourceBlock !== undefined
      ? renderDogPatternAsset(getDogIllusionDisguisedPattern(sourceBlock), runtime.config)
      : sourceElement?.querySelector<HTMLElement>(".dog-block__glyph")?.outerHTML ?? "";

    if (isIllusion && shouldAnimate && runtime.started && sourceBlock !== undefined) {
      return this.commitAnimatedIllusionSelection(
        blockId,
        sourceBlock,
        sourceRect,
        patternMarkup,
      );
    }
    if (isMagnetic && shouldAnimate && runtime.started && sourceBlock !== undefined) {
      return this.commitAnimatedMagneticSelection(
        blockId,
        sourceBlock,
        sourceRect,
        patternMarkup,
      );
    }

    const patternType = sourceElement?.dataset.patternType as DogPatternType | undefined;
    const trayRectsBeforeSelection = captureDogTrayBlockRects(root);
    const selection = runtime.session.selectBlock(blockId);
    const nextState = selection.snapshot;
    if (!selection.selected) {
      return nextState;
    }

    runtime.hasInteracted = true;
    const didMatch = selection.removedCount > 0;
    const result = this.options.createResult(nextState.status);
    if (result !== null) {
      runtime.endedAt = Date.now();
      this.options.confirmResult(result, !shouldAnimate || !runtime.started);
    }

    if (!shouldAnimate || !runtime.started) {
      soundEffects.play("select");
      this.options.feedback.playFeedbackSounds(didMatch, result);
      void this.options.feedback.settleKeyDrop(selection.tripleCount, false);
      runtime.feedback = "idle";
      runtime.matchFeedbackActive = false;
      runtime.inputLocked = false;
      this.options.render(nextState);
      if (result !== null) {
        this.options.presentResult(result);
      }
      return nextState;
    }

    runtime.inputLocked = true;
    if (isIllusion) {
      runtime.matchFeedbackActive = didMatch;
      runtime.feedback = "idle";
    } else if (didMatch) {
      runtime.matchFeedbackActive = true;
      runtime.feedback = "match";
    } else if (result !== null) {
      runtime.feedback = result.status;
    } else if (!runtime.matchFeedbackActive) {
      runtime.feedback = "idle";
    }
    soundEffects.play("select");
    if (!isIllusion) {
      this.options.feedback.playFeedbackSounds(didMatch, result);
    }
    if (didMatch && result === null) {
      void this.options.feedback.ensureMatchFeedback();
    }

    const target = findDogTrayTarget(root, patternType);
    const flight = animateBlockFlight({
      root,
      config: runtime.config,
      patternMarkup,
      patternType: sourceBlock?.patternType ?? patternType,
      isIllusion,
      source: sourceRect,
      target: target?.getBoundingClientRect() ?? null,
    });
    runtime.activeFlights.add(flight);
    this.options.feedback.startMeltAnimations(selection.meltedBlockIds, trayRectsBeforeSelection);
    const twinSplit = isTwin
      ? animateDogTwinSplitEffect({
          root,
          config: runtime.config,
          sourceId: blockId,
          blockIds: [`${blockId}-1`, `${blockId}-2`],
          patternMarkup,
          source: sourceRect,
          target: target?.getBoundingClientRect() ?? null,
        })
      : null;
    if (twinSplit !== null) {
      runtime.activeFlights.add(twinSplit);
    }
    this.options.render(nextState);
    void this.finishAnimatedSelection(
      flight,
      result,
      didMatch,
      false,
      null,
      twinSplit,
      selection.tripleCount,
    );
    return nextState;
  }

  private commitAnimatedIllusionSelection(
    blockId: string,
    block: DogBlock,
    sourceRect: DOMRect | null,
    patternMarkup: string,
  ): GameSessionSnapshot {
    const { runtime, root, soundEffects } = this.options;
    const pending = runtime.session.beginBlockSelection(blockId);
    if (!pending.selected) {
      return pending.snapshot;
    }

    runtime.hasInteracted = true;
    runtime.inputLocked = true;
    runtime.feedback = "idle";
    runtime.matchFeedbackActive = false;
    soundEffects.play("select");
    const target = findDogTrayTarget(root, block.patternType);
    const flight = animateBlockFlight({
      root,
      config: runtime.config,
      patternMarkup,
      patternType: block.patternType,
      isIllusion: true,
      source: sourceRect,
      target: target?.getBoundingClientRect() ?? null,
    });
    runtime.activeFlights.add(flight);
    this.options.render(pending.snapshot);
    void this.finishAnimatedSelection(flight, null, false, true, blockId);
    return pending.snapshot;
  }

  private commitAnimatedMagneticSelection(
    blockId: string,
    block: DogBlock,
    sourceRect: DOMRect | null,
    patternMarkup: string,
  ): GameSessionSnapshot {
    const { runtime, root, soundEffects } = this.options;
    const pending = runtime.session.beginBlockSelection(blockId);
    if (!pending.selected) {
      return pending.snapshot;
    }

    const targetBlockId = pending.magneticResolution?.targetBlockId ?? null;
    const targetBlock = targetBlockId === null
      ? undefined
      : pending.snapshot.remainingBlocks.find((candidate) => candidate.id === targetBlockId);
    const targetElement = targetBlockId === null ? null : findDogBlockElement(root, targetBlockId);
    const targetRect = targetElement?.getBoundingClientRect() ?? null;
    const targetPatternMarkup = targetElement?.querySelector<HTMLElement>(
      ".dog-block__glyph",
    )?.outerHTML ?? patternMarkup;

    runtime.hasInteracted = true;
    runtime.inputLocked = true;
    runtime.feedback = "idle";
    runtime.matchFeedbackActive = false;
    soundEffects.play("select");
    this.options.render(pending.snapshot);
    const trayTarget = findDogTrayBlockElement(root, blockId) ??
      findDogTrayTarget(root, block.patternType);
    const sourceFlight = animateBlockFlight({
      root,
      config: runtime.config,
      patternMarkup,
      patternType: block.patternType,
      isMagnetic: true,
      source: sourceRect,
      target: trayTarget?.getBoundingClientRect() ?? null,
    });
    runtime.activeFlights.add(sourceFlight);
    void this.finishAnimatedMagneticSelection(
      sourceFlight,
      block,
      targetBlock,
      targetRect,
      targetPatternMarkup,
    );
    return pending.snapshot;
  }

  private async finishAnimatedSelection(
    flight: CancellableAnimation,
    result: GameResult | null,
    didMatch: boolean,
    isIllusion: boolean,
    illusionBlockId: string | null = null,
    twinSplit: CancellableAnimation | null = null,
    tripleCount = 0,
  ): Promise<void> {
    const { runtime, root } = this.options;
    await flight.promise;
    runtime.activeFlights.delete(flight);
    if (runtime.destroyed) {
      return;
    }

    if (isIllusion) {
      const selection = runtime.session.completeBlockSelection();
      this.options.render(selection.snapshot);
      const reveal = animateDogIllusionReveal({
        root,
        config: runtime.config,
        blockId: illusionBlockId ?? "",
      });
      runtime.activeFlights.add(reveal);
      void this.finishIllusionReveal(reveal, selection);
      return;
    }

    if (twinSplit !== null) {
      await twinSplit.promise;
      runtime.activeFlights.delete(twinSplit);
      if (runtime.destroyed) {
        return;
      }
    }

    await this.options.feedback.finishResolvedSelection(result, didMatch, tripleCount);
  }

  private async finishAnimatedMagneticSelection(
    sourceFlight: CancellableAnimation,
    sourceBlock: DogBlock,
    targetBlock: DogBlock | undefined,
    targetRect: DOMRect | null,
    targetPatternMarkup: string,
  ): Promise<void> {
    const { runtime, root, soundEffects } = this.options;
    await sourceFlight.promise;
    runtime.activeFlights.delete(sourceFlight);
    if (runtime.destroyed) {
      return;
    }

    if (targetBlock !== undefined && targetRect !== null) {
      const sourceElement = findDogTrayBlockElement(root, sourceBlock.id);
      const attraction = animateDogMagneticAttractionEffect({
        root,
        config: runtime.config,
        sourceId: sourceBlock.id,
        targetId: targetBlock.id,
        source: sourceElement?.getBoundingClientRect() ?? null,
        target: targetRect,
      });
      runtime.activeFlights.add(attraction);
      await attraction.promise;
      runtime.activeFlights.delete(attraction);
      if (runtime.destroyed) {
        return;
      }

      const targetTray = findDogTrayInsertionTarget(
        root,
        runtime.session.getState().trayBlocks.length,
        targetBlock.patternType,
      );
      const targetFlight = animateBlockFlight({
        root,
        config: runtime.config,
        patternMarkup: targetPatternMarkup,
        patternType: targetBlock.patternType,
        isIllusion: targetBlock.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE,
        source: targetRect,
        target: targetTray?.getBoundingClientRect() ?? null,
      });
      runtime.activeFlights.add(targetFlight);
      await targetFlight.promise;
      runtime.activeFlights.delete(targetFlight);
      if (runtime.destroyed) {
        return;
      }
    }

    const magneticResolution = runtime.session.completeMagneticEntry();
    if (magneticResolution === null) {
      runtime.inputLocked = false;
      this.options.render();
      return;
    }

    this.options.render(runtime.session.getState());
    const trayRectsBeforeSelection = captureDogTrayBlockRects(root);
    const targetTray = targetBlock === undefined
      ? null
      : findDogTrayBlockElement(
          root,
          magneticResolution.targetTrayBlockIds[0] ?? targetBlock.id,
        );

    if (targetBlock !== undefined) {
      if (targetBlock.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE) {
        const reveal = animateDogIllusionReveal({
          root,
          config: runtime.config,
          blockId: targetBlock.id,
        });
        runtime.activeFlights.add(reveal);
        await reveal.promise;
        runtime.activeFlights.delete(reveal);
        if (runtime.destroyed) {
          return;
        }
      }

      if (targetBlock.specialMechanism?.type === DOG_TWIN_MECHANISM_TYPE) {
        const split = animateDogTwinSplitEffect({
          root,
          config: runtime.config,
          sourceId: targetBlock.id,
          blockIds: magneticResolution.targetTrayBlockIds,
          patternMarkup: targetPatternMarkup,
          source: targetRect,
          target: targetTray?.getBoundingClientRect() ?? null,
        });
        runtime.activeFlights.add(split);
        await split.promise;
        runtime.activeFlights.delete(split);
        if (runtime.destroyed) {
          return;
        }
      }
    }

    const selection = runtime.session.resolveMagneticEntry();
    const result = this.options.createResult(selection.snapshot.status);
    if (result !== null) {
      runtime.endedAt = Date.now();
      this.options.confirmResult(result, false);
    }
    if (selection.removedCount > 0) {
      runtime.matchFeedbackActive = true;
      runtime.feedback = "match";
      soundEffects.play("match");
    }
    this.options.feedback.startMeltAnimations(selection.meltedBlockIds, trayRectsBeforeSelection);
    await this.options.feedback.finishResolvedSelection(
      result,
      selection.removedCount > 0,
      selection.tripleCount,
    );
  }

  private async finishIllusionReveal(
    reveal: CancellableAnimation,
    selection: GameSessionSelectionResult,
  ): Promise<void> {
    const { runtime, soundEffects } = this.options;
    await reveal.promise;
    runtime.activeFlights.delete(reveal);
    if (runtime.destroyed) {
      return;
    }

    const result = this.options.createResult(selection.snapshot.status);
    if (result !== null) {
      runtime.endedAt = Date.now();
      this.options.confirmResult(result, false);
    }
    if (selection.removedCount > 0) {
      runtime.matchFeedbackActive = true;
      runtime.feedback = "match";
      soundEffects.play("match");
    }
    await this.options.feedback.finishResolvedSelection(
      result,
      selection.removedCount > 0,
      selection.tripleCount,
    );
  }
}
