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

describe("GameSession · core", () => {
  it("共享深度不可变关卡引用，并返回可渲染的选择结果", () => {
    const level = createLevel([
      createBlock("working-1", 0, 0, 0, WORKING_DOG),
      createBlock("single", 2, 0, 0, SINGLE_DOG),
    ]);
    const session = new GameSession(level);

    const initialState = session.getState();
    expect(initialState.level).toBe(level);
    expect(Object.isFrozen(level)).toBe(true);
    expect(Object.isFrozen(level.blocks)).toBe(true);
    expect(Object.isFrozen(level.blocks[0])).toBe(true);

    const selected = session.selectBlock("working-1");

    expect(selected.selected).toBe(true);
    expect(selected.removedCount).toBe(0);
    expect(selected.status).toBe("playing");
    expect(selected.snapshot.level).toBe(level);
    expect(selected.snapshot.tray).toEqual([WORKING_DOG]);

    const rejected = session.selectBlock("missing");

    expect(rejected.selected).toBe(false);
    expect(rejected.removedCount).toBe(0);
    expect(rejected.snapshot).toEqual(selected.snapshot);
  });

  it("移除多个上层方块后才解锁所有正面积遮挡的下层方块", () => {
    const session = new GameSession(
      createLevel([
        createBlock("lower", 0, 0, 0, WORKING_DOG),
        createBlock("higher-left", 0, 0, 1, SINGLE_DOG),
        createBlock("higher-right", 1, 0, 2, LICKING_DOG),
      ]),
    );

    expect(session.canSelectBlock("lower")).toBe(false);
    session.selectBlock("higher-right");
    expect(session.canSelectBlock("lower")).toBe(false);
    session.selectBlock("higher-left");

    expect(session.canSelectBlock("lower")).toBe(true);
  });

  it("只允许没有更高层正面积遮挡的方块选择，边角接触不遮挡", () => {
    const session = new GameSession(
      createLevel([
        createBlock("blocked", 0, 8, 0, WORKING_DOG),
        createBlock("edge", 4, 0, 0, SINGLE_DOG),
        createBlock("corner", 4, 4, 0, LICKING_DOG),
        createBlock("overlap", 1, 8, 1, GUARD_DOG),
        createBlock("edge-cover", 0, 0, 1, WORKING_DOG),
        createBlock("corner-cover", 0, 0, 1, SINGLE_DOG),
      ]),
    );

    expect(session.canSelectBlock("blocked")).toBe(false);
    expect(session.canSelectBlock("edge")).toBe(true);
    expect(session.canSelectBlock("corner")).toBe(true);
    expect(session.getState().selectableBlockIds).toEqual([
      "edge",
      "corner",
      "overlap",
      "edge-cover",
      "corner-cover",
    ]);

    session.selectBlock("overlap");

    expect(session.canSelectBlock("blocked")).toBe(true);
  });

  it("把方块按点击顺序追加到暂存槽，非相邻同类不三消", () => {
    const session = new GameSession(
      createLevel([
        createBlock("working-1", 0, 0, 0, WORKING_DOG),
        createBlock("single", 2, 0, 0, SINGLE_DOG),
        createBlock("working-2", 4, 0, 0, WORKING_DOG),
        createBlock("remaining", 6, 0, 0, LICKING_DOG),
      ]),
    );

    session.selectBlock("working-1");
    session.selectBlock("single");
    const state = session.selectBlock("working-2");

    expect(state.removedCount).toBe(0);
    expect(state.tray).toEqual([WORKING_DOG, SINGLE_DOG, WORKING_DOG]);
    expect(state.remainingBlocks.map((block) => block.id)).toEqual(["remaining"]);
    expect(state.status).toBe("playing");
  });

  it("三个相同图案类型自动消除，并解锁下层方块", () => {
    const session = new GameSession(
      createLevel([
        createBlock("working-1", 0, 0, 0, WORKING_DOG),
        createBlock("working-2", 2, 0, 0, WORKING_DOG),
        createBlock("working-3", 4, 0, 0, WORKING_DOG),
        createBlock("remaining", 6, 0, 0, SINGLE_DOG),
      ]),
    );

    session.selectBlock("working-1");
    session.selectBlock("working-2");
    const state = session.selectBlock("working-3");

    expect(state.removedCount).toBe(3);
    expect(state.tray).toEqual([]);
    expect(state.remainingBlocks.map((block) => block.id)).toEqual(["remaining"]);
    expect(state.status).toBe("playing");
    expect(state.selectableBlockIds).toEqual(["remaining"]);
  });

  it("一次结算处理多个完整三连", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("remaining-1", 0, 0, 0, LICKING_DOG),
        createBlock("remaining-2", 2, 0, 0, GUARD_DOG),
      ]),
      initialTray: [
        WORKING_DOG,
        WORKING_DOG,
        WORKING_DOG,
        SINGLE_DOG,
        SINGLE_DOG,
        SINGLE_DOG,
      ],
    });

    const state = session.getState();

    expect(state.tray).toEqual([]);
    expect(state.status).toBe("playing");
    expect(state.selectableBlockIds).toEqual(["remaining-1", "remaining-2"]);
  });

  it("暂存槽短暂达到七格但立即三消时不失败", () => {
    const session = new GameSession(
      createLevel([
        createBlock("working-1", 0, 0, 0, WORKING_DOG),
        createBlock("working-2", 2, 0, 0, WORKING_DOG),
        createBlock("working-3", 4, 0, 0, WORKING_DOG),
        createBlock("single-1", 6, 0, 0, SINGLE_DOG),
        createBlock("single-2", 8, 0, 0, SINGLE_DOG),
        createBlock("licking", 10, 0, 0, LICKING_DOG),
        createBlock("guard", 12, 0, 0, GUARD_DOG),
        createBlock("remaining", 0, 2, 0, GUARD_DOG),
      ]),
    );

    session.selectBlock("single-1");
    session.selectBlock("single-2");
    session.selectBlock("licking");
    session.selectBlock("guard");
    session.selectBlock("working-1");
    session.selectBlock("working-2");
    const state = session.selectBlock("working-3");

    expect(state.status).toBe("playing");
    expect(state.tray).toEqual([SINGLE_DOG, SINGLE_DOG, LICKING_DOG, GUARD_DOG]);
    expect(state.tray).toHaveLength(4);
  });

  it("暂存槽满且无法三消时失败", () => {
    const session = new GameSession(
      createLevel([
        createBlock("working-1", 0, 0, 0, WORKING_DOG),
        createBlock("single-1", 2, 0, 0, SINGLE_DOG),
        createBlock("licking-1", 4, 0, 0, LICKING_DOG),
        createBlock("guard-1", 6, 0, 0, GUARD_DOG),
        createBlock("working-2", 8, 0, 0, WORKING_DOG),
        createBlock("single-2", 10, 0, 0, SINGLE_DOG),
        createBlock("licking-2", 12, 0, 0, LICKING_DOG),
        createBlock("remaining", 0, 2, 0, GUARD_DOG),
      ]),
    );

    for (const blockId of [
      "working-1",
      "single-1",
      "licking-1",
      "guard-1",
      "working-2",
      "single-2",
    ]) {
      session.selectBlock(blockId);
    }

    const state = session.selectBlock("licking-2");

    expect(state.status).toBe("lost");
    expect(state.tray).toHaveLength(7);
    expect(state.remainingBlocks.map((block) => block.id)).toEqual(["remaining"]);
    expect(session.canSelectBlock("remaining")).toBe(false);
  });

  it("暂存槽容量提升只增加当前尝试一格并封顶", () => {
    const session = new GameSession(
      createLevel([createBlock("remaining", 0, 0, 0, WORKING_DOG)]),
    );

    expect(session.getState().trayCapacity).toBe(7);
    expect(session.increaseTrayCapacity()).toBe(true);
    expect(session.getState().trayCapacity).toBe(8);
    expect(session.increaseTrayCapacity()).toBe(false);
    expect(session.getState().trayCapacity).toBe(8);
  });
});
