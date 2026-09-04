import {
  type DogBlock,
  type DogLegeDogLevel,
  type DogSpecialMechanismHandler,
  type DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import { createBlockGraph, type BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import { freezeDogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-immutability";
import {
  prepareDogTrayBlocks,
  resolveDogTrayMatches,
} from "@/games/dog-lege-dog/levels/level-rules";
import { findSolvabilityFromState } from "@/games/dog-lege-dog/levels/level-solvability";
import { GameSessionShuffleRuntime } from "@/games/dog-lege-dog/game/game-session-shuffle";
import { resolveDogSelection } from "@/games/dog-lege-dog/levels/level-mechanism-resolution";
import { resolveDogShuffleState } from "@/games/dog-lege-dog/levels/level-shuffle";
import {
  createDogSpecialMechanismHandlerMap,
  createDogSpecialMechanismHandlers,
  DOG_SPECIAL_MECHANISM_HANDLERS,
  DOG_SHUFFLE_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
  getDogLogicalBlockCount,
  getDogShuffleMechanismStatus,
  getDogTrayLogicalUnitCount,
  isDogSpecialMechanismResolved,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import { cloneDogTrayBlock } from "@/games/dog-lege-dog/levels/level-tray-block";
import {
  DOG_V13_CONFIG,
  getDogShuffleThreshold,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import type {
  GameSessionMagneticResolution,
  GameSessionOptions,
  GameSessionPendingSelection,
  GameSessionSnapshot,
  GameSessionStatus,
} from "@/games/dog-lege-dog/game/game-session-contracts";

export class GameSessionState {
  readonly config: DogV13Config;
  readonly level: DogLegeDogLevel;
  readonly graph: BlockGraph;
  readonly remainingBlocks = new Map<string, DogBlock>();
  readonly higherBlockCounts: number[];
  readonly specialMechanismHandlers: ReadonlyMap<string, DogSpecialMechanismHandler>;
  readonly magneticRandom: SeededRandom;
  readonly tray: DogTrayBlock[];
  pendingMagneticResolution: GameSessionMagneticResolution | null = null;
  pendingSelection: GameSessionPendingSelection | null = null;
  trayCapacity: number;
  lockedTraySlotCount: number;
  status: GameSessionStatus = "playing";
  private readonly shuffleRuntime: GameSessionShuffleRuntime;

  constructor(options: GameSessionOptions) {
    this.config = options.config ?? DOG_V13_CONFIG;
    this.level = freezeDogLegeDogLevel(options.level);
    this.magneticRandom = new SeededRandom(`${this.level.runSeed}:magnetic-target`);
    this.graph = createBlockGraph(this.level.blocks);
    this.higherBlockCounts = [...this.graph.higherBlockCounts];
    this.specialMechanismHandlers = createDogSpecialMechanismHandlerMap(
      options.specialMechanismHandlers ??
        (options.config === undefined
          ? DOG_SPECIAL_MECHANISM_HANDLERS
          : createDogSpecialMechanismHandlers(this.config)),
    );
    this.trayCapacity = options.initialTrayCapacity ?? this.config.tray.baseCapacity;
    if (
      !Number.isInteger(this.trayCapacity) ||
      this.trayCapacity < this.config.tray.baseCapacity ||
      this.trayCapacity > this.config.tray.maxCapacity
    ) {
      throw new Error(
        `GameSession tray capacity must be an integer between ${this.config.tray.baseCapacity} and ${this.config.tray.maxCapacity}`,
      );
    }
    this.lockedTraySlotCount = normalizeLockedTraySlotCount(
      this.level.lockedTraySlotCount,
      this.config.tray.maxLockedSlotCount,
    );
    if (this.lockedTraySlotCount > this.trayCapacity) {
      throw new Error("GameSession locked tray slots cannot exceed tray capacity");
    }
    validateMechanismHandlers(this.level.blocks, this.specialMechanismHandlers);
    if (
      options.initialTrayBlocks?.some(
        (block) => block.specialMechanism?.type === "illusion",
      )
    ) {
      throw new Error("GameSession illusion blocks cannot start in the tray");
    }
    this.tray = options.initialTrayBlocks?.flatMap((block) =>
      prepareDogTrayBlocks({ ...block }, this.specialMechanismHandlers),
    ) ?? [];

    for (const block of this.level.blocks) {
      if (this.remainingBlocks.has(block.id)) {
        throw new Error(`Duplicate 狗了个狗 block id: ${block.id}`);
      }
      this.remainingBlocks.set(block.id, block);
    }

    resolveDogTrayMatches(this.tray, this.specialMechanismHandlers);
    const effectiveTrayCapacity = this.getEffectiveTrayCapacity();
    if (getDogTrayLogicalUnitCount(this.tray) > effectiveTrayCapacity) {
      throw new Error(
        `GameSession tray cannot contain more than ${effectiveTrayCapacity} unlocked slots`,
      );
    }
    this.shuffleRuntime = new GameSessionShuffleRuntime({
      config: this.config,
      level: this.level,
      remainingBlocks: this.remainingBlocks,
      specialMechanismHandlers: this.specialMechanismHandlers,
      magneticRandom: this.magneticRandom,
      tray: this.tray,
      getEffectiveTrayCapacity: () => this.getEffectiveTrayCapacity(),
      getLockedTraySlotCount: () => this.lockedTraySlotCount,
      getStatus: () => this.status,
      getTrayCapacity: () => this.trayCapacity,
      isSelectionPending: () => this.isSelectionPending(),
      setLockedTraySlotCount: (count) => {
        this.lockedTraySlotCount = count;
      },
      setStatus: (status) => {
        this.status = status;
      },
      setTrayCapacity: (capacity) => {
        this.trayCapacity = capacity;
      },
      updateTerminalStatus: () => this.updateTerminalStatus(),
    });
    this.updateResult();
  }

  getState(): GameSessionSnapshot {
    const remainingBlocks = Object.freeze([...this.remainingBlocks.values()]);
    const trayBlocks = Object.freeze(this.getVisibleTrayBlocks().map(cloneDogTrayBlock));
    const effectiveTrayCapacity = this.getEffectiveTrayCapacity();

    return Object.freeze({
      status: this.status,
      level: this.level,
      remainingBlocks,
      trayBlocks,
      trayCapacity: this.trayCapacity,
      effectiveTrayCapacity,
      trayFreeCapacity: Math.max(
        0,
        effectiveTrayCapacity - getDogTrayLogicalUnitCount(trayBlocks),
      ),
      lockedTraySlotCount: this.lockedTraySlotCount,
      remainingLogicalUnitCount: getDogLogicalBlockCount([...this.remainingBlocks.values()]),
      trayLogicalUnitCount: getDogTrayLogicalUnitCount(trayBlocks),
      shuffle: this.getShuffleState(),
      selectableBlockIds: Object.freeze(this.getSelectableBlockIds()),
    });
  }

  canSelectBlock(blockId: string): boolean {
    if (this.status !== "playing" || this.isSelectionPending()) {
      return false;
    }

    const block = this.remainingBlocks.get(blockId);
    const blockIndex = this.graph.indexById.get(blockId);
    return block !== undefined &&
      blockIndex !== undefined &&
      this.higherBlockCounts[blockIndex] === 0;
  }

  getSelectableBlockIds(): string[] {
    if (this.status !== "playing" || this.isSelectionPending()) {
      return [];
    }

    return [...this.remainingBlocks.values()]
      .filter((block) => {
        const blockIndex = this.graph.indexById.get(block.id);
        return blockIndex !== undefined && this.higherBlockCounts[blockIndex] === 0;
      })
      .map((block) => block.id);
  }

  increaseTrayCapacity(): boolean {
    if (
      this.status !== "playing" ||
      this.isSelectionPending() ||
      this.trayCapacity >= this.config.tray.maxCapacity
    ) {
      return false;
    }

    this.trayCapacity += 1;
    this.updateResult();
    return true;
  }

  canUnlockTraySlot(): boolean {
    return this.status === "playing" &&
      !this.isSelectionPending() &&
      this.lockedTraySlotCount > 0;
  }

  unlockTraySlot(): number | null {
    if (!this.canUnlockTraySlot()) {
      return null;
    }

    const unlockedSlotIndex = this.getEffectiveTrayCapacity();
    this.lockedTraySlotCount -= 1;
    this.updateResult();
    return unlockedSlotIndex;
  }

  removeRemainingBlock(blockId: string): DogBlock | undefined {
    const block = this.remainingBlocks.get(blockId);
    const blockIndex = this.graph.indexById.get(blockId);
    if (block === undefined || blockIndex === undefined) {
      return undefined;
    }

    this.remainingBlocks.delete(blockId);
    this.revealLowerBlocks(blockIndex);
    return block;
  }

  replaceRemainingBlock(blockId: string, block: DogBlock): boolean {
    if (!this.remainingBlocks.has(blockId)) {
      return false;
    }
    this.remainingBlocks.set(blockId, block);
    return true;
  }

  getBlock(blockId: string): DogBlock | undefined {
    return this.remainingBlocks.get(blockId);
  }

  getEffectiveTrayCapacity(): number {
    return this.trayCapacity - this.lockedTraySlotCount;
  }

  getCurrentSolvabilityLevel(): DogLegeDogLevel {
    return {
      ...this.level,
      blocks: this.level.blocks.map(
        (block) => this.remainingBlocks.get(block.id) ?? block,
      ),
    };
  }

  getRemainingBlockMask(): bigint {
    let remainingMask = 0n;
    for (const blockId of this.remainingBlocks.keys()) {
      const blockIndex = this.graph.indexById.get(blockId);
      if (blockIndex !== undefined) {
        remainingMask |= 1n << BigInt(blockIndex);
      }
    }
    return remainingMask;
  }

  updateResult() {
    return this.shuffleRuntime.updateResult();
  }

  getLastShuffleTransaction() {
    return this.shuffleRuntime.getLastShuffleTransaction();
  }

  canRestoreLastShuffle(): boolean {
    return this.shuffleRuntime.canRestoreLastShuffle();
  }

  restoreLastShuffle(): boolean {
    return this.shuffleRuntime.restoreLastShuffle();
  }

  expireLastShuffleTransaction(transaction = this.getLastShuffleTransaction()): void {
    this.shuffleRuntime.expireLastShuffleTransaction(transaction);
  }

  getShuffleReplayEvents() {
    return this.shuffleRuntime.getShuffleReplayEvents();
  }

  private updateTerminalStatus(): void {
    const trayLogicalUnitCount = getDogTrayLogicalUnitCount(this.tray);
    const effectiveTrayCapacity = this.getEffectiveTrayCapacity();
    if (trayLogicalUnitCount > effectiveTrayCapacity) {
      this.status = "lost";
      return;
    }

    if (this.remainingBlocks.size === 0) {
      if (this.tray.length === 0) {
        this.status = "won";
        return;
      }

      if (this.tray.every((block) => isDogSpecialMechanismResolved(block.specialMechanism))) {
        this.status = "lost";
        return;
      }
    }

    if (
      trayLogicalUnitCount === effectiveTrayCapacity &&
      !this.hasCapacityRelievingSelection(effectiveTrayCapacity)
    ) {
      this.status = "lost";
    }
  }

  private getShuffleThreshold(): number {
    return getDogShuffleThreshold(this.getEffectiveTrayCapacity(), this.config);
  }

  private getShuffleState(): GameSessionSnapshot["shuffle"] {
    const shuffleBlock = this.tray.find(
      (block) => block.specialMechanism?.type === DOG_SHUFFLE_MECHANISM_TYPE,
    );
    if (shuffleBlock === undefined) {
      return null;
    }

    return Object.freeze({
      blockId: shuffleBlock.id,
      status: getDogShuffleMechanismStatus(shuffleBlock.specialMechanism),
      threshold: this.getShuffleThreshold(),
    });
  }

  getVisibleTrayBlocks(): DogTrayBlock[] {
    const trayBlocks = [...this.tray];
    if (this.pendingSelection === null) {
      return trayBlocks;
    }

    const pendingBlock = toTrayBlock(this.pendingSelection.block);
    if (pendingBlock.specialMechanism?.type === DOG_TWIN_MECHANISM_TYPE) {
      trayBlocks.push(...prepareDogTrayBlocks(pendingBlock, this.specialMechanismHandlers));
    } else {
      trayBlocks.push(pendingBlock);
    }
    return trayBlocks;
  }

  isSelectionPending(): boolean {
    return this.pendingSelection !== null || this.pendingMagneticResolution !== null;
  }

  private revealLowerBlocks(higherBlockIndex: number): void {
    for (const lowerBlockIndex of this.graph.lowerBlockIndicesByHigher[higherBlockIndex] ?? []) {
      this.higherBlockCounts[lowerBlockIndex] -= 1;
    }
  }

  private hasCapacityRelievingSelection(effectiveTrayCapacity: number): boolean {
    if (this.remainingBlocks.size === 0) {
      return false;
    }

    const remainingMask = this.getRemainingBlockMask();
    return this.getSelectableBlockIds().some((blockId) => {
      const blockIndex = this.graph.indexById.get(blockId);
      if (blockIndex === undefined) {
        return false;
      }

      const magneticRandom = this.magneticRandom.clone();
      const resolution = resolveDogSelection(
        this.level,
        blockIndex,
        remainingMask,
        this.higherBlockCounts,
        this.tray,
        this.specialMechanismHandlers,
        magneticRandom,
        this.graph,
      );
      const shuffleResolution = resolveDogShuffleState({
        config: this.config,
        level: this.level,
        tray: resolution.tray,
        remainingBlockIds: this.level.blocks
          .filter((_, index) => (resolution.remainingMask & (1n << BigInt(index))) !== 0n)
          .map((block) => block.id),
        effectiveTrayCapacity,
        handlers: this.specialMechanismHandlers,
        magneticRandom,
        sequence: 1,
      });
      return getDogTrayLogicalUnitCount(shuffleResolution.tray) <= effectiveTrayCapacity;
    });
  }
}

export function toTrayBlock(block: DogBlock): DogTrayBlock {
  return {
    id: block.id,
    patternType: block.patternType,
    ...(block.specialMechanism === undefined
      ? {}
      : { specialMechanism: block.specialMechanism }),
  };
}

export function removeSpecialMechanism<T extends DogBlock | DogTrayBlock>(block: T): T {
  const { specialMechanism: _specialMechanism, ...ordinaryBlock } = block;
  return ordinaryBlock as T;
}

function normalizeLockedTraySlotCount(value: number | undefined, maxLockedSlotCount: number): number {
  if (value === undefined) {
    return 0;
  }

  if (!Number.isInteger(value) || value < 0 || value > maxLockedSlotCount) {
    throw new Error(
      `GameSession locked tray slot count must be an integer between 0 and ${maxLockedSlotCount}`,
    );
  }

  return value;
}

function validateMechanismHandlers(
  blocks: readonly DogBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): void {
  for (const block of blocks) {
    if (block.specialMechanism !== undefined && !handlers.has(block.specialMechanism.type)) {
      throw new Error(
        `狗了个狗 special mechanism handler is missing: ${block.specialMechanism.type}`,
      );
    }
  }
}
