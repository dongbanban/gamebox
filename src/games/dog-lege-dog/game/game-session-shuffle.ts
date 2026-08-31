import type {
  DogBlock,
  DogLegeDogLevel,
  DogSpecialMechanismHandler,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  resolveDogShuffleState,
  type DogShuffleResolutionComputation,
} from "@/games/dog-lege-dog/levels/level-shuffle";
import {
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import type { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import { cloneDogTrayBlock } from "@/games/dog-lege-dog/levels/level-tray-block";
import type {
  GameSessionShuffleReplayEvent,
  GameSessionShuffleResolution,
  GameSessionShuffleTransaction,
  GameSessionShuffleTransactionState,
  GameSessionStatus,
} from "@/games/dog-lege-dog/game/game-session-contracts";

export interface GameSessionShuffleRuntimeContext {
  readonly config: DogV13Config;
  readonly level: DogLegeDogLevel;
  readonly remainingBlocks: ReadonlyMap<string, DogBlock>;
  readonly specialMechanismHandlers: ReadonlyMap<string, DogSpecialMechanismHandler>;
  readonly magneticRandom: SeededRandom;
  readonly tray: DogTrayBlock[];
  readonly getEffectiveTrayCapacity: () => number;
  readonly getLockedTraySlotCount: () => number;
  readonly getTrayCapacity: () => number;
  readonly getStatus: () => GameSessionStatus;
  readonly isSelectionPending: () => boolean;
  readonly setStatus: (status: GameSessionStatus) => void;
  readonly updateTerminalStatus: () => void;
}

export class GameSessionShuffleRuntime {
  private shuffleSequence = 0;
  private lastShuffleTransaction: GameSessionShuffleTransaction | null = null;
  private readonly shuffleReplayEvents: GameSessionShuffleReplayEvent[] = [];

  constructor(private readonly context: GameSessionShuffleRuntimeContext) {}

  updateResult(): GameSessionShuffleResolution | null {
    if (this.context.isSelectionPending()) {
      this.context.setStatus("playing");
      return null;
    }

    const pendingShuffle = this.updateShuffleState();
    this.context.updateTerminalStatus();
    if (pendingShuffle === null) {
      return null;
    }

    const after = this.createShuffleTransactionState();
    const replayEvent = createShuffleReplayEvent(
      this.context.level,
      pendingShuffle.computation,
      ++this.shuffleSequence,
    );
    const transaction = pendingShuffle.computation.outcome === "reordered"
      ? Object.freeze({
          outcome: "reordered" as const,
          before: pendingShuffle.before,
          after,
          replayEvent,
        })
      : null;
    this.lastShuffleTransaction = transaction;
    this.shuffleReplayEvents.push(replayEvent);
    return Object.freeze({
      triggered: true as const,
      triggerBlockId: pendingShuffle.computation.triggerBlockId,
      outcome: pendingShuffle.computation.outcome,
      candidateCount: pendingShuffle.computation.candidateCount,
      uniqueCandidateCount: pendingShuffle.computation.uniqueCandidateCount,
      safeCandidateCount: pendingShuffle.computation.safeCandidateCount,
      selectedCandidateIndex: pendingShuffle.computation.selectedCandidateIndex,
      transaction,
      replayEvent,
      removedCount: pendingShuffle.computation.removedCount,
      tripleCount: pendingShuffle.computation.tripleCount,
      secondaryRemovedBlockIds: Object.freeze([
        ...pendingShuffle.computation.secondaryRemovedBlockIds,
      ]),
      secondaryTripleCount: pendingShuffle.computation.tripleCount,
      meltedBlockIds: Object.freeze([...pendingShuffle.computation.meltedBlockIds]),
    });
  }

  getLastShuffleTransaction(): GameSessionShuffleTransaction | null {
    return this.lastShuffleTransaction;
  }

  getShuffleReplayEvents(): readonly GameSessionShuffleReplayEvent[] {
    return Object.freeze([...this.shuffleReplayEvents]);
  }

  private updateShuffleState(): PendingShuffleResolution | null {
    const state = resolveDogShuffleState({
      config: this.context.config,
      level: this.context.level,
      remainingBlockIds: [...this.context.remainingBlocks.keys()],
      tray: this.context.tray,
      effectiveTrayCapacity: this.context.getEffectiveTrayCapacity(),
      handlers: this.context.specialMechanismHandlers,
      magneticRandom: this.context.magneticRandom,
      sequence: this.shuffleSequence + 1,
    });
    if (state.computation === null) {
      this.context.tray.splice(0, this.context.tray.length, ...state.tray);
      return null;
    }

    const before = this.createShuffleTransactionState(state.computation.beforeTrayBlocks);
    this.context.tray.splice(0, this.context.tray.length, ...state.tray);
    return { before, computation: state.computation };
  }

  private createShuffleTransactionState(
    tray: readonly DogTrayBlock[] = this.context.tray,
  ): GameSessionShuffleTransactionState {
    return Object.freeze({
      status: this.context.getStatus(),
      remainingBlockIds: Object.freeze([...this.context.remainingBlocks.keys()]),
      trayBlocks: Object.freeze(tray.map(cloneDogTrayBlock)),
      trayCapacity: this.context.getTrayCapacity(),
      effectiveTrayCapacity: this.context.getEffectiveTrayCapacity(),
      lockedTraySlotCount: this.context.getLockedTraySlotCount(),
    });
  }
}

interface PendingShuffleResolution {
  readonly before: GameSessionShuffleTransactionState;
  readonly computation: DogShuffleResolutionComputation;
}

function createShuffleReplayEvent(
  level: DogLegeDogLevel,
  computation: DogShuffleResolutionComputation,
  sequence: number,
): GameSessionShuffleReplayEvent {
  return Object.freeze({
    type: "shuffle" as const,
    sequence,
    runSeed: level.runSeed,
    generatorVersion: level.generatorVersion,
    randomSeed: computation.randomSeed,
    triggerBlockId: computation.triggerBlockId,
    candidateCount: computation.candidateCount,
    uniqueCandidateCount: computation.uniqueCandidateCount,
    safeCandidateCount: computation.safeCandidateCount,
    selectedCandidateIndex: computation.selectedCandidateIndex,
    outcome: computation.outcome,
    beforeTrayBlockIds: Object.freeze(computation.beforeTrayBlocks.map((block) => block.id)),
    afterTrayBlockIds: Object.freeze(computation.afterTrayBlocks.map((block) => block.id)),
    secondaryRemovedBlockIds: Object.freeze([...computation.secondaryRemovedBlockIds]),
    secondaryTripleCount: computation.tripleCount,
  });
}
