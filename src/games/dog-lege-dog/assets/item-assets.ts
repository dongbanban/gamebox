import { resolveAssetUrl } from "@/asset-url";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";

const DOG_ITEM_ASSET_PATHS: Readonly<Record<DogItemId, string>> = Object.freeze({
  "triple-removal": "assets/dog-item-icons/triple-removal.svg",
  "tray-capacity": "assets/dog-item-icons/tray-capacity-plus-one.svg",
  wildcard: "assets/dog-item-icons/wildcard.svg",
  torch: "assets/dog-item-icons/torch.svg",
  detector: "assets/dog-item-icons/detector.svg",
});

export function getDogItemAssetUrl(itemId: DogItemId): string {
  return resolveAssetUrl(DOG_ITEM_ASSET_PATHS[itemId]);
}

export function renderDogItemAsset(itemId: DogItemId): string {
  const assetUrl = getDogItemAssetUrl(itemId);

  return `
    <img src="${assetUrl}" crossorigin="anonymous" width="100%" height="100%" alt="" aria-hidden="true" />
  `;
}
