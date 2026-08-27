import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import { resolveAssetUrl } from "@/asset-url";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";

export interface DogPatternPresentation {
  readonly className: string;
  readonly assetPath: string;
}

export const DOG_PATTERN_PRESENTATIONS: Readonly<Record<DogPatternType, DogPatternPresentation>> =
  Object.freeze({
    打工狗: {
      className: "working-dog",
      assetPath: DOG_V13_CONFIG.assets.patterns.打工狗,
    },
    单身狗: {
      className: "single-dog",
      assetPath: DOG_V13_CONFIG.assets.patterns.单身狗,
    },
    舔狗: {
      className: "licking-dog",
      assetPath: DOG_V13_CONFIG.assets.patterns.舔狗,
    },
    看门狗: {
      className: "guard-dog",
      assetPath: DOG_V13_CONFIG.assets.patterns.看门狗,
    },
    疯狗: {
      className: "mad-dog",
      assetPath: DOG_V13_CONFIG.assets.patterns.疯狗,
    },
    拆家狗: {
      className: "destructive-dog",
      assetPath: DOG_V13_CONFIG.assets.patterns.拆家狗,
    },
    龇牙狗: {
      className: "snarling-dog",
      assetPath: DOG_V13_CONFIG.assets.patterns.龇牙狗,
    },
    社恐狗: {
      className: "shy-dog",
      assetPath: DOG_V13_CONFIG.assets.patterns.社恐狗,
    },
    吃货狗: {
      className: "foodie-dog",
      assetPath: DOG_V13_CONFIG.assets.patterns.吃货狗,
    },
    傻狗: {
      className: "silly-dog",
      assetPath: DOG_V13_CONFIG.assets.patterns.傻狗,
    },
  });

export function getDogPatternClassName(patternType: DogPatternType): string {
  return DOG_PATTERN_PRESENTATIONS[patternType].className;
}

export function getDogPatternAssetUrl(
  patternType: DogPatternType,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  return resolveAssetUrl(config.assets.patterns[patternType]);
}

export function renderDogPatternAsset(
  patternType: DogPatternType,
  config: DogV13Config = DOG_V13_CONFIG,
): string {
  const assetUrl = getDogPatternAssetUrl(patternType, config);

  return `
    <img src="${assetUrl}" crossorigin="anonymous" width="100%" height="100%" alt="" aria-hidden="true" />
  `;
}
