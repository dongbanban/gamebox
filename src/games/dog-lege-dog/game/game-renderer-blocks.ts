import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-types";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
} from "@/games/dog-lege-dog/levels/level-types";
import { getDogBlockVisualMetrics } from "@/games/dog-lege-dog/visual-metrics";
import {
  getDogPatternClassName,
  getDogPatternAssetUrl,
  renderDogPatternAsset,
} from "@/games/dog-lege-dog/assets/game-assets";
import {
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  getDogIllusionDisguisedPattern,
} from "@/games/dog-lege-dog/game/special-mechanisms";
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
  const details = getDogBlockRenderDetails(block, options);
  const targetAttributes = details.selectingBlockTarget ? 'data-item-targetable="true"' : "";
  const illusionStyle = details.isIllusion
    ? ` --dog-illusion-image: url(${details.displayPatternAssetUrl});`
    : "";
  return `
    <button
      type="button"
      class="${details.className}"
      data-testid="dog-block"
      data-block-id="${block.id}"
      data-pattern-type="${block.patternType}"
      ${details.mechanismAttributes}
      ${targetAttributes}
      data-x="${block.x}"
      data-y="${block.y}"
      data-z="${block.z}"
      aria-label="${details.accessibleLabel}"
      ${details.selectable ? "" : "disabled"}
      style="--block-left: ${details.left}px; --block-top: ${details.top}px; --block-width: ${details.blockWidth}px; --block-height: ${details.blockHeight}px; --block-z: ${block.z};${illusionStyle}"
    ><span class="${details.glyphClass}">${renderDogPatternAsset(details.displayPatternType, details.config)}</span>${renderSpecialMechanismIcon(details.boardMechanismType)}</button>
  `;
}

export function syncDogBlockElement(
  element: HTMLElement,
  block: DogLegeDogLevel["blocks"][number],
  options: DogBlockRenderOptions,
): HTMLElement {
  const details = getDogBlockRenderDetails(block, options);
  if (getDogBlockVisualKey(element) !== details.visualKey) {
    const replacement = parseDogBlockElement(renderDogBlock(block, options));
    element.replaceWith(replacement);
    return replacement;
  }

  const detectorRevealClass = element.classList.contains("dog-block--detector-reveal")
    ? " dog-block--detector-reveal"
    : "";
  element.className = `${details.className}${detectorRevealClass}`;
  element.dataset.blockId = block.id;
  element.dataset.patternType = block.patternType;
  syncDogBlockMechanismAttributes(element, block.specialMechanism);
  if (details.selectingBlockTarget) {
    element.dataset.itemTargetable = "true";
  } else {
    delete element.dataset.itemTargetable;
  }
  element.dataset.x = String(block.x);
  element.dataset.y = String(block.y);
  element.dataset.z = String(block.z);
  element.setAttribute("aria-label", details.accessibleLabel);
  element.toggleAttribute("disabled", !details.selectable);
  element.style.setProperty("--block-left", `${details.left}px`);
  element.style.setProperty("--block-top", `${details.top}px`);
  element.style.setProperty("--block-width", `${details.blockWidth}px`);
  element.style.setProperty("--block-height", `${details.blockHeight}px`);
  element.style.setProperty("--block-z", String(block.z));
  if (details.isIllusion) {
    element.style.setProperty("--dog-illusion-image", `url(${details.displayPatternAssetUrl})`);
  } else {
    element.style.removeProperty("--dog-illusion-image");
  }
  if (element instanceof HTMLButtonElement) {
    element.disabled = !details.selectable;
  }
  return element;
}

interface DogBlockRenderDetails {
  readonly config: DogV13Config;
  readonly displayPatternType: DogLegeDogLevel["blocks"][number]["patternType"];
  readonly displayPatternAssetUrl: string;
  readonly boardMechanismType: string | undefined;
  readonly className: string;
  readonly mechanismAttributes: string;
  readonly isIllusion: boolean;
  readonly glyphClass: string;
  readonly left: number;
  readonly top: number;
  readonly blockWidth: number;
  readonly blockHeight: number;
  readonly selectingBlockTarget: boolean;
  readonly selectable: boolean;
  readonly accessibleLabel: string;
  readonly visualKey: string;
}

