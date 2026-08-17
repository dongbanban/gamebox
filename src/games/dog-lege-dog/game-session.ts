import {
  FIRST_LEVEL,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "./first-level";
import { createBlockGraph, type BlockGraph } from "./level-graph";
import { freezeDogLegeDogLevel } from "./level-immutability";
import {
  insertPatternIntoTray,
  resolvePatternMatches,
} from "./level-rules";

export const GAME_SESSION_TRAY_CAPACITY = 7 as const;

export type GameSessionStatus = "playing" | "won" | "lost";

export interface GameSessionOptions {
  readonly level?: DogLegeDogLevel;
  readonly initialTray?: readonly DogPatternType[];
}

export interface GameSessionSnapshot {
  readonly status: GameSessionStatus;
  readonly level: DogLegeDogLevel;
  readonly remainingBlocks: readonly DogBlock[];
  readonly tray: readonly DogPatternType[];
  readonly trayCapacity: typeof GAME_SESSION_TRAY_CAPACITY;
  readonly selectableBlockIds: readonly string[];
}

export interface GameSessionSelectionResult extends GameSessionSnapshot {
  readonly selected: boolean;
  readonly removedCount: number;
  readonly snapshot: GameSessionSnapshot;
}

export class GameSession {
  private readonly level: DogLegeDogLevel;
  private readonly graph: BlockGraph;
  private readonly remainingBlocks = new Map<string, DogBlock>();
  private readonly higherBlockCounts: number[];
  private tray: DogPatternType[];
  private status: GameSessionStatus = "playing";

  constructor(level?: DogLegeDogLevel);
  constructor(options?: GameSessionOptions);
  constructor(levelOrOptions: DogLegeDogLevel | GameSessionOptions = FIRST_LEVEL) {
    const options = isLevel(levelOrOptions) ? { level: levelOrOptions } : levelOrOptions;
    this.level = freezeDogLegeDogLevel(options.level ?? FIRST_LEVEL);
    this.graph = createBlockGraph(this.level.blocks);
    this.higherBlockCounts = [...this.graph.higherBlockCounts];
    this.tray = [...(options.initialTray ?? [])];

    for (const block of this.level.blocks) {
      if (this.remainingBlocks.has(block.id)) {
        throw new Error(`Duplicate 狗了个狗 block id: ${block.id}`);
      }

      this.remainingBlocks.set(block.id, block);
    }

    if (this.tray.length > GAME_SESSION_TRAY_CAPACITY) {
      throw new Error("GameSession tray cannot contain more than 7 blocks");
    }

    resolvePatternMatches(this.tray);
    this.updateResult();
  }

  getState(): GameSessionSnapshot {
    const remainingBlocks = Object.freeze([...this.remainingBlocks.values()]);

    return Object.freeze({
      status: this.status,
      level: this.level,
      remainingBlocks,
      tray: Object.freeze([...this.tray]),
      trayCapacity: GAME_SESSION_TRAY_CAPACITY,
      selectableBlockIds: Object.freeze(this.getSelectableBlockIds()),
    });
  }

  canSelectBlock(blockId: string): boolean {
    if (this.status !== "playing") {
      return false;
    }

    const block = this.remainingBlocks.get(blockId);
    if (block === undefined) {
      return false;
    }

    const blockIndex = this.graph.indexById.get(blockId);
    return blockIndex !== undefined && this.higherBlockCounts[blockIndex] === 0;
  }

  selectBlock(blockId: string): GameSessionSelectionResult {
    if (!this.canSelectBlock(blockId)) {
      return this.createSelectionResult(false, 0);
    }

    const block = this.remainingBlocks.get(blockId);
    if (block === undefined) {
      return this.createSelectionResult(false, 0);
    }

    this.remainingBlocks.delete(blockId);
    const blockIndex = this.graph.indexById.get(blockId);
    if (blockIndex === undefined) {
      return this.createSelectionResult(false, 0);
    }

    for (const lowerBlockIndex of this.graph.lowerBlockIndicesByHigher[blockIndex]) {
      this.higherBlockCounts[lowerBlockIndex] -= 1;
    }

    const removedCount = insertPatternIntoTray(this.tray, block.patternType);
    this.updateResult();

    return this.createSelectionResult(true, removedCount);
  }

  private getSelectableBlockIds(): string[] {
    if (this.status !== "playing") {
      return [];
    }

    return [...this.remainingBlocks.values()]
      .filter((block) => {
        const blockIndex = this.graph.indexById.get(block.id);
        return blockIndex !== undefined && this.higherBlockCounts[blockIndex] === 0;
      })
      .map((block) => block.id);
  }

  private createSelectionResult(
    selected: boolean,
    removedCount: number,
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
    if (this.remainingBlocks.size === 0) {
      this.status = "won";
      return;
    }

    if (this.tray.length >= GAME_SESSION_TRAY_CAPACITY) {
      this.status = "lost";
    }
  }
}

function isLevel(value: DogLegeDogLevel | GameSessionOptions): value is DogLegeDogLevel {
  return "blocks" in value;
}
