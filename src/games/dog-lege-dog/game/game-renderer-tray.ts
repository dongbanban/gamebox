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
  renderSpecialMechanismAttributes,
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
  const labels = config.ui.copy.labels;
  const slotCount = Math.max(session.trayCapacity, session.trayBlocks.length);
  return Array.from({ length: slotCount }, (_, index) => {
    const block = session.trayBlocks[index];
    if (block === undefined) {
      const locked = index >= session.trayCapacity - session.lockedTraySlotCount;
      return locked
        ? `<li class="dog-tray__slot dog-tray__slot--locked" data-testid="dog-tray-slot" data-tray-slot-index="${index}" data-slot-state="locked" aria-label="${labels.lockedTraySlot}"><span class="dog-tray__lock" aria-hidden="true">🔒</span></li>`
        : `<li class="dog-tray__slot" data-testid="dog-tray-slot" data-tray-slot-index="${index}" data-slot-state="empty" aria-label="${labels.emptyTraySlot}"></li>`;
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
    const mechanismAttributes = [
      renderSpecialMechanismAttributes(block.specialMechanism),
      shuffleStatus === null ? "" : `data-shuffle-state="${shuffleStatus}"`,
    ].filter(Boolean).join(" ");
    const glyphClass = isIllusion
      ? "dog-block__glyph dog-block__glyph--fuzzy"
      : "dog-block__glyph";
    const illusionStyle = isIllusion
      ? `style="--dog-illusion-image: url(${getDogPatternAssetUrl(displayPatternType, config)});"`
      : "";
    const selectingBlockTarget = isDogItemTargetable(
      block.specialMechanism,
      itemTargetType,
      itemTargetId,
      true,
      block.id,
      targetBlockIds,
    );
    const targetAttributes = selectingBlockTarget
      ? 'data-item-targetable="true" role="button" tabindex="0"'
      : "";
    const targetClass = selectingBlockTarget ? " dog-tray__slot--item-targetable" : "";
    const targetDisabled = itemTargetType !== null && !selectingBlockTarget;
    const targetDisabledAttributes = targetDisabled
      ? 'data-item-target-disabled="true" aria-disabled="true"'
      : "";
    const targetDisabledClass = targetDisabled ? " dog-tray__slot--item-target-disabled" : "";
    const shuffleStateLabel = shuffleStatus === null
      ? ""
      : config.ui.copy.specialMechanisms.presentations.shuffle.stateLabels?.[shuffleStatus] ?? shuffleStatus;
    const baseAccessibleLabel = selectingBlockTarget
      ? labels.itemTarget
      : block.visualMarker === "wildcard"
        ? `${labels.wildcard}，${block.patternType}`
        : block.patternType;
    const accessibleLabel = shuffleStateLabel === ""
      ? baseAccessibleLabel
      : `${baseAccessibleLabel}，${shuffleStateLabel}`;
    const visualMarkerClass = block.visualMarker === "wildcard"
      ? " dog-tray__slot--wildcard"
      : "";
    const visualMarkerAttributes = block.visualMarker === undefined
      ? ""
      : `data-visual-marker="${block.visualMarker}"`;
    return `
      <li class="dog-tray__slot dog-tray__slot--filled${targetClass}${targetDisabledClass}${visualMarkerClass} dog-block--${getDogPatternClassName(displayPatternType)}${mechanismClass}" data-testid="dog-tray-slot" data-tray-slot-index="${index}" data-slot-state="filled" data-block-id="${block.id}" data-pattern-type="${block.patternType}" ${visualMarkerAttributes} ${mechanismAttributes} ${targetAttributes} ${targetDisabledAttributes} ${illusionStyle} aria-label="${accessibleLabel}">
        <span class="${glyphClass}">${renderDogPatternAsset(displayPatternType, config)}</span>
      </li>
    `;
  }).join("");
}

export function renderDogShuffleStatus(
  session: GameSessionSnapshot,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  if (session.shuffle === null) {
    return "";
  }

  const presentation = config.ui.copy.specialMechanisms.presentations.shuffle;
  const stateLabel = presentation.stateLabels?.[session.shuffle.status] ?? session.shuffle.status;
  return `<p class="dog-tray__shuffle-status" data-testid="dog-shuffle-status" role="status" aria-live="polite" data-shuffle-state="${session.shuffle.status}" data-shuffle-threshold="${session.shuffle.threshold}">${presentation.name}：${stateLabel}，阈值 ${session.shuffle.threshold}</p>`;
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
