import type { DogTrayBlock } from "@/games/dog-lege-dog/levels/level-types";

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
