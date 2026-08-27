import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";

export const DOG_V13_SCHEMA_VERSION = 13 as const;

export type DogV13MechanismType = "freeze" | "illusion" | "magnetic" | "twin";
export type DogV13ParticleEffectName = "match" | "won" | "lost";
export type DogV13ItemId =
  | "triple-removal"
  | "tray-capacity"
  | "wildcard"
  | "torch"
  | "detector"
  | "demagnetizer"
  | "key";
export const DOG_V13_ITEM_COPY_KEYS: readonly DogV13ItemId[] = [
  "triple-removal",
  "tray-capacity",
  "wildcard",
  "torch",
  "detector",
  "demagnetizer",
  "key",
];

export type DogV13TestProfileName = "focused" | "smoke" | "full";
export type DogConfigChangeArea =
  | "docs"
  | "ui"
  | "runtime"
  | "generator"
  | "solvability"
  | "difficulty"
  | "public-contract"
  | "game-startup"
  | "worker"
  | "random-regression"
  | "cross-browser";

export interface DogV13Range {
  readonly min: number;
  readonly max: number;
}

export interface DogV13StructureStage {
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly maxLayers: number;
  readonly patternTypeCount: number;
}

export interface DogV13MechanismDefinition {
  readonly type: DogV13MechanismType;
  readonly logicalUnitWeight: 1 | 2;
  readonly operationCost: number;
}

export interface DogV13DifficultyTarget {
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly safeChoiceCount: DogV13Range;
  readonly safeChoiceRate: DogV13Range;
  readonly durationMinutes: DogV13Range;
  readonly trayPeakPressure: DogV13Range;
  readonly mechanismDensity: DogV13Range;
  readonly operationCost: DogV13Range;
  readonly mistakeRisk: DogV13Range;
}

export interface DogV13DifficultyScoring {
  readonly trayPressure: {
    readonly occupancyWeight: number;
    readonly choicePressureWeight: number;
  };
  readonly operationCost: { readonly magneticTargetWeight: number };
  readonly duration: {
    readonly operationCostWeight: number;
    readonly lockWeight: number;
  };
  readonly mistakeRisk: {
    readonly base: number;
    readonly choiceWeight: number;
    readonly trayPressureWeight: number;
    readonly operationCostWeight: number;
    readonly lockWeight: number;
  };
}

export type DogV13SoundWaveform = "sine" | "square" | "sawtooth" | "triangle";

export interface DogV13SoundEffectProfile {
  readonly frequencies: readonly number[];
  readonly durationSeconds: number;
  readonly waveform: DogV13SoundWaveform;
  readonly volume: number;
  readonly noteSpacingSeconds: number;
}

export interface DogV13MechanismPresentation {
  readonly name: string;
  readonly description: string;
}

export interface DogV13ResultDisplay {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}

export interface DogV13ParticleEffectProfile {
  readonly durationMs: number;
  readonly count: number;
  readonly colors: readonly string[];
}

export interface DogV13ItemCopy {
  readonly name: string;
  readonly icon: string;
  readonly description: string;
}

export interface DogV13AppCopy {
  readonly brandName: string;
  readonly registrationTitle: string;
  readonly registrationIntro: string;
  readonly register: string;
  readonly registrationFinePrint: string;
  readonly catalogTitle: string;
  readonly reset: string;
  readonly catalogAriaLabel: string;
  readonly highestUnlockedLevel: string;
  readonly startGame: string;
  readonly activeGame: string;
  readonly returnCatalog: string;
  readonly soundEnabled: string;
  readonly soundDisabled: string;
  readonly persistenceSaved: string;
  readonly persistenceTemporary: string;
  readonly resetConfirmation: string;
  readonly leaveConfirmation: string;
  readonly result: {
    readonly completedLevel: string;
    readonly finalReward: string;
    readonly totalScore: string;
    readonly finalTitle: string;
    readonly finalTitleValue: string;
    readonly currentLevel: string;
    readonly reward: string;
    readonly nextLevel: string;
  };
  readonly actions: {
    readonly loadout: string;
    readonly nextLevel: string;
    readonly retry: string;
  };
}

export interface DogV13LoadoutCopy {
  readonly initialTitle: string;
  readonly changeTitle: string;
  readonly initialIntro: string;
  readonly changeCurrentIntro: string;
  readonly changeNextIntro: string;
  readonly usesFallback: string;
  readonly usesPerLevel: string;
  readonly confirmationTitle: string;
  readonly confirmationNext: string;
  readonly confirmationCurrent: string;
  readonly cancel: string;
  readonly clear: string;
  readonly confirm: string;
  readonly summaryAriaLabel: string;
  readonly edit: string;
  readonly targetPrompt: string;
  readonly remainingUses: string;
}

export interface DogV13TestProfile {
  readonly name: DogV13TestProfileName;
  readonly levelNumbers: readonly number[];
  readonly fixedSeeds: readonly string[];
  readonly randomLevelPrefix: number;
  readonly stressLevelCount: number;
  readonly runUI: boolean;
  readonly runCore: boolean;
  readonly runRandomRegression: boolean;
  readonly runE2E: boolean;
  readonly runCrossBrowser: boolean;
  readonly runWorkerFallback: boolean;
  readonly runBuild: boolean;
  readonly runDiffCheck: boolean;
  readonly runFileLineCheck: boolean;
  readonly maxChangedFileLines: number;
}

