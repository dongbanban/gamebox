import { renderDogItemAsset } from "@/games/dog-lege-dog/assets/item-assets";
import {
  DOG_V13_CONFIG,
  type DogV13ItemId,
} from "@/games/dog-lege-dog/game/game-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";

/** Migration adapter. Item identity and quota policy live in v13 config. */
export const DOG_LOADOUT_SIZE = DOG_V13_CONFIG.items.loadoutSize;

export const DOG_ITEM_IDS = DOG_V13_CONFIG.items.ids;

export type DogItemId = DogV13ItemId;

export type DogItemTargetType =
  | "none"
  | "tray-block"
  | "block";

export type DogItemVisualFeedback = DogItemId;

export interface DogItemDefinition {
  readonly id: DogItemId;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly targetType: DogItemTargetType;
  readonly visualFeedback: DogItemVisualFeedback;
}

const DOG_ITEM_RULES: readonly Pick<DogItemDefinition, "id" | "targetType" | "visualFeedback">[] = [
  { id: "triple-removal", targetType: "tray-block", visualFeedback: "triple-removal" },
  { id: "tray-capacity", targetType: "none", visualFeedback: "tray-capacity" },
  { id: "wildcard", targetType: "tray-block", visualFeedback: "wildcard" },
  { id: "torch", targetType: "block", visualFeedback: "torch" },
  { id: "detector", targetType: "block", visualFeedback: "detector" },
  { id: "demagnetizer", targetType: "block", visualFeedback: "demagnetizer" },
  { id: "key", targetType: "none", visualFeedback: "key" },
];

export const DOG_ITEM_DEFINITIONS: readonly DogItemDefinition[] = Object.freeze(
  DOG_ITEM_RULES.map((rule) =>
    Object.freeze({
      ...rule,
      ...DOG_V13_CONFIG.ui.copy.items[rule.id],
    }),
  ),
);

const DOG_ITEM_ID_SET: ReadonlySet<string> = new Set(DOG_ITEM_IDS);

export function isDogItemId(value: string): value is DogItemId {
  return DOG_ITEM_ID_SET.has(value);
}

export function isValidDogLoadout(
  value: readonly string[] | null | undefined,
  loadoutSize: number = DOG_LOADOUT_SIZE,
): value is readonly DogItemId[] {
  return (
    value !== null &&
    value !== undefined &&
    value.length === loadoutSize &&
    new Set(value).size === loadoutSize &&
    value.every(isDogItemId)
  );
}

export function normalizeDogLoadout(
  value: readonly string[] | null | undefined,
  loadoutSize: number = DOG_LOADOUT_SIZE,
): readonly DogItemId[] | null {
  return isValidDogLoadout(value, loadoutSize) ? [...value] : null;
}

export function areDogLoadoutsEqual(
  first: readonly string[] | null | undefined,
  second: readonly string[] | null | undefined,
  loadoutSize: number = DOG_LOADOUT_SIZE,
): boolean {
  if (!isValidDogLoadout(first, loadoutSize) || !isValidDogLoadout(second, loadoutSize)) {
    return first === second;
  }

  return first.every((itemId) => second.includes(itemId));
}

export function getDogItemDefinition(
  itemId: DogItemId,
  config: DogV13Config = DOG_V13_CONFIG,
): DogItemDefinition {
  const definition = DOG_ITEM_DEFINITIONS.find((item) => item.id === itemId);
  if (definition === undefined) {
    throw new Error(`Unknown 狗了个狗 item id: ${itemId}`);
  }

  if (config === DOG_V13_CONFIG) {
    return definition;
  }

  return {
    ...definition,
    ...config.ui.copy.items[itemId],
  };
}

export interface DogLoadoutEditorRenderOptions {
  readonly mode: "initial" | "change";
  readonly draft: readonly DogItemId[];
  readonly current: readonly DogItemId[] | null;
  readonly levelNumber: number;
  readonly confirming: boolean;
  readonly changeTarget?: "current" | "next";
  readonly itemUses?: Partial<Record<DogItemId, number>>;
  readonly config?: DogV13Config;
  readonly loadoutSize?: number;
}

export interface DogLoadoutSummaryItemState {
  readonly id: DogItemId;
  readonly remainingUses: number;
  readonly available: boolean;
}

export interface DogLoadoutSummaryTargetState {
  readonly targetType: DogItemTargetType | null;
}

