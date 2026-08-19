import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";

export interface DogPatternPresentation {
  readonly className: string;
  readonly assetPath: string;
}

const DOG_PATTERN_ASSET_PATHS: Readonly<Record<DogPatternType, string>> = Object.freeze({
  打工狗: "assets/dog-icons-square/01-working-dog.svg",
  单身狗: "assets/dog-icons-square/02-single-dog.svg",
  舔狗: "assets/dog-icons-square/03-licking-dog.svg",
  看门狗: "assets/dog-icons-square/04-guard-dog.svg",
  疯狗: "assets/dog-icons-square/05-mad-dog.svg",
  拆家狗: "assets/dog-icons-square/06-destructive-dog.svg",
  龇牙狗: "assets/dog-icons-square/07-snarling-dog.svg",
  社恐狗: "assets/dog-icons-square/08-shy-dog.svg",
  吃货狗: "assets/dog-icons-square/09-foodie-dog.svg",
  傻狗: "assets/dog-icons-square/10-silly-dog.svg",
});

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

export function renderDogPatternAsset(patternType: DogPatternType): string {
  const presentation = DOG_PATTERN_PRESENTATIONS[patternType];

  return `
    <svg viewBox="0 0 340 388" width="100%" height="100%" aria-hidden="true" focusable="false">
      <image href="${presentation.assetPath}" width="340" height="388" preserveAspectRatio="xMidYMid meet" />
    </svg>
  `;
}
