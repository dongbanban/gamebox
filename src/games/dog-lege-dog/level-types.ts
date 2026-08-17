export const BLOCK_WIDTH = 4 as const;
export const BLOCK_HEIGHT = 4 as const;

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

export type DogBoardShape = "irregular";

export interface DogBoardCell {
  readonly x: number;
  readonly y: number;
}

export interface DogBoard {
  readonly shape: DogBoardShape;
  readonly templateId: string;
  readonly width: number;
  readonly height: number;
  readonly logicalCellSize: 4;
  readonly playableCells: readonly DogBoardCell[];
}

export interface DogBlock {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: 4;
  readonly height: 4;
  readonly rotation: 0;
  readonly patternType: DogPatternType;
}

export interface DogDifficultyRange {
  readonly min: number;
  readonly max: number;
}

export interface DogDifficultyTarget {
  readonly safeChoiceCount: DogDifficultyRange;
  readonly durationMinutes: DogDifficultyRange;
}

export interface DogLevelDifficulty {
  readonly blockCount: number;
  readonly maxLayers: number;
  readonly coverageRate: number;
  readonly initialSelectableCount: number;
  readonly rawSafeChoiceCount: number;
  readonly safeChoiceCount: number;
  readonly trayPeakPressure: number;
  readonly shapeComplexity: number;
  readonly patternTypeCount: number;
  readonly estimatedDurationMinutes: number;
  readonly target: DogDifficultyTarget;
  readonly withinTarget: boolean;
}

export type DogLevelReplayMode = "fixed" | "generated" | "guaranteed";

export interface DogLevelReplay {
  readonly attempt: number;
  readonly levelNumber: number;
  readonly seed: string;
  readonly levelSeed: string;
  readonly testSeed: string;
  readonly generatorVersion: number;
  readonly mode: DogLevelReplayMode;
  readonly randomSeed: string;
}

export interface DogLevelGenerationFailure extends DogLevelReplay {
  readonly reason: string;
}

export interface DogLevelGeneration {
  readonly attempts: number;
  readonly fallbackUsed: boolean;
  readonly replay: DogLevelReplay;
  readonly failures: readonly DogLevelGenerationFailure[];
}

export interface DogLevelGeometry {
  readonly number: number;
  readonly maxLayers: number;
  readonly board: DogBoard;
  readonly patternTypes: readonly DogPatternType[];
  readonly blocks: readonly DogBlock[];
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
  readonly solutionPath: readonly string[];
  readonly difficulty: DogLevelDifficulty;
  readonly generation: DogLevelGeneration;
}