export function renderDogLoadoutEditor({
  mode,
  draft,
  current,
  levelNumber,
  confirming,
  changeTarget = "current",
  itemUses,
  config = DOG_V13_CONFIG,
  loadoutSize = config.items.loadoutSize,
}: DogLoadoutEditorRenderOptions): string {
  const isChange = mode === "change";
  const isNextChange = changeTarget === "next";
  const canConfirm = isValidDogLoadout(draft, loadoutSize) &&
    (!isChange || !areDogLoadoutsEqual(current, draft, loadoutSize));
  const copy = config.ui.copy.loadout;
  const title = isChange ? copy.changeTitle : copy.initialTitle;
  const intro = isChange
    ? isNextChange
      ? fillDogLoadoutCopy(copy.changeNextIntro, { levelNumber })
      : fillDogLoadoutCopy(copy.changeCurrentIntro, { levelNumber })
    : fillDogLoadoutCopy(copy.initialIntro, { loadoutSize });
  const titleId = `dog-loadout-title-${mode}`;
  const options = DOG_ITEM_DEFINITIONS.map((baseItem) => {
    const item = getDogItemDefinition(baseItem.id, config);
    const selected = draft.includes(item.id);
    const uses = itemUses?.[item.id];
    return `
      <button
        class="dog-loadout-option${selected ? " dog-loadout-option--selected" : ""}"
        type="button"
        data-action="toggle-loadout"
        data-testid="dog-loadout-option"
        data-loadout-id="${item.id}"
        aria-pressed="${selected}"
      >
        <span class="dog-loadout-option__heading">
          <span class="dog-loadout-option__icon" aria-hidden="true">${renderDogItemAsset(item.id, config)}</span>
          <strong>${item.name}</strong>
        </span>
        <span class="dog-loadout-option__description">${item.description}</span>
        <small class="dog-loadout-option__uses">${uses === undefined ? copy.usesFallback : fillDogLoadoutCopy(copy.usesPerLevel, { uses })}</small>
        <span class="dog-loadout-option__check" aria-hidden="true">${selected ? "✓" : ""}</span>
      </button>
    `;
  }).join("");

  const confirmation = confirming
    ? `
        <div class="dog-loadout-confirmation" data-testid="dog-loadout-confirmation" role="alert">
          <strong>${copy.confirmationTitle}</strong>
          <p>${isNextChange
            ? fillDogLoadoutCopy(copy.confirmationNext, { levelNumber })
            : copy.confirmationCurrent}</p>
          <div class="dog-loadout-confirmation__actions">
            <button class="text-button dog-loadout-editor__clear" type="button" data-action="cancel-loadout-confirmation">${copy.cancel}</button>
            <button class="primary-button" type="button" data-action="apply-loadout-change">${copy.confirm}</button>
          </div>
        </div>
      `
    : `
        <div class="dog-loadout-editor__actions">
          <button class="text-button dog-loadout-editor__clear" type="button" data-action="cancel-loadout">${isChange ? copy.cancel : copy.clear}</button>
          <button class="primary-button" type="button" data-action="confirm-loadout" data-testid="dog-loadout-confirm" ${canConfirm ? "" : "disabled"}>
            ${copy.confirm}
          </button>
        </div>
      `;

  return `
    <div class="dog-loadout-modal" data-testid="dog-loadout-modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="dog-loadout-modal__backdrop" aria-hidden="true"></div>
      <section class="dog-loadout" data-testid="dog-loadout-panel" data-mode="${mode}">
        <div class="dog-loadout__heading">
          <div>
            <h3 id="${titleId}">${title}</h3>
            <p>${intro}</p>
          </div>
          <span class="dog-loadout__count" data-testid="dog-loadout-count">${draft.length}/${loadoutSize}</span>
        </div>
        <div class="dog-loadout__options">${options}</div>
        ${confirmation}
      </section>
    </div>
  `;
}

export function renderDogLoadoutSummary(
  loadout: readonly DogItemId[],
  inputLocked = false,
  itemStates: readonly DogLoadoutSummaryItemState[] = [],
  targetState?: DogLoadoutSummaryTargetState,
  loadoutLocked = inputLocked,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const copy = config.ui.copy.loadout;
  const targetType = targetState?.targetType ?? null;
  const isTargeting = targetType !== null;
  const targetPrompt = isTargeting
    ? `
        <div class="dog-item-targeting" data-testid="dog-item-targeting" role="status">
          <span class="dog-item-targeting__label">${copy.targetPrompt}</span>
        </div>
      `
    : "";

  return `
    <section
      class="dog-loadout-summary"
      data-testid="dog-loadout-summary"
      data-target-type="${targetType ?? ""}"
      aria-label="${copy.summaryAriaLabel}"
    >
      <div class="dog-loadout-summary__items">
        ${loadout.map((itemId) => {
          const item = getDogItemDefinition(itemId, config);
          const state = itemStates.find((itemState) => itemState.id === itemId);
          const available = !inputLocked && (state?.available ?? true);
          const remainingUses = state?.remainingUses;
          const remainingLabel = remainingUses === undefined
            ? ""
            : fillDogLoadoutCopy(copy.remainingUses, { uses: remainingUses });
          const usageBadge = remainingUses === undefined
            ? ""
            : `<span class="dog-loadout-thumbnail__uses" data-testid="dog-loadout-thumbnail-uses" aria-hidden="true">${remainingUses}</span>`;
          return `<button
            class="dog-loadout-thumbnail${available ? "" : " dog-loadout-thumbnail--unavailable"}"
            type="button"
            data-action="use-item"
            data-item-id="${itemId}"
            data-item-target-type="${item.targetType}"
            data-item-feedback="${item.visualFeedback}"
            data-testid="dog-loadout-thumbnail"
            data-loadout-id="${itemId}"
            data-item-available="${available}"
            aria-label="${item.name}${remainingLabel}"
            ${available ? "" : "disabled"}
          >
            <span class="dog-loadout-thumbnail__icon" aria-hidden="true">${renderDogItemAsset(item.id, config)}</span>
            ${usageBadge}
          </button>`;
        }).join("")}
      </div>
      <div class="dog-loadout-summary__actions" data-testid="dog-loadout-actions">
        ${targetType === null
          ? ""
          : `<button class="text-button dog-loadout-summary__cancel" type="button" data-action="cancel-item-target">${copy.cancel}</button>`}
        <button class="text-button dog-loadout-summary__edit" type="button" data-action="edit-loadout" data-testid="dog-edit-loadout" ${loadoutLocked ? "disabled" : ""}>${copy.edit}</button>
      </div>
      ${targetPrompt}
    </section>
  `;
}

function fillDogLoadoutCopy(
  template: string,
  values: Readonly<Record<string, number>>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}
