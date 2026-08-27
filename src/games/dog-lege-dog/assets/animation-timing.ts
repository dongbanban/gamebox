import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";

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

export interface DogAnimationTimingOptions {
  readonly config?: DogV13Config;
}

export function resolveAnimationDuration(
  config: DogV13Config | undefined,
  key: Exclude<keyof DogV13Config["animation"], "inputLockedDuringAnimation">,
  fallback: number,
): number {
  return config?.animation[key] ?? fallback;
}

export function setDogAnimationDuration(element: HTMLElement, durationMs: number): void {
  element.style.setProperty("--dog-animation-duration", `${durationMs}ms`);
}

export function clearDogAnimationDuration(element: HTMLElement | null): void {
  element?.style.removeProperty("--dog-animation-duration");
}
