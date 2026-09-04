import { describe, expect, it } from "vitest";
import {
  findSolvabilityFromState,
  GameSession,
  LevelGenerator,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import {
  createBlock,
  createLevel,
  createFrozenTrayBlock,
} from "../support/game-session-fixtures";
import { createBlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import {
  createDogMagneticRandom,
  resolveDogSelection,
} from "@/games/dog-lege-dog/levels/level-mechanism-resolution";
import {
  createDogSpecialMechanismHandlerMap,
  DOG_SPECIAL_MECHANISM_HANDLERS,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import {
  createFullBlockMask,
} from "@/games/dog-lege-dog/levels/level-solvability-contracts";
import type { DogTrayBlock } from "@/games/dog-lege-dog/levels/level-types";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";
const GUARD_DOG: DogPatternType = "看门狗";

describe("GameSession · wildcard-and-terminal", () => {
  it("万能方块以一个冻结与一个普通同款补足三消，不融化未参与冻结同款", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-hidden", 0, 0, 0, WORKING_DOG),
        createBlock("single-cover", 0, 0, 1, SINGLE_DOG),
        createBlock("single-2", 8, 0, 0, SINGLE_DOG),
        createBlock("single-3", 16, 0, 0, SINGLE_DOG),
        createBlock("working-final", 24, 0, 0, WORKING_DOG),
        createBlock("licking-1", 8, 8, 0, LICKING_DOG),
        createBlock("licking-2", 16, 8, 0, LICKING_DOG),
        createBlock("licking-3", 24, 8, 0, LICKING_DOG),
      ]),
      initialTrayBlocks: [
        createFrozenTrayBlock("frozen-working-1", WORKING_DOG),
        { id: "ordinary-working-1", patternType: WORKING_DOG },
        { id: "ordinary-working-2", patternType: WORKING_DOG },
        createFrozenTrayBlock("frozen-working-2", WORKING_DOG, 1),
      ],
    });

    const result = session.useWildcard(WORKING_DOG);

    expect(result).toMatchObject({ used: true, removedCount: 3, tripleCount: 1 });
    expect(result.snapshot.trayBlocks).toEqual([
      createFrozenTrayBlock("frozen-working-1", WORKING_DOG, 1),
      { id: "ordinary-working-1", patternType: WORKING_DOG },
    ]);
  });

  it("万能方块会填满暂存槽并破坏无道具可解性时拒绝且保持原子不变", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-hidden", 0, 0, 0, WORKING_DOG),
        createBlock("single-cover", 0, 0, 1, SINGLE_DOG),
      ]),
      initialTrayBlocks: [
        { id: "initial-tray-1", patternType: WORKING_DOG },
        { id: "initial-tray-2", patternType: LICKING_DOG },
        { id: "initial-tray-3", patternType: GUARD_DOG },
        { id: "initial-tray-4", patternType: "拆家狗" },
        { id: "initial-tray-5", patternType: "龇牙狗" },
        { id: "initial-tray-6", patternType: "社恐狗" },
      ],
    });
    const initial = session.getState();

    expect(session.getWildcardPlan(WORKING_DOG)).toBeNull();
    expect(session.useWildcard(WORKING_DOG)).toMatchObject({ used: false });
    expect(session.getState()).toEqual(initial);
  });

  it("棋盘机制被火把更新后按实时状态判断万能方块可解性", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-hidden", 0, 0, 0, WORKING_DOG),
        createBlock("working-2", 8, 0, 0, WORKING_DOG),
        {
          ...createBlock("single-cover", 0, 0, 1, SINGLE_DOG),
          specialMechanism: {
            type: "freeze",
            state: { status: "frozen", completedTriples: 0 },
          },
        },
        createBlock("single-2", 8, 8, 0, SINGLE_DOG),
        createBlock("single-3", 16, 8, 0, SINGLE_DOG),
      ]),
      initialTrayBlocks: [{ id: "initial-tray-1", patternType: WORKING_DOG }],
    });

    const beforeMeltPlan = session.getWildcardPlan(WORKING_DOG);
    expect(beforeMeltPlan).toMatchObject({
      compensatedBlockId: "working-hidden",
    });
    expect(session.meltFrozenBlock("single-cover", "board")).toMatchObject({
      melted: true,
    });

    const afterMeltPlan = session.getWildcardPlan(WORKING_DOG);
    expect(afterMeltPlan).not.toBe(beforeMeltPlan);
    expect(afterMeltPlan).toMatchObject({
      compensatedBlockId: "working-hidden",
    });
    expect(session.useWildcard(WORKING_DOG)).toMatchObject({ used: true });
  });

  it("棋盘方块全部清空时通关", () => {
    const session = new GameSession(
      createLevel([
        createBlock("working-1", 0, 0, 0, WORKING_DOG),
        createBlock("working-2", 2, 0, 0, WORKING_DOG),
        createBlock("working-3", 4, 0, 0, WORKING_DOG),
      ]),
    );

    session.selectBlock("working-1");
    session.selectBlock("working-2");
    const state = session.selectBlock("working-3");

    expect(state.status).toBe("won");
    expect(state.remainingBlocks).toEqual([]);
    expect(state.trayBlocks).toEqual([]);
    expect(session.selectBlock("working-1")).toEqual(state);
  });

  it("万能方块后不同图案的终局暂存槽不应直接通关", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-hidden", 0, 0, 0, WORKING_DOG),
        createBlock("single-cover", 0, 0, 1, SINGLE_DOG),
        createBlock("single-2", 8, 0, 0, SINGLE_DOG),
        createBlock("single-3", 16, 0, 0, SINGLE_DOG),
        createBlock("licking-1", 24, 0, 0, LICKING_DOG),
        createBlock("licking-2", 32, 0, 0, LICKING_DOG),
        createBlock("licking-3", 40, 0, 0, LICKING_DOG),
      ]),
      initialTrayBlocks: [
        { id: "ordinary-working-1", patternType: WORKING_DOG },
        { id: "ordinary-working-2", patternType: WORKING_DOG },
      ],
    });

    const wildcard = session.useWildcard(WORKING_DOG);
    expect(wildcard).toMatchObject({ used: true, removedCount: 3, tripleCount: 1 });
    expect(wildcard.snapshot.trayBlocks).toEqual([]);

    let finalSelection = session.selectBlock("single-cover");
    for (const blockId of [
      "licking-1",
      "single-2",
      "licking-2",
      "single-3",
      "licking-3",
    ]) {
      finalSelection = session.selectBlock(blockId);
    }

    expect(finalSelection.removedCount).toBe(0);
    expect(finalSelection.snapshot.trayBlocks.map((block) => block.patternType)).toEqual([
      SINGLE_DOG,
      LICKING_DOG,
      SINGLE_DOG,
      LICKING_DOG,
      SINGLE_DOG,
      LICKING_DOG,
    ]);
    expect(finalSelection.snapshot.status).toBe("lost");
  });

  it("磁吸随机流已推进时万能方块不应接受过期可解计划", () => {
    const level = new LevelGenerator().generate({
      levelNumber: 1,
      runSeed: "wildcard-magnetic-diagnostic-0",
    });
    const session = new GameSession(level);
    const prefix = [
      "level-1-block-14",
      "level-1-block-28",
      "level-1-block-61",
      "level-1-block-63",
      "level-1-block-10",
    ];

    for (const blockId of prefix) {
      expect(session.canSelectBlock(blockId)).toBe(true);
      session.selectBlock(blockId);
    }

    const liveMagneticRandom = replayMagneticRandom(level, prefix);
    const wildcard = session.useWildcard(SINGLE_DOG);
    expect(wildcard).toMatchObject({ used: true, tripleCount: 1 });

    const state = session.getState();
    const solvability = findSolvabilityFromState(level, {
      remainingBlockIds: state.remainingBlocks.map((block) => block.id),
      initialTray: state.trayBlocks,
      trayCapacity: state.effectiveTrayCapacity,
      magneticRandom: liveMagneticRandom,
    });
    expect(solvability.status).toBe("solvable");
    for (const blockId of solvability.path) {
      if (session.canSelectBlock(blockId)) {
        session.selectBlock(blockId);
      }
    }
    expect(session.getState().status).toBe("won");
  });
});

function replayMagneticRandom(
  level: ReturnType<LevelGenerator["generate"]>,
  path: readonly string[],
) {
  const graph = createBlockGraph(level.blocks);
  const handlers = createDogSpecialMechanismHandlerMap(DOG_SPECIAL_MECHANISM_HANDLERS);
  const magneticRandom = createDogMagneticRandom(level);
  let remainingMask = createFullBlockMask(level.blocks.length);
  const higherBlockCounts = [...graph.higherBlockCounts];
  const tray: DogTrayBlock[] = [];

  for (const blockId of path) {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex === undefined) {
      throw new Error(`missing diagnostic block ${blockId}`);
    }
    const resolution = resolveDogSelection(
      level,
      blockIndex,
      remainingMask,
      higherBlockCounts,
      tray,
      handlers,
      magneticRandom,
      graph,
    );
    remainingMask = resolution.remainingMask;
    higherBlockCounts.splice(0, higherBlockCounts.length, ...resolution.higherBlockCounts);
    tray.splice(0, tray.length, ...resolution.tray);
  }

  return magneticRandom;
}
