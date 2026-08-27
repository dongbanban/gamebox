import {
  DOG_ITEM_DEFINITIONS,
  type DogItemDefinition,
} from "@/games/dog-lege-dog/game/dog-loadout";
import type { DogItemRuntimeDefinition } from "@/games/dog-lege-dog/game/dog-item-runtime";
import {
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import { TEST_LEVEL, TEST_PATTERN_TYPES } from "./dog-level-fixture";

export function createTargetDefinition(): DogItemRuntimeDefinition {
  const definition: DogItemDefinition = {
    ...DOG_ITEM_DEFINITIONS[0]!,
    targetType: "block",
  };
  return {
    definition,
    getUses: () => 1,
    canUse: ({ target }) => target === undefined || target.type === "block",
    execute: ({ target }) => ({
      success: target?.type === "block",
      visualFeedback: "triple-removal",
    }),
  };
}

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
  patternType: DogPatternType,
  specialMechanism?: DogBlock["specialMechanism"],
  placement: Partial<Pick<DogBlock, "x" | "y" | "z">> = {},
): DogBlock {
  return {
    id,
    x: placement.x ?? 0,
    y: placement.y ?? 0,
    z: placement.z ?? 0,
    width: 4,
    height: 4,
    rotation: 0,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}