function getDogBlockRenderDetails(
  block: DogLegeDogLevel["blocks"][number],
  options: DogBlockRenderOptions,
): DogBlockRenderDetails {
  const config = options.config ?? DOG_V13_CONFIG;
  const visual = getDogBlockVisualMetrics(config);
  const displayPatternType = getDogIllusionDisguisedPattern(block);
  const mechanismType = block.specialMechanism?.type;
  const boardMechanismType = isDogBoardOrdinaryVisual(mechanismType)
    ? undefined
    : mechanismType;
  const isIllusion = boardMechanismType === DOG_ILLUSION_MECHANISM_TYPE;
  const glyphClass = isIllusion
    ? "dog-block__glyph dog-block__glyph--fuzzy"
    : "dog-block__glyph";
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
  const className = `dog-block dog-block--board dog-block--${getDogPatternClassName(displayPatternType)}${getSpecialMechanismClass(boardMechanismType)}${selectingBlockTarget ? " dog-block--item-targetable" : ""}`;
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
  const accessibleLabel = selectingBlockTarget
    ? config.ui.copy.labels.itemTarget
    : config.ui.copy.labels.blockSelectable;
  return {
    config,
    displayPatternType,
    displayPatternAssetUrl: getDogPatternAssetUrl(displayPatternType, config),
    boardMechanismType,
    className,
    mechanismAttributes: renderSpecialMechanismAttributes(block.specialMechanism),
    isIllusion,
    glyphClass,
    left,
    top,
    blockWidth,
    blockHeight,
    selectingBlockTarget,
    selectable,
    accessibleLabel,
    visualKey: [
      getStaticClassKey(className, "dog-block--item-targetable"),
      block.patternType,
      mechanismType ?? "",
      typeof block.specialMechanism?.state.disguisedPatternType === "string"
        ? block.specialMechanism.state.disguisedPatternType
        : "",
      glyphClass,
      boardMechanismType === DOG_MAGNETIC_MECHANISM_TYPE ? "magnetic" : "",
    ].join("|"),
  };
}

function getDogBlockVisualKey(element: HTMLElement): string {
  const glyph = element.querySelector<HTMLElement>(".dog-block__glyph");
  return [
    getStaticClassKey(element.className, "dog-block--item-targetable"),
    element.dataset.patternType ?? "",
    element.dataset.specialMechanism ?? "",
    element.dataset.disguisedPatternType ?? "",
    glyph?.className ?? "",
    element.querySelector(".dog-block__mechanism-icon") === null ? "" : "magnetic",
  ].join("|");
}

function syncDogBlockMechanismAttributes(
  element: HTMLElement,
  mechanism: DogLegeDogLevel["blocks"][number]["specialMechanism"],
): void {
  for (const attribute of [
    "data-special-mechanism",
    "data-special-mechanism-state",
    "data-disguised-pattern-type",
    "data-special-mechanism-progress",
  ]) {
    element.removeAttribute(attribute);
  }
  if (mechanism === undefined) {
    return;
  }

  element.dataset.specialMechanism = mechanism.type;
  const status = mechanism.state.status;
  if (typeof status === "string") {
    element.dataset.specialMechanismState = status;
  }
  const disguisedPatternType = mechanism.state.disguisedPatternType;
  if (typeof disguisedPatternType === "string") {
    element.dataset.disguisedPatternType = disguisedPatternType;
  }
  const completedTriples = mechanism.state.completedTriples;
  if (typeof completedTriples === "number") {
    element.dataset.specialMechanismProgress = String(completedTriples);
  }
}

function parseDogBlockElement(markup: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  const element = template.content.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    throw new Error("Expected dog block markup to contain one element");
  }
  return element;
}

function getStaticClassKey(className: string, ...ignored: string[]): string {
  return className
    .split(/\s+/)
    .filter((name) => name !== "" && name !== "dog-block--detector-reveal" && !ignored.includes(name))
    .sort()
    .join(" ");
}

function clampVisualBlockPosition(
  position: number,
  minPosition: number,
  maxPosition: number,
): number {
  return Math.min(Math.max(position, minPosition), maxPosition);
}
