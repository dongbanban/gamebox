import type { GameSessionSnapshot } from "@/games/dog-lege-dog/game/game-session";
import {
  getDogPatternClassName,
  renderDogPatternAsset,
  getDogPatternAssetUrl,
} from "@/games/dog-lege-dog/assets/game-assets";
import {
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_SHUFFLE_MECHANISM_TYPE,
  getDogShuffleMechanismStatus,
  getDogIllusionDisguisedPattern,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  DogItemId,
  DogItemTargetType,
} from "@/games/dog-lege-dog/game/dog-loadout";
import type { DogVisualFeedback } from "@/games/dog-lege-dog/game/game-types";
import {
  getSpecialMechanismClass,
} from "@/games/dog-lege-dog/game/game-renderer-mechanisms";
import { isDogItemTargetable } from "@/games/dog-lege-dog/game/game-renderer-targets";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";

export function renderDogTray(
  session: GameSessionSnapshot,
  feedback: DogVisualFeedback,
  itemTargetType: DogItemTargetType | null,
  itemTargetId: DogItemId | null,
  targetBlockIds: readonly string[],
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const labels = config.ui.copy.labels;
  return `
    <section class="dog-tray" data-testid="dog-tray-region" aria-label="${labels.tray}">
      ${renderDogMatchFeedback(feedback, config)}
      ${renderDogShuffleStatus(session, config)}
      <ol class="dog-tray__slots" data-testid="dog-tray" data-tray-capacity="${session.trayCapacity}" data-effective-tray-capacity="${session.effectiveTrayCapacity}" data-tray-free-capacity="${session.trayFreeCapacity}" data-locked-tray-slot-count="${session.lockedTraySlotCount}" style="--dog-tray-columns: ${session.trayCapacity};">${renderDogTraySlots(session, itemTargetType, itemTargetId, targetBlockIds, config)}</ol>
      <p class="dog-game__status dog-game__status--${session.status}" data-testid="dog-status" role="status">${renderDogStatusMessage(session.status, config)}</p>
      <div class="dog-effects-layer" data-testid="dog-effects-layer">
        <canvas class="dog-effects-canvas" data-testid="dog-effects-canvas"></canvas>
      </div>
    </section>
  `;
}

export function renderDogTraySlots(
  session: GameSessionSnapshot,
  itemTargetType: DogItemTargetType | null = null,
  itemTargetId: DogItemId | null = null,
  targetBlockIds: readonly string[] = [],
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const slotCount = Math.max(session.trayCapacity, session.trayBlocks.length);
  return Array.from({ length: slotCount }, (_, index) =>
    renderDogTraySlot(session, index, itemTargetType, itemTargetId, targetBlockIds, config),
  ).join("");
}

export function renderDogTraySlot(
  session: GameSessionSnapshot,
  index: number,
  itemTargetType: DogItemTargetType | null = null,
  itemTargetId: DogItemId | null = null,
  targetBlockIds: readonly string[] = [],
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const details = getDogTraySlotRenderDetails(
    session,
    index,
    itemTargetType,
    itemTargetId,
    targetBlockIds,
    config,
  );
  const attributes = details.attributes
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");
  return `<li ${attributes}>${details.childrenMarkup}</li>`;
}

export function syncDogTraySlotElement(
  element: HTMLElement,
  session: GameSessionSnapshot,
  index: number,
  itemTargetType: DogItemTargetType | null = null,
  itemTargetId: DogItemId | null = null,
  targetBlockIds: readonly string[] = [],
  config: DogV13Config = DOG_V13_CONFIG,
): void {
  const details = getDogTraySlotRenderDetails(
    session,
    index,
    itemTargetType,
    itemTargetId,
    targetBlockIds,
    config,
  );
  const visualChanged = getDogTraySlotVisualKey(element) !== details.visualKey;
  const transientClasses = [
    "dog-tray__slot--illusion-reveal",
    "dog-tray__slot--unlocking",
  ].filter((className) => element.classList.contains(className));
  const transientAttributes: Array<[string, string]> = [];
  for (const [name, value] of [
    ["data-illusion-reveal", element.dataset.illusionReveal],
    ["data-unlocking", element.dataset.unlocking],
  ] as const) {
    if (value !== undefined) {
      transientAttributes.push([name, value]);
    }
  }
  const animationDuration = element.style.getPropertyValue("--dog-animation-duration");
  const attributes = details.attributes.map(([name, value]) => {
    if (name === "class" && transientClasses.length > 0) {
      return [name, `${value} ${transientClasses.join(" ")}`] as [string, string];
    }
    if (name === "style" && animationDuration !== "") {
      return [name, `${value} --dog-animation-duration: ${animationDuration};`] as [string, string];
    }
    return [name, value] as [string, string];
  });
  if (animationDuration !== "" && !attributes.some(([name]) => name === "style")) {
    attributes.push(["style", `--dog-animation-duration: ${animationDuration};`]);
  }
  syncElementAttributes(element, [...attributes, ...transientAttributes]);
  if (visualChanged) {
    element.innerHTML = details.childrenMarkup;
  }
}

