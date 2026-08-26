import type { GameResult } from "@/game-contracts";
import {
  animateDogKeyDropEffect,
  renderDogMeltEffect,
} from "@/games/dog-lege-dog/assets/animation-effects";
import type { ParticleEffects } from "@/games/dog-lege-dog/assets/particle-effects";
import type { SoundEffects } from "@/games/dog-lege-dog/assets/sound-effects";
import type { GameSessionSnapshot } from "@/games/dog-lege-dog/game/game-session";
import type { DogGameRuntime } from "@/games/dog-lege-dog/game/dog-game-runtime-types";

export interface DogFeedbackCoordinatorOptions {
  readonly root: HTMLElement;
  readonly runtime: Pick<
    DogGameRuntime,
    | "activeFlights"
    | "config"
    | "destroyed"
    | "feedback"
    | "inputLocked"
    | "itemRuntime"
    | "matchAnimation"
    | "matchFeedbackActive"
    | "meltAnimation"
    | "session"
    | "started"
  >;
  readonly soundEffects: SoundEffects;
  readonly particleEffects: ParticleEffects;
  readonly render: (snapshot?: GameSessionSnapshot) => void;
  readonly presentResult: (result: GameResult) => void;
}

export class DogFeedbackCoordinator {
  private readonly options: DogFeedbackCoordinatorOptions;

  constructor(options: DogFeedbackCoordinatorOptions) {
    this.options = options;
  }

  playFeedbackSounds(didMatch: boolean, result: GameResult | null): void {
    if (didMatch) {
      this.options.soundEffects.play("match");
    }
    if (result !== null) {
      this.options.soundEffects.play(result.status);
    }
  }

  startMeltAnimations(
    meltedBlockIds: readonly string[],
    fallbackRects: ReadonlyMap<string, DOMRect>,
  ): void {
    if (meltedBlockIds.length === 0) {
      return;
    }

    const animation = this.playMeltAnimations(meltedBlockIds, fallbackRects);
    let trackedAnimation: Promise<void>;
    trackedAnimation = animation.then(() => {
      if (this.options.runtime.meltAnimation !== trackedAnimation) {
        return;
      }

      this.options.runtime.meltAnimation = null;
      if (!this.options.runtime.destroyed) {
        this.options.render();
      }
    });
    this.options.runtime.meltAnimation = trackedAnimation;
  }

  async finishResolvedSelection(
    resolvedResult: GameResult | null,
    resolvedDidMatch: boolean,
    tripleCount = 0,
  ): Promise<void> {
    const { runtime } = this.options;
    if (resolvedResult !== null) {
      if (resolvedDidMatch || runtime.matchFeedbackActive) {
        await this.ensureMatchFeedback();
        if (runtime.destroyed) {
          return;
        }
      }

      await this.waitForMeltAnimation();
      await this.settleKeyDrop(tripleCount);
      if (runtime.destroyed) {
        return;
      }

      runtime.feedback = resolvedResult.status;
      this.options.render();
      await this.options.particleEffects.play(resolvedResult.status);
      if (runtime.destroyed) {
        return;
      }
      runtime.inputLocked = false;
      runtime.feedback = "idle";
      runtime.matchFeedbackActive = false;
      this.options.render();
      this.options.presentResult(resolvedResult);
      return;
    }

    if (resolvedDidMatch) {
      void this.ensureMatchFeedback()
        .then(() => this.waitForMeltAnimation())
        .then(() => this.settleKeyDrop(tripleCount));
      return;
    }

    runtime.inputLocked = false;
    this.options.render();
  }

