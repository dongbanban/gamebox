import { describe, expect, it } from "vitest";
import {
  GameSession,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import { TEST_LEVEL, TEST_PATTERN_TYPES } from "../support/dog-level-fixture";
import { createBlock, createLevel, createFrozenTrayBlock } from "../support/game-session-fixtures";

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
      initialTray: [
        WORKING_DOG,
        LICKING_DOG,
        GUARD_DOG,
        "拆家狗",
        "龇牙狗",
        "社恐狗",
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
        createBlock("working-3", 16, 0, 0, WORKING_DOG),
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
      initialTray: [WORKING_DOG],
    });

    expect(session.getWildcardPlan(WORKING_DOG)).toBeNull();
    expect(session.meltFrozenBlock("single-cover", "board")).toMatchObject({
      melted: true,
    });

    expect(session.getWildcardPlan(WORKING_DOG)).toMatchObject({
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
    expect(state.tray).toEqual([]);
    expect(session.selectBlock("working-1")).toEqual(state);
  });
});
