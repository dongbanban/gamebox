import type {
  DogPatternType,
  DogSpecialMechanismHandler,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";

export { getPositiveOverlapArea, hasPositiveAreaOverlap } from "@/games/dog-lege-dog/levels/level-graph";

export interface DogRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function insertPatternIntoTray(
  tray: DogPatternType[],
  patternType: DogPatternType,
): number {
  tray.push(patternType);

  return resolvePatternMatches(tray);
}

export function resolvePatternMatches(tray: DogPatternType[]): number {
  const counts = new Map<DogPatternType, number>();
  for (const currentPatternType of tray) {
    counts.set(currentPatternType, (counts.get(currentPatternType) ?? 0) + 1);
  }

  const removals = new Map<DogPatternType, number>();
  for (const [currentPatternType, count] of counts) {
    const removableCount = Math.floor(count / 3) * 3;
    if (removableCount > 0) {
      removals.set(currentPatternType, removableCount);
    }
  }

  if (removals.size === 0) {
    return 0;
  }

  let writeIndex = 0;
  let removedCount = 0;
  for (const currentPatternType of tray) {
    const remainingRemovals = removals.get(currentPatternType) ?? 0;
    if (remainingRemovals > 0) {
      removals.set(currentPatternType, remainingRemovals - 1);
      removedCount += 1;
      continue;
    }

    tray[writeIndex] = currentPatternType;
    writeIndex += 1;
  }
  tray.length = writeIndex;
  return removedCount;
}

export interface DogTrayMatchResolution {
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
}

export interface DogTrayMatchResolutionOptions {
  readonly allowFrozenFinalTriple?: boolean;
}

export function insertDogBlockIntoTray(
  tray: DogTrayBlock[],
  block: DogTrayBlock,
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  options: DogTrayMatchResolutionOptions = {},
): DogTrayMatchResolution {
  const trayBlock = prepareDogTrayBlock(block, handlers);
  insertDogTrayBlock(tray, trayBlock);

  return resolveDogTrayMatches(tray, handlers, options);
}

export function insertDogTrayBlock(
  tray: DogTrayBlock[],
  block: DogTrayBlock,
): void {
  tray.push(block);
}

export function prepareDogTrayBlock(
  block: DogTrayBlock,
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): DogTrayBlock {
  if (block.specialMechanism === undefined) {
    return block;
  }

  return getHandler(block, handlers).onEnterTray?.(block) ?? block;
}

export function resolveDogTrayMatches(
  tray: DogTrayBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  options: DogTrayMatchResolutionOptions = {},
): DogTrayMatchResolution {
  let removedCount = 0;
  let tripleCount = 0;
  const meltedBlockIds: string[] = [];
  const allowFrozenMatches =
    options.allowFrozenFinalTriple === true && canResolveAllTrayBlocks(tray);

  while (true) {
    const removals = getMatchRemovals(tray, handlers, allowFrozenMatches);
    if (removals.size === 0) {
      break;
    }

    const roundTriplePatterns = [...removals.entries()].flatMap(
      ([patternType, removableCount]) =>
        Array.from({ length: removableCount / 3 }, () => patternType),
    );
    let writeIndex = 0;
    let roundRemovedCount = 0;
    for (const block of tray) {
      const remainingRemovals = removals.get(block.patternType) ?? 0;
      if (
        remainingRemovals > 0 &&
        isDogTrayBlockMatchable(block, handlers, allowFrozenMatches)
      ) {
        removals.set(block.patternType, remainingRemovals - 1);
        roundRemovedCount += 1;
        continue;
      }

      tray[writeIndex] = block;
      writeIndex += 1;
    }
    tray.length = writeIndex;

    const roundTripleCount = roundTriplePatterns.length;
    removedCount += roundRemovedCount;
    tripleCount += roundTripleCount;
    if (roundTripleCount === 0) {
      break;
    }

    for (let index = 0; index < tray.length; index += 1) {
      const block = tray[index];
      if (block?.specialMechanism === undefined) {
        continue;
      }

      const handler = getHandler(block, handlers);
      const nextBlock = handler.onSuccessfulTriples(
        block,
        roundTripleCount,
        roundTriplePatterns,
      );
      if (
        block.specialMechanism !== undefined &&
        nextBlock.specialMechanism === undefined
      ) {
        meltedBlockIds.push(block.id);
      }
      tray[index] = nextBlock;
    }
  }

  return {
    removedCount,
    tripleCount,
    meltedBlockIds,
  };
}

function getMatchRemovals(
  tray: readonly DogTrayBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  allowFrozenMatches: boolean,
): Map<DogPatternType, number> {
  const counts = new Map<DogPatternType, number>();
  for (const block of tray) {
    if (!isDogTrayBlockMatchable(block, handlers, allowFrozenMatches)) {
      continue;
    }
    counts.set(block.patternType, (counts.get(block.patternType) ?? 0) + 1);
  }

  const removals = new Map<DogPatternType, number>();
  for (const [patternType, count] of counts) {
    const removableCount = Math.floor(count / 3) * 3;
    if (removableCount > 0) {
      removals.set(patternType, removableCount);
    }
  }
  return removals;
}

export function isDogTrayBlockMatchable(
  block: DogTrayBlock,
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  allowFrozenMatches = false,
): boolean {
  if (block.specialMechanism === undefined) {
    return true;
  }

  if (allowFrozenMatches && block.specialMechanism.type === "freeze") {
    return true;
  }

  return getHandler(block, handlers).isMatchable(block.specialMechanism);
}

function canResolveAllTrayBlocks(tray: readonly DogTrayBlock[]): boolean {
  if (tray.length === 0) {
    return false;
  }

  const counts = new Map<DogPatternType, number>();
  for (const block of tray) {
    counts.set(block.patternType, (counts.get(block.patternType) ?? 0) + 1);
  }

  return [...counts.values()].every((count) => count % 3 === 0);
}

function getHandler(
  block: DogTrayBlock,
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): DogSpecialMechanismHandler {
  const mechanismType = block.specialMechanism?.type;
  if (mechanismType === undefined) {
    throw new Error(`狗了个狗 block ${block.id} has no special mechanism type`);
  }

  const handler = handlers.get(mechanismType);
  if (handler === undefined) {
    throw new Error(`狗了个狗 special mechanism handler is missing: ${mechanismType}`);
  }
  return handler;
}
