import type { DogShapeTemplate } from "@/games/dog-lege-dog/levels/level-shapes";
import type { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";

export interface BlockPlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RemovalPathPlan {
  readonly order: readonly number[];
  readonly layerByBlock: readonly number[];
}

export interface SolvableBlocksOptions {
  readonly logicalBlockCount?: number;
  readonly twinCount?: number;
}

export type PlacementFactory = (
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
) => readonly BlockPlacement[];
