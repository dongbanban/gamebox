import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-types";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
} from "@/games/dog-lege-dog/levels/level-types";
import { getDogBlockVisualMetrics } from "@/games/dog-lege-dog/visual-metrics";
import {
  getDogPatternClassName,
  renderDogPatternAsset,
} from "@/games/dog-lege-dog/assets/game-assets";
import { getDogIllusionDisguisedPattern } from "@/games/dog-lege-dog/game/special-mechanisms";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import {
  getSpecialMechanismClass,
  isDogBoardOrdinaryVisual,
  renderSpecialMechanismAttributes,
  renderSpecialMechanismIcon,
} from "@/games/dog-lege-dog/game/game-renderer-mechanisms";
import { isDogItemTargetable } from "@/games/dog-lege-dog/game/game-renderer-targets";
import type {
  DogItemId,
  DogItemTargetType,
} from "@/games/dog-lege-dog/game/dog-loadout";

export const DOG_BLOCK_VISUAL_SIZE_PX = DOG_V13_CONFIG.ui.visual.blockSizePx;
export const DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX = DOG_BLOCK_VISUAL_SIZE_PX / BLOCK_WIDTH;
export const DOG_LOGICAL_UNIT_VISUAL_HEIGHT_PX = DOG_BLOCK_VISUAL_SIZE_PX / BLOCK_HEIGHT;
export const DOG_BOARD_SAFE_MARGIN_PX = DOG_V13_CONFIG.ui.visual.boardSafeMarginPx;

export {
  getDogBlockVisualMetrics,
  type DogBlockVisualConfig,
  type DogBlockVisualMetrics,
} from "@/games/dog-lege-dog/visual-metrics";

export interface DogBlockRenderOptions {
  readonly boardPixelWidth: number;
  readonly boardPixelHeight: number;
  readonly selectableBlockIds: readonly string[];
  readonly inputLocked: boolean;
  readonly itemTargetType: DogItemTargetType | null;
  readonly itemTargetId: DogItemId | null;
  readonly targetBlockIds: readonly string[];
  readonly config?: DogV13Config;
}

export function renderDogBlock(
  block: DogLegeDogLevel["blocks"][number],
  options: DogBlockRenderOptions,
): string {
  const config = options.config ?? DOG_V13_CONFIG;
  const visual = getDogBlockVisualMetrics(config);
  const labels = config.ui.copy.labels;
  const displayPatternType = getDogIllusionDisguisedPattern(block);
  const className = getDogPatternClassName(displayPatternType);
  const mechanismType = block.specialMechanism?.type;
  const boardMechanismType = isDogBoardOrdinaryVisual(mechanismType)
    ? undefined
    : mechanismType;
  const mechanismClass = getSpecialMechanismClass(boardMechanismType);
  const mechanismAttributes = renderSpecialMechanismAttributes(block.specialMechanism);
  const blockWidth = BLOCK_WIDTH * visual.unitWidthPx;
  const blockHeight = BLOCK_HEIGHT * visual.unitHeightPx;
  const left = clampVisualBlockPosition(
    block.x * visual.unitWidthPx,
    visual.boardSafeMarginPx,
    options.boardPixelWidth - blockWidth - visual.boardSafeMarginPx,
  );
  const top = clampVisualBlockPosition(
    block.y * visual.unitHeightPx,
    visual.boardSafeMarginPx,
    options.boardPixelHeight - blockHeight - visual.boardSafeMarginPx,
  );
  const selectingBlockTarget = isDogItemTargetable(
    block.specialMechanism,
    options.itemTargetType,
    options.itemTargetId,
    options.selectableBlockIds.includes(block.id),
    block.id,
    options.targetBlockIds,
  );
  const selectable = selectingBlockTarget || (
    options.itemTargetType === null &&
    !options.inputLocked &&
    options.selectableBlockIds.includes(block.id)
  );
  const targetAttributes = selectingBlockTarget ? 'data-item-targetable="true"' : "";
  const targetClass = selectingBlockTarget ? " dog-block--item-targetable" : "";
  return `
    <button
      type="button"
      class="dog-block dog-block--board dog-block--${className}${mechanismClass}${targetClass}"
      data-testid="dog-block"
      data-block-id="${block.id}"
      data-pattern-type="${block.patternType}"
      ${mechanismAttributes}
      ${targetAttributes}
      data-x="${block.x}"
      data-y="${block.y}"
      data-z="${block.z}"
      aria-label="${selectingBlockTarget ? labels.itemTarget : labels.blockSelectable}"
      ${selectable ? "" : "disabled"}
      style="--block-left: ${left}px; --block-top: ${top}px; --block-width: ${blockWidth}px; --block-height: ${blockHeight}px; --block-z: ${block.z};"
    ><span class="dog-block__glyph">${renderDogPatternAsset(displayPatternType, config)}</span>${renderSpecialMechanismIcon(boardMechanismType)}</button>
  `;
}

function clampVisualBlockPosition(
  position: number,
  minPosition: number,
  maxPosition: number,
): number {
  return Math.min(Math.max(position, minPosition), maxPosition);
}