interface DogTraySlotRenderDetails {
  readonly attributes: Array<[string, string]>;
  readonly childrenMarkup: string;
  readonly visualKey: string;
}

function getDogTraySlotRenderDetails(
  session: GameSessionSnapshot,
  index: number,
  itemTargetType: DogItemTargetType | null,
  itemTargetId: DogItemId | null,
  targetBlockIds: readonly string[],
  config: DogV13Config,
): DogTraySlotRenderDetails {
  const labels = config.ui.copy.labels;
  const block = session.trayBlocks[index];
  if (block === undefined) {
    const locked = index >= session.trayCapacity - session.lockedTraySlotCount;
    const className = locked
      ? "dog-tray__slot dog-tray__slot--locked"
      : "dog-tray__slot";
    return {
      attributes: [
        ["class", className],
        ["data-testid", "dog-tray-slot"],
        ["data-tray-slot-index", String(index)],
        ["data-slot-state", locked ? "locked" : "empty"],
        ["aria-label", locked ? labels.lockedTraySlot : labels.emptyTraySlot],
      ],
      childrenMarkup: locked ? '<span class="dog-tray__lock" aria-hidden="true">🔒</span>' : "",
      visualKey: getTrayVisualKey(className, "", "", "", "", ""),
    };
  }

  const displayPatternType = getDogIllusionDisguisedPattern(block);
  const isIllusion = block.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE;
  const shuffleStatus = block.specialMechanism?.type === DOG_SHUFFLE_MECHANISM_TYPE
    ? getDogShuffleMechanismStatus(block.specialMechanism)
    : null;
  const shuffleClass = shuffleStatus === "armed"
    ? " dog-tray__slot--shuffle-armed"
    : shuffleStatus === "triggerable"
      ? " dog-tray__slot--shuffle-triggerable"
      : "";
  const mechanismClass = `${getSpecialMechanismClass(block.specialMechanism?.type)}${shuffleClass}`;
  const glyphClass = isIllusion
    ? "dog-block__glyph dog-block__glyph--fuzzy"
    : "dog-block__glyph";
  const selectingBlockTarget = isDogItemTargetable(
    block.specialMechanism,
    itemTargetType,
    itemTargetId,
    true,
    block.id,
    targetBlockIds,
  );
  const targetDisabled = itemTargetType !== null && !selectingBlockTarget;
  const className = `dog-tray__slot dog-tray__slot--filled${selectingBlockTarget ? " dog-tray__slot--item-targetable" : ""}${targetDisabled ? " dog-tray__slot--item-target-disabled" : ""}${block.visualMarker === "wildcard" ? " dog-tray__slot--wildcard" : ""} dog-block--${getDogPatternClassName(displayPatternType)}${mechanismClass}`;
  const shuffleStateLabel = shuffleStatus === null
    ? ""
    : config.ui.copy.specialMechanisms.presentations.shuffle.stateLabels[shuffleStatus];
  const baseAccessibleLabel = selectingBlockTarget
    ? labels.itemTarget
    : block.visualMarker === "wildcard"
      ? `${labels.wildcard}，${block.patternType}`
      : block.patternType;
  const accessibleLabel = shuffleStateLabel === ""
    ? baseAccessibleLabel
    : `${baseAccessibleLabel}，${shuffleStateLabel}`;
  const attributes: Array<[string, string]> = [
    ["class", className],
    ["data-testid", "dog-tray-slot"],
    ["data-tray-slot-index", String(index)],
    ["data-slot-state", "filled"],
    ["data-block-id", block.id],
    ["data-pattern-type", block.patternType],
  ];
  if (block.visualMarker !== undefined) {
    attributes.push(["data-visual-marker", block.visualMarker]);
  }
  appendMechanismAttributes(attributes, block.specialMechanism);
  if (shuffleStatus !== null) {
    attributes.push(["data-shuffle-state", shuffleStatus]);
  }
  if (selectingBlockTarget) {
    attributes.push(["data-item-targetable", "true"], ["role", "button"], ["tabindex", "0"]);
  }
  if (targetDisabled) {
    attributes.push(["data-item-target-disabled", "true"], ["aria-disabled", "true"]);
  }
  if (isIllusion) {
    attributes.push(["style", `--dog-illusion-image: url(${getDogPatternAssetUrl(displayPatternType, config)});`]);
  }
  attributes.push(["aria-label", accessibleLabel]);
  return {
    attributes,
    childrenMarkup: `<span class="${glyphClass}">${renderDogPatternAsset(displayPatternType, config)}</span>`,
    visualKey: getTrayVisualKey(
      className,
      block.patternType,
      block.specialMechanism?.type,
      typeof block.specialMechanism?.state.disguisedPatternType === "string"
        ? block.specialMechanism.state.disguisedPatternType
        : "",
      block.visualMarker,
      glyphClass,
    ),
  };
}

