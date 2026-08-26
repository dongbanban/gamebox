import { DOG_PATTERN_TYPES, type DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import { getPatternTypeCount } from "@/games/dog-lege-dog/levels/level-progression";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import type { DogShapeTemplate } from "@/games/dog-lege-dog/levels/level-shapes";
import {
  createStructuralBlockPlacements,
} from "@/games/dog-lege-dog/levels/level-placement-geometry";
import {
  createRemovalOrder,
} from "@/games/dog-lege-dog/levels/level-placement-solvability";
import type {
  BlockPlacement,
  PlacementFactory,
  RemovalPathPlan,
} from "@/games/dog-lege-dog/levels/level-placement-contracts";

export type {
  BlockPlacement,
  PlacementFactory,
  RemovalPathPlan,
  SolvableBlocksOptions,
} from "@/games/dog-lege-dog/levels/level-placement-contracts";
export {
  validatePlacementGeometry,
  validateSpatialDistribution,
} from "@/games/dog-lege-dog/levels/level-placement-validation";
export { createSolvableBlocks } from "@/games/dog-lege-dog/levels/level-placement-solvability";

export function selectPatternTypes(
  levelNumber: number,
  random: SeededRandom,
  config: DogV13Config = DOG_V13_CONFIG,
): readonly DogPatternType[] {
  return random.shuffle([...DOG_PATTERN_TYPES]).slice(0, getPatternTypeCount(levelNumber, config));
}

export function createSolvableBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
): readonly BlockPlacement[] {
  const structuralPlacements = createStructuralBlockPlacements(
    template,
    blockCount,
    maxLayers,
    random,
  );
  return assignPlacementsToRemovalPlan(structuralPlacements, blockCount, maxLayers, removalPlan);
}

export function createFirstLevelBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
  config: DogV13Config = DOG_V13_CONFIG,
): readonly BlockPlacement[] {
  if (
    blockCount < 1 ||
    blockCount > config.firstLevel.blockCount ||
    maxLayers !== config.firstLevel.maxLayers
  ) {
    throw new Error("LevelGenerator first-level placement config is invalid");
  }

  const structuralPlacements = createStructuralBlockPlacements(
    template,
    blockCount,
    maxLayers,
    random,
    true,
  );
  return assignPlacementsToRemovalPlan(structuralPlacements, blockCount, maxLayers, removalPlan);
}

export function createGuaranteedBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
): readonly BlockPlacement[] {
  const structuralPlacements = createStructuralBlockPlacements(
    template,
    blockCount,
    maxLayers,
    random,
  );
  return assignPlacementsToRemovalPlan(structuralPlacements, blockCount, maxLayers, removalPlan);
}

function assignPlacementsToRemovalPlan(
  structuralPlacements: readonly BlockPlacement[],
  blockCount: number,
  maxLayers: number,
  removalPlan: RemovalPathPlan,
): readonly BlockPlacement[] {
  const blockIndicesByLayer = Array.from(
    { length: maxLayers },
    () => [] as number[],
  );

  for (const blockIndex of removalPlan.order) {
    const layer = removalPlan.layerByBlock[blockIndex];
    if (layer === undefined) {
      throw new Error(`LevelGenerator path plan has no layer for block ${blockIndex}`);
    }
    const layerIndices = blockIndicesByLayer[layer];
    if (layerIndices === undefined) {
      throw new Error(`LevelGenerator path plan has invalid layer ${layer}`);
    }
    layerIndices.push(blockIndex);
  }

  const placementsByBlock: BlockPlacement[] = Array.from(
    { length: blockCount },
    () => ({ x: 0, y: 0, z: 0 }),
  );
  const placementCursorByLayer = Array.from({ length: maxLayers }, () => 0);

  // Path exists before geometry. Structural layers are assigned in reverse stack order.
  for (const placement of structuralPlacements) {
    const layerIndices = blockIndicesByLayer[placement.z];
    const cursor = placementCursorByLayer[placement.z];
    const blockIndex = layerIndices?.[cursor ?? 0];
    if (blockIndex === undefined) {
      throw new Error(`LevelGenerator path plan has no block for layer ${placement.z}`);
    }

    placementsByBlock[blockIndex] = placement;
    if (placementCursorByLayer[placement.z] === undefined) {
      throw new Error(`LevelGenerator placement has invalid layer ${placement.z}`);
    }
    placementCursorByLayer[placement.z] += 1;
  }

  return placementsByBlock;
}

export function createRemovalPathPlan(
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
): RemovalPathPlan {
  const order = random.shuffle(
    Array.from({ length: blockCount }, (_, index) => index),
  );
  const layerCounts = distributeBlocks(blockCount, maxLayers);
  const layerByBlock = Array.from({ length: blockCount }, () => 0);
  let pathCursor = 0;

  // Assign path prefix to upper layers. Earlier path blocks remove upper blocks first.
  for (let z = maxLayers - 1; z >= 0; z -= 1) {
    for (let count = 0; count < layerCounts[z]; count += 1) {
      const blockIndex = order[pathCursor];
      if (blockIndex === undefined) {
        throw new Error("LevelGenerator path plan has incomplete block order");
      }

      layerByBlock[blockIndex] = z;
      pathCursor += 1;
    }
  }

  return {
    order: Object.freeze([...order]),
    layerByBlock: Object.freeze([...layerByBlock]),
  };
}

export function resolveRemovalPathPlan(
  placements: readonly BlockPlacement[],
  random: SeededRandom,
  preferredOrder: readonly number[],
): RemovalPathPlan {
  // Resolve reveal dependencies once after raw stack geometry exists.
  const order = createRemovalOrder(placements, random, preferredOrder);
  return {
    order: Object.freeze([...order]),
    layerByBlock: Object.freeze(placements.map((placement) => placement.z)),
  };
}

function distributeBlocks(blockCount: number, maxLayers: number): readonly number[] {
  const baseCount = Math.floor(blockCount / maxLayers);
  const remainder = blockCount % maxLayers;
  return Array.from(
    { length: maxLayers },
    (_, index) => baseCount + (index < remainder ? 1 : 0),
  );
}
