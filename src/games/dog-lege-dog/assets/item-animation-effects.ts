import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import { renderDogItemAsset } from "@/games/dog-lege-dog/assets/item-assets";
import {
  createAnimationLifecycle,
  type CancellableAnimation,
} from "@/games/dog-lege-dog/assets/animation-lifecycle";
import { getDogBlockVisualMetrics } from "@/games/dog-lege-dog/visual-metrics";
import {
  DOG_V13_CONFIG,
} from "@/games/dog-lege-dog/game/game-config";
import {
  DOG_FREEZE_MELT_DURATION_MS,
  DOG_ITEM_FEEDBACK_DURATION_MS,
  DOG_KEY_DROP_DURATION_MS,
  DOG_TORCH_MELT_DURATION_MS,
  DOG_TRAY_UNLOCK_DURATION_MS,
  clearDogAnimationDuration,
  resolveAnimationDuration,
  setDogAnimationDuration,
  type DogAnimationTimingOptions,
} from "@/games/dog-lege-dog/assets/animation-timing";

export interface DogItemEffectOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly itemId: string;
  readonly visualFeedback: string | null;
}

export interface DogTripleRemovalEffectOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly itemId: string;
  readonly patternType: DogPatternType;
  readonly blockIds: readonly string[];
  readonly sourceRects: ReadonlyMap<string, DOMRect>;
  readonly target: DOMRect | null;
}

export function animateDogTripleRemovalEffect(
  options: DogTripleRemovalEffectOptions,
): CancellableAnimation {
  const durationMs = resolveAnimationDuration(
    options.config,
    "itemFeedbackMs",
    DOG_ITEM_FEEDBACK_DURATION_MS,
  );
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(durationMs, () => undefined);
  }

  const effect = document.createElement("div");
  effect.className = "dog-item-effect dog-triple-removal-effect";
  effect.dataset.testid = "dog-item-effect";
  effect.dataset.itemId = options.itemId;
  effect.dataset.itemFeedback = "triple-removal";
  effect.dataset.patternType = options.patternType;
  effect.dataset.blockIds = options.blockIds.join(",");
  const supplement = document.createElement("div");
  supplement.dataset.testid = "dog-triple-removal-effect";
  supplement.className = "dog-triple-removal-effect__supplement";
  const layerRect = layer.getBoundingClientRect();
  const target = options.target;
  const targetLeft = (target?.left ?? layerRect.left) - layerRect.left;
  const targetTop = (target?.top ?? layerRect.top) - layerRect.top;
  for (const blockId of options.blockIds) {
    const source = options.sourceRects.get(blockId);
    const sourceElement = document.createElement("span");
    sourceElement.className = "dog-triple-removal-effect__flight";
    sourceElement.dataset.blockId = blockId;
    sourceElement.textContent = "✦";
    const sourceLeft = (source?.left ?? layerRect.left) - layerRect.left;
    const sourceTop = (source?.top ?? layerRect.top) - layerRect.top;
    Object.assign(sourceElement.style, {
      left: `${sourceLeft}px`,
      top: `${sourceTop}px`,
      width: `${source?.width || getDogBlockVisualMetrics(options.config).blockSizePx}px`,
      height: `${source?.height || getDogBlockVisualMetrics(options.config).blockSizePx}px`,
      "--dog-triple-removal-target-x": `${targetLeft - sourceLeft}px`,
      "--dog-triple-removal-target-y": `${targetTop - sourceTop}px`,
    });
    supplement.append(sourceElement);
  }
  const spark = document.createElement("span");
  spark.className = "dog-item-effect__spark";
  spark.setAttribute("aria-hidden", "true");
  spark.textContent = "✦";
  effect.append(supplement, spark);
  setDogAnimationDuration(effect, durationMs);
  layer.append(effect);

  return createAnimationLifecycle(durationMs, () => {
    effect.remove();
  });
}

