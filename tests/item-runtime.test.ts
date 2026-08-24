import { describe, expect, it } from "vitest";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
  FIRST_LEVEL,
  GameSession,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import {
  DOG_ITEM_DEFINITIONS,
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

describe("DogItemRuntime", () => {
  it("容量提升无目标直执行，成功扣次并在动画完成后重新计算可用性", () => {
    const session = new GameSession(createLevel([createBlock("remaining", WORKING_DOG)]));
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["tray-capacity"],
    });

    expect(runtime.getState().items[0]).toMatchObject({
      id: "tray-capacity",
      targetType: "none",
      remainingUses: 1,
      available: true,
    });
    expect(runtime.begin("wildcard")).toMatchObject({
      accepted: false,
      success: false,
    });

    const action = runtime.begin("tray-capacity");

    expect(action).toMatchObject({
      accepted: true,
      success: true,
      requiresTarget: false,
    });
    expect(session.getState().trayCapacity).toBe(8);
    expect(runtime.getState().phase).toBe("animating");
    expect(runtime.getState().items[0]).toMatchObject({
      remainingUses: 0,
      available: false,
    });

    runtime.completeAnimation();

    expect(runtime.getState().phase).toBe("idle");
    expect(runtime.getState().items[0]?.available).toBe(false);
  });

  it("目标道具确认前可取消，取消与无效目标不改变次数和棋盘", () => {
    const session = new GameSession(createLevel([createBlock("remaining", WORKING_DOG)]));
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
      definitions: [createTargetDefinition()],
    });
    const initial = session.getState();

    expect(runtime.begin("triple-removal")).toMatchObject({
      accepted: true,
      success: false,
      requiresTarget: true,
    });
    expect(runtime.getState().phase).toBe("targeting");
    expect(session.getState()).toEqual(initial);

    expect(runtime.confirmTarget({ type: "tray-block", blockId: "missing" })).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(session.getState()).toEqual(initial);

    runtime.cancel();

    expect(runtime.getState().phase).toBe("idle");
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(session.getState()).toEqual(initial);
  });

  it("万能方块在暂存槽没有可选图案时不可用", () => {
    const level = createLevel([
      createBlock("working-hidden", WORKING_DOG),
      createBlock("single-cover", SINGLE_DOG, undefined, { z: 1 }),
    ]);
    const session = new GameSession(level);
    const runtime = new DogItemRuntime({ level, session, loadout: ["wildcard"] });

    expect(runtime.getState().items[0]).toMatchObject({ available: false });
    expect(runtime.begin("wildcard")).toMatchObject({ accepted: false, success: false });
  });

  it("万能方块点击槽内方块选择已有图案，取消无副作用，确认后原子提交", () => {
    const level = createLevel([
      createBlock("working-hidden", WORKING_DOG),
      createBlock("single-cover", SINGLE_DOG, undefined, { z: 1 }),
    ]);
    const session = new GameSession({
      level,
      initialTrayBlocks: [{ id: "target-working", patternType: WORKING_DOG }],
    });
    const runtime = new DogItemRuntime({
      level,
      session,
      loadout: ["wildcard"],
    });
    const initial = session.getState();

    expect(runtime.getState().items[0]).toMatchObject({
      id: "wildcard",
      targetType: "tray-block",
      remainingUses: 1,
      available: true,
    });
    expect(runtime.begin("wildcard")).toMatchObject({
      accepted: true,
      success: false,
      requiresTarget: true,
    });
    expect(runtime.getState().phase).toBe("targeting");
    expect(runtime.cancel()).toMatchObject({ phase: "idle" });
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(session.getState()).toEqual(initial);

    runtime.begin("wildcard");
    expect(
      runtime.confirmTarget({ type: "block", blockId: "single-cover" }),
    ).toMatchObject({ accepted: false, success: false, requiresTarget: true });
    const action = runtime.confirmTarget({ type: "tray-block", blockId: "target-working" });

    expect(action).toMatchObject({
      accepted: true,
      success: true,
      itemId: "wildcard",
      effect: {
        type: "wildcard",
        patternType: WORKING_DOG,
        compensatedBlockId: "working-hidden",
      },
    });
    expect(runtime.getState()).toMatchObject({ phase: "animating" });
    expect(runtime.getState().items[0]).toMatchObject({
      remainingUses: 0,
      available: false,
    });
    expect(session.getState()).toEqual(initial);

    runtime.completeAnimation();

    expect(runtime.getState().phase).toBe("idle");
    expect(session.getState().remainingBlocks.map((block) => block.id)).toEqual([
      "single-cover",
    ]);
    expect(session.getState().trayBlocks.find((block) => block.visualMarker === "wildcard"))
      .toMatchObject({
        patternType: WORKING_DOG,
        visualMarker: "wildcard",
      });
    expect(runtime.getLastCompletedEffect()).toMatchObject({
      type: "wildcard",
      removedCount: 0,
      tripleCount: 0,
    });
  });

  it("万能方块同一图案可重复选择，每次成功各扣一次", () => {
    const level = {
      ...createLevel([
        createBlock("working-hidden-1", WORKING_DOG),
        createBlock("single-cover-1", SINGLE_DOG, undefined, { z: 1 }),
        createBlock("working-hidden-2", WORKING_DOG, undefined, { x: 8 }),
        createBlock("single-cover-2", SINGLE_DOG, undefined, { x: 8, z: 1 }),
      ]),
      number: 2,
    };
    const session = new GameSession({
      level,
      initialTrayBlocks: [{ id: "target-working", patternType: WORKING_DOG }],
    });
    const runtime = new DogItemRuntime({ level, session, loadout: ["wildcard"] });

    for (const expectedRemainingUses of [1, 0]) {
      expect(runtime.begin("wildcard")).toMatchObject({
        accepted: true,
        requiresTarget: true,
      });
      expect(
        runtime.confirmTarget({ type: "tray-block", blockId: "target-working" }),
      ).toMatchObject({ accepted: true, success: true });
      runtime.completeAnimation();
      expect(runtime.getState().items[0]?.remainingUses).toBe(expectedRemainingUses);
    }

    expect(session.getState().trayBlocks).toEqual([]);
    expect(runtime.begin("wildcard")).toMatchObject({ accepted: false, success: false });
  });

  it("万能方块所选图案没有不可点击补偿方块时失败且不扣次数", () => {
    const level = {
      ...createLevel([
        createBlock("working-hidden", WORKING_DOG),
        createBlock("single-cover", SINGLE_DOG, undefined, { z: 1 }),
      ]),
      patternTypes: [WORKING_DOG, SINGLE_DOG],
    };
    const session = new GameSession({
      level,
      initialTrayBlocks: [
        { id: "target-working", patternType: WORKING_DOG },
        { id: "target-single", patternType: SINGLE_DOG },
      ],
    });
    const runtime = new DogItemRuntime({ level, session, loadout: ["wildcard"] });
    const initial = session.getState();

    expect(runtime.begin("wildcard")).toMatchObject({ accepted: true, requiresTarget: true });
    expect(
      runtime.confirmTarget({ type: "tray-block", blockId: "target-single" }),
    ).toMatchObject({ accepted: false, success: false, requiresTarget: true });
    expect(runtime.getState()).toMatchObject({ phase: "targeting" });
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(session.getState()).toEqual(initial);
  });

  it("关卡失败后道具不可用且不扣次数", () => {
    const session = new GameSession({
      level: createLevel([createBlock("remaining", WORKING_DOG)]),
      initialTray: [
        WORKING_DOG,
        SINGLE_DOG,
        LICKING_DOG,
        GUARD_DOG,
        "拆家狗",
        "龇牙狗",
        "社恐狗",
      ],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["tray-capacity"],
    });

    expect(session.getState().status).toBe("lost");
    expect(runtime.getState().items[0]).toMatchObject({
      remainingUses: 1,
      available: false,
    });
    expect(runtime.begin("tray-capacity")).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(session.getState().trayCapacity).toBe(7);
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
  });

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

    expect(session.getTripleRemovalTargetPatterns()).toEqual([]);
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
      initialTray: [WORKING_DOG],
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
    expect(session.getState().tray).toEqual([WORKING_DOG]);
  });

  it("道具选择暂存槽内任意位置的相邻图案对，并自动补 1 个棋盘方块", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("working-board", WORKING_DOG),
        createBlock("single-1", SINGLE_DOG),
        createBlock("single-2", SINGLE_DOG),
      ]),
      initialTray: [WORKING_DOG, WORKING_DOG, SINGLE_DOG],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
    });

    expect(runtime.getState().items[0]).toMatchObject({
      targetType: "tray-block",
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
        createBlock("single-3", SINGLE_DOG, undefined, { x: 12 }),
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
      initialTray: [WORKING_DOG, SINGLE_DOG, WORKING_DOG],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
    });

    expect(session.getTripleRemovalTargetPatterns()).toEqual([]);
    expect(runtime.getState().items[0]).toMatchObject({ available: false, remainingUses: 1 });
    expect(runtime.begin("triple-removal")).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(session.getState().tray).toEqual([WORKING_DOG, SINGLE_DOG, WORKING_DOG]);
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
      initialTray: [WORKING_DOG, WORKING_DOG],
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
      initialTray: [
        WORKING_DOG,
        LICKING_DOG,
        GUARD_DOG,
        "拆家狗",
        "龇牙狗",
        "社恐狗",
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

  it("执行提交失败时不扣次数，并保持目标选择状态等待重试或取消", () => {
    const session = new GameSession(createLevel([createBlock("remaining", WORKING_DOG)]));
    const definition: DogItemRuntimeDefinition = {
      ...createTargetDefinition(),
      execute: () => ({
        success: true,
        visualFeedback: "triple-removal",
        commit: () => false,
      }),
    };
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["triple-removal"],
      definitions: [definition],
    });

    runtime.begin("triple-removal");
    const action = runtime.confirmTarget({ type: "block", blockId: "remaining" });

    expect(action).toMatchObject({ accepted: false, success: false });
    expect(runtime.getState().phase).toBe("targeting");
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(session.getState().tray).toEqual([]);
  });

  it("动画后原子提交失败时恢复次数且不留下完成效果", () => {
    const session = new GameSession({
      level: createLevel([createBlock("remaining", WORKING_DOG)]),
      initialTrayBlocks: [{ id: "target-working", patternType: WORKING_DOG }],
    });
    const wildcardDefinition = DOG_ITEM_DEFINITIONS.find((item) => item.id === "wildcard")!;
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["wildcard"],
      definitions: [{
        definition: wildcardDefinition,
        getUses: () => 1,
        canUse: () => true,
        execute: () => ({
          success: true,
          visualFeedback: "wildcard",
          commitAfterAnimation: () => ({ success: false }),
        }),
      }],
    });
    const initial = session.getState();

    runtime.begin("wildcard");
    expect(
      runtime.confirmTarget({ type: "tray-block", blockId: "target-working" }),
    ).toMatchObject({ accepted: true, success: true });
    expect(runtime.getState().items[0]?.remainingUses).toBe(0);

    runtime.completeAnimation();

    expect(runtime.getState()).toMatchObject({ phase: "idle" });
    expect(runtime.getState().items[0]).toMatchObject({
      remainingUses: 1,
      available: true,
    });
    expect(runtime.getLastCompletedEffect()).toBeNull();
    expect(session.getState()).toEqual(initial);
  });

  it("火把只接受冻结方块目标，取消与无效目标不扣次", () => {
    const session = new GameSession(
      createLevel([
        createBlock("freeze", WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }),
        createBlock("ordinary", SINGLE_DOG),
      ]),
    );
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["torch"],
    });

    expect(runtime.getState().items[0]).toMatchObject({
      id: "torch",
      targetType: "block",
      available: true,
      remainingUses: 1,
    });
    expect(runtime.begin("torch")).toMatchObject({
      accepted: true,
      success: false,
      requiresTarget: true,
    });
    expect(runtime.confirmTarget({ type: "block", blockId: "ordinary" })).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(runtime.cancel().phase).toBe("idle");
    expect(session.getState().remainingBlocks.find((block) => block.id === "freeze"))
      .toHaveProperty("specialMechanism.type", DOG_FREEZE_MECHANISM_TYPE);
  });

  it("火把与检测仪不能选择被遮挡的棋盘方块", () => {
    const session = new GameSession(
      createLevel([
        createBlock("freeze", WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }, { x: 0, y: 0, z: 0 }),
        createBlock("freeze-cover", SINGLE_DOG, undefined, { x: 0, y: 0, z: 1 }),
        createBlock("illusion", LICKING_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: SINGLE_DOG },
        }, { x: 8, y: 0, z: 0 }),
        createBlock("illusion-cover", GUARD_DOG, undefined, { x: 8, y: 0, z: 1 }),
      ]),
    );

    expect(session.getState().selectableBlockIds).toEqual(["freeze-cover", "illusion-cover"]);
    expect(session.canMeltFrozenBlock("freeze", "board")).toBe(false);
    expect(session.canRevealIllusionBlock("illusion")).toBe(false);

    const torch = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["torch"],
    });
    const detector = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["detector"],
    });

    expect(torch.getState().items[0]).toMatchObject({ available: false, remainingUses: 1 });
    expect(detector.getState().items[0]).toMatchObject({ available: false, remainingUses: 1 });
    expect(torch.begin("torch")).toMatchObject({ accepted: false, success: false });
    expect(detector.begin("detector")).toMatchObject({ accepted: false, success: false });
  });

  it("火把成功融化棋盘冻结方块后扣次并锁定至动画完成", () => {
    const session = new GameSession(
      createLevel([
        createBlock("freeze", WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }),
        createBlock("ordinary", SINGLE_DOG),
      ]),
    );
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["torch"],
    });

    runtime.begin("torch");
    const action = runtime.confirmTarget({ type: "block", blockId: "freeze" });

    expect(action).toMatchObject({
      accepted: true,
      success: true,
      itemId: "torch",
      effect: {
        type: "melt",
        blockId: "freeze",
        location: "board",
      },
    });
    expect(runtime.getState()).toMatchObject({ phase: "animating" });
    expect(runtime.getState().items[0]).toMatchObject({ remainingUses: 0, available: false });
    expect(session.getState().remainingBlocks.find((block) => block.id === "freeze"))
      .toHaveProperty("specialMechanism.type", DOG_FREEZE_MECHANISM_TYPE);

    runtime.completeAnimation();

    expect(runtime.getState().phase).toBe("idle");
    expect(session.getState().remainingBlocks.find((block) => block.id === "freeze"))
      .not.toHaveProperty("specialMechanism");
  });

  it("火把融化暂存槽冻结方块并立即三消", () => {
    const session = new GameSession({
      level: createLevel([createBlock("remaining", SINGLE_DOG)]),
      initialTrayBlocks: [
        {
          id: "freeze",
          patternType: WORKING_DOG,
          specialMechanism: {
            type: DOG_FREEZE_MECHANISM_TYPE,
            state: { status: "frozen", completedTriples: 0 },
          },
        },
        { id: "working-1", patternType: WORKING_DOG },
        { id: "working-2", patternType: WORKING_DOG },
      ],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["torch"],
    });

    runtime.begin("torch");
    const action = runtime.confirmTarget({ type: "tray-block", blockId: "freeze" });

    expect(action).toMatchObject({
      accepted: true,
      success: true,
      effect: {
        type: "melt",
        blockId: "freeze",
        location: "tray",
      },
    });
    expect(session.getState().tray).toHaveLength(3);

    runtime.completeAnimation();

    expect(session.getState().tray).toEqual([]);
    expect(runtime.getLastCompletedEffect()).toMatchObject({
      type: "melt",
      removedCount: 3,
      tripleCount: 1,
    });
  });

  it("检测仪只接受棋盘幻化方块，原位揭示且不改变暂存槽", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("illusion", WORKING_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: SINGLE_DOG },
        }),
        createBlock("ordinary", SINGLE_DOG),
        createBlock("freeze", LICKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }),
      ]),
      initialTrayBlocks: [
        { id: "tray-1", patternType: WORKING_DOG },
        { id: "tray-2", patternType: WORKING_DOG },
      ],
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["detector", "torch"],
    });
    const initial = session.getState();
    const initialIllusion = initial.remainingBlocks.find((block) => block.id === "illusion");

    expect(runtime.getState().items.find((item) => item.id === "detector")).toMatchObject({
      remainingUses: 1,
      available: true,
    });
    expect(runtime.begin("detector")).toMatchObject({
      accepted: true,
      success: false,
      requiresTarget: true,
    });
    expect(runtime.isInputLocked()).toBe(true);
    expect(runtime.begin("torch")).toMatchObject({ accepted: false, success: false });

    for (const invalidTarget of [
      { type: "block", blockId: "ordinary" },
      { type: "block", blockId: "freeze" },
      { type: "tray-block", blockId: "tray-1" },
    ] as const) {
      expect(runtime.confirmTarget(invalidTarget)).toMatchObject({
        accepted: false,
        success: false,
      });
      expect(runtime.getState().phase).toBe("targeting");
      expect(session.getState()).toEqual(initial);
    }

    runtime.cancel();
    expect(runtime.getState().phase).toBe("idle");
    expect(runtime.getState().items.find((item) => item.id === "detector"))
      .toMatchObject({ remainingUses: 1 });
    expect(session.getState()).toEqual(initial);
    expect(runtime.begin("detector")).toMatchObject({
      accepted: true,
      success: false,
      requiresTarget: true,
    });

    const action = runtime.confirmTarget({ type: "block", blockId: "illusion" });

    expect(action).toMatchObject({
      accepted: true,
      success: true,
      itemId: "detector",
      effect: { type: "reveal", blockId: "illusion" },
    });
    expect(runtime.getState()).toMatchObject({ phase: "animating" });
    expect(runtime.getState().items.find((item) => item.id === "detector"))
      .toMatchObject({ remainingUses: 0, available: false });
    expect(session.getState()).toEqual(initial);
    expect(session.getState().tray).toEqual([WORKING_DOG, WORKING_DOG]);

    runtime.completeAnimation();

    expect(runtime.isInputLocked()).toBe(false);
    expect(session.getState().remainingBlocks.find((block) => block.id === "illusion"))
      .toMatchObject({
        x: initialIllusion?.x,
        y: initialIllusion?.y,
        z: initialIllusion?.z,
        patternType: WORKING_DOG,
      });
    expect(session.getState().remainingBlocks.find((block) => block.id === "illusion"))
      .not.toHaveProperty("specialMechanism");
    expect(session.getState().tray).toEqual([WORKING_DOG, WORKING_DOG]);
    expect(session.getState().status).toBe("playing");
    expect(runtime.begin("detector")).toMatchObject({ accepted: false, success: false });
    expect(runtime.getState().items.find((item) => item.id === "detector"))
      .toMatchObject({ remainingUses: 0 });
  });
});

function createTargetDefinition(): DogItemRuntimeDefinition {
  const definition: DogItemDefinition = {
    ...DOG_ITEM_DEFINITIONS[0]!,
    targetType: "block",
  };
  return {
    definition,
    getUses: () => 1,
    canUse: ({ target }) => target === undefined || target.type === "block",
    execute: ({ target }) => ({
      success: target?.type === "block",
      visualFeedback: "triple-removal",
    }),
  };
}

function createLevel(blocks: readonly DogBlock[]): DogLegeDogLevel {
  return {
    ...FIRST_LEVEL,
    blocks,
  };
}

function createBlock(
  id: string,
  patternType: DogPatternType,
  specialMechanism?: DogBlock["specialMechanism"],
  placement: Partial<Pick<DogBlock, "x" | "y" | "z">> = {},
): DogBlock {
  return {
    id,
    x: placement.x ?? 0,
    y: placement.y ?? 0,
    z: placement.z ?? 0,
    width: 4,
    height: 4,
    rotation: 0,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}
