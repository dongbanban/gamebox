import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
} from "@/games/dog-lege-dog/levels/level-types";

export interface DogBlockVisualConfig {
  readonly ui: {
    readonly visual: {
      readonly blockSizePx: number;
      readonly boardSafeMarginPx: number;
    };
  };
}

export interface DogBlockVisualMetrics {
  readonly blockSizePx: number;
  readonly unitWidthPx: number;
  readonly unitHeightPx: number;
  readonly boardSafeMarginPx: number;
}

const DEFAULT_DOG_BLOCK_VISUAL_CONFIG: DogBlockVisualConfig = {
  ui: {
    visual: {
      blockSizePx: 48,
      boardSafeMarginPx: 12,
    },
  },
};

export function getDogBlockVisualMetrics(
  config: DogBlockVisualConfig = DEFAULT_DOG_BLOCK_VISUAL_CONFIG,
): DogBlockVisualMetrics {
  const blockSizePx = config.ui.visual.blockSizePx;
  return {
    blockSizePx,
    unitWidthPx: blockSizePx / BLOCK_WIDTH,
    unitHeightPx: blockSizePx / BLOCK_HEIGHT,
    boardSafeMarginPx: config.ui.visual.boardSafeMarginPx,
  };
}
