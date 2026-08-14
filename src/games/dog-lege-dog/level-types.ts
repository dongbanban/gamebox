export const BLOCK_WIDTH = 2 as const;
export const BLOCK_HEIGHT = 2 as const;

export const DOG_PATTERN_TYPES = [
  "打工狗",
  "单身狗",
  "舔狗",
  "看门狗",
  "疯狗",
  "拆家狗",
  "龇牙狗",
  "社恐狗",
  "吃货狗",
  "傻狗",
] as const;

export type DogPatternType = (typeof DOG_PATTERN_TYPES)[number];

export type DogBoardShape = "rectangle" | "star" | "heart" | "irregular";

export interface DogBoardCell {
  readonly x: number;
  readonly y: number;
}

export interface DogBoard {
  readonly shape: DogBoardShape;
  readonly templateId: string;
  readonly width: number;
  readonly height: number;
  readonly logicalCellSize: 2;
  readonly playableCells: readonly DogBoardCell[];
}

export interface DogBlock {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: 2;
  readonly height: 2;
  readonly rotation: 0;
  readonly patternType: DogPatternType;
}

export interface DogLegeDogLevel {
  readonly number: number;
  readonly seed: string;
  readonly generatorVersion: number;
  readonly maxLayers: number;
  readonly reward: number;
  readonly board: DogBoard;
  readonly patternTypes: readonly DogPatternType[];
  readonly blocks: readonly DogBlock[];
}
