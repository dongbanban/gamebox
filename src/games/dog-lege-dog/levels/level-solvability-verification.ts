import { createBlockGraph, type BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import {
  createDogSpecialMechanismHandlerMap,
  DOG_SPECIAL_MECHANISM_HANDLERS,
  getDogTrayLogicalUnitCount,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  DogLevelGeometry,
  DogSpecialMechanismHandler,
  DogSolvabilityStatus,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  DOG_BASE_TRAY_CAPACITY,
  DOG_MAX_LOCKED_TRAY_SLOTS,
} from "@/games/dog-lege-dog/game/game-config";
import {
  createDogMagneticRandom,
  resolveDogSelection,
} from "@/games/dog-lege-dog/levels/level-mechanism-resolution";
import {
  blockMask,
  createFullBlockMask,
  createSolvabilityResult,
  type PathVerification,
  type SolvabilityResult,
} from "@/games/dog-lege-dog/levels/level-solvability-contracts";
import {
  getSelectableBlocks,
  isCapacityBlocked,
} from "@/games/dog-lege-dog/levels/level-solvability-simulation";

const DEFAULT_SPECIAL_MECHANISM_HANDLER_MAP = createDogSpecialMechanismHandlerMap();

export function verifyRemovalPath(
  level: DogLevelGeometry,
  path: readonly string[],
  knownGraph?: BlockGraph,
  specialMechanismHandlers: ReadonlyMap<string, DogSpecialMechanismHandler> =
    DEFAULT_SPECIAL_MECHANISM_HANDLER_MAP,
  trayCapacity = resolveLevelTrayCapacity(level),
): PathVerification {
  if (path.length === 0 || path.length > level.blocks.length) {
    return createPathVerification(
      "unsolvable",
      path,
      0,
      "solvable path must contain at least one click and no more clicks than blocks",
    );
  }

  const graph = knownGraph ?? createBlockGraph(level.blocks);
  let remainingMask = createFullBlockMask(level.blocks.length);
  const higherBlockCounts = [...graph.higherBlockCounts];
  const tray: DogTrayBlock[] = [];
  const seenPathIndices = new Set<number>();
  const autoConsumedIndices = new Set<number>();
  const acceptedPath: string[] = [];
  const magneticRandom = createDogMagneticRandom(level);
  let trayPeakPressure = 0;

  for (const blockId of path) {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex === undefined) {
      return createPathVerification(
        "unsolvable",
        path,
        trayPeakPressure,
        `solvable path contains duplicate or unknown block ${blockId}`,
      );
    }

    if ((remainingMask & blockMask(blockIndex)) === 0n) {
      if (autoConsumedIndices.has(blockIndex) && !seenPathIndices.has(blockIndex)) {
        seenPathIndices.add(blockIndex);
        continue;
      }
      return createPathVerification(
        "unsolvable",
        path,
        trayPeakPressure,
        `solvable path removes block ${blockId} more than once`,
      );
    }

    if (higherBlockCounts[blockIndex] !== 0) {
      return createPathVerification(
        "unsolvable",
        path,
        trayPeakPressure,
        `solvable path selects blocked block ${blockId}`,
      );
    }

    const resolution = resolveDogSelection(
      level,
      blockIndex,
      remainingMask,
      higherBlockCounts,
      tray,
      specialMechanismHandlers,
      magneticRandom,
      graph,
    );
    remainingMask = resolution.remainingMask;
    for (const consumedIndex of resolution.consumedBlockIndices) {
      if (consumedIndex !== blockIndex) {
        autoConsumedIndices.add(consumedIndex);
      }
    }
    higherBlockCounts.splice(0, higherBlockCounts.length, ...resolution.higherBlockCounts);
    tray.splice(0, tray.length, ...resolution.tray);
    seenPathIndices.add(blockIndex);
    acceptedPath.push(blockId);
    const trayLogicalUnitCount = getDogTrayLogicalUnitCount(tray);
    trayPeakPressure = Math.max(trayPeakPressure, trayLogicalUnitCount);
    const selectable = getSelectableBlocks(level, remainingMask, higherBlockCounts);
    if (isCapacityBlocked(
      level,
      tray,
      trayLogicalUnitCount,
      trayCapacity,
      remainingMask !== 0n,
      selectable,
      specialMechanismHandlers,
      higherBlockCounts,
      magneticRandom,
      remainingMask,
      graph,
    )) {
      return createPathVerification(
        "unsolvable",
        path,
        trayPeakPressure,
        `solvable path fills the ${trayCapacity}-slot tray before clearing the board`,
      );
    }
  }

  if (remainingMask !== 0n) {
    return createPathVerification(
      "unsolvable",
      path,
      trayPeakPressure,
      "solvable path leaves blocks behind",
    );
  }

  if (tray.some((block) => block.specialMechanism !== undefined)) {
    return createPathVerification(
      "unsolvable",
      path,
      trayPeakPressure,
      "solvable path leaves frozen blocks before natural melting",
    );
  }

  return createPathVerification("solvable", acceptedPath, trayPeakPressure);
}

export function normalizeSolvabilityResult(
  level: DogLevelGeometry,
  result: SolvabilityResult,
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): SolvabilityResult {
  if (result.status !== "solvable") {
    return result;
  }
  const verification = verifyRemovalPath(level, result.path, undefined, handlers);
  if (!verification.solvable) {
    return result;
  }
  return {
    ...result,
    path: verification.path,
    trayPeakPressure: verification.trayPeakPressure,
  };
}

export function toSolvabilityResult(verification: PathVerification): SolvabilityResult {
  return createSolvabilityResult(
    verification.status,
    [...verification.path],
    verification.trayPeakPressure,
    verification.reason,
  );
}

export function resolveTrayCapacity(value: number | undefined): number {
  if (value === undefined) {
    return DOG_BASE_TRAY_CAPACITY;
  }

  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("solvability tray capacity must be a positive integer");
  }

  return value;
}

export function resolveLevelTrayCapacity(level: DogLevelGeometry): number {
  const lockedTraySlotCount = level.lockedTraySlotCount ?? 0;
  if (
    !Number.isSafeInteger(lockedTraySlotCount) ||
    lockedTraySlotCount < 0 ||
    lockedTraySlotCount > DOG_MAX_LOCKED_TRAY_SLOTS
  ) {
    throw new Error("solvability locked tray slot count must be an integer between 0 and 2");
  }

  return resolveTrayCapacity(DOG_BASE_TRAY_CAPACITY - lockedTraySlotCount);
}

function createPathVerification(
  status: Exclude<DogSolvabilityStatus, "budget-exhausted">,
  path: readonly string[],
  trayPeakPressure: number,
  reason?: string,
): PathVerification {
  return {
    status,
    solvable: status === "solvable",
    path,
    trayPeakPressure,
    reason,
  };
}
