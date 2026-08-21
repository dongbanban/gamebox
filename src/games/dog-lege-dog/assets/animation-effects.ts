export const BLOCK_FLIGHT_DURATION_MS = 240;
export const DOG_ITEM_FEEDBACK_DURATION_MS = 360;

export interface BlockFlightOptions {
  readonly root: HTMLElement;
  readonly patternMarkup: string;
  readonly patternType?: string;
  readonly revealsIllusion?: boolean;
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
  flight.className = options.revealsIllusion
    ? "dog-flying-block dog-flying-block--illusion"
    : "dog-flying-block";
  flight.dataset.testid = "dog-flight";
  if (options.patternType !== undefined) {
    flight.dataset.patternType = options.patternType;
  }
  if (options.revealsIllusion) {
    flight.dataset.illusionReveal = "true";
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

export interface DogItemEffectOptions {
  readonly root: HTMLElement;
  readonly itemId: string;
  readonly visualFeedback: string | null;
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