export interface DogV13Config {
  readonly schemaVersion: typeof DOG_V13_SCHEMA_VERSION;
  readonly game: {
    readonly id: "dog-lege-dog";
    readonly firstLevelNumber: 1;
    readonly maxLevelNumber: 99;
    readonly generatorVersion: 13;
    readonly defaultReward: number;
  };
  readonly board: {
    readonly shape: "irregular";
    readonly logicalCellSize: 4;
    readonly blockWidth: 4;
    readonly blockHeight: 4;
    readonly maxMechanismsPerBlock: 1;
  };
  readonly levels: {
    readonly firstLevelNumber: 1;
    readonly maxLevelNumber: 99;
    readonly logicalBlockCount: {
      readonly start: 90;
      readonly increment: 18;
      readonly incrementEveryLevels: 5;
      readonly cap: 180;
    };
    readonly structureStages: readonly DogV13StructureStage[];
  };
  readonly tray: {
    readonly baseCapacity: 7;
    readonly maxCapacity: 8;
    readonly maxLockedSlotCount: 2;
    readonly lockedSlotPlacement: "right";
  };
  readonly items: {
    readonly ids: readonly DogV13ItemId[];
    readonly loadoutSize: 3;
    readonly defaultUsesPerLevel: 1;
    readonly maxSuccessfulUsesPerLevel: 1;
    readonly key: {
      readonly id: "key";
      readonly initialUses: 0;
      readonly usesCappedByLockedSlots: true;
      readonly dropRate: number;
    };
  };
  readonly specialMechanisms: {
    readonly logicalBudgetRatio: 0.3;
    readonly budgetRounding: "floor";
    readonly remainderStrategy: "stable-round-robin";
    readonly requireAllTypes: true;
    readonly freezeMeltTripleCount: number;
    readonly mechanisms: readonly DogV13MechanismDefinition[];
  };
  readonly difficulty: {
    readonly targets: readonly DogV13DifficultyTarget[];
    readonly scoring: DogV13DifficultyScoring;
  };
  readonly animation: {
    readonly blockFlightMs: number;
    readonly illusionRevealMs: number;
    readonly itemFeedbackMs: number;
    readonly freezeMeltMs: number;
    readonly twinSplitMs: number;
    readonly magneticAttractionMs: number;
    readonly keyDropMs: number;
    readonly trayUnlockMs: number;
    readonly inputLockedDuringAnimation: true;
  };
  readonly assets: {
    readonly patterns: Readonly<Record<DogPatternType, string>>;
    readonly items: Readonly<Record<DogV13ItemId, string>>;
    readonly music: string;
  };
  readonly audio: {
    readonly music: { readonly path: string; readonly volume: number };
    readonly effects: Readonly<Record<string, DogV13SoundEffectProfile>>;
  };
  readonly ui: {
    readonly visual: {
      readonly blockSizePx: number;
      readonly boardSafeMarginPx: number;
      readonly keyDropSizePx: number;
      readonly magneticEffectHeightPx: number;
      readonly flightTargetScale: number;
    };
    readonly copy: {
      readonly app: DogV13AppCopy;
      readonly labels: {
        readonly level: string;
        readonly activeLevel: string;
        readonly specialMechanism: string;
        readonly board: string;
        readonly blockSelectable: string;
        readonly itemTarget: string;
        readonly tray: string;
        readonly lockedTraySlot: string;
        readonly emptyTraySlot: string;
        readonly wildcard: string;
        readonly match: string;
        readonly status: { readonly won: string; readonly lost: string };
      };
      readonly loadout: DogV13LoadoutCopy;
      readonly items: Readonly<Record<DogV13ItemId, DogV13ItemCopy>>;
      readonly specialMechanisms: {
        readonly title: string;
        readonly hint: string;
        readonly empty: string;
        readonly closeLabel: string;
        readonly fallbackDescription: string;
        readonly presentations: Readonly<Record<DogV13MechanismType, DogV13MechanismPresentation>>;
      };
      readonly result: Readonly<Record<"won" | "final" | "lost", DogV13ResultDisplay>>;
    };
    readonly particles: Readonly<Record<DogV13ParticleEffectName, DogV13ParticleEffectProfile>>;
  };
  readonly testProfiles: {
    readonly default: DogV13TestProfileName;
    readonly selection: {
      readonly fullAreas: readonly DogConfigChangeArea[];
      readonly smokeAreas: readonly DogConfigChangeArea[];
    };
    readonly profiles: Readonly<Record<DogV13TestProfileName, DogV13TestProfile>>;
  };
}

export interface DogV13ConfigIssue {
  readonly path: string;
  readonly code: "required" | "type" | "range" | "value" | "duplicate" | "relation";
  readonly message: string;
}

export interface DogV13MechanismPlan {
  readonly budget: number;
  readonly counts: Readonly<Record<DogV13MechanismType, number>>;
  readonly logicalUnitCount: number;
  readonly physicalBlockCount: number;
  readonly unallocatedLogicalUnitCount: number;
}
