import {
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import { TEST_LEVEL, TEST_PATTERN_TYPES } from "./dog-level-fixture";

export function createLevel(blocks: readonly DogBlock[]): DogLegeDogLevel {
  return {
    ...TEST_LEVEL,
    lockedTraySlotCount: 0,
    patternTypes: TEST_PATTERN_TYPES,
    blocks,
  };
}

export function createBlock(
  id: string,
  x: number,
  y: number,
  z: number,
  patternType: DogPatternType,
): DogBlock {
  return {
    id,
    x,
    y,
    z,
    width: 4,
    height: 4,
    rotation: 0,
    patternType,
  };
}

export function createFrozenTrayBlock(
  id: string,
  patternType: DogPatternType,
  completedTriples = 0,
) {
  return {
    id,
    patternType,
    specialMechanism: {
      type: "freeze",
      state: { status: "frozen", completedTriples },
    },
  } as const;
}
