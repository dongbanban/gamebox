import type { DogItemTarget } from "@/games/dog-lege-dog/game/dog-item-runtime";
import type { DogGameRuntime } from "@/games/dog-lege-dog/game/dog-game-runtime-types";

export interface DogInputControllerOptions {
  readonly root: HTMLElement;
  readonly runtime: Pick<DogGameRuntime, "itemRuntime">;
  readonly selectBlock: (blockId: string, shouldAnimate: boolean) => void;
  readonly startItem: (itemId: string | undefined) => void;
  readonly confirmItemTarget: (target: DogItemTarget) => void;
  readonly cancelItemTarget: () => void;
  readonly toggleLoadout: (itemId: string | undefined) => void;
  readonly openLoadoutEditor: () => void;
  readonly cancelLoadoutEditor: () => void;
  readonly requestLoadoutConfirmation: () => void;
  readonly cancelLoadoutConfirmation: () => void;
  readonly applyLoadoutChange: () => void;
  readonly openSpecialMechanisms: () => void;
  readonly closeSpecialMechanisms: () => void;
  readonly toggleSound: () => void;
}

export interface DogInputController {
  destroy(): void;
}

export function bindDogInputController(
  options: DogInputControllerOptions,
): DogInputController {
  const { root, runtime } = options;

  const handlePointerUp = (event: Event): void => {
    if (runtime.itemRuntime?.getState().phase === "targeting") {
      const itemTarget = getItemTarget(event, runtime);
      if (itemTarget !== undefined) {
        event.preventDefault();
        options.confirmItemTarget(itemTarget);
      }
      return;
    }

    const blockId = getBlockId(event);
    if (blockId === undefined) {
      return;
    }
    event.preventDefault();
    options.selectBlock(blockId, true);
  };

  const handleClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-action]");
    const action = actionElement?.dataset.action;
    if (action === "toggle-loadout") {
      options.toggleLoadout(actionElement?.dataset.loadoutId);
      return;
    }
    if (action === "edit-loadout") {
      options.openLoadoutEditor();
      return;
    }
    if (action === "cancel-loadout") {
      options.cancelLoadoutEditor();
      return;
    }
    if (action === "confirm-loadout") {
      options.requestLoadoutConfirmation();
      return;
    }
    if (action === "cancel-loadout-confirmation") {
      options.cancelLoadoutConfirmation();
      return;
    }
    if (action === "apply-loadout-change") {
      options.applyLoadoutChange();
      return;
    }
    if (action === "open-special-mechanisms") {
      options.openSpecialMechanisms();
      return;
    }
    if (action === "close-special-mechanisms") {
      options.closeSpecialMechanisms();
      return;
    }
    if (action === "use-item") {
      options.startItem(actionElement?.dataset.itemId);
      return;
    }
    if (action === "cancel-item-target") {
      options.cancelItemTarget();
      return;
    }
    if (action === "toggle-sound") {
      options.toggleSound();
      return;
    }

    const eventDetail = "detail" in event && typeof event.detail === "number"
      ? event.detail
      : 0;
    if (eventDetail > 0) {
      return;
    }
    if (runtime.itemRuntime?.getState().phase === "targeting") {
      const itemTarget = getItemTarget(event, runtime);
      if (itemTarget !== undefined) {
        options.confirmItemTarget(itemTarget);
      }
      return;
    }

    const blockId = getBlockId(event);
    if (blockId !== undefined) {
      options.selectBlock(blockId, false);
    }
  };

  root.addEventListener("pointerup", handlePointerUp);
  root.addEventListener("click", handleClick);

  return {
    destroy(): void {
      root.removeEventListener("pointerup", handlePointerUp);
      root.removeEventListener("click", handleClick);
    },
  };
}

function getItemTarget(
  event: Event,
  runtime: Pick<DogGameRuntime, "itemRuntime">,
): DogItemTarget | undefined {
  const target = event.target;
  if (!(target instanceof Element)) {
    return undefined;
  }

  const targetElement = target.closest<HTMLElement>('[data-item-targetable="true"]');
  const itemTargetType = runtime.itemRuntime?.getState().selectedItemTargetType;
  if (
    targetElement === null ||
    (itemTargetType !== "block" && itemTargetType !== "tray-block")
  ) {
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

function getBlockId(event: Event): string | undefined {
  const target = event.target;
  if (!(target instanceof Element)) {
    return undefined;
  }
  return target.closest<HTMLElement>('[data-testid="dog-block"]')?.dataset.blockId;
}
