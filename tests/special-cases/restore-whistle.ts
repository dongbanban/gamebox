import { describe, expect, it } from "vitest";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  GameSession,
  createDogShuffleMechanism,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
  type DogTrayBlock,
} from "@/games/dog-lege-dog";
import { TEST_LEVEL, TEST_PATTERN_TYPES } from "../support/dog-level-fixture";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";

describe("特殊机制测试 · restore-whistle", () => {
  it("乱序直接形成终局时不开放复原快照", () => {
    const session = new GameSession({
      level: {
        ...createLevel([
          createBlock("working-1", 0, WORKING_DOG),
          createBlock("single-1", 4, SINGLE_DOG),
          createBlock("working-2", 8, WORKING_DOG),
          createBlock("single-2", 12, SINGLE_DOG),
          createBlock("shuffle", 16, WORKING_DOG, createDogShuffleMechanism()),
        ]),
        runSeed: "terminal-shuffle-restore",
      },
      initialTrayBlocks: [createTrayBlock("single-0", SINGLE_DOG)],
    });

    let result = session.selectBlock("working-1");
    for (const blockId of ["single-1", "working-2", "single-2", "shuffle"]) {
      result = session.selectBlock(blockId);
    }

    expect(result.shuffleResolution?.outcome).toBe("reordered");
    expect(result.snapshot.status).toBe("won");
    expect(session.getLastShuffleTransaction()).toBeNull();
    expect(session.canRestoreLastShuffle()).toBe(false);
    expect(session.restoreLastShuffle()).toBe(false);
  });
});

function createLevel(blocks: readonly DogBlock[]): DogLegeDogLevel {
  return { ...TEST_LEVEL, patternTypes: TEST_PATTERN_TYPES, blocks };
}

function createBlock(
  id: string,
  x: number,
  patternType: DogPatternType,
  specialMechanism?: DogBlock["specialMechanism"],
): DogBlock {
  return {
    id,
    x,
    y: 0,
    z: 0,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    rotation: 0,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}

function createTrayBlock(id: string, patternType: DogPatternType): DogTrayBlock {
  return { id, patternType };
}
