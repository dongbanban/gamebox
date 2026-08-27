import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-types";
import {
  DOG_V13_CONFIG,
  getDogV13ItemUses,
} from "@/games/dog-lege-dog/game/v13-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";

/** Reads item quota from current v13 config. Level state stays part of seam. */
export function getDogItemUses(
  _level: Pick<DogLegeDogLevel, "number">,
  itemId: DogItemId,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  return getDogV13ItemUses(itemId, config);
}

export function normalizeDogItemUses(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}
