import {
  createAnimationLifecycle,
  type CancellableAnimation,
} from "@/games/dog-lege-dog/assets/animation-lifecycle";
import { getDogBlockVisualMetrics } from "@/games/dog-lege-dog/visual-metrics";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config";
import {
  BLOCK_FLIGHT_DURATION_MS,
  DOG_DETECTOR_REVEAL_DURATION_MS,
  DOG_DEMAGNETIZER_DURATION_MS,
  DOG_ILLUSION_REVEAL_DURATION_MS,
  DOG_MAGNETIC_ATTRACTION_DURATION_MS,
  DOG_TWIN_SPLIT_DURATION_MS,
  clearDogAnimationDuration,
  resolveAnimationDuration,
  setDogAnimationDuration,
  type DogAnimationTimingOptions,
} from "@/games/dog-lege-dog/assets/animation-timing";

export interface BlockFlightOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly patternMarkup: string;
  readonly patternType?: string;
  readonly isIllusion?: boolean;
  readonly isMagnetic?: boolean;
  readonly source: DOMRect | null;
  readonly target: DOMRect | null;
}

export function animateBlockFlight(options: BlockFlightOptions): CancellableAnimation {
  const durationMs = resolveAnimationDuration(
    options.config,
    "blockFlightMs",
    BLOCK_FLIGHT_DURATION_MS,
  );
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(durationMs, () => undefined);
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
  const blockSizePx = getDogBlockVisualMetrics(options.config).blockSizePx;
  const sourceWidth = sourceRect?.width || blockSizePx;
  const sourceHeight = sourceRect?.height || blockSizePx;
  const flightTargetScale =
    options.config?.ui.visual.flightTargetScale ?? DOG_V13_CONFIG.ui.visual.flightTargetScale;
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
              transform: `translate3d(${targetLeft - sourceLeft}px, ${targetTop - sourceTop}px, 0) scale(${flightTargetScale})`,
              opacity: ".2",
            },
          ],
          {
            duration: durationMs,
            easing: "cubic-bezier(.22, .8, .35, 1)",
            fill: "forwards",
          },
        )
      : null;

  const lifecycle = createAnimationLifecycle(durationMs, () => {
    animation?.cancel();
    flight.remove();
  });

  animation?.addEventListener("finish", lifecycle.cancel, { once: true });
  animation?.addEventListener("cancel", lifecycle.cancel, { once: true });

  return lifecycle;
}

export interface DogMagneticAttractionEffectOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly sourceId: string;
  readonly targetId: string;
  readonly source: DOMRect | null;
  readonly target: DOMRect | null;
}

export function animateDogMagneticAttractionEffect(
  options: DogMagneticAttractionEffectOptions,
): CancellableAnimation {
  const durationMs = resolveAnimationDuration(
    options.config,
    "magneticAttractionMs",
    DOG_MAGNETIC_ATTRACTION_DURATION_MS,
  );
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(durationMs, () => undefined);
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
  const blockSizePx = getDogBlockVisualMetrics(options.config).blockSizePx;
  const sourceWidth = source?.width || blockSizePx;
  const sourceHeight = source?.height || blockSizePx;
  const targetWidth = target?.width || blockSizePx;
  const targetHeight = target?.height || blockSizePx;
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
  const effectHeight =
    options.config?.ui.visual.magneticEffectHeightPx ??
    DOG_V13_CONFIG.ui.visual.magneticEffectHeightPx;
  Object.assign(effect.style, {
    left: `${sourceCenterLeft}px`,
    top: `${sourceCenterTop - effectHeight / 2}px`,
    width: `${Math.max(distance, 1)}px`,
    height: `${effectHeight}px`,
  });
  setDogAnimationDuration(effect, durationMs);
  effect.style.setProperty("--dog-magnetic-angle", `${angle}deg`);
  layer.append(effect);

  return createAnimationLifecycle(durationMs, () => {
    effect.remove();
  });
}

