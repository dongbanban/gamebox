import { resolveAssetUrl } from "@/asset-url";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/game-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";

/** Migration adapter. Item asset paths are owned by v13 config. */
const DOG_ITEM_ASSET_PATHS: Readonly<Record<DogItemId, string>> = DOG_V13_CONFIG.assets.items;

export function getDogItemAssetUrl(
  itemId: DogItemId,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  return resolveAssetUrl(config.assets.items[itemId]);
}

export function renderDogItemAsset(
  itemId: DogItemId,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const assetUrl = getDogItemAssetUrl(itemId, config);

  return `
    <img src="${assetUrl}" crossorigin="anonymous" width="100%" height="100%" alt="" aria-hidden="true" />
  `;
}
