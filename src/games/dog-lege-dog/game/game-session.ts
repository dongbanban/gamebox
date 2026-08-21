import {
  FIRST_LEVEL,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
  type DogSpecialMechanismHandler,
  type DogTrayBlock,
} from "@/games/dog-lege-dog/levels/first-level";
import { createBlockGraph, type BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import { freezeDogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-immutability";
import {
  insertDogTrayBlock,
  insertDogBlockIntoTray,
  resolveDogTrayMatches,
} from "@/games/dog-lege-dog/levels/level-rules";
import {
  createDogSpecialMechanismHandlerMap,
  DOG_SPECIAL_MECHANISM_HANDLERS,
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanisms";

export const GAME_SESSION_BASE_TRAY_CAPACITY = 7 as const;
export const GAME_SESSION_TRAY_CAPACITY = GAME_SESSION_BASE_TRAY_CAPACITY;
export const GAME_SESSION_MAX_TRAY_CAPACITY = 8 as const;

export type GameSessionStatus = "playing" | "won" | "lost";

export interface GameSessionOptions {
  readonly level?: DogLegeDogLevel;
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
  readonly selectableBlockIds: readonly string[];
}

export interface GameSessionPendingSelectionResult {
  readonly selected: boolean;
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionSelectionResult extends GameSessionSnapshot {
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

export class GameSession {
  private readonly level: DogLegeDogLevel;
  private readonly graph: BlockGraph;
  private readonly remainingBlocks = new Map<string, DogBlock>();
  private readonly higherBlockCounts: number[];
  private readonly specialMechanismHandlers: ReadonlyMap<string, DogSpecialMechanismHandler>;
  private tray: DogTrayBlock[];
  private pendingSelection: { readonly block: DogBlock } | null = null;
  private trayCapacity: number;
  private status: GameSessionStatus = "playing";

  constructor(level?: DogLegeDogLevel);
  constructor(options?: GameSessionOptions);
  constructor(levelOrOptions: DogLegeDogLevel | GameSessionOptions = FIRST_LEVEL) {
    const options = isLevel(levelOrOptions) ? { level: levelOrOptions } : levelOrOptions;
    this.level = freezeDogLegeDogLevel(options.level ?? FIRST_LEVEL);
    this.graph = createBlockGraph(this.level.blocks);
    this.higherBlockCounts = [...this.graph.higherBlockCounts];
    this.specialMechanismHandlers = createDogSpecialMechanismHandlerMap(
      options.specialMechanismHandlers ?? DOG_SPECIAL_MECHANISM_HANDLERS,
    );
    this.trayCapacity = options.initialTrayCapacity ?? GAME_SESSION_BASE_TRAY_CAPACITY;
    if (
      !Number.isInteger(this.trayCapacity) ||
      this.trayCapacity < GAME_SESSION_BASE_TRAY_CAPACITY ||
      this.trayCapacity > GAME_SESSION_MAX_TRAY_CAPACITY
    ) {
      throw new Error("GameSession tray capacity must be an integer between 7 and 8");
    }
    for (const block of this.level.blocks) {
      if (
        block.specialMechanism !== undefined &&
        !this.specialMechanismHandlers.has(block.specialMechanism.type)
      ) {
        throw new Error(
          `狗了个狗 special mechanism handler is missing: ${block.specialMechanism.type}`,
        );
      }
    }
    if (options.initialTray !== undefined && options.initialTrayBlocks !== undefined) {
      throw new Error("GameSession cannot receive both initialTray and initialTrayBlocks");
    }
    this.tray = options.initialTrayBlocks === undefined
      ? (options.initialTray ?? []).map((patternType, index) => ({
          id: `initial-tray-${index + 1}`,
          patternType,
        }))
      : options.initialTrayBlocks.map((block) => ({ ...block }));

    for (const block of this.level.blocks) {
      if (this.remainingBlocks.has(block.id)) {
        throw new Error(`Duplicate 狗了个狗 block id: ${block.id}`);
      }

      this.remainingBlocks.set(block.id, block);
    }

    if (this.tray.length > this.trayCapacity) {
      throw new Error(`GameSession tray cannot contain more than ${this.trayCapacity} blocks`);
    }

    if (
      this.tray.some(
        (block) => block.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE,
      )
    ) {
      throw new Error("GameSession illusion blocks cannot start in the tray");
    }

    resolveDogTrayMatches(this.tray, this.specialMechanismHandlers);
    this.updateResult();
  }

  getState(): GameSessionSnapshot {
    const remainingBlocks = Object.freeze([...this.remainingBlocks.values()]);
    const trayBlocks = Object.freeze(
      this.getVisibleTrayBlocks().map(cloneTrayBlock),
    );

    return Object.freeze({
      status: this.status,
      level: this.level,
      remainingBlocks,
      tray: Object.freeze(trayBlocks.map((block) => block.patternType)),
      trayBlocks,
      trayCapacity: this.trayCapacity,
      selectableBlockIds: Object.freeze(this.getSelectableBlockIds()),
    });
  }

  canSelectBlock(blockId: string): boolean {
    if (this.status !== "playing" || this.pendingSelection !== null) {
      return false;
    }

    const block = this.remainingBlocks.get(blockId);
    if (block === undefined) {
      return false;
    }

    const blockIndex = this.graph.indexById.get(blockId);
    return blockIndex !== undefined && this.higherBlockCounts[blockIndex] === 0;
  }

  increaseTrayCapacity(): boolean {
    if (
      this.status !== "playing" ||
      this.pendingSelection !== null ||
      this.trayCapacity >= GAME_SESSION_MAX_TRAY_CAPACITY
    ) {
      return false;
    }

    this.trayCapacity += 1;
    return true;
  }

  canMeltFrozenBlock(blockId: string, location: GameSessionMeltLocation): boolean {
    if (this.status !== "playing" || this.pendingSelection !== null) {
      return false;
    }

    const block = location === "board"
      ? this.remainingBlocks.get(blockId)
      : this.tray.find((candidate) => candidate.id === blockId);
    return block?.specialMechanism?.type === DOG_FREEZE_MECHANISM_TYPE;
  }

  canRevealIllusionBlock(blockId: string): boolean {
    if (this.status !== "playing" || this.pendingSelection !== null) {
      return false;
    }

    return this.remainingBlocks.get(blockId)?.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE;
  }

  revealIllusionBlock(blockId: string): GameSessionRevealResult {
    if (!this.canRevealIllusionBlock(blockId)) {
      return this.createRevealResult(false, blockId);
    }

    const block = this.remainingBlocks.get(blockId);
    if (block === undefined) {
      return this.createRevealResult(false, blockId);
    }

    this.remainingBlocks.set(blockId, removeSpecialMechanism(block));
    this.updateResult();
    return this.createRevealResult(true, blockId);
  }

  meltFrozenBlock(
    blockId: string,
    location: GameSessionMeltLocation,
  ): GameSessionMeltResult {
    if (!this.canMeltFrozenBlock(blockId, location)) {
      return this.createMeltResult(false, blockId, location, 0, 0, []);
    }

    if (location === "board") {
      const block = this.remainingBlocks.get(blockId);
      if (block === undefined) {
        return this.createMeltResult(false, blockId, location, 0, 0, []);
      }

      this.remainingBlocks.set(blockId, removeSpecialMechanism(block));
      this.updateResult();
      return this.createMeltResult(true, blockId, location, 0, 0, [blockId]);
    }

    const trayIndex = this.tray.findIndex((candidate) => candidate.id === blockId);
    const block = trayIndex < 0 ? undefined : this.tray[trayIndex];
    if (block === undefined) {
      return this.createMeltResult(false, blockId, location, 0, 0, []);
    }

    this.tray[trayIndex] = removeSpecialMechanism(block);
    const resolution = resolveDogTrayMatches(this.tray, this.specialMechanismHandlers);
    this.updateResult();
    return this.createMeltResult(
      true,
      blockId,
      location,
      resolution.removedCount,
      resolution.tripleCount,
      [blockId, ...resolution.meltedBlockIds],
    );
  }

  selectBlock(blockId: string): GameSessionSelectionResult {
    if (!this.startBlockSelection(blockId)) {
      return this.createSelectionResult(false, 0);
    }

    return this.completeBlockSelection();
  }

  beginBlockSelection(blockId: string): GameSessionPendingSelectionResult {
    if (!this.startBlockSelection(blockId)) {
      return {
        selected: false,
        snapshot: this.getState(),
      };
    }

    return {
      selected: true,
      snapshot: this.getState(),
    };
  }

  completeBlockSelection(): GameSessionSelectionResult {
    const pendingSelection = this.pendingSelection;
    if (pendingSelection === null) {
      return this.createSelectionResult(false, 0);
    }

    this.pendingSelection = null;
    const resolution = insertDogBlockIntoTray(
      this.tray,
      toTrayBlock(pendingSelection.block),
      this.specialMechanismHandlers,
    );
    this.updateResult();

    return this.createSelectionResult(
      true,
      resolution.removedCount,
      resolution.tripleCount,
      resolution.meltedBlockIds,
    );
  }

  private getSelectableBlockIds(): string[] {
    if (this.status !== "playing" || this.pendingSelection !== null) {
      return [];
    }

    return [...this.remainingBlocks.values()]
      .filter((block) => {
        const blockIndex = this.graph.indexById.get(block.id);
        return blockIndex !== undefined && this.higherBlockCounts[blockIndex] === 0;
      })
      .map((block) => block.id);
  }

  private startBlockSelection(blockId: string): boolean {
    if (!this.canSelectBlock(blockId)) {
      return false;
    }

    const block = this.remainingBlocks.get(blockId);
    const blockIndex = this.graph.indexById.get(blockId);
    if (block === undefined || blockIndex === undefined) {
      return false;
    }

    this.remainingBlocks.delete(blockId);
    for (const lowerBlockIndex of this.graph.lowerBlockIndicesByHigher[blockIndex]) {
      this.higherBlockCounts[lowerBlockIndex] -= 1;
    }
    this.pendingSelection = { block };
    return true;
  }

  private createSelectionResult(
    selected: boolean,
    removedCount: number,
    tripleCount = 0,
    meltedBlockIds: readonly string[] = [],
  ): GameSessionSelectionResult {
    const snapshot = this.getState();
    const result = {
      ...snapshot,
    } as GameSessionSelectionResult;
    Object.defineProperties(result, {
      selected: {
        configurable: false,
        enumerable: false,
        value: selected,
        writable: false,
      },
      removedCount: {
        configurable: false,
        enumerable: false,
        value: removedCount,
        writable: false,
      },
      tripleCount: {
        configurable: false,
        enumerable: false,
        value: tripleCount,
        writable: false,
      },
      meltedBlockIds: {
        configurable: false,
        enumerable: false,
        value: Object.freeze([...meltedBlockIds]),
        writable: false,
      },
      snapshot: {
        configurable: false,
        enumerable: false,
        value: snapshot,
        writable: false,
      },
    });
    return Object.freeze(result);
  }

  private createMeltResult(
    melted: boolean,
    blockId: string,
    location: GameSessionMeltLocation,
    removedCount: number,
    tripleCount: number,
    meltedBlockIds: readonly string[],
  ): GameSessionMeltResult {
    const snapshot = this.getState();
    const result = {
      ...snapshot,
    } as GameSessionMeltResult;
    Object.defineProperties(result, {
      melted: {
        configurable: false,
        enumerable: false,
        value: melted,
        writable: false,
      },
      location: {
        configurable: false,
        enumerable: false,
        value: location,
        writable: false,
      },
      blockId: {
        configurable: false,
        enumerable: false,
        value: blockId,
        writable: false,
      },
      removedCount: {
        configurable: false,
        enumerable: false,
        value: removedCount,
        writable: false,
      },
      tripleCount: {
        configurable: false,
        enumerable: false,
        value: tripleCount,
        writable: false,
      },
      meltedBlockIds: {
        configurable: false,
        enumerable: false,
        value: Object.freeze([...meltedBlockIds]),
        writable: false,
      },
      snapshot: {
        configurable: false,
        enumerable: false,
        value: snapshot,
        writable: false,
      },
    });
    return Object.freeze(result);
  }

  private createRevealResult(
    revealed: boolean,
    blockId: string,
  ): GameSessionRevealResult {
    const snapshot = this.getState();
    const result = {
      ...snapshot,
    } as GameSessionRevealResult;
    Object.defineProperties(result, {
      revealed: {
        configurable: false,
        enumerable: false,
        value: revealed,
        writable: false,
      },
      blockId: {
        configurable: false,
        enumerable: false,
        value: blockId,
        writable: false,
      },
      snapshot: {
        configurable: false,
        enumerable: false,
        value: snapshot,
        writable: false,
      },
    });
    return Object.freeze(result);
  }

  private updateResult(): void {
    if (this.pendingSelection !== null) {
      this.status = "playing";
      return;
    }

    if (
      this.remainingBlocks.size === 0 &&
      this.tray.every((block) => block.specialMechanism === undefined)
    ) {
      this.status = "won";
      return;
    }

    if (this.tray.length >= this.trayCapacity) {
      this.status = "lost";
    }
  }

  private getVisibleTrayBlocks(): DogTrayBlock[] {
    const trayBlocks = [...this.tray];
    if (this.pendingSelection === null) {
      return trayBlocks;
    }

    insertDogTrayBlock(
      trayBlocks,
      toTrayBlock(this.pendingSelection.block),
    );
    return trayBlocks;
  }
}

function cloneTrayBlock(block: DogTrayBlock): DogTrayBlock {
  if (block.specialMechanism === undefined) {
    return Object.freeze({ ...block });
  }

  return Object.freeze({
    ...block,
    specialMechanism: Object.freeze({
      ...block.specialMechanism,
      state: Object.freeze({ ...block.specialMechanism.state }),
    }),
  });
}

function toTrayBlock(block: DogBlock): DogTrayBlock {
  return {
    id: block.id,
    patternType: block.patternType,
    ...(block.specialMechanism === undefined
      ? {}
      : { specialMechanism: block.specialMechanism }),
  };
}

function removeSpecialMechanism<T extends DogBlock | DogTrayBlock>(block: T): T {
  const { specialMechanism: _specialMechanism, ...meltedBlock } = block;
  return meltedBlock as T;
}

function isLevel(value: DogLegeDogLevel | GameSessionOptions): value is DogLegeDogLevel {
  return "blocks" in value;
}
