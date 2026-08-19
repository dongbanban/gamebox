import type { DogBlock } from "@/games/dog-lege-dog/levels/level-types";

export interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LayeredRectangle extends Rectangle {
  readonly z: number;
}

export interface OverlapGraph {
  readonly higherBlockCounts: readonly number[];
  readonly lowerBlockIndicesByHigher: readonly (readonly number[])[];
}

export interface BlockGraph extends OverlapGraph {
  readonly indexById: ReadonlyMap<string, number>;
}

export interface PlacementRectangle {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const blockGraphCache = new WeakMap<readonly DogBlock[], BlockGraph>();

export function createBlockGraph(blocks: readonly DogBlock[]): BlockGraph {
  const cachedGraph = blockGraphCache.get(blocks);
  if (cachedGraph !== undefined) {
    return cachedGraph;
  }

  const indexById = new Map<string, number>();
  for (let index = 0; index < blocks.length; index += 1) {
    indexById.set(blocks[index].id, index);
  }

  const graph = Object.freeze({
    indexById,
    ...createOverlapGraph(blocks),
  });
  blockGraphCache.set(blocks, graph);
  return graph;
}

export function createPlacementGraph(
  placements: readonly PlacementRectangle[],
  blockWidth: number,
  blockHeight: number,
): OverlapGraph {
  return createOverlapGraph(
    placements.map((placement) => ({
      ...placement,
      width: blockWidth,
      height: blockHeight,
    })),
  );
}

export function createOverlapGraph(
  rectangles: readonly LayeredRectangle[],
): OverlapGraph {
  const higherBlockCounts = Array.from({ length: rectangles.length }, () => 0);
  const lowerBlockIndicesByHigher = Array.from(
    { length: rectangles.length },
    () => [] as number[],
  );

  for (let firstIndex = 0; firstIndex < rectangles.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < rectangles.length;
      secondIndex += 1
    ) {
      const first = rectangles[firstIndex];
      const second = rectangles[secondIndex];
      if (
        first.z === second.z ||
        !hasPositiveAreaOverlap(first, second)
      ) {
        continue;
      }

      const higherIndex = first.z > second.z ? firstIndex : secondIndex;
      const lowerIndex = first.z > second.z ? secondIndex : firstIndex;
      higherBlockCounts[lowerIndex] += 1;
      lowerBlockIndicesByHigher[higherIndex].push(lowerIndex);
    }
  }

  return Object.freeze({
    higherBlockCounts: Object.freeze(higherBlockCounts),
    lowerBlockIndicesByHigher: Object.freeze(
      lowerBlockIndicesByHigher.map((indices) => Object.freeze(indices)),
    ),
  });
}

export function hasPositiveAreaOverlap(
  first: Rectangle,
  second: Rectangle,
): boolean {
  return getPositiveOverlapArea(first, second) > 0;
}

export function getPositiveOverlapArea(first: Rectangle, second: Rectangle): number {
  const overlapWidth = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y),
  );
  return overlapWidth * overlapHeight;
}
