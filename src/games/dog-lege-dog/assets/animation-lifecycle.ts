export interface CancellableAnimation {
  readonly promise: Promise<void>;
  cancel(): void;
}

export function createAnimationLifecycle(
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
