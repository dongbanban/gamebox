import type {
  GameSessionDemagnetizeResult,
  GameSessionMeltLocation,
  GameSessionMeltResult,
  GameSessionMagneticResolution,
  GameSessionRevealResult,
  GameSessionSelectionResult,
  GameSessionSnapshot,
  GameSessionTripleRemovalResult,
  GameSessionUnlockResult,
  GameSessionWildcardResolution,
  GameSessionWildcardResult,
} from "@/games/dog-lege-dog/game/game-session-contracts";
import type { DogPatternType } from "@/games/dog-lege-dog/levels/first-level";

export function createSelectionResult(
  snapshot: GameSessionSnapshot,
  selected: boolean,
  removedCount: number,
  tripleCount = 0,
  meltedBlockIds: readonly string[] = [],
  magneticResolution: GameSessionMagneticResolution | null = null,
): GameSessionSelectionResult {
  return freezeResult(snapshot, {
    magneticResolution,
    selected,
    removedCount,
    tripleCount,
    meltedBlockIds: Object.freeze([...meltedBlockIds]),
  }, "snapshot");
}

export function createTripleRemovalResult(
  snapshot: GameSessionSnapshot,
  removed: boolean,
  patternType: DogPatternType,
  blockIds: readonly string[],
  removedCount: number,
  tripleCount: number,
  meltedBlockIds: readonly string[],
  trayBlockIds: readonly string[] = [],
): GameSessionTripleRemovalResult {
  return freezeResult(snapshot, {
    removed,
    patternType,
    trayBlockIds: Object.freeze([...trayBlockIds]),
    blockIds: Object.freeze([...blockIds]),
    removedCount,
    tripleCount,
    meltedBlockIds: Object.freeze([...meltedBlockIds]),
  }, "snapshot");
}

export function createMeltResult(
  snapshot: GameSessionSnapshot,
  melted: boolean,
  blockId: string,
  location: GameSessionMeltLocation,
  removedCount: number,
  tripleCount: number,
  meltedBlockIds: readonly string[],
): GameSessionMeltResult {
  return freezeResult(snapshot, {
    melted,
    location,
    blockId,
    removedCount,
    tripleCount,
    meltedBlockIds: Object.freeze([...meltedBlockIds]),
  }, "snapshot");
}

export function createRevealResult(
  snapshot: GameSessionSnapshot,
  revealed: boolean,
  blockId: string,
): GameSessionRevealResult {
  return freezeResult(snapshot, { revealed, blockId }, "snapshot");
}

export function createDemagnetizeResult(
  snapshot: GameSessionSnapshot,
  demagnetized: boolean,
  blockId: string,
): GameSessionDemagnetizeResult {
  return freezeResult(snapshot, { demagnetized, blockId }, "snapshot");
}

export function createUnlockResult(
  snapshot: GameSessionSnapshot,
  unlocked: boolean,
  unlockedSlotIndex: number | null,
): GameSessionUnlockResult {
  return freezeResult(snapshot, { unlocked, unlockedSlotIndex }, "snapshot");
}

export function createWildcardResult(
  snapshot: GameSessionSnapshot,
  resolution: GameSessionWildcardResolution,
): GameSessionWildcardResult {
  return freezeResult(snapshot, {
    used: true,
    patternType: resolution.patternType,
    wildcardBlockId: resolution.wildcardBlockId,
    compensatedBlockId: resolution.compensatedBlockId,
    removedCount: resolution.removedCount,
    tripleCount: resolution.tripleCount,
    meltedBlockIds: Object.freeze([...resolution.meltedBlockIds]),
  }, "snapshot");
}

export function createFailedWildcardResult(
  snapshot: GameSessionSnapshot,
  patternType: DogPatternType,
): GameSessionWildcardResult {
  return freezeResult(snapshot, { used: false, patternType }, "snapshot");
}

function freezeResult<T extends object>(
  snapshot: GameSessionSnapshot,
  properties: T,
  snapshotProperty: "snapshot",
): T & GameSessionSnapshot & { readonly snapshot: GameSessionSnapshot } {
  const result = { ...snapshot } as T & GameSessionSnapshot & {
    readonly snapshot: GameSessionSnapshot;
  };
  Object.defineProperties(result, {
    ...Object.fromEntries(Object.entries(properties).map(([key, value]) => [
      key,
      {
        configurable: false,
        enumerable: false,
        value,
        writable: false,
      },
    ])),
    [snapshotProperty]: {
      configurable: false,
      enumerable: false,
      value: snapshot,
      writable: false,
    },
  });
  return Object.freeze(result);
}