  async finishItemResult(
    result: GameResult | null,
    didMatch: boolean,
    tripleCount: number,
  ): Promise<void> {
    const { runtime } = this.options;
    if (didMatch) {
      runtime.matchFeedbackActive = true;
      runtime.feedback = "match";
      this.options.render();
      await this.ensureMatchFeedback();
      if (runtime.destroyed) {
        return;
      }
    }

    await this.settleKeyDrop(tripleCount);
    if (runtime.destroyed) {
      return;
    }
    if (result !== null) {
      runtime.feedback = result.status;
      this.options.render();
      await this.options.particleEffects.play(result.status);
      if (runtime.destroyed) {
        return;
      }
      runtime.inputLocked = false;
      runtime.feedback = "idle";
      runtime.matchFeedbackActive = false;
      this.options.render();
      this.options.presentResult(result);
      return;
    }

    runtime.inputLocked = false;
    this.options.render();
  }

  ensureMatchFeedback(): Promise<void> {
    const { runtime } = this.options;
    if (runtime.matchAnimation !== null) {
      return runtime.matchAnimation;
    }
    if (!runtime.matchFeedbackActive) {
      return Promise.resolve();
    }

    runtime.inputLocked = true;
    if (runtime.feedback !== "match") {
      runtime.feedback = "match";
      this.options.render();
    }

    let animation: Promise<void>;
    animation = this.options.particleEffects.play("match").then(() => {
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
        this.options.render();
      }
    });
    runtime.matchAnimation = animation;
    return animation;
  }

  async waitForMeltAnimation(): Promise<void> {
    const meltAnimation = this.options.runtime.meltAnimation;
    if (meltAnimation !== null) {
      await meltAnimation;
    }
  }

  async settleKeyDrop(tripleCount: number, animate = true): Promise<void> {
    const { runtime, root } = this.options;
    const itemRuntime = runtime.itemRuntime;
    if (itemRuntime === null) {
      return;
    }

    const drop = itemRuntime.settleSuccessfulTriples(tripleCount);
    if (!drop.dropped) {
      return;
    }
    if (!animate || !runtime.started || runtime.destroyed) {
      this.options.render();
      return;
    }

    runtime.inputLocked = true;
    const source = root.querySelector<HTMLElement>('[data-testid="dog-tray-region"]');
    const target = root.querySelector<HTMLElement>('[data-loadout-id="key"]');
    const animation = animateDogKeyDropEffect({
      root,
      config: runtime.config,
      source: source?.getBoundingClientRect() ?? null,
      target: target?.getBoundingClientRect() ?? null,
    });
    runtime.activeFlights.add(animation);
    await animation.promise;
    runtime.activeFlights.delete(animation);
    if (runtime.destroyed) {
      return;
    }

    runtime.inputLocked = false;
    this.options.render();
  }

  private playMeltAnimations(
    meltedBlockIds: readonly string[],
    fallbackRects: ReadonlyMap<string, DOMRect>,
  ): Promise<void> {
    const { root, runtime } = this.options;
    const traySlots = [...root.querySelectorAll<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-block-id]',
    )];
    const animations: Promise<void>[] = [];
    for (const blockId of meltedBlockIds) {
      const target = traySlots.find((slot) => slot.dataset.blockId === blockId);
      const targetRect = target?.getBoundingClientRect() ?? fallbackRects.get(blockId);
      if (targetRect === undefined) {
        continue;
      }

      const effect = renderDogMeltEffect({
        root,
        config: runtime.config,
        blockId,
        target: targetRect,
      });
      if (effect === null) {
        continue;
      }

      animations.push(new Promise<void>((resolve) => {
        let settled = false;
        const finish = (): void => {
          if (settled) {
            return;
          }
          settled = true;
          effect.removeEventListener("animationend", handleAnimationEnd);
          window.clearTimeout(timer);
          effect.remove();
          resolve();
        };
        const handleAnimationEnd = (event: AnimationEvent): void => {
          if (event.animationName === "dog-freeze-melt") {
            finish();
          }
        };
        const timer = window.setTimeout(finish, runtime.config.animation.freezeMeltMs);
        effect.addEventListener("animationend", handleAnimationEnd);
      }));
    }

    return Promise.all(animations).then(() => undefined);
  }
}
