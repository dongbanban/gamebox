import { isDogTrayBlockMatchable } from "@/games/dog-lege-dog/levels/level-rules";
import { createBlockGraph, type BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import {
  getDogTrayLogicalUnitCount,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type {
  DogLevelGeometry,
  DogSpecialMechanismHandler,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  blockMask,
  createFullBlockMask,
} from "@/games/dog-lege-dog/levels/level-solvability-contracts";
import {
  createDogMagneticRandom,
  resolveDogSelection,
} from "@/games/dog-lege-dog/levels/level-mechanism-resolution";
import {
  resolveDogShuffleState,
  type DogShuffleStateResolution,
} from "@/games/dog-lege-dog/levels/level-shuffle";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";

export function getSelectableBlocks(
  level: DogLevelGeometry,
  remainingMask: bigint,
  higherBlockCounts: readonly number[],
): number[] {
  const selectable: number[] = [];
  for (let index = 0; index < level.blocks.length; index += 1) {
    if (
      (remainingMask & blockMask(index)) !== 0n &&
      higherBlockCounts[index] === 0
    ) {
      selectable.push(index);
    }
  }
  return selectable;
}

export function isCapacityBlocked(
  level: DogLevelGeometry,
  tray: readonly DogTrayBlock[],
  trayLogicalUnitCount: number,
  trayCapacity: number,
  hasRemainingBlocks: boolean,
  selectableIndices: readonly number[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  config: DogV13Config,
  currentHigherBlockCounts?: readonly number[],
  magneticRandom?: SeededRandom,
  remainingMask = createFullBlockMask(level.blocks.length),
  knownGraph?: BlockGraph,
): boolean {
  if (!hasRemainingBlocks || trayLogicalUnitCount < trayCapacity) {
    return false;
  }
  if (trayLogicalUnitCount > trayCapacity) {
    return true;
  }

  return !selectableIndices.some((index) => {
    const block = level.blocks[index];
    if (block === undefined) {
      return false;
    }

    const selectionRandom = magneticRandom?.clone() ?? createDogMagneticRandom(level);
    const simulated = resolveDogSelection(
      level,
      index,
      remainingMask,
      currentHigherBlockCounts ?? createBlockGraph(level.blocks).higherBlockCounts,
      tray,
      handlers,
      selectionRandom,
      knownGraph,
    );
    const shuffled = resolveDogShuffleAfterSelection({
      level,
      tray: simulated.tray,
      remainingMask: simulated.remainingMask,
      effectiveTrayCapacity: trayCapacity,
      handlers,
      magneticRandom: selectionRandom,
      config,
    });
    return getDogTrayLogicalUnitCount(shuffled.tray) <= trayCapacity;
  });
}

export interface DogShuffleAfterSelectionOptions {
  readonly level: DogLevelGeometry;
  readonly tray: readonly DogTrayBlock[];
  readonly remainingMask: bigint;
  readonly effectiveTrayCapacity: number;
  readonly handlers: ReadonlyMap<string, DogSpecialMechanismHandler>;
  readonly magneticRandom: SeededRandom;
  readonly config: DogV13Config;
  readonly sequence?: number;
}

export function resolveDogShuffleAfterSelection(
  options: DogShuffleAfterSelectionOptions,
): DogShuffleStateResolution {
  return resolveDogShuffleState({
    level: options.level,
    config: options.config,
    tray: options.tray,
    remainingBlockIds: options.level.blocks
      .filter((_, index) => (options.remainingMask & blockMask(index)) !== 0n)
      .map((block) => block.id),
    effectiveTrayCapacity: options.effectiveTrayCapacity,
    handlers: options.handlers,
    magneticRandom: options.magneticRandom,
    sequence: options.sequence ?? 1,
  });
}

export function sortSelectableBlocks(
  selectable: number[],
  level: DogLevelGeometry,
  tray: readonly DogTrayBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  preferredRank: ReadonlyMap<number, number>,
): void {
  selectable.sort((firstIndex, secondIndex) => {
    const firstRank = preferredRank.get(firstIndex) ?? Number.MAX_SAFE_INTEGER;
    const secondRank = preferredRank.get(secondIndex) ?? Number.MAX_SAFE_INTEGER;
    const firstMatches = getTrailingMatchCount(
      tray,
      level.blocks[firstIndex].patternType,
      handlers,
    );
    const secondMatches = getTrailingMatchCount(
      tray,
      level.blocks[secondIndex].patternType,
      handlers,
    );
    return (
      secondMatches - firstMatches ||
      firstRank - secondRank ||
      level.blocks[secondIndex].z - level.blocks[firstIndex].z ||
      level.blocks[firstIndex].id.localeCompare(level.blocks[secondIndex].id)
    );
  });
}

export function stateKeyFor(
  remainingMask: bigint,
  tray: readonly DogTrayBlock[],
  magneticRandom?: SeededRandom,
): string {
  return `${remainingMask.toString(36)}:${tray
    .map((block) => block.specialMechanism === undefined
      ? `ordinary:${block.patternType}`
      : `${block.id}:${block.patternType}:${serializeMechanism(block)}`)
    .join(",")}:${magneticRandom?.stateKey() ?? "initial"}`;
}

export function trayPeakPressureForPath(
  level: DogLevelGeometry,
  initialTray: readonly DogTrayBlock[],
  path: readonly string[],
  graph: BlockGraph,
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  config: DogV13Config,
  initialRemainingMask = createFullBlockMask(level.blocks.length),
  initialHigherBlockCounts: readonly number[] = graph.higherBlockCounts,
  magneticRandom: SeededRandom = createDogMagneticRandom(level),
): number {
  const tray = [...initialTray];
  let remainingMask = initialRemainingMask;
  const higherBlockCounts = [...initialHigherBlockCounts];
  const selectionRandom = magneticRandom.clone();
  let trayPeakPressure = getDogTrayLogicalUnitCount(tray);
  const autoConsumedIndices = new Set<number>();
  for (const blockId of path) {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex === undefined) {
      return trayPeakPressure;
    }

    if ((remainingMask & blockMask(blockIndex)) === 0n) {
      if (autoConsumedIndices.has(blockIndex)) {
        continue;
      }
      return trayPeakPressure;
    }

    const resolution = resolveDogSelection(
      level,
      blockIndex,
      remainingMask,
      higherBlockCounts,
      tray,
      handlers,
      selectionRandom,
      graph,
    );
    remainingMask = resolution.remainingMask;
    higherBlockCounts.splice(0, higherBlockCounts.length, ...resolution.higherBlockCounts);
    const shuffled = resolveDogShuffleAfterSelection({
      level,
      tray: resolution.tray,
      remainingMask,
      effectiveTrayCapacity: config.tray.baseCapacity - (level.lockedTraySlotCount ?? 0),
      handlers,
      magneticRandom: selectionRandom,
      config,
    });
    tray.splice(0, tray.length, ...shuffled.tray);
    for (const consumedIndex of resolution.consumedBlockIndices) {
      if (consumedIndex !== blockIndex) {
        autoConsumedIndices.add(consumedIndex);
      }
    }
    trayPeakPressure = Math.max(trayPeakPressure, getDogTrayLogicalUnitCount(tray));
  }

  return trayPeakPressure;
}

export function toTrayBlock(block: DogLevelGeometry["blocks"][number]): DogTrayBlock {
  return {
    id: block.id,
    patternType: block.patternType,
    ...(block.specialMechanism === undefined
      ? {}
      : { specialMechanism: block.specialMechanism }),
  };
}

export function cloneTray(tray: readonly DogTrayBlock[]): DogTrayBlock[] {
  return tray.map((block) => ({
    ...block,
    ...(block.specialMechanism === undefined
      ? {}
      : {
          specialMechanism: {
            ...block.specialMechanism,
            state: { ...block.specialMechanism.state },
          },
        }),
  }));
}

function getTrailingMatchCount(
  tray: readonly DogTrayBlock[],
  patternType: DogTrayBlock["patternType"],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): number {
  let matchCount = 0;
  for (let index = tray.length - 1; index >= 0; index -= 1) {
    const block = tray[index];
    if (
      block === undefined ||
      block.patternType !== patternType ||
      !isDogTrayBlockMatchable(block, handlers)
    ) {
      break;
    }
    matchCount += 1;
  }
  return matchCount;
}

function serializeMechanism(block: DogTrayBlock): string {
  if (block.specialMechanism === undefined) {
    return "ordinary";
  }

  return [
    block.specialMechanism.type,
    ...Object.entries(block.specialMechanism.state)
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
      .map(([key, value]) => `${key}=${String(value)}`),
  ].join(";");
}
