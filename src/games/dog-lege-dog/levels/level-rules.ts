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
  for (const trayBlock of prepareDogTrayBlocks(block, handlers)) {
    tray.push(trayBlock);
  }

  return resolveDogTrayMatches(tray, handlers, options);
}

export function prepareDogTrayBlocks(
  block: DogTrayBlock,
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): readonly DogTrayBlock[] {
  if (block.specialMechanism === undefined) {
    return [block];
  }

  const prepared = getHandler(block, handlers).onEnterTray?.(block) ?? block;
  if (Array.isArray(prepared)) {
    return prepared as readonly DogTrayBlock[];
  }
  return [prepared as DogTrayBlock];
}

export function applyDogTraySuccessfulTripleEffects(
  tray: DogTrayBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  tripleCount: number,
  triplePatterns: readonly DogPatternType[],
): readonly string[] {
  if (tripleCount <= 0) {
    return [];
  }

  const meltedBlockIds: string[] = [];
  for (let index = 0; index < tray.length; index += 1) {
    const block = tray[index];
    if (block?.specialMechanism === undefined) {
      continue;
    }

    const handler = getHandler(block, handlers);
    const nextBlock = handler.onSuccessfulTriples(
      block,
      tripleCount,
      triplePatterns,
    );
    if (nextBlock.specialMechanism === undefined) {
      meltedBlockIds.push(block.id);
    }
    tray[index] = nextBlock;
  }

  return Object.freeze(meltedBlockIds);
}

export function resolveDogTrayMatches(
  tray: DogTrayBlock[],
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
  options: DogTrayMatchResolutionOptions = {},
): DogTrayMatchResolution {
  let removedCount = 0;
  let tripleCount = 0;
  const meltedBlockIds: string[] = [];
  // The caller sets this only after the board is empty. Resolve every legal
  // tray group so a frozen group cannot strand the terminal state.
  const allowFrozenMatches = options.allowFrozenFinalTriple === true;

  while (true) {
    const groups = getAdjacentMatchGroups(
      tray,
      (block) => isDogTrayBlockMatchable(block, handlers, allowFrozenMatches)
        ? block.patternType
        : undefined,
    );
    const removalIndexes = groups.flatMap(({ indexes }) =>
      indexes.slice(0, Math.floor(indexes.length / 3) * 3),
    );
    if (removalIndexes.length === 0) {
      break;
    }

    const roundTriplePatterns = groups.flatMap(({ key, indexes }) =>
      Array.from({ length: Math.floor(indexes.length / 3) }, () => key),
    );
    const roundRemovedCount = removeItemsAtIndexes(tray, removalIndexes);

    const roundTripleCount = roundTriplePatterns.length;
    removedCount += roundRemovedCount;
    tripleCount += roundTripleCount;
    if (roundTripleCount === 0) {
      break;
    }

    meltedBlockIds.push(
      ...applyDogTraySuccessfulTripleEffects(
        tray,
        handlers,
        roundTripleCount,
        roundTriplePatterns,
      ),
    );
  }

  return {
    removedCount,
    tripleCount,
    meltedBlockIds,
  };
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

function getAdjacentMatchGroups<T, K>(
  items: readonly T[],
  getMatchKey: (item: T) => K | undefined,
): Array<{ readonly key: K; readonly indexes: number[] }> {
  const groups: Array<{ readonly key: K; readonly indexes: number[] }> = [];
  let currentGroup: { readonly key: K; readonly indexes: number[] } | undefined;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item === undefined) {
      currentGroup = undefined;
      continue;
    }

    const key = getMatchKey(item);
    if (key === undefined) {
      currentGroup = undefined;
      continue;
    }

    if (currentGroup !== undefined && currentGroup.key === key) {
      currentGroup.indexes.push(index);
      continue;
    }

    currentGroup = { key, indexes: [index] };
    groups.push(currentGroup);
  }

  return groups;
}

function removeItemsAtIndexes<T>(items: T[], indexes: readonly number[]): number {
  const removalIndexes = new Set(indexes);
  let writeIndex = 0;
  let removedCount = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item === undefined) {
      continue;
    }

    if (removalIndexes.has(index)) {
      removedCount += 1;
      continue;
    }

    items[writeIndex] = item;
    writeIndex += 1;
  }
  items.length = writeIndex;
  return removedCount;
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
