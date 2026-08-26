import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/first-level";
import type { DogItemId, DogItemTargetType } from "@/games/dog-lege-dog/game/dog-loadout";
import type { DogLegeDogGameState } from "@/games/dog-lege-dog/game/game-types";

export function getActiveItemTargetBlockIds(
  state: DogLegeDogGameState,
): readonly string[] {
  if (state.items?.phase !== "targeting") {
    return [];
  }

  if (state.items.selectedItemId === "wildcard") {
    return state.items.wildcardTargetBlockIds;
  }

  if (state.items.selectedItemId === "triple-removal") {
    return state.items.tripleRemovalTargetBlockIds;
  }

  if (state.items.selectedItemId === "demagnetizer") {
    return state.items.demagnetizerTargetBlockIds;
  }

  return [];
}

export function isDogItemTargetable(
  mechanism: DogLegeDogLevel["blocks"][number]["specialMechanism"],
  itemTargetType: DogItemTargetType | null,
  itemTargetId: DogItemId | null,
  selectable = true,
  blockId = "",
  targetBlockIds: readonly string[] = [],
): boolean {
  if (!selectable) {
    return false;
  }

  if (itemTargetType === "tray-block") {
    return (itemTargetId === "triple-removal" || itemTargetId === "wildcard") &&
      targetBlockIds.includes(blockId);
  }

  if (itemTargetType !== "block") {
    return false;
  }

  if (itemTargetId === "torch") {
    return mechanism?.type === "freeze";
  }

  if (itemTargetId === "detector") {
    return mechanism?.type === "illusion";
  }

  if (itemTargetId === "demagnetizer") {
    return mechanism?.type === "magnetic";
  }

  return false;
}
