import {
  DOG_ITEM_DEFINITIONS,
  renderDogLoadoutEditor,
  renderDogLoadoutSummary,
  type DogItemId,
} from "@/games/dog-lege-dog/game/dog-loadout";
import {
  DOG_V13_CONFIG,
  getDogV13ItemUses,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import type { DogLegeDogGameState } from "@/games/dog-lege-dog/game/game-types";

export function renderDogLoadoutArea(
  state: DogLegeDogGameState,
  config: DogV13Config,
): string {
  if (state.loadoutEditor !== null) {
    return renderDogLoadoutEditor({
      mode: state.loadoutEditor.mode,
      draft: state.loadoutEditor.draft,
      current: state.loadout,
      levelNumber: state.level.number,
      confirming: state.loadoutEditor.confirming,
      config,
      loadoutSize: config.items.loadoutSize,
      itemUses: Object.fromEntries(
        DOG_ITEM_DEFINITIONS.map((item) => [item.id, getDogV13ItemUses(item.id, config)]),
      ),
    });
  }

  if (state.loadout === null || state.items === null) {
    return "";
  }

  const targetType = state.items.phase === "targeting" ? state.items.selectedItemTargetType : null;
  return renderDogLoadoutSummary(
    state.loadout,
    state.inputLocked,
    state.items.items,
    { targetType },
    state.loadoutLocked,
    config,
  );
}

export function updateDogLoadoutArea(
  loadoutSlot: HTMLElement,
  state: DogLegeDogGameState,
  config: DogV13Config,
): void {
  const currentEditor = loadoutSlot.querySelector('[data-testid="dog-loadout-panel"]');
  const currentSummary = loadoutSlot.querySelector<HTMLElement>('[data-testid="dog-loadout-summary"]');
  if (
    state.loadoutEditor !== null ||
    currentEditor !== null ||
    state.loadout === null ||
    state.items === null
  ) {
    loadoutSlot.innerHTML = renderDogLoadoutArea(state, config);
    return;
  }

  const targetType = state.items.phase === "targeting"
    ? state.items.selectedItemTargetType
    : null;
  const hasSameLoadout = currentSummary !== null &&
    [...currentSummary.querySelectorAll<HTMLElement>('[data-testid="dog-loadout-thumbnail"]')]
      .map((button) => button.dataset.loadoutId)
      .every((itemId, index) => itemId === state.loadout?.[index]) &&
    currentSummary.querySelectorAll('[data-testid="dog-loadout-thumbnail"]').length === state.loadout.length;
  const hasSameTargetMarkup = currentSummary?.dataset.targetType === (targetType ?? "");

  if (!hasSameLoadout || !hasSameTargetMarkup || currentSummary === null) {
    loadoutSlot.innerHTML = renderDogLoadoutArea(state, config);
    return;
  }

  syncDogLoadoutSummary(currentSummary, state, config);
}

export function syncDogLoadoutSummary(
  summary: HTMLElement,
  state: DogLegeDogGameState,
  config: DogV13Config = DOG_V13_CONFIG,
): void {
  const itemStates = new Map(state.items?.items.map((item) => [item.id, item]) ?? []);
  for (const thumbnail of summary.querySelectorAll<HTMLButtonElement>(
    '[data-testid="dog-loadout-thumbnail"]',
  )) {
    const itemId = thumbnail.dataset.loadoutId;
    const itemState = itemId === undefined ? undefined : itemStates.get(itemId as DogItemId);
    if (itemState === undefined) {
      continue;
    }

    const available = state.inputLocked === false && itemState.available;
    thumbnail.classList.toggle("dog-loadout-thumbnail--unavailable", !available);
    thumbnail.disabled = !available;
    thumbnail.dataset.itemAvailable = String(available);
    thumbnail.setAttribute(
      "aria-label",
      `${itemState.name}${config.ui.copy.loadout.remainingUses.replaceAll(
        "{uses}",
        String(itemState.remainingUses),
      )}`,
    );
    const uses = thumbnail.querySelector<HTMLElement>(
      '[data-testid="dog-loadout-thumbnail-uses"]',
    );
    if (uses !== null) {
      uses.textContent = String(itemState.remainingUses);
    }
  }

  const editButton = summary.querySelector<HTMLButtonElement>('[data-action="edit-loadout"]');
  if (editButton !== null) {
    editButton.disabled = state.loadoutLocked;
  }
}