export function animateDogItemEffect(options: DogItemEffectOptions): CancellableAnimation {
  const durationMs = resolveAnimationDuration(
    options.config,
    "itemFeedbackMs",
    DOG_ITEM_FEEDBACK_DURATION_MS,
  );
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(durationMs, () => undefined);
  }

  const effect = document.createElement("div");
  effect.className = "dog-item-effect";
  effect.dataset.testid = "dog-item-effect";
  effect.dataset.itemId = options.itemId;
  effect.dataset.itemFeedback = options.visualFeedback ?? options.itemId;
  effect.innerHTML = '<span class="dog-item-effect__spark" aria-hidden="true">✦</span>';
  setDogAnimationDuration(effect, durationMs);
  layer.append(effect);

  const lifecycle = createAnimationLifecycle(durationMs, () => {
    effect.remove();
  });
  return lifecycle;
}

export interface DogTrayUnlockEffectOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly slotIndex: number;
}

export function animateDogUnlockTrayEffect(
  options: DogTrayUnlockEffectOptions,
): CancellableAnimation {
  const durationMs = resolveAnimationDuration(
    options.config,
    "trayUnlockMs",
    DOG_TRAY_UNLOCK_DURATION_MS,
  );
  const slot = [...options.root.querySelectorAll<HTMLElement>(
    '[data-testid="dog-tray-slot"][data-tray-slot-index]',
  )].find((candidate) => candidate.dataset.traySlotIndex === String(options.slotIndex)) ?? null;
  slot?.classList.add("dog-tray__slot--unlocking");
  if (slot !== null) {
    slot.dataset.unlocking = "true";
    setDogAnimationDuration(slot, durationMs);
  }

  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(durationMs, () => {
      slot?.classList.remove("dog-tray__slot--unlocking");
      clearDogAnimationDuration(slot);
      if (slot?.dataset.unlocking === "true") {
        delete slot.dataset.unlocking;
      }
    });
  }

  const effect = document.createElement("div");
  effect.className = "dog-tray-unlock-effect";
  effect.dataset.testid = "dog-tray-unlock-effect";
  effect.dataset.slotIndex = String(options.slotIndex);
  effect.setAttribute("aria-hidden", "true");
  effect.innerHTML = `<span class="dog-tray-unlock-effect__icon">${renderDogItemAsset("key", options.config)}</span>`;
  const layerRect = layer.getBoundingClientRect();
  const slotRect = slot?.getBoundingClientRect() ?? null;
  Object.assign(effect.style, {
    left: `${(slotRect?.left ?? layerRect.left) - layerRect.left}px`,
    top: `${(slotRect?.top ?? layerRect.top) - layerRect.top}px`,
    width: `${slotRect?.width || getDogBlockVisualMetrics(options.config).blockSizePx}px`,
    height: `${slotRect?.height || getDogBlockVisualMetrics(options.config).blockSizePx}px`,
  });
  setDogAnimationDuration(effect, durationMs);
  layer.append(effect);

  return createAnimationLifecycle(durationMs, () => {
    effect.remove();
    slot?.classList.remove("dog-tray__slot--unlocking");
    clearDogAnimationDuration(slot);
    if (slot?.dataset.unlocking === "true") {
      delete slot.dataset.unlocking;
    }
  });
}

export interface DogKeyDropEffectOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly source: DOMRect | null;
  readonly target: DOMRect | null;
}