function appendMechanismAttributes(
  attributes: Array<[string, string]>,
  mechanism: GameSessionSnapshot["trayBlocks"][number]["specialMechanism"],
): void {
  if (mechanism === undefined) {
    return;
  }

  attributes.push(["data-special-mechanism", mechanism.type]);
  const status = mechanism.state.status;
  if (typeof status === "string") {
    attributes.push(["data-special-mechanism-state", status]);
  }
  const disguisedPatternType = mechanism.state.disguisedPatternType;
  if (typeof disguisedPatternType === "string") {
    attributes.push(["data-disguised-pattern-type", disguisedPatternType]);
  }
  const completedTriples = mechanism.state.completedTriples;
  if (typeof completedTriples === "number") {
    attributes.push(["data-special-mechanism-progress", String(completedTriples)]);
  }
}

function getDogTraySlotVisualKey(element: HTMLElement): string {
  const glyph = element.querySelector<HTMLElement>(".dog-block__glyph");
  return getTrayVisualKey(
    element.className,
    element.dataset.patternType,
    element.dataset.specialMechanism,
    element.dataset.disguisedPatternType,
    element.dataset.visualMarker,
    glyph?.className,
  );
}

function getTrayVisualKey(
  className: string,
  patternType: string | undefined,
  mechanismType: string | undefined,
  disguisedPatternType: string | undefined,
  visualMarker: string | undefined,
  glyphClass: string | undefined,
): string {
  return [
    getStaticClassKey(className),
    patternType ?? "",
    mechanismType ?? "",
    disguisedPatternType ?? "",
    visualMarker ?? "",
    glyphClass ?? "",
  ].join("|");
}

function syncElementAttributes(
  element: HTMLElement,
  attributes: readonly [string, string][],
): void {
  const desired = new Map(attributes);
  for (const attribute of [...element.attributes]) {
    if (!desired.has(attribute.name)) {
      element.removeAttribute(attribute.name);
    }
  }
  for (const [name, value] of attributes) {
    if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }
}

function getStaticClassKey(className: string): string {
  return className
    .split(/\s+/)
    .filter((name) =>
      name !== "" &&
      name !== "dog-tray__slot--item-targetable" &&
      name !== "dog-tray__slot--item-target-disabled" &&
      name !== "dog-tray__slot--illusion-reveal" &&
      name !== "dog-tray__slot--unlocking" &&
      name !== "dog-tray__slot--shuffle-armed" &&
      name !== "dog-tray__slot--shuffle-triggerable"
    )
    .sort()
    .join(" ");
}

export function renderDogShuffleStatus(
  session: GameSessionSnapshot,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  if (session.shuffle === null) {
    return "";
  }

  const presentation = config.ui.copy.specialMechanisms.presentations.shuffle;
  const stateLabel = presentation.stateLabels[session.shuffle.status];
  return `<p class="dog-tray__shuffle-status" data-testid="dog-shuffle-status" role="status" aria-live="polite" data-shuffle-state="${session.shuffle.status}" data-shuffle-threshold="${session.shuffle.threshold}">${presentation.name}：${stateLabel}</p>`;
}

export function renderDogStatusMessage(
  status: GameSessionSnapshot["status"],
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  if (status === "won") {
    return config.ui.copy.labels.status.won;
  }

  if (status === "lost") {
    return config.ui.copy.labels.status.lost;
  }

  return "";
}

export function renderDogMatchFeedback(
  feedback: DogVisualFeedback,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  if (feedback !== "match") {
    return "";
  }

  return `
    <div class="dog-match-effect" data-testid="dog-match-effect" role="status" aria-label="${config.ui.copy.labels.match}" style="--dog-animation-duration: ${config.ui.particles.match.durationMs}ms;">
      <span class="dog-match-effect__ring"></span>
      ${Array.from({ length: 8 }, (_, index) => `<span class="dog-match-effect__spark dog-match-effect__spark--${index + 1}"></span>`).join("")}
    </div>
  `;
}
