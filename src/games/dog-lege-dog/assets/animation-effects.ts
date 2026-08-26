import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import { renderDogItemAsset } from "@/games/dog-lege-dog/assets/item-assets";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/game-config";

/** Migration adapters. Animation timing is owned by v13 config. */
export const BLOCK_FLIGHT_DURATION_MS = DOG_V13_CONFIG.animation.blockFlightMs;
export const DOG_ILLUSION_REVEAL_DURATION_MS = DOG_V13_CONFIG.animation.illusionRevealMs;
export const DOG_ITEM_FEEDBACK_DURATION_MS = DOG_V13_CONFIG.animation.itemFeedbackMs;
export const DOG_DETECTOR_REVEAL_DURATION_MS = DOG_ITEM_FEEDBACK_DURATION_MS;
export const DOG_DEMAGNETIZER_DURATION_MS = DOG_ITEM_FEEDBACK_DURATION_MS;
export const DOG_TORCH_MELT_DURATION_MS = DOG_ITEM_FEEDBACK_DURATION_MS;
export const DOG_FREEZE_MELT_DURATION_MS = DOG_V13_CONFIG.animation.freezeMeltMs;
export const DOG_TWIN_SPLIT_DURATION_MS = DOG_V13_CONFIG.animation.twinSplitMs;
export const DOG_MAGNETIC_ATTRACTION_DURATION_MS = DOG_V13_CONFIG.animation.magneticAttractionMs;
export const DOG_KEY_DROP_DURATION_MS = DOG_V13_CONFIG.animation.keyDropMs;
export const DOG_TRAY_UNLOCK_DURATION_MS = DOG_V13_CONFIG.animation.trayUnlockMs;

export interface BlockFlightOptions {
  readonly root: HTMLElement;
  readonly patternMarkup: string;
  readonly patternType?: string;
  readonly isIllusion?: boolean;
  readonly isMagnetic?: boolean;
  readonly source: DOMRect | null;
  readonly target: DOMRect | null;
}

export interface CancellableAnimation {
  readonly promise: Promise<void>;
  cancel(): void;
}

export function animateBlockFlight(options: BlockFlightOptions): CancellableAnimation {
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(BLOCK_FLIGHT_DURATION_MS, () => undefined);
  }

  const flight = document.createElement("div");
  flight.className = options.isIllusion
    ? "dog-flying-block dog-flying-block--illusion"
    : "dog-flying-block";
  flight.dataset.testid = "dog-flight";
  if (options.patternType !== undefined) {
    flight.dataset.patternType = options.patternType;
  }
  if (options.isIllusion) {
    flight.dataset.illusionFlight = "true";
  }
  if (options.isMagnetic) {
    flight.dataset.magneticFlight = "true";
  }
  flight.innerHTML = options.patternMarkup;
  layer.append(flight);

  const layerRect = layer.getBoundingClientRect();
  const sourceRect = options.source;
  const targetRect = options.target;
  const sourceLeft = sourceRect === null ? layerRect.width * 0.5 : sourceRect.left - layerRect.left;
  const sourceTop = sourceRect === null ? layerRect.height * 0.3 : sourceRect.top - layerRect.top;
  const sourceWidth = sourceRect?.width || 48;
  const sourceHeight = sourceRect?.height || 48;
  const targetLeft =
    targetRect === null ? layerRect.width * 0.5 : targetRect.left - layerRect.left;
  const targetTop = targetRect === null ? layerRect.height * 0.84 : targetRect.top - layerRect.top;

  Object.assign(flight.style, {
    left: `${sourceLeft}px`,
    top: `${sourceTop}px`,
    width: `${sourceWidth}px`,
    height: `${sourceHeight}px`,
  });

  const animation =
    typeof flight.animate === "function"
      ? flight.animate(
          [
            { transform: "translate3d(0, 0, 0) scale(1)", opacity: "1" },
            {
              transform: `translate3d(${targetLeft - sourceLeft}px, ${targetTop - sourceTop}px, 0) scale(.48)`,
              opacity: ".2",
            },
          ],
          {
            duration: BLOCK_FLIGHT_DURATION_MS,
            easing: "cubic-bezier(.22, .8, .35, 1)",
            fill: "forwards",
          },
        )
      : null;

  const lifecycle = createAnimationLifecycle(BLOCK_FLIGHT_DURATION_MS, () => {
    animation?.cancel();
    flight.remove();
  });

  animation?.addEventListener("finish", lifecycle.cancel, { once: true });
  animation?.addEventListener("cancel", lifecycle.cancel, { once: true });

  return lifecycle;
}

export interface DogMagneticAttractionEffectOptions {
  readonly root: HTMLElement;
  readonly sourceId: string;
  readonly targetId: string;
  readonly source: DOMRect | null;
  readonly target: DOMRect | null;
}

