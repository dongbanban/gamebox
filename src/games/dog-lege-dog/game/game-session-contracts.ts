import type {
  DogBlock,
  DogLegeDogLevel,
  DogPatternType,
  DogShuffleMechanismStatus,
  DogSpecialMechanismHandler,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";

export type GameSessionStatus = "playing" | "won" | "lost";

export interface GameSessionOptions {
  readonly level: DogLegeDogLevel;
  readonly config?: DogV13Config;
  readonly initialTray?: readonly DogPatternType[];
  readonly initialTrayBlocks?: readonly DogTrayBlock[];
  readonly initialTrayCapacity?: number;
  readonly specialMechanismHandlers?: readonly DogSpecialMechanismHandler[];
}

export interface GameSessionSnapshot {
  readonly status: GameSessionStatus;
  readonly level: DogLegeDogLevel;
  readonly remainingBlocks: readonly DogBlock[];
  readonly tray: readonly DogPatternType[];
  readonly trayBlocks: readonly DogTrayBlock[];
  readonly trayCapacity: number;
  readonly effectiveTrayCapacity: number;
  readonly trayFreeCapacity: number;
  readonly lockedTraySlotCount: number;
  readonly remainingLogicalUnitCount: number;
  readonly trayLogicalUnitCount: number;
  readonly shuffle: GameSessionShuffleState | null;
  readonly selectableBlockIds: readonly string[];
}

export interface GameSessionShuffleState {
  readonly blockId: string;
  readonly status: DogShuffleMechanismStatus;
  readonly threshold: number;
}

export type GameSessionShuffleOutcome = "reordered" | "stable";

export interface GameSessionShuffleTransactionState {
  readonly status: GameSessionStatus;
  readonly remainingBlockIds: readonly string[];
  readonly trayBlocks: readonly DogTrayBlock[];
  readonly trayCapacity: number;
  readonly effectiveTrayCapacity: number;
  readonly lockedTraySlotCount: number;
}

export interface GameSessionShuffleReplayEvent {
  readonly type: "shuffle";
  readonly sequence: number;
  readonly runSeed: string;
  readonly generatorVersion: number;
  readonly randomSeed: string;
  readonly triggerBlockId: string;
  readonly candidateCount: number;
  readonly uniqueCandidateCount: number;
  readonly safeCandidateCount: number;
  readonly selectedCandidateIndex: number | null;
  readonly outcome: GameSessionShuffleOutcome;
  readonly beforeTrayBlockIds: readonly string[];
  readonly afterTrayBlockIds: readonly string[];
  readonly secondaryRemovedBlockIds: readonly string[];
  readonly secondaryTripleCount: number;
}

export interface GameSessionShuffleTransaction {
  readonly outcome: "reordered";
  readonly before: GameSessionShuffleTransactionState;
  readonly after: GameSessionShuffleTransactionState;
  readonly replayEvent: GameSessionShuffleReplayEvent;
}

export interface GameSessionShuffleResolution {
  readonly triggered: true;
  readonly triggerBlockId: string;
  readonly outcome: GameSessionShuffleOutcome;
  readonly candidateCount: number;
  readonly uniqueCandidateCount: number;
  readonly safeCandidateCount: number;
  readonly selectedCandidateIndex: number | null;
  readonly transaction: GameSessionShuffleTransaction | null;
  readonly replayEvent: GameSessionShuffleReplayEvent;
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly secondaryRemovedBlockIds: readonly string[];
  readonly secondaryTripleCount: number;
  readonly meltedBlockIds: readonly string[];
}

export interface GameSessionUnlockResult extends GameSessionSnapshot {
  readonly unlocked: boolean;
  readonly unlockedSlotIndex: number | null;
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionPendingSelectionResult {
  readonly selected: boolean;
  readonly magneticResolution: GameSessionMagneticResolution | null;
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionMagneticResolution {
  readonly sourceBlockId: string;
  readonly targetBlockId: string | null;
  readonly targetTrayBlockIds: readonly string[];
}

export interface GameSessionSelectionResult extends GameSessionSnapshot {
  readonly magneticResolution: GameSessionMagneticResolution | null;
  readonly shuffleResolution: GameSessionShuffleResolution | null;
  readonly selected: boolean;
  readonly removedCount: number;
  readonly snapshot: GameSessionSnapshot;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
}

export type GameSessionMeltLocation = "board" | "tray";

export interface GameSessionMeltResult extends GameSessionSnapshot {
  readonly melted: boolean;
  readonly location: GameSessionMeltLocation;
  readonly blockId: string;
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionRevealResult extends GameSessionSnapshot {
  readonly revealed: boolean;
  readonly blockId: string;
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionDemagnetizeResult extends GameSessionSnapshot {
  readonly demagnetized: boolean;
  readonly blockId: string;
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionTripleRemovalPlan {
  readonly patternType: DogPatternType;
  readonly trayBlockIds: readonly string[];
  readonly blockIds: readonly string[];
  readonly removedCount: 3;
  readonly tripleCount: 1;
}

export interface GameSessionTripleRemovalResult extends GameSessionSnapshot {
  readonly removed: boolean;
  readonly patternType: DogPatternType;
  readonly trayBlockIds: readonly string[];
  readonly blockIds: readonly string[];
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionWildcardResolution {
  readonly patternType: DogPatternType;
  readonly wildcardBlockId: string;
  readonly compensatedBlockId: string;
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
}

export type GameSessionWildcardPlan = GameSessionWildcardResolution;

export interface GameSessionWildcardResultBase extends GameSessionSnapshot {
  readonly patternType: DogPatternType;
  readonly snapshot: GameSessionSnapshot;
}

export type GameSessionWildcardResult =
  | (GameSessionWildcardResultBase & { readonly used: false })
  | (GameSessionWildcardResultBase &
      GameSessionWildcardResolution & { readonly used: true });

export interface GameSessionPendingSelection {
  readonly block: DogBlock;
  readonly magneticTargetBlockId: string | null;
}
