import type { DogPatternType } from "./first-level";

export interface DogPatternPresentation {
  readonly className: string;
  readonly accent: string;
  readonly detailMarkup: string;
}

export const DOG_PATTERN_PRESENTATIONS: Readonly<Record<DogPatternType, DogPatternPresentation>> =
  Object.freeze({
    打工狗: {
      className: "working-dog",
      accent: "#ee8069",
      detailMarkup: '<rect x="17" y="35" width="14" height="7" rx="2" fill="#183b48"/><path d="M20 35c0-4 8-4 8 0" fill="none" stroke="#183b48" stroke-width="2"/>',
    },
    单身狗: {
      className: "single-dog",
      accent: "#ffc966",
      detailMarkup: '<path d="M24 42c-7-4-8-8-5-10 2-1 4 0 5 2 1-2 3-3 5-2 3 2 2 6-5 10Z" fill="#ee8069"/>',
    },
    舔狗: {
      className: "licking-dog",
      accent: "#76b89a",
      detailMarkup: '<path d="M24 31v8c0 4-6 4-6 0 0-2 2-3 6-3Z" fill="#ee8069"/>',
    },
    看门狗: {
      className: "guard-dog",
      accent: "#6c9dc4",
      detailMarkup: '<path d="m24 34 8 3-2 6h-12l-2-6 8-3Z" fill="#183b48"/><path d="M24 36v5" stroke="#ffc966" stroke-width="2"/>',
    },
    疯狗: {
      className: "mad-dog",
      accent: "#d47bd0",
      detailMarkup: '<path d="M17 36 21 32l3 4 3-4 4 4-7 5Z" fill="#183b48"/>',
    },
    拆家狗: {
      className: "destructive-dog",
      accent: "#e8a15b",
      detailMarkup: '<path d="m17 35 5-3 2 3 2-3 5 3-2 7H19Z" fill="#183b48"/>',
    },
    龇牙狗: {
      className: "snarling-dog",
      accent: "#a8c86e",
      detailMarkup: '<path d="M17 33c4 4 10 4 14 0v7H17Z" fill="#fffdf8" stroke="#183b48" stroke-width="1.5"/>',
    },
    社恐狗: {
      className: "shy-dog",
      accent: "#a5a6d8",
      detailMarkup: '<path d="M17 35h14v7H17Z" fill="#183b48" opacity=".8"/>',
    },
    吃货狗: {
      className: "foodie-dog",
      accent: "#f0bd68",
      detailMarkup: '<circle cx="24" cy="37" r="6" fill="#183b48"/><circle cx="22" cy="35" r="1.5" fill="#fff3d7"/>',
    },
    傻狗: {
      className: "silly-dog",
      accent: "#8ec5c7",
      detailMarkup: '<path d="M18 34c4 3 8 3 12 0l-2 8H20Z" fill="#183b48"/>',
    },
  });

export function getDogPatternClassName(patternType: DogPatternType): string {
  return DOG_PATTERN_PRESENTATIONS[patternType].className;
}

export function renderDogPatternAsset(patternType: DogPatternType): string {
  const presentation = DOG_PATTERN_PRESENTATIONS[patternType];

  return `
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true" focusable="false">
      <path d="M11 18 8 7l10 6c4-2 8-2 12 0l10-6-3 11c2 3 3 7 3 11 0 9-7 14-16 14S8 38 8 29c0-4 1-8 3-11Z" fill="${presentation.accent}"/>
      <path d="M13 25c0-5 5-9 11-9s11 4 11 9v7c0 5-5 8-11 8s-11-3-11-8Z" fill="#fff3d7"/>
      <circle cx="19" cy="26" r="2" fill="#183b48"/><circle cx="29" cy="26" r="2" fill="#183b48"/>
      <path d="M21 32c2 2 4 2 6 0" fill="none" stroke="#183b48" stroke-width="2" stroke-linecap="round"/>
      ${presentation.detailMarkup}
    </svg>
  `;
}
