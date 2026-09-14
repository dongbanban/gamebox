import { createDogShuffleMechanism } from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  DogLegeDogLevel,
  DogPatternType,
} from "@/games/dog-lege-dog/levels/level-types";
import { createBlock, createLevel } from "./item-fixtures";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";

export function createRestoreUiLevel(): DogLegeDogLevel {
  return {
    ...createLevel([
      createBlock("shuffle", WORKING_DOG, createDogShuffleMechanism()),
      createBlock("single-1", SINGLE_DOG, undefined, { x: 4 }),
      createBlock("licking-1", LICKING_DOG, undefined, { x: 8 }),
      createBlock("guard-1", "看门狗", undefined, { x: 12 }),
      createBlock("mad-1", "疯狗", undefined, { x: 16 }),
      createBlock("working-2", WORKING_DOG, undefined, { x: 20 }),
      createBlock("working-3", WORKING_DOG, undefined, { x: 24 }),
      createBlock("single-2", SINGLE_DOG, undefined, { x: 28 }),
      createBlock("single-3", SINGLE_DOG, undefined, { x: 32 }),
      createBlock("licking-2", LICKING_DOG, undefined, { x: 36 }),
      createBlock("licking-3", LICKING_DOG, undefined, { x: 40 }),
      createBlock("guard-2", "看门狗", undefined, { x: 44 }),
      createBlock("guard-3", "看门狗", undefined, { x: 48 }),
      createBlock("mad-2", "疯狗", undefined, { x: 52 }),
      createBlock("mad-3", "疯狗", undefined, { x: 56 }),
    ]),
    runSeed: "restore-whistle-ui",
  };
}
