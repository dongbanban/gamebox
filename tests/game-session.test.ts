import { describe, expect, it } from "vitest";
import {
  FIRST_LEVEL,
  GameSession,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";
const GUARD_DOG: DogPatternType = "看门狗";

describe("GameSession", () => {
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

function createLevel(blocks: readonly DogBlock[]): DogLegeDogLevel {
  return {
    ...FIRST_LEVEL,
    blocks,
  };
}

function createBlock(
  id: string,
  x: number,
  y: number,
  z: number,
  patternType: DogPatternType,
): DogBlock {
  return {
    id,
    x,
    y,
    z,
    width: 4,
    height: 4,
    rotation: 0,
    patternType,
  };
}

function createFrozenTrayBlock(
  id: string,
  patternType: DogPatternType,
  completedTriples = 0,
) {
  return {
    id,
    patternType,
    specialMechanism: {
      type: "freeze",
      state: { status: "frozen", completedTriples },
    },
  } as const;
}
