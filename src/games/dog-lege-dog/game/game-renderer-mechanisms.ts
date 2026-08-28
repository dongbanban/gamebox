import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-types";
import {
  getDogPatternClassName,
  renderDogPatternAsset,
} from "@/games/dog-lege-dog/assets/game-assets";
import {
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_SHUFFLE_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
  getDogIllusionDisguisedPattern,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";

export function renderDogSpecialMechanismModal(
  level: DogLegeDogLevel,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const copy = config.ui.copy.specialMechanisms;
  const mechanismTypes = Array.from(
    new Set(
      level.blocks
        .map((block) => block.specialMechanism?.type)
        .filter((type): type is string => type !== undefined),
    ),
  );
  const mechanismCards = mechanismTypes.length === 0
    ? `<p class="dog-special-mechanism-modal__empty" data-testid="dog-special-mechanism-empty">${copy.empty}</p>`
    : mechanismTypes.map((type) => {
      const presentation = copy.presentations[type as keyof typeof copy.presentations] ?? {
        name: type,
        description: copy.fallbackDescription,
      };
      const mechanismBlock = level.blocks.find(
        (block) => block.specialMechanism?.type === type,
      );
      return `
        <li class="dog-special-mechanism-card" data-testid="dog-special-mechanism" data-special-mechanism="${type}">
          ${mechanismBlock === undefined ? "" : renderDogSpecialMechanismThumbnail(mechanismBlock, config)}
          <div>
            <strong>${presentation.name}</strong>
            <p>${presentation.description}</p>
          </div>
        </li>
      `;
    }).join("");

  return `
    <div class="dog-special-mechanism-modal" data-testid="dog-special-mechanism-modal" role="dialog" aria-modal="true" aria-labelledby="dog-special-mechanism-title">
      <button class="dog-special-mechanism-modal__backdrop" type="button" data-action="close-special-mechanisms" aria-label="${copy.closeLabel}"></button>
      <section class="dog-special-mechanism-modal__dialog">
        <header class="dog-special-mechanism-modal__heading">
          <div>
            <span class="dog-special-mechanism-modal__eyebrow">${config.ui.copy.labels.level} ${level.number}</span>
            <h2 id="dog-special-mechanism-title">${copy.title}</h2>
            <p class="dog-special-mechanism-modal__hint">${copy.hint}</p>
          </div>
          <button class="dog-special-mechanism-modal__close" type="button" data-action="close-special-mechanisms" aria-label="${copy.closeLabel}">×</button>
        </header>
        <ul class="dog-special-mechanism-modal__list">${mechanismCards}</ul>
      </section>
    </div>
  `;
}

export function renderDogSpecialMechanismThumbnail(
  block: DogLegeDogLevel["blocks"][number],
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const mechanismType = block.specialMechanism?.type;
  const ordinaryVisual = isDogBoardOrdinaryVisual(mechanismType);
  const displayPatternType = ordinaryVisual
    ? block.patternType
    : getDogIllusionDisguisedPattern(block);
  const previewMechanismType = ordinaryVisual ? undefined : mechanismType;

  return `
    <span
      class="dog-special-mechanism-card__thumbnail dog-block dog-block--${getDogPatternClassName(displayPatternType)}${getSpecialMechanismClass(previewMechanismType)} dog-block--mechanism-preview"
      data-testid="dog-special-mechanism-thumbnail"
      ${renderSpecialMechanismAttributes(block.specialMechanism)}
      aria-hidden="true"
    ><span class="dog-block__glyph">${renderDogPatternAsset(displayPatternType, config)}</span>${renderSpecialMechanismIcon(previewMechanismType)}</span>
  `;
}

export function isDogBoardOrdinaryVisual(type: string | undefined): boolean {
  return type === DOG_ILLUSION_MECHANISM_TYPE ||
    type === DOG_SHUFFLE_MECHANISM_TYPE ||
    type === DOG_TWIN_MECHANISM_TYPE;
}

export function getSpecialMechanismClass(type: string | undefined): string {
  if (type === undefined) {
    return "";
  }

  return ` dog-block--special dog-block--special-${type.replace(/[^a-z0-9-]/gi, "-")}`;
}

export function renderSpecialMechanismAttributes(
  mechanism: DogLegeDogLevel["blocks"][number]["specialMechanism"],
): string {
  if (mechanism === undefined) {
    return "";
  }

  const status = mechanism.state.status;
  const completedTriples = mechanism.state.completedTriples;
  const disguisedPatternType = mechanism.state.disguisedPatternType;
  return [
    `data-special-mechanism="${mechanism.type}"`,
    typeof status === "string" ? `data-special-mechanism-state="${status}"` : "",
    typeof disguisedPatternType === "string"
      ? `data-disguised-pattern-type="${disguisedPatternType}"`
      : "",
    typeof completedTriples === "number"
      ? `data-special-mechanism-progress="${completedTriples}"`
      : "",
  ].filter(Boolean).join(" ");
}

export function renderSpecialMechanismIcon(type: string | undefined): string {
  if (type !== DOG_MAGNETIC_MECHANISM_TYPE) {
    return "";
  }

  return '<span class="dog-block__mechanism-icon dog-block__mechanism-icon--magnetic" aria-hidden="true">🧲</span>';
}