export function animateDogMagneticAttractionEffect(
  options: DogMagneticAttractionEffectOptions,
): CancellableAnimation {
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(DOG_MAGNETIC_ATTRACTION_DURATION_MS, () => undefined);
  }

  const effect = document.createElement("div");
  effect.className = "dog-magnetic-attraction-effect";
  effect.dataset.testid = "dog-magnetic-effect";
  effect.dataset.sourceId = options.sourceId;
  effect.dataset.targetId = options.targetId;
  effect.setAttribute("aria-hidden", "true");
  effect.innerHTML = `
    <span class="dog-magnetic-attraction-effect__track"></span>
    <span class="dog-magnetic-attraction-effect__ring dog-magnetic-attraction-effect__ring--source"></span>
    <span class="dog-magnetic-attraction-effect__ring dog-magnetic-attraction-effect__ring--target"></span>
    <span class="dog-magnetic-attraction-effect__pulse dog-magnetic-attraction-effect__pulse--1"></span>
    <span class="dog-magnetic-attraction-effect__pulse dog-magnetic-attraction-effect__pulse--2"></span>
    <span class="dog-magnetic-attraction-effect__pulse dog-magnetic-attraction-effect__pulse--3"></span>
  `;
  const layerRect = layer.getBoundingClientRect();
  const source = options.source;
  const target = options.target;
  const sourceWidth = source?.width || 48;
  const sourceHeight = source?.height || 48;
  const targetWidth = target?.width || 48;
  const targetHeight = target?.height || 48;
  const sourceCenterLeft =
    (source?.left ?? layerRect.left) - layerRect.left + sourceWidth / 2;
  const sourceCenterTop =
    (source?.top ?? layerRect.top) - layerRect.top + sourceHeight / 2;
  const targetCenterLeft =
    (target?.left ?? layerRect.left) - layerRect.left + targetWidth / 2;
  const targetCenterTop =
    (target?.top ?? layerRect.top) - layerRect.top + targetHeight / 2;
  const deltaX = targetCenterLeft - sourceCenterLeft;
  const deltaY = targetCenterTop - sourceCenterTop;
  const distance = Math.hypot(deltaX, deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  const effectHeight = 32;
  Object.assign(effect.style, {
    left: `${sourceCenterLeft}px`,
    top: `${sourceCenterTop - effectHeight / 2}px`,
    width: `${Math.max(distance, 1)}px`,
    height: `${effectHeight}px`,
  });
  effect.style.setProperty("--dog-magnetic-angle", `${angle}deg`);
  layer.append(effect);

  return createAnimationLifecycle(DOG_MAGNETIC_ATTRACTION_DURATION_MS, () => {
    effect.remove();
  });
}

export interface DogTwinSplitEffectOptions {
  readonly root: HTMLElement;
  readonly sourceId: string;
  readonly blockIds: readonly string[];
  readonly patternMarkup: string;
  readonly source: DOMRect | null;
  readonly target: DOMRect | null;
}

export function animateDogTwinSplitEffect(
  options: DogTwinSplitEffectOptions,
): CancellableAnimation {
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(DOG_TWIN_SPLIT_DURATION_MS, () => undefined);
  }

  const effect = document.createElement("div");
  effect.className = "dog-twin-split-effect";
  effect.dataset.testid = "dog-twin-split-effect";
  effect.dataset.twinSourceId = options.sourceId;
  effect.dataset.twinBlockIds = options.blockIds.join(",");
  const layerRect = layer.getBoundingClientRect();
  const anchor = options.target ?? options.source;
  Object.assign(effect.style, {
    left: `${(anchor?.left ?? layerRect.left) - layerRect.left}px`,
    top: `${(anchor?.top ?? layerRect.top) - layerRect.top}px`,
    width: `${anchor?.width || 48}px`,
    height: `${anchor?.height || 48}px`,
  });

  options.blockIds.slice(0, 2).forEach((blockId, index) => {
    const piece = document.createElement("span");
    piece.className = `dog-twin-split-effect__piece dog-twin-split-effect__piece--${index + 1}`;
    piece.dataset.twinBlockId = blockId;
    piece.innerHTML = options.patternMarkup;
    effect.append(piece);
  });
  layer.append(effect);

  return createAnimationLifecycle(DOG_TWIN_SPLIT_DURATION_MS, () => {
    effect.remove();
  });
}

export interface DogIllusionRevealOptions {
  readonly root: HTMLElement;
  readonly blockId: string;
}

