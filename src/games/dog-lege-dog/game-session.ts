import {
  FIRST_LEVEL,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "./first-level";

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

export class GameSession {
  private readonly level: DogLegeDogLevel;
  private readonly remainingBlocks = new Map<string, DogBlock>();
  private tray: DogPatternType[];
  private status: GameSessionStatus = "playing";

  constructor(level?: DogLegeDogLevel);
  constructor(options?: GameSessionOptions);
  constructor(levelOrOptions: DogLegeDogLevel | GameSessionOptions = FIRST_LEVEL) {
    const options = isLevel(levelOrOptions) ? { level: levelOrOptions } : levelOrOptions;
    this.level = options.level ?? FIRST_LEVEL;
    this.tray = [...(options.initialTray ?? [])];

    for (const block of this.level.blocks) {
      if (this.remainingBlocks.has(block.id)) {
        throw new Error(`Duplicate 狗了个狗 block id: ${block.id}`);
      }

      this.remainingBlocks.set(block.id, { ...block });
    }

    if (this.tray.length > GAME_SESSION_TRAY_CAPACITY) {
      throw new Error("GameSession tray cannot contain more than 7 blocks");
    }

    this.resolveMatches();
    this.updateResult();
  }

  getState(): GameSessionSnapshot {
    const remainingBlocks = [...this.remainingBlocks.values()].map(cloneBlock);

    return {
      status: this.status,
      level: cloneLevel(this.level),
      remainingBlocks,
      tray: [...this.tray],
      trayCapacity: GAME_SESSION_TRAY_CAPACITY,
      selectableBlockIds: this.getSelectableBlockIds(),
    };
  }

  canSelectBlock(blockId: string): boolean {
    if (this.status !== "playing") {
      return false;
    }

    const block = this.remainingBlocks.get(blockId);
    if (block === undefined) {
      return false;
    }

    return ![...this.remainingBlocks.values()].some(
      (higherBlock) =>
        higherBlock.z > block.z && hasPositiveAreaOverlap(block, higherBlock),
    );
  }

  selectBlock(blockId: string): GameSessionSnapshot {
    if (!this.canSelectBlock(blockId)) {
      return this.getState();
    }

    const block = this.remainingBlocks.get(blockId);
    if (block === undefined) {
      return this.getState();
    }

    this.remainingBlocks.delete(blockId);
    this.insertIntoTray(block.patternType);
    this.resolveMatches();
    this.updateResult();

    return this.getState();
  }

  private getSelectableBlockIds(): string[] {
    return [...this.remainingBlocks.values()]
      .filter((block) => this.canSelectBlock(block.id))
      .map((block) => block.id);
  }

  private insertIntoTray(patternType: DogPatternType): void {
    let lastSameTypeIndex = -1;
    for (let index = this.tray.length - 1; index >= 0; index -= 1) {
      if (this.tray[index] === patternType) {
        lastSameTypeIndex = index;
        break;
      }
    }

    if (lastSameTypeIndex === -1) {
      this.tray.push(patternType);
      return;
    }

    this.tray.splice(lastSameTypeIndex + 1, 0, patternType);
  }

  private resolveMatches(): void {
    const counts = new Map<DogPatternType, number>();
    for (const patternType of this.tray) {
      counts.set(patternType, (counts.get(patternType) ?? 0) + 1);
    }

    const removals = new Map<DogPatternType, number>();
    for (const [patternType, count] of counts) {
      const removableCount = Math.floor(count / 3) * 3;
      if (removableCount > 0) {
        removals.set(patternType, removableCount);
      }
    }

    if (removals.size === 0) {
      return;
    }

    this.tray = this.tray.filter((patternType) => {
      const remainingRemovals = removals.get(patternType) ?? 0;
      if (remainingRemovals === 0) {
        return true;
      }

      removals.set(patternType, remainingRemovals - 1);
      return false;
    });
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

function hasPositiveAreaOverlap(block: DogBlock, other: DogBlock): boolean {
  return (
    block.x < other.x + other.width &&
    other.x < block.x + block.width &&
    block.y < other.y + other.height &&
    other.y < block.y + block.height
  );
}

function cloneBlock(block: DogBlock): DogBlock {
  return { ...block };
}

function cloneLevel(level: DogLegeDogLevel): DogLegeDogLevel {
  return {
    ...level,
    board: {
      ...level.board,
      playableCells: level.board.playableCells.map((cell) => ({ ...cell })),
    },
    patternTypes: [...level.patternTypes],
    blocks: level.blocks.map(cloneBlock),
  };
}
