import type { DogBlock } from "./level-types";

export interface LayeredRectangle {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
}

export interface OverlapGraph {
  readonly higherBlockCounts: number[];
  readonly lowerBlockIndicesByHigher: number[][];
}

export interface BlockGraph extends OverlapGraph {
  readonly indexById: ReadonlyMap<string, number>;
}

export interface PlacementRectangle {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function createBlockGraph(blocks: readonly DogBlock[]): BlockGraph {
  const indexById = new Map<string, number>();
  for (let index = 0; index < blocks.length; index += 1) {
    indexById.set(blocks[index].id, index);
  }

  return {
    indexById,
    ...createOverlapGraph(blocks),
  };
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

  return { higherBlockCounts, lowerBlockIndicesByHigher };
}

function hasPositiveAreaOverlap(
  first: LayeredRectangle,
  second: LayeredRectangle,
): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}
