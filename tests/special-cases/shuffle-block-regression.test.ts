import { describe, expect, it } from "vitest";
import { GameSession } from "@/games/dog-lege-dog/game/game-session";
import {
  DOG_SHUFFLE_MECHANISM_TYPE,
  createDogShuffleMechanism,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
  type DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import { TEST_LEVEL, TEST_PATTERN_TYPES } from "../support/dog-level-fixture";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";

describe("特殊机制测试 · shuffle-block regression", () => {
  it("相同 runSeed 与操作路径复现候选选择、槽序、结算结果", () => {
    const level = createLevel([
      createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
      createBlock("single-1", 4, 0, SINGLE_DOG),
      createBlock("licking-1", 8, 0, LICKING_DOG),
      createBlock("guard-1", 12, 0, "看门狗"),
      createBlock("mad-1", 16, 0, "疯狗"),
      createBlock("working-2", 20, 0, WORKING_DOG),
      createBlock("working-3", 24, 0, WORKING_DOG),
      createBlock("single-2", 28, 0, SINGLE_DOG),
      createBlock("single-3", 32, 0, SINGLE_DOG),
      createBlock("licking-2", 36, 0, LICKING_DOG),
      createBlock("licking-3", 40, 0, LICKING_DOG),
      createBlock("guard-2", 44, 0, "看门狗"),
      createBlock("guard-3", 48, 0, "看门狗"),
      createBlock("mad-2", 52, 0, "疯狗"),
      createBlock("mad-3", 56, 0, "疯狗"),
    ]);
    const play = () => {
      const session = new GameSession({ level });
      for (const blockId of ["shuffle", "single-1", "licking-1", "guard-1", "mad-1"]) {
        session.selectBlock(blockId);
      }
      const result = session.getState();
      return {
        replayEvent: session.getShuffleReplayEvents()[0],
        trayBlocks: result.trayBlocks,
        status: result.status,
      };
    };

    expect(play()).toEqual(play());
  });

  it("安全候选按完整条目移动，并自动结算新形成的相邻三消", () => {
    const session = new GameSession({
      level: {
        ...createLevel([
          createBlock("working-1", 0, 0, WORKING_DOG),
          createBlock("single-1", 4, 0, SINGLE_DOG),
          createBlock("working-2", 8, 0, WORKING_DOG),
          createBlock("licking-1", 12, 0, LICKING_DOG),
          createBlock("shuffle", 16, 0, WORKING_DOG, createDogShuffleMechanism()),
          createBlock("single-2", 20, 0, SINGLE_DOG),
          createBlock("single-3", 24, 0, SINGLE_DOG),
          createBlock("licking-2", 28, 0, LICKING_DOG),
          createBlock("licking-3", 32, 0, LICKING_DOG),
          createBlock("guard-2", 36, 0, "看门狗"),
          createBlock("guard-3", 40, 0, "看门狗"),
        ]),
        runSeed: "secondary-0",
      },
      initialTrayBlocks: [
        createTrayBlock("frozen", "看门狗", {
          type: "freeze",
          state: { status: "frozen", completedTriples: 0 },
        }),
      ],
    });

    for (const blockId of ["working-1", "single-1", "working-2", "licking-1"]) {
      session.selectBlock(blockId);
    }
    const result = session.selectBlock("shuffle");
    expect(result.shuffleResolution?.outcome).toBe("reordered");
    expect(result.shuffleResolution?.tripleCount).toBeGreaterThan(0);
    expect(result.shuffleResolution?.secondaryTripleCount).toBe(1);
    expect(result.shuffleResolution?.secondaryRemovedBlockIds.length).toBeGreaterThan(0);
    expect(
      result.shuffleResolution?.transaction?.before.trayBlocks.find(
        (block) => block.id === "shuffle",
      ),
    ).toMatchObject({
      id: "shuffle",
      patternType: WORKING_DOG,
      specialMechanism: {
        type: DOG_SHUFFLE_MECHANISM_TYPE,
        state: { status: "armed" },
      },
    });
    expect(result.snapshot.trayBlocks.some((block) => block.id === "frozen")).toBe(true);
    expect(
      result.snapshot.trayBlocks.find((block) => block.id === "frozen")?.specialMechanism,
    ).toMatchObject({ type: "freeze", state: { completedTriples: 1 } });
    for (const block of result.snapshot.trayBlocks) {
      if (block.id === "shuffle") {
        expect(block.patternType).toBe(WORKING_DOG);
        expect(block.specialMechanism?.state.status).toBe("consumed");
      }
    }

    expect(session.canRestoreLastShuffle()).toBe(true);
    expect(session.restoreLastShuffle()).toBe(true);
    expect(session.getState().trayBlocks).toEqual([
      createTrayBlock("frozen", "看门狗", {
        type: "freeze",
        state: { status: "frozen", completedTriples: 0 },
      }),
      createTrayBlock("working-1", WORKING_DOG),
      createTrayBlock("single-1", SINGLE_DOG),
      createTrayBlock("working-2", WORKING_DOG),
      createTrayBlock("licking-1", LICKING_DOG),
      createTrayBlock("shuffle", WORKING_DOG),
    ]);
    expect(session.getLastShuffleTransaction()).toBeNull();
    expect(session.canRestoreLastShuffle()).toBe(false);

    expect(session.selectBlock("single-2").shuffleResolution).toBeNull();
  });
});

function createLevel(blocks: readonly DogBlock[]): DogLegeDogLevel {
  return { ...TEST_LEVEL, patternTypes: TEST_PATTERN_TYPES, blocks };
}

function createBlock(
  id: string,
  x: number,
  y: number,
  patternType: DogPatternType,
  specialMechanism?: DogBlock["specialMechanism"],
): DogBlock {
  return {
    id,
    x,
    y,
    z: 0,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    rotation: 0,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}

function createTrayBlock(
  id: string,
  patternType: DogPatternType,
  specialMechanism?: DogTrayBlock["specialMechanism"],
): DogTrayBlock {
  return { id, patternType, ...(specialMechanism === undefined ? {} : { specialMechanism }) };
}
