import { resolveAssetUrl } from "@/asset-url";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";

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
