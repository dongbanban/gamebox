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

export type DogSpecialMechanismStateValue = string | number | boolean | null;

/** Opaque mechanism payload owned by the concrete game. */
export interface DogSpecialMechanism {
  readonly type: string;
  readonly state: Readonly<Record<string, DogSpecialMechanismStateValue>>;
}

export interface DogSpecialMechanismConfig {
  readonly type: string;
  readonly min: number;
  readonly max: number;
  /** Optional per-progress-stage ranges. Parsed at generation boundary. */
  readonly minByStage?: readonly number[];
  readonly maxByStage?: readonly number[];
  /** Logical-unit weight used by composition and difficulty validation. */
  readonly densityWeight?: number;
  /** Stable per-level bonus for paired item quotas. */
  readonly itemUseBonus?: number;
}

export interface DogTrayBlock {
  readonly id: string;
  readonly patternType: DogPatternType;
  readonly visualMarker?: "wildcard";
  readonly specialMechanism?: DogSpecialMechanism;
}

export interface DogSpecialMechanismHandler {
  readonly type: string;
  isMatchable(mechanism: DogSpecialMechanism): boolean;
  onEnterTray?(block: DogTrayBlock): DogTrayBlock;
  onSuccessfulTriples(
    block: DogTrayBlock,
    tripleCount: number,
    triplePatterns: readonly DogPatternType[],
  ): DogTrayBlock;
}

export type DogSolvabilityStatus =
  | "solvable"
  | "unsolvable"
  | "budget-exhausted";

export type DogSafeChoiceSearchStatus = "complete" | "budget-exhausted";

export type DogDifficultyCertainty = "certain" | "uncertain";

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
  readonly specialMechanism?: DogSpecialMechanism;
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
  readonly solvabilityStatus: DogSolvabilityStatus;
  readonly safeChoiceSearchStatus: DogSafeChoiceSearchStatus;
  readonly certainty: DogDifficultyCertainty;
  readonly trayPeakPressure: number;
  readonly shapeComplexity: number;
  readonly patternTypeCount: number;
  readonly specialMechanismCount: number;
  readonly specialMechanismDensity: number;
  readonly specialMechanismDifficulty: number;
  readonly estimatedDurationMinutes: number;
  readonly target: DogDifficultyTarget;
  readonly withinTarget: boolean;
}

export type DogLevelReplayMode = "fixed" | "generated" | "guaranteed";

export interface DogLevelReplay {
  readonly attempt: number;
  readonly levelNumber: number;
  readonly seed: string;
  readonly runSeed?: string;
  readonly levelSeed: string;
  readonly testSeed: string;
  readonly generatorVersion: number;
  readonly rewardConfigVersion: number;
  readonly mode: DogLevelReplayMode;
  readonly randomSeed: string;
  /** Marks replay metadata produced for the accepted candidate. */
  readonly accepted?: boolean;
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
  readonly specialMechanisms?: readonly DogSpecialMechanismConfig[];
}

export interface DogLegeDogLevel {
  readonly number: number;
  readonly seed: string;
  readonly runSeed: string;
  readonly generatorVersion: number;
  readonly rewardConfigVersion: number;
  readonly maxLayers: number;
  readonly reward: number;
  readonly board: DogBoard;
  readonly patternTypes: readonly DogPatternType[];
  readonly blocks: readonly DogBlock[];
  readonly specialMechanisms: readonly DogSpecialMechanismConfig[];
  readonly solutionPath: readonly string[];
  readonly difficulty: DogLevelDifficulty;
  readonly generation: DogLevelGeneration;
}
