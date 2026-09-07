import type {
  DogBlock,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";

export function toDogTrayBlock(block: DogBlock): DogTrayBlock {
  return {
    id: block.id,
    patternType: block.patternType,
    ...(block.specialMechanism === undefined
      ? {}
      : { specialMechanism: block.specialMechanism }),
  };
}

export function cloneDogTrayBlock(block: DogTrayBlock): DogTrayBlock {
  if (block.specialMechanism === undefined) {
    return Object.freeze({ ...block });
  }

  return Object.freeze({
    ...block,
    specialMechanism: Object.freeze({
      ...block.specialMechanism,
      state: Object.freeze({ ...block.specialMechanism.state }),
    }),
  });
}
