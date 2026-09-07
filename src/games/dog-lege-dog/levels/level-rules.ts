import type {
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  applyDogSpecialMechanismSuccessfulTripleEffects,
  isDogSpecialMechanismMatchable,
  prepareDogTrayBlocks,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";

export { getPositiveOverlapArea, hasPositiveAreaOverlap } from "@/games/dog-lege-dog/levels/level-graph";

export interface DogTrayMatchResolution {
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
}

export interface DogTrayMatchResolutionOptions {
  readonly allowFrozenFinalTriple?: boolean;
  readonly config?: DogV13Config;
}

export function insertDogBlockIntoTray(
  tray: DogTrayBlock[],
  block: DogTrayBlock,
  options: DogTrayMatchResolutionOptions = {},
): DogTrayMatchResolution {
  for (const trayBlock of prepareDogTrayBlocks(block)) {
    tray.push(trayBlock);
  }

  return resolveDogTrayMatches(tray, options);
}

export function applyDogTraySuccessfulTripleEffects(
  tray: DogTrayBlock[],
  tripleCount: number,
  config: DogV13Config = DOG_V13_CONFIG,
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

    const nextBlock = applyDogSpecialMechanismSuccessfulTripleEffects(
      block,
      tripleCount,
      config,
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
      (block) => isDogTrayBlockMatchable(block, allowFrozenMatches)
        ? block.patternType
        : undefined,
    );
    const removalIndexes = groups.flatMap(({ indexes }) =>
      indexes.slice(0, Math.floor(indexes.length / 3) * 3),
    );
    if (removalIndexes.length === 0) {
      break;
    }

    const roundRemovedCount = removeItemsAtIndexes(tray, removalIndexes);

    const roundTripleCount = removalIndexes.length / 3;
    removedCount += roundRemovedCount;
    tripleCount += roundTripleCount;
    if (roundTripleCount === 0) {
      break;
    }

    meltedBlockIds.push(
      ...applyDogTraySuccessfulTripleEffects(
        tray,
        roundTripleCount,
        options.config,
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
  allowFrozenMatches = false,
): boolean {
  if (block.specialMechanism === undefined) {
    return true;
  }

  return isDogSpecialMechanismMatchable(block.specialMechanism, allowFrozenMatches);
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
  const remainingItems = items.filter((_, index) => !removalIndexes.has(index));
  const removedCount = items.length - remainingItems.length;
  items.splice(0, items.length, ...remainingItems);
  return removedCount;
}