export function animateDogIllusionReveal(
  options: DogIllusionRevealOptions,
): CancellableAnimation {
  const traySlot = [...options.root.querySelectorAll<HTMLElement>(
    '[data-testid="dog-tray-slot"][data-block-id]',
  )].find((slot) => slot.dataset.blockId === options.blockId) ?? null;

  traySlot?.classList.add("dog-tray__slot--illusion-reveal");
  if (traySlot !== null) {
    traySlot.dataset.illusionReveal = "true";
  }

  return createAnimationLifecycle(DOG_ILLUSION_REVEAL_DURATION_MS, () => {
    traySlot?.classList.remove("dog-tray__slot--illusion-reveal");
    if (traySlot?.dataset.illusionReveal === "true") {
      delete traySlot.dataset.illusionReveal;
    }
  });
}

export interface DogDetectorRevealOptions {
  readonly root: HTMLElement;
  readonly blockId: string;
  readonly patternMarkup: string;
}

export function animateDogDetectorReveal(
  options: DogDetectorRevealOptions,
): CancellableAnimation {
  const boardBlock = [...options.root.querySelectorAll<HTMLElement>(
    '[data-testid="dog-block"][data-block-id]',
  )].find((block) => block.dataset.blockId === options.blockId) ?? null;
  const revealGlyph = boardBlock === null ? null : document.createElement("span");

  if (boardBlock !== null && revealGlyph !== null) {
    boardBlock.classList.add("dog-block--detector-reveal");
    boardBlock.dataset.detectorReveal = "true";
    revealGlyph.className = "dog-block__glyph dog-block__glyph--detector-reveal";
    revealGlyph.style.position = "absolute";
    revealGlyph.style.inset = "4px";
    revealGlyph.style.overflow = "hidden";
    revealGlyph.style.borderRadius = "inherit";
    revealGlyph.dataset.testid = "dog-detector-reveal";
    revealGlyph.innerHTML = options.patternMarkup;
    boardBlock.append(revealGlyph);
  }

  return createAnimationLifecycle(DOG_DETECTOR_REVEAL_DURATION_MS, () => {
    boardBlock?.classList.remove("dog-block--detector-reveal");
    if (boardBlock?.dataset.detectorReveal === "true") {
      delete boardBlock.dataset.detectorReveal;
    }
    revealGlyph?.remove();
  });
}

export interface DogDemagnetizerEffectOptions {
  readonly root: HTMLElement;
  readonly blockId: string;
  readonly target: DOMRect | null;
}

export function animateDogDemagnetizerEffect(
  options: DogDemagnetizerEffectOptions,
): CancellableAnimation {
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(DOG_DEMAGNETIZER_DURATION_MS, () => undefined);
  }

  const effect = document.createElement("div");
  effect.className = "dog-demagnetizer-effect";
  effect.dataset.testid = "dog-demagnetizer-effect";
  effect.dataset.itemId = "demagnetizer";
  effect.dataset.blockId = options.blockId;
  effect.setAttribute("aria-hidden", "true");
  effect.innerHTML = `
    <span class="dog-demagnetizer-effect__ring"></span>
    <span class="dog-demagnetizer-effect__mark">⊖</span>
  `;
  const layerRect = layer.getBoundingClientRect();
  const target = options.target;
  Object.assign(effect.style, {
    left: `${(target?.left ?? layerRect.left) - layerRect.left}px`,
    top: `${(target?.top ?? layerRect.top) - layerRect.top}px`,
    width: `${target?.width || 48}px`,
    height: `${target?.height || 48}px`,
  });
  layer.append(effect);

  return createAnimationLifecycle(DOG_DEMAGNETIZER_DURATION_MS, () => {
    effect.remove();
  });
}

export interface DogItemEffectOptions {
  readonly root: HTMLElement;
  readonly itemId: string;
  readonly visualFeedback: string | null;
}

export interface DogTripleRemovalEffectOptions {
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
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(DOG_ITEM_FEEDBACK_DURATION_MS, () => undefined);
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
      width: `${source?.width || 48}px`,
      height: `${source?.height || 48}px`,
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
  layer.append(effect);

  return createAnimationLifecycle(DOG_ITEM_FEEDBACK_DURATION_MS, () => {
    effect.remove();
  });
}

export function animateDogItemEffect(options: DogItemEffectOptions): CancellableAnimation {
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(DOG_ITEM_FEEDBACK_DURATION_MS, () => undefined);
  }

  const effect = document.createElement("div");
  effect.className = "dog-item-effect";
  effect.dataset.testid = "dog-item-effect";
  effect.dataset.itemId = options.itemId;
  effect.dataset.itemFeedback = options.visualFeedback ?? options.itemId;
  effect.innerHTML = '<span class="dog-item-effect__spark" aria-hidden="true">✦</span>';
  layer.append(effect);

  const lifecycle = createAnimationLifecycle(DOG_ITEM_FEEDBACK_DURATION_MS, () => {
    effect.remove();
  });
  return lifecycle;
}

