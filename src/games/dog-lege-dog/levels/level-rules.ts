import type { DogPatternType } from "./level-types";

export { getPositiveOverlapArea, hasPositiveAreaOverlap } from "./level-graph";

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
  let lastSameTypeIndex = -1;
  for (let index = tray.length - 1; index >= 0; index -= 1) {
    if (tray[index] === patternType) {
      lastSameTypeIndex = index;
      break;
    }
  }

  if (lastSameTypeIndex === -1) {
    tray.push(patternType);
  } else {
    tray.splice(lastSameTypeIndex + 1, 0, patternType);
  }

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