export interface DogTwinSplitEffectOptions extends DogAnimationTimingOptions {
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
  const durationMs = resolveAnimationDuration(
    options.config,
    "twinSplitMs",
    DOG_TWIN_SPLIT_DURATION_MS,
  );
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(durationMs, () => undefined);
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
    width: `${anchor?.width || getDogBlockVisualMetrics(options.config).blockSizePx}px`,
    height: `${anchor?.height || getDogBlockVisualMetrics(options.config).blockSizePx}px`,
  });

  options.blockIds.slice(0, 2).forEach((blockId, index) => {
    const piece = document.createElement("span");
    piece.className = `dog-twin-split-effect__piece dog-twin-split-effect__piece--${index + 1}`;
    piece.dataset.twinBlockId = blockId;
    piece.innerHTML = options.patternMarkup;
    effect.append(piece);
  });
  setDogAnimationDuration(effect, durationMs);
  layer.append(effect);

  return createAnimationLifecycle(durationMs, () => {
    effect.remove();
  });
}

export interface DogIllusionRevealOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly blockId: string;
}

export function animateDogIllusionReveal(
  options: DogIllusionRevealOptions,
): CancellableAnimation {
  const durationMs = resolveAnimationDuration(
    options.config,
    "illusionRevealMs",
    DOG_ILLUSION_REVEAL_DURATION_MS,
  );
  const traySlot = [...options.root.querySelectorAll<HTMLElement>(
    '[data-testid="dog-tray-slot"][data-block-id]',
  )].find((slot) => slot.dataset.blockId === options.blockId) ?? null;

  traySlot?.classList.add("dog-tray__slot--illusion-reveal");
  if (traySlot !== null) {
    traySlot.dataset.illusionReveal = "true";
    setDogAnimationDuration(traySlot, durationMs);
  }

  return createAnimationLifecycle(durationMs, () => {
    traySlot?.classList.remove("dog-tray__slot--illusion-reveal");
    clearDogAnimationDuration(traySlot);
    if (traySlot?.dataset.illusionReveal === "true") {
      delete traySlot.dataset.illusionReveal;
    }
  });
}

export interface DogDetectorRevealOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly blockId: string;
  readonly patternMarkup: string;
}

export function animateDogDetectorReveal(
  options: DogDetectorRevealOptions,
): CancellableAnimation {
  const durationMs = resolveAnimationDuration(
    options.config,
    "itemFeedbackMs",
    DOG_DETECTOR_REVEAL_DURATION_MS,
  );
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
    setDogAnimationDuration(boardBlock, durationMs);
    boardBlock.append(revealGlyph);
  }

  return createAnimationLifecycle(durationMs, () => {
    boardBlock?.classList.remove("dog-block--detector-reveal");
    if (boardBlock?.dataset.detectorReveal === "true") {
      delete boardBlock.dataset.detectorReveal;
    }
    clearDogAnimationDuration(boardBlock);
    revealGlyph?.remove();
  });
}

export interface DogDemagnetizerEffectOptions extends DogAnimationTimingOptions {
  readonly root: HTMLElement;
  readonly blockId: string;
  readonly target: DOMRect | null;
}

export function animateDogDemagnetizerEffect(
  options: DogDemagnetizerEffectOptions,
): CancellableAnimation {
  const durationMs = resolveAnimationDuration(
    options.config,
    "itemFeedbackMs",
    DOG_DEMAGNETIZER_DURATION_MS,
  );
  const layer = options.root.querySelector<HTMLElement>(
    '[data-testid="dog-animation-layer"]',
  );
  if (layer === null) {
    return createAnimationLifecycle(durationMs, () => undefined);
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
    width: `${target?.width || getDogBlockVisualMetrics(options.config).blockSizePx}px`,
    height: `${target?.height || getDogBlockVisualMetrics(options.config).blockSizePx}px`,
  });
  setDogAnimationDuration(effect, durationMs);
  layer.append(effect);

  return createAnimationLifecycle(durationMs, () => {
    effect.remove();
  });
}
