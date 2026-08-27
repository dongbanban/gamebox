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

describe("GameSession · item-rules", () => {
  it("锁槽占用右侧位置，公开有效容量与空闲有效槽并按顺序解锁", () => {
    const session = new GameSession({
      level: {
        ...createLevel([
          createBlock("remaining", 0, 0, 0, WORKING_DOG),
          createBlock("remaining-2", 4, 0, 0, SINGLE_DOG),
        ]),
        lockedTraySlotCount: 2,
      },
    });

    expect(session.getState()).toMatchObject({
      trayCapacity: 7,
      effectiveTrayCapacity: 5,
      trayFreeCapacity: 5,
      lockedTraySlotCount: 2,
    });
    expect(session.canUnlockTraySlot()).toBe(true);

    const first = session.unlockTraySlot();
    expect(first).toMatchObject({
      unlocked: true,
      unlockedSlotIndex: 5,
      effectiveTrayCapacity: 6,
      lockedTraySlotCount: 1,
    });
    expect(session.getState().trayFreeCapacity).toBe(6);

    const second = session.unlockTraySlot();
    expect(second).toMatchObject({
      unlocked: true,
      unlockedSlotIndex: 6,
      effectiveTrayCapacity: 7,
      lockedTraySlotCount: 0,
    });
    expect(session.canUnlockTraySlot()).toBe(false);
    expect(session.unlockTraySlot().unlocked).toBe(false);
  });

  it("扩容在右侧锁槽前增加有效槽，锁槽数量不变", () => {
    const session = new GameSession({
      level: {
        ...createLevel([createBlock("remaining", 0, 0, 0, WORKING_DOG)]),
        lockedTraySlotCount: 2,
      },
    });

    expect(session.increaseTrayCapacity()).toBe(true);
    expect(session.getState()).toMatchObject({
      trayCapacity: 8,
      effectiveTrayCapacity: 6,
      trayFreeCapacity: 6,
      lockedTraySlotCount: 2,
    });
  });

  it("锁槽降低有效容量，满有效槽后仍按玩家操作失败", () => {
    const session = new GameSession({
      level: {
        ...createLevel([
          createBlock("remaining", 0, 0, 0, WORKING_DOG),
          createBlock("remaining-2", 4, 0, 0, SINGLE_DOG),
        ]),
        lockedTraySlotCount: 2,
      },
      initialTray: [
        WORKING_DOG,
        SINGLE_DOG,
        LICKING_DOG,
        GUARD_DOG,
      ],
    });

    const result = session.selectBlock("remaining");

    expect(result.selected).toBe(true);
    expect(result.snapshot.trayLogicalUnitCount).toBe(5);
    expect(result.snapshot.effectiveTrayCapacity).toBe(5);
    expect(result.snapshot.status).toBe("lost");
  });

  it("万能方块原子补偿一个被遮挡同图案方块并以万能标记入槽", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-hidden", 0, 0, 0, WORKING_DOG),
        createBlock("single-cover", 0, 0, 1, SINGLE_DOG),
      ]),
      initialTray: [WORKING_DOG],
    });

    const plan = session.getWildcardPlan(WORKING_DOG);

    expect(plan).toMatchObject({
      patternType: WORKING_DOG,
      compensatedBlockId: "working-hidden",
      removedCount: 0,
      tripleCount: 0,
    });
    expect(session.getState().remainingBlocks.map((block) => block.id)).toEqual([
      "working-hidden",
      "single-cover",
    ]);
    expect(session.getState().trayBlocks).toEqual([
      { id: "initial-tray-1", patternType: WORKING_DOG },
    ]);

    const result = session.useWildcard(WORKING_DOG);
    if (!result.used) {
      throw new Error("expected wildcard use to succeed");
    }

    expect(result).toMatchObject({
      used: true,
      patternType: WORKING_DOG,
      compensatedBlockId: "working-hidden",
      removedCount: 0,
      tripleCount: 0,
    });
    expect(result.wildcardBlockId).toMatch(/^wildcard-/);
    expect(result.snapshot.remainingBlocks.map((block) => block.id)).toEqual(["single-cover"]);
    expect(result.snapshot.trayBlocks).toEqual([
      { id: "initial-tray-1", patternType: WORKING_DOG },
      {
        id: result.wildcardBlockId,
        patternType: WORKING_DOG,
        visualMarker: "wildcard",
      },
    ]);
    expect(result.snapshot.status).toBe("playing");
  });

  it("暂存槽没有所选图案时拒绝万能方块", () => {
    const session = new GameSession(
      createLevel([
        createBlock("working-hidden", 0, 0, 0, WORKING_DOG),
        createBlock("single-cover", 0, 0, 1, SINGLE_DOG),
      ]),
    );

    expect(session.getWildcardPlan(WORKING_DOG)).toBeNull();
    expect(session.useWildcard(WORKING_DOG)).toMatchObject({ used: false });
  });

  it("万能方块优先与两个相邻冻结同款三消并保留未参与普通同款", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-hidden", 0, 0, 0, WORKING_DOG),
        createBlock("single-cover", 0, 0, 1, SINGLE_DOG),
      ]),
      initialTrayBlocks: [
        { id: "ordinary-working", patternType: WORKING_DOG },
        createFrozenTrayBlock("frozen-working-1", WORKING_DOG),
        createFrozenTrayBlock("frozen-working-2", WORKING_DOG),
      ],
    });

    expect(session.getWildcardPlan(WORKING_DOG)).toMatchObject({
      removedCount: 3,
      tripleCount: 1,
    });

    const result = session.useWildcard(WORKING_DOG);

    expect(result).toMatchObject({ used: true, removedCount: 3, tripleCount: 1 });
    expect(result.snapshot.trayBlocks).toEqual([
      { id: "ordinary-working", patternType: WORKING_DOG },
    ]);
  });

  it("万能方块不跨过槽内间隔与非后缀冻结同款三消", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-hidden", 0, 0, 0, WORKING_DOG),
        createBlock("single-cover", 0, 0, 1, SINGLE_DOG),
        createBlock("working-1", 8, 0, 0, WORKING_DOG),
        createBlock("working-2", 16, 0, 0, WORKING_DOG),
        createBlock("working-3", 24, 0, 0, WORKING_DOG),
        createBlock("single-2", 8, 8, 0, SINGLE_DOG),
        createBlock("licking-1", 16, 8, 0, LICKING_DOG),
        createBlock("licking-2", 24, 8, 0, LICKING_DOG),
        createBlock("licking-3", 32, 8, 0, LICKING_DOG),
      ]),
      initialTrayBlocks: [
        createFrozenTrayBlock("frozen-working-1", WORKING_DOG),
        createFrozenTrayBlock("frozen-working-2", WORKING_DOG),
        { id: "ordinary-single", patternType: SINGLE_DOG },
      ],
    });

    expect(session.getWildcardPlan(WORKING_DOG)).not.toBeNull();

    const result = session.useWildcard(WORKING_DOG);
    if (!result.used) {
      throw new Error("expected wildcard use to succeed");
    }

    expect(result).toMatchObject({ used: true, removedCount: 0, tripleCount: 0 });
    expect(result.snapshot.trayBlocks).toEqual([
      createFrozenTrayBlock("frozen-working-1", WORKING_DOG),
      createFrozenTrayBlock("frozen-working-2", WORKING_DOG),
      { id: "ordinary-single", patternType: SINGLE_DOG },
      {
        id: result.wildcardBlockId,
        patternType: WORKING_DOG,
        visualMarker: "wildcard",
      },
    ]);
  });

  it("万能方块不把棋盘冻结方块作为补偿删除", () => {
    const session = new GameSession({
      level: createLevel([
        {
          ...createBlock("working-hidden", 0, 0, 0, WORKING_DOG),
          specialMechanism: {
            type: "freeze",
            state: { status: "frozen", completedTriples: 0 },
          },
        },
        createBlock("single-cover", 0, 0, 1, SINGLE_DOG),
        createBlock("working-2", 8, 0, 0, WORKING_DOG),
        createBlock("working-3", 16, 0, 0, WORKING_DOG),
        createBlock("single-2", 8, 8, 0, SINGLE_DOG),
        createBlock("single-3", 16, 8, 0, SINGLE_DOG),
      ]),
      initialTray: [WORKING_DOG],
    });

    expect(session.getWildcardPlan(WORKING_DOG)).toBeNull();
    const result = session.useWildcard(WORKING_DOG);
    expect(result).toMatchObject({ used: false, patternType: WORKING_DOG });
    expect(result).not.toHaveProperty("wildcardBlockId");
    expect(result).not.toHaveProperty("compensatedBlockId");
    expect(session.getState().remainingBlocks.find(
      (block) => block.id === "working-hidden",
    )).toHaveProperty("specialMechanism.type", "freeze");
  });

  it("万能方块可以把被遮挡幻化同款作为棋盘补偿", () => {
    const session = new GameSession({
      level: createLevel([
        {
          ...createBlock("working-hidden", 0, 0, 0, WORKING_DOG),
          specialMechanism: {
            type: "illusion",
            state: { status: "masked", disguisedPatternType: SINGLE_DOG },
          },
        },
        createBlock("single-cover", 0, 0, 1, SINGLE_DOG),
        createBlock("working-2", 8, 0, 0, WORKING_DOG),
        createBlock("working-3", 16, 0, 0, WORKING_DOG),
        createBlock("single-2", 8, 8, 0, SINGLE_DOG),
        createBlock("single-3", 16, 8, 0, SINGLE_DOG),
      ]),
      initialTray: [WORKING_DOG],
    });

    expect(session.getWildcardPlan(WORKING_DOG)).toMatchObject({
      compensatedBlockId: "working-hidden",
    });
    expect(session.useWildcard(WORKING_DOG)).toMatchObject({ used: true });
  });
});