export function animateDogKeyDropEffect(
  options: DogKeyDropEffectOptions,
): CancellableAnimation {
  const durationMs = resolveAnimationDuration(
    options.config,
    "keyDropMs",
    DOG_KEY_DROP_DURATION_MS,
  );
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(durationMs, () => undefined);
  }

  const effect = document.createElement("div");
  effect.className = "dog-key-drop-effect";
  effect.dataset.testid = "dog-key-drop-effect";
  effect.setAttribute("aria-hidden", "true");
  effect.innerHTML = renderDogItemAsset("key", options.config);
  const layerRect = layer.getBoundingClientRect();
  const source = options.source;
  const target = options.target;
  const keyDropSizePx =
    options.config?.ui.visual.keyDropSizePx ?? DOG_V13_CONFIG.ui.visual.keyDropSizePx;
  const sourceLeft = (source?.left ?? layerRect.left) - layerRect.left;
  const sourceTop = (source?.top ?? layerRect.top) - layerRect.top;
  const targetLeft = (target?.left ?? layerRect.left) - layerRect.left;
  const targetTop = (target?.top ?? layerRect.top) - layerRect.top;
  Object.assign(effect.style, {
    left: `${sourceLeft}px`,
    top: `${sourceTop}px`,
    width: `${source?.width || keyDropSizePx}px`,
    height: `${source?.height || keyDropSizePx}px`,
    "--dog-key-drop-target-x": `${targetLeft - sourceLeft}px`,
    "--dog-key-drop-target-y": `${targetTop - sourceTop}px`,
  });
  setDogAnimationDuration(effect, durationMs);
  layer.append(effect);

  return createAnimationLifecycle(durationMs, () => {
    effect.remove();
  });
}

export interface DogTorchMeltEffectOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly blockId: string;
  readonly location: "board" | "tray";
  readonly target: DOMRect | null;
}

export function animateDogTorchMeltEffect(
  options: DogTorchMeltEffectOptions,
): CancellableAnimation {
  const durationMs = resolveAnimationDuration(
    options.config,
    "itemFeedbackMs",
    DOG_TORCH_MELT_DURATION_MS,
  );
  const effect = renderDogMeltEffect({
    root: options.root,
    config: options.config,
    blockId: options.blockId,
    location: options.location,
    itemId: "torch",
    torch: true,
    target: options.target,
  });
  if (effect === null) {
    return createAnimationLifecycle(durationMs, () => undefined);
  }

  return createAnimationLifecycle(durationMs, () => {
    effect.remove();
  });
}

export interface DogMeltEffectRenderOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly blockId: string;
  readonly target: DOMRect | null;
  readonly itemId?: string;
  readonly location?: "board" | "tray";
  readonly torch?: boolean;
}

export function renderDogMeltEffect(
  options: DogMeltEffectRenderOptions,
): HTMLElement | null {
  const durationMs = resolveAnimationDuration(
    options.config,
    options.torch ? "itemFeedbackMs" : "freezeMeltMs",
    options.torch ? DOG_TORCH_MELT_DURATION_MS : DOG_FREEZE_MELT_DURATION_MS,
  );
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return null;
  }

  const effect = document.createElement("div");
  effect.className = options.torch
    ? "dog-melt-effect dog-melt-effect--torch"
    : "dog-melt-effect";
  if (options.itemId !== undefined) {
    effect.dataset.itemId = options.itemId;
    effect.dataset.testid = "dog-melt-effect";
  }
  effect.dataset.meltBlockId = options.blockId;
  if (options.location !== undefined) {
    effect.dataset.meltLocation = options.location;
  }
  effect.setAttribute("aria-hidden", "true");
  effect.innerHTML = `
    <span class="dog-melt-effect__flake">❄</span>
    <span class="dog-melt-effect__drop dog-melt-effect__drop--1"></span>
    <span class="dog-melt-effect__drop dog-melt-effect__drop--2"></span>
    <span class="dog-melt-effect__drop dog-melt-effect__drop--3"></span>
    <span class="dog-melt-effect__drop dog-melt-effect__drop--4"></span>
  `;
  const layerRect = layer.getBoundingClientRect();
  const target = options.target;
  Object.assign(effect.style, {
    left: `${(target?.left ?? layerRect.left) - layerRect.left}px`,
    top: `${(target?.top ?? layerRect.top) - layerRect.top}px`,
    width: `${target?.width || getDogBlockVisualMetrics(options.config).blockSizePx}px`,
    height: `${target?.height || getDogBlockVisualMetrics(options.config).blockSizePx}px`,
  });
  setDogAnimationDuration(effect, durationMs);
  layer.append(effect);
  return effect;
}
