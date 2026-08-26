import type {
  DogLegeDogLevel,
} from "@/games/dog-lege-dog/levels/first-level";
import {
  DOG_V13_CONFIG,
  getDogV13ItemUses,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";

export function getDogItemUses(
  level: Pick<DogLegeDogLevel, "number"> &
    Partial<Pick<DogLegeDogLevel, "generatorVersion" | "specialMechanisms">>,
  itemId: DogItemId,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  if ((level.generatorVersion ?? config.game.generatorVersion) >= config.game.generatorVersion) {
    return getDogV13ItemUses(itemId, config);
  }

  // Legacy adapter. v13 quota comes from config.
  if (itemId === "key") {
    return config.items.key.initialUses;
  }

  if (itemId === "tray-capacity") {
    return 1;
  }

  const baseUses = level.number % 2 === 0 ? 2 : 1;
  const mechanismType = itemId === "torch" || itemId === "wildcard"
    ? "freeze"
    : itemId === "detector"
      ? "illusion"
      : itemId === "demagnetizer"
        ? "magnetic"
        : undefined;
  if (mechanismType === undefined) {
    return baseUses;
  }

  const configuration = level.specialMechanisms?.find(
    (candidate) => candidate.type === mechanismType,
  );
  if (configuration === undefined) {
    return baseUses;
  }

  const rangeBonus = Math.max(0, Math.ceil((configuration.max - 2) / 2));
  const densityBonus = Math.max(
    0,
    Math.ceil((configuration.densityWeight ?? 1) - 1),
  );
  const configuredBonus = configuration.itemUseBonus ?? 0;
  return baseUses + Math.max(rangeBonus, densityBonus, configuredBonus);
}

export function normalizeDogItemUses(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}
