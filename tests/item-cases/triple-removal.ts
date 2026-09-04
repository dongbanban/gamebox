import { describe, expect, it } from "vitest";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  GameSession,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog";
import { TEST_LEVEL, TEST_PATTERN_TYPES } from "../support/dog-level-fixture";
import { createBlock, createLevel } from "../support/item-fixtures";
import {
  DOG_ITEM_DEFINITIONS,
  DOG_ITEM_IDS,
  type DogItemDefinition,
  type DogItemId,
} from "@/games/dog-lege-dog/game/dog-loadout";
import {
  DogItemRuntime,
  type DogItemRuntimeDefinition,
  type DogItemTarget,
} from "@/games/dog-lege-dog/game/dog-item-runtime";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";
const GUARD_DOG: DogPatternType = "看门狗";

describe("DogItemRuntime · triple-removal", () => {
  it("找不到合法补充方案时道具保持不可用且不扣次数", () => {
    const session = new GameSession({
      level: createLevel([createBlock("remaining", WORKING_DOG)]),
      initialTrayBlocks: [{ id: "target-working", patternType: WORKING_DOG }],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
    });

    expect(runtime.getState().items[0]).toMatchObject({
      available: false,
      remainingUses: 1,
    });
    expect(runtime.begin("triple-removal")).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(runtime.getState().phase).toBe("idle");
  });

  it("暂存槽只有冻结同款时不把特殊方块当作普通目标", () => {
    const session = new GameSession({
      level: createLevel([createBlock("working", WORKING_DOG)]),
      initialTrayBlocks: [
        {
          id: "frozen-working",
          patternType: WORKING_DOG,
          specialMechanism: {
            type: DOG_FREEZE_MECHANISM_TYPE,
            state: { status: "frozen", completedTriples: 0 },
          },
        },
      ],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
    });

    expect(runtime.getState().tripleRemovalTargetBlockIds).toEqual([]);
    expect(runtime.getState().items[0]).toMatchObject({
      available: false,
      remainingUses: 1,
    });
    expect(runtime.begin("triple-removal")).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(session.getState().trayBlocks[0]).toHaveProperty(
      "specialMechanism.type",
      DOG_FREEZE_MECHANISM_TYPE,
    );
  });

  it("槽内只有 1 个图案时不能使用三消移除，也不自动补 2 个", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-1", WORKING_DOG),
        createBlock("working-2", WORKING_DOG),
      ]),
      initialTrayBlocks: [{ id: "initial-tray-1", patternType: WORKING_DOG }],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
    });

    expect(runtime.getState().items[0]).toMatchObject({
      available: false,
      remainingUses: 1,
    });
    expect(runtime.getState().tripleRemovalTargetBlockIds).toEqual([]);
    expect(runtime.begin("triple-removal")).toMatchObject({
      accepted: false,
      success: false,
      requiresTarget: false,
    });
    expect(session.getState().remainingBlocks.map((block) => block.id)).toEqual([
      "working-1",
      "working-2",
    ]);
    expect(session.getState().trayBlocks.map((block) => block.patternType)).toEqual([WORKING_DOG]);
  });

  it("道具选择暂存槽内任意位置的相邻图案对，并自动补 1 个棋盘方块", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-board", WORKING_DOG),
        createBlock("single-1", SINGLE_DOG),
        createBlock("single-2", SINGLE_DOG),
      ]),
      initialTrayBlocks: [
        { id: "initial-tray-1", patternType: WORKING_DOG },
        { id: "initial-tray-2", patternType: WORKING_DOG },
        { id: "initial-tray-3", patternType: SINGLE_DOG },
      ],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
    });

    expect(runtime.getState().items[0]).toMatchObject({
      available: true,
    });
    expect(runtime.getState().tripleRemovalTargetBlockIds).toEqual([
      "initial-tray-1",
      "initial-tray-2",
    ]);
    runtime.begin("triple-removal");
    const action = runtime.confirmTarget({ type: "tray-block", blockId: "initial-tray-1" });

    expect(action).toMatchObject({
      accepted: true,
      success: true,
      effect: {
        patternType: WORKING_DOG,
        blockIds: ["working-board"],
        trayBlockIds: ["initial-tray-1", "initial-tray-2"],
        removedCount: 3,
        tripleCount: 1,
      },
    });
    expect(session.getState().trayBlocks.map((block) => block.id)).toEqual([
      "initial-tray-1",
      "initial-tray-2",
      "initial-tray-3",
    ]);
    runtime.completeAnimation();
    expect(session.getState().trayBlocks.map((block) => block.id)).toEqual(["initial-tray-3"]);
  });

  it("三消道具成功后计入暂存槽冻结方块的后续三消进度", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-board", WORKING_DOG),
        createBlock("single-1", SINGLE_DOG, undefined, { x: 4 }),
        createBlock("single-2", SINGLE_DOG, undefined, { x: 8 }),
        createBlock("licking-1", LICKING_DOG, undefined, { x: 16 }),
        createBlock("licking-2", LICKING_DOG, undefined, { x: 20 }),
        createBlock("licking-3", LICKING_DOG, undefined, { x: 24 }),
      ]),
      initialTrayBlocks: [
        {
          id: "frozen-single",
          patternType: SINGLE_DOG,
          specialMechanism: {
            type: DOG_FREEZE_MECHANISM_TYPE,
            state: { status: "frozen", completedTriples: 1 },
          },
        },
        { id: "working-1", patternType: WORKING_DOG },
        { id: "working-2", patternType: WORKING_DOG },
      ],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
    });

    expect(runtime.getState().items[0]?.available).toBe(true);
    runtime.begin("triple-removal");
    expect(runtime.confirmTarget({ type: "tray-block", blockId: "working-1" })).toMatchObject({
      accepted: true,
      success: true,
    });
    runtime.completeAnimation();

    expect(session.getState().trayBlocks).toEqual([
      { id: "frozen-single", patternType: SINGLE_DOG },
    ]);
    expect(runtime.getLastCompletedEffect()).toMatchObject({
      type: "triple-removal",
      meltedBlockIds: ["frozen-single"],
    });
  });

  it("槽内已有 2 个非相邻图案时不能补成三消", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-board", WORKING_DOG),
        createBlock("single-1", SINGLE_DOG),
        createBlock("single-2", SINGLE_DOG),
      ]),
      initialTrayBlocks: [
        { id: "initial-tray-1", patternType: WORKING_DOG },
        { id: "initial-tray-2", patternType: SINGLE_DOG },
        { id: "initial-tray-3", patternType: WORKING_DOG },
      ],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
    });

    expect(runtime.getState().tripleRemovalTargetBlockIds).toEqual([]);
    expect(runtime.getState().items[0]).toMatchObject({ available: false, remainingUses: 1 });
    expect(runtime.begin("triple-removal")).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(session.getState().trayBlocks.map((block) => block.patternType)).toEqual([
      WORKING_DOG,
      SINGLE_DOG,
      WORKING_DOG,
    ]);
    expect(session.getState().remainingBlocks.map((block) => block.id)).toEqual([
      "working-board",
      "single-1",
      "single-2",
    ]);
  });

  it("多个同类补充方案均可解时按关卡稳定顺序选择", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-b", WORKING_DOG, undefined, { x: 20 }),
        createBlock("working-a", WORKING_DOG, undefined, { x: 0, z: 1 }),
        createBlock("working-c", WORKING_DOG, undefined, { x: 40 }),
        createBlock("working-d", WORKING_DOG, undefined, { x: 60 }),
        createBlock("single-cover", SINGLE_DOG),
        createBlock("single-1", SINGLE_DOG),
        createBlock("single-2", SINGLE_DOG),
      ]),
      initialTrayBlocks: [
        { id: "initial-tray-1", patternType: WORKING_DOG },
        { id: "initial-tray-2", patternType: WORKING_DOG },
      ],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
    });

    runtime.begin("triple-removal");
    const action = runtime.confirmTarget({ type: "tray-block", blockId: "initial-tray-1" });

    expect(action).toMatchObject({
      accepted: true,
      success: true,
      effect: { blockIds: ["working-a"] },
    });
  });

  it("补齐后无道具路径不存在时失败且保持局面与次数原子不变", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-1", WORKING_DOG),
        createBlock("working-2", WORKING_DOG),
        createBlock("orphan-1", SINGLE_DOG),
        createBlock("orphan-2", SINGLE_DOG),
        createBlock("orphan-3", SINGLE_DOG),
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
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
    });
    const initial = session.getState();

    expect(runtime.getState().items[0]).toMatchObject({
      available: false,
      remainingUses: 1,
    });
    expect(runtime.begin("triple-removal")).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(runtime.getState().phase).toBe("idle");
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(session.getState()).toEqual(initial);
  });
});
