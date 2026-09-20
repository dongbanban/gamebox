import type {
  DogLegeDogLevel,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  resolveDogShuffleState,
  type DogShuffleResolutionComputation,
} from "@/games/dog-lege-dog/levels/level-shuffle";
import type { GameSessionState } from "@/games/dog-lege-dog/game/game-session-state";
import {
  cloneDogTrayBlock,
  removeSpecialMechanism,
} from "@/games/dog-lege-dog/levels/level-tray-block";
import type {
  GameSessionShuffleReplayEvent,
  GameSessionShuffleResolution,
  GameSessionShuffleTransaction,
  GameSessionShuffleTransactionState,
} from "@/games/dog-lege-dog/game/game-session-contracts";

export class GameSessionShuffleRuntime {
  private shuffleSequence = 0;
  private lastShuffleTransaction: GameSessionShuffleTransaction | null = null;
  private readonly shuffleReplayEvents: GameSessionShuffleReplayEvent[] = [];

  constructor(private readonly state: GameSessionState) {}

  updateResult(): GameSessionShuffleResolution | null {
    if (this.state.isSelectionPending()) {
      this.state.status = "playing";
      return null;
    }

    const pendingShuffle = this.updateShuffleState();
    this.state.updateTerminalStatus();
    if (pendingShuffle === null) {
      if (this.state.status !== "playing") {
        this.lastShuffleTransaction = null;
      }
      return null;
    }

    const after = this.createShuffleTransactionState();
    const replayEvent = createShuffleReplayEvent(
      this.state.level,
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
    this.lastShuffleTransaction = after.status === "playing" ? transaction : null;
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

  canRestoreLastShuffle(): boolean {
    return this.lastShuffleTransaction !== null &&
      this.state.status === "playing" &&
      !this.state.isSelectionPending();
  }

  restoreLastShuffle(): boolean {
    const transaction = this.lastShuffleTransaction;
    if (transaction === null || !this.canRestoreLastShuffle()) {
      return false;
    }

    this.state.tray.splice(
      0,
      this.state.tray.length,
      ...transaction.before.trayBlocks.map((block) =>
        block.id === transaction.replayEvent.triggerBlockId
          ? removeSpecialMechanism(block)
          : cloneDogTrayBlock(block),
      ),
    );
    this.state.trayCapacity = transaction.before.trayCapacity;
    this.state.lockedTraySlotCount = transaction.before.lockedTraySlotCount;
    this.state.status = transaction.before.status;
    this.lastShuffleTransaction = null;
    return true;
  }

  expireLastShuffleTransaction(
    transaction: GameSessionShuffleTransaction | null = this.lastShuffleTransaction,
  ): void {
    if (transaction !== null && this.lastShuffleTransaction === transaction) {
      this.lastShuffleTransaction = null;
    }
  }

  getShuffleReplayEvents(): readonly GameSessionShuffleReplayEvent[] {
    return Object.freeze([...this.shuffleReplayEvents]);
  }

  private updateShuffleState(): PendingShuffleResolution | null {
    const shuffleState = resolveDogShuffleState({
      config: this.state.config,
      level: this.state.level,
      remainingBlockIds: [...this.state.remainingBlocks.keys()],
      tray: this.state.tray,
      effectiveTrayCapacity: this.state.getEffectiveTrayCapacity(),
      magneticRandom: this.state.magneticRandom,
      sequence: this.shuffleSequence + 1,
    });
    if (shuffleState.computation === null) {
      this.state.tray.splice(0, this.state.tray.length, ...shuffleState.tray);
      return null;
    }

    const before = this.createShuffleTransactionState(shuffleState.computation.beforeTrayBlocks);
    this.state.tray.splice(0, this.state.tray.length, ...shuffleState.tray);
    return { before, computation: shuffleState.computation };
  }

  private createShuffleTransactionState(
    tray: readonly DogTrayBlock[] = this.state.tray,
  ): GameSessionShuffleTransactionState {
    return Object.freeze({
      status: this.state.status,
      remainingBlockIds: Object.freeze([...this.state.remainingBlocks.keys()]),
      trayBlocks: Object.freeze(tray.map(cloneDogTrayBlock)),
      trayCapacity: this.state.trayCapacity,
      effectiveTrayCapacity: this.state.getEffectiveTrayCapacity(),
      lockedTraySlotCount: this.state.lockedTraySlotCount,
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