export interface DogTrayUnlockEffectOptions {
  readonly root: HTMLElement;
  readonly slotIndex: number;
}

export function animateDogUnlockTrayEffect(
  options: DogTrayUnlockEffectOptions,
): CancellableAnimation {
  const slot = [...options.root.querySelectorAll<HTMLElement>(
    '[data-testid="dog-tray-slot"][data-tray-slot-index]',
  )].find((candidate) => candidate.dataset.traySlotIndex === String(options.slotIndex)) ?? null;
  slot?.classList.add("dog-tray__slot--unlocking");
  if (slot !== null) {
    slot.dataset.unlocking = "true";
  }

  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(DOG_TRAY_UNLOCK_DURATION_MS, () => {
      slot?.classList.remove("dog-tray__slot--unlocking");
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
  effect.innerHTML = `<span class="dog-tray-unlock-effect__icon">${renderDogItemAsset("key")}</span>`;
  const layerRect = layer.getBoundingClientRect();
  const slotRect = slot?.getBoundingClientRect() ?? null;
  Object.assign(effect.style, {
    left: `${(slotRect?.left ?? layerRect.left) - layerRect.left}px`,
    top: `${(slotRect?.top ?? layerRect.top) - layerRect.top}px`,
    width: `${slotRect?.width || 48}px`,
    height: `${slotRect?.height || 48}px`,
  });
  layer.append(effect);

  return createAnimationLifecycle(DOG_TRAY_UNLOCK_DURATION_MS, () => {
    effect.remove();
    slot?.classList.remove("dog-tray__slot--unlocking");
    if (slot?.dataset.unlocking === "true") {
      delete slot.dataset.unlocking;
    }
  });
}

export interface DogKeyDropEffectOptions {
  readonly root: HTMLElement;
  readonly source: DOMRect | null;
  readonly target: DOMRect | null;
}

export function animateDogKeyDropEffect(
  options: DogKeyDropEffectOptions,
): CancellableAnimation {
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(DOG_KEY_DROP_DURATION_MS, () => undefined);
  }

  const effect = document.createElement("div");
  effect.className = "dog-key-drop-effect";
  effect.dataset.testid = "dog-key-drop-effect";
  effect.setAttribute("aria-hidden", "true");
  effect.innerHTML = renderDogItemAsset("key");
  const layerRect = layer.getBoundingClientRect();
  const source = options.source;
  const target = options.target;
  const sourceLeft = (source?.left ?? layerRect.left) - layerRect.left;
  const sourceTop = (source?.top ?? layerRect.top) - layerRect.top;
  const targetLeft = (target?.left ?? layerRect.left) - layerRect.left;
  const targetTop = (target?.top ?? layerRect.top) - layerRect.top;
  Object.assign(effect.style, {
    left: `${sourceLeft}px`,
    top: `${sourceTop}px`,
    width: `${source?.width || 42}px`,
    height: `${source?.height || 42}px`,
    "--dog-key-drop-target-x": `${targetLeft - sourceLeft}px`,
    "--dog-key-drop-target-y": `${targetTop - sourceTop}px`,
  });
  layer.append(effect);

  return createAnimationLifecycle(DOG_KEY_DROP_DURATION_MS, () => {
    effect.remove();
  });
}

export interface DogTorchMeltEffectOptions {
  readonly root: HTMLElement;
  readonly blockId: string;
  readonly location: "board" | "tray";
  readonly target: DOMRect | null;
}

export function animateDogTorchMeltEffect(
  options: DogTorchMeltEffectOptions,
): CancellableAnimation {
  const effect = renderDogMeltEffect({
    root: options.root,
    blockId: options.blockId,
    location: options.location,
    itemId: "torch",
    torch: true,
    target: options.target,
  });
  if (effect === null) {
    return createAnimationLifecycle(DOG_TORCH_MELT_DURATION_MS, () => undefined);
  }

  return createAnimationLifecycle(DOG_TORCH_MELT_DURATION_MS, () => {
    effect.remove();
  });
}

export interface DogMeltEffectRenderOptions {
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
    width: `${target?.width || 48}px`,
    height: `${target?.height || 48}px`,
  });
  layer.append(effect);
  return effect;
}

function createAnimationLifecycle(
  durationMs: number,
  onComplete: () => void,
): CancellableAnimation {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  let resolvePromise: () => void = () => undefined;
  let complete: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  complete = (): void => {
    if (settled) {
      return;
    }

    settled = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    onComplete();
    resolvePromise();
  };
  timer = setTimeout(complete, durationMs);

  return { promise, cancel: complete };
}
