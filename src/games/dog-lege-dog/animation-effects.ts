export const BLOCK_FLIGHT_DURATION_MS = 240;

export interface BlockFlightOptions {
  readonly root: HTMLElement;
  readonly patternMarkup: string;
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
  flight.className = "dog-flying-block";
  flight.dataset.testid = "dog-flight";
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
