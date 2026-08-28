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
import { createBlock, createLevel, createTargetDefinition } from "../support/item-fixtures";
import {
  DOG_ITEM_DEFINITIONS,
  DOG_ITEM_IDS,
  type DogItemDefinition,
  type DogItemId,
} from "@/games/dog-lege-dog/game/dog-loadout";
import {
  DogItemRuntime,
  getDogItemUses,
  type DogItemRuntimeDefinition,
  type DogItemTarget,
} from "@/games/dog-lege-dog/game/dog-item-runtime";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";
const GUARD_DOG: DogPatternType = "看门狗";

describe("DogItemRuntime · wildcard", () => {
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
      createBlock("working-final", WORKING_DOG, undefined, { x: 8 }),
      createBlock("single-2", SINGLE_DOG, undefined, { x: 16 }),
      createBlock("single-3", SINGLE_DOG, undefined, { x: 24 }),
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
      "working-final",
      "single-2",
      "single-3",
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

  it("万能方块每关成功一次后不可再次使用", () => {
    const level = {
      ...createLevel([
        createBlock("working-hidden-1", WORKING_DOG),
        createBlock("single-cover-1", SINGLE_DOG, undefined, { z: 1 }),
        createBlock("working-hidden-2", WORKING_DOG, undefined, { x: 8 }),
        createBlock("single-cover-2", SINGLE_DOG, undefined, { x: 8, z: 1 }),
        createBlock("single-final", SINGLE_DOG, undefined, { x: 16 }),
      ]),
      number: 2,
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    };
    const session = new GameSession({
      level,
      initialTrayBlocks: [{ id: "target-working", patternType: WORKING_DOG }],
    });
    const runtime = new DogItemRuntime({ level, session, loadout: ["wildcard"] });

    expect(runtime.begin("wildcard")).toMatchObject({
      accepted: true,
      requiresTarget: true,
    });
    expect(
      runtime.confirmTarget({ type: "tray-block", blockId: "target-working" }),
    ).toMatchObject({ accepted: true, success: true });
    runtime.completeAnimation();
    expect(runtime.getState().items[0]).toMatchObject({ remainingUses: 0, available: false });

    expect(session.getState().trayBlocks).toMatchObject([
      { id: "target-working", patternType: WORKING_DOG },
      { patternType: WORKING_DOG, visualMarker: "wildcard" },
    ]);
    expect(runtime.begin("wildcard")).toMatchObject({ accepted: false, success: false });
  });

  it("万能方块所选图案没有不可点击补偿方块时失败且不扣次数", () => {
    const level = {
      ...createLevel([
        createBlock("working-hidden", WORKING_DOG),
        createBlock("single-cover", SINGLE_DOG, undefined, { z: 1 }),
        createBlock("single-2", SINGLE_DOG, undefined, { x: 8 }),
      ]),
      patternTypes: [WORKING_DOG, SINGLE_DOG],
    };
    const session = new GameSession({
      level,
      initialTrayBlocks: [
        { id: "target-single", patternType: SINGLE_DOG },
        { id: "target-working", patternType: WORKING_DOG },
        { id: "target-working-2", patternType: WORKING_DOG },
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
});
