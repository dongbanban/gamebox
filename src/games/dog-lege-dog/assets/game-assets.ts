import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import { resolveAssetUrl } from "@/asset-url";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/game-config";

export interface DogPatternPresentation {
  readonly className: string;
  readonly assetPath: string;
}

/** Migration adapter. Asset paths are owned by v13 config. */
const DOG_PATTERN_ASSET_PATHS: Readonly<Record<DogPatternType, string>> =
  DOG_V13_CONFIG.assets.patterns;

export const DOG_PATTERN_PRESENTATIONS: Readonly<Record<DogPatternType, DogPatternPresentation>> =
  Object.freeze({
    打工狗: {
      className: "working-dog",
      assetPath: DOG_PATTERN_ASSET_PATHS.打工狗,
    },
    单身狗: {
      className: "single-dog",
      assetPath: DOG_PATTERN_ASSET_PATHS.单身狗,
    },
    舔狗: {
      className: "licking-dog",
      assetPath: DOG_PATTERN_ASSET_PATHS.舔狗,
    },
    看门狗: {
      className: "guard-dog",
      assetPath: DOG_PATTERN_ASSET_PATHS.看门狗,
    },
    疯狗: {
      className: "mad-dog",
      assetPath: DOG_PATTERN_ASSET_PATHS.疯狗,
    },
    拆家狗: {
      className: "destructive-dog",
      assetPath: DOG_PATTERN_ASSET_PATHS.拆家狗,
    },
    龇牙狗: {
      className: "snarling-dog",
      assetPath: DOG_PATTERN_ASSET_PATHS.龇牙狗,
    },
    社恐狗: {
      className: "shy-dog",
      assetPath: DOG_PATTERN_ASSET_PATHS.社恐狗,
    },
    吃货狗: {
      className: "foodie-dog",
      assetPath: DOG_PATTERN_ASSET_PATHS.吃货狗,
    },
    傻狗: {
      className: "silly-dog",
      assetPath: DOG_PATTERN_ASSET_PATHS.傻狗,
    },
  });

export function getDogPatternClassName(patternType: DogPatternType): string {
  return DOG_PATTERN_PRESENTATIONS[patternType].className;
}

export function getDogPatternAssetUrl(patternType: DogPatternType): string {
  return resolveAssetUrl(DOG_PATTERN_PRESENTATIONS[patternType].assetPath);
}

export function renderDogPatternAsset(patternType: DogPatternType): string {
  const assetUrl = getDogPatternAssetUrl(patternType);

  return `
    <img src="${assetUrl}" crossorigin="anonymous" width="100%" height="100%" alt="" aria-hidden="true" />
  `;
}
