import { describe, expect, it } from "vitest";
import {
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

    expect(runtime.confirmTarget({ type: "pattern", patternType: SINGLE_DOG })).toMatchObject({
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
    const session = new GameSession(createLevel([createBlock("remaining", WORKING_DOG)]));
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

function createBlock(id: string, patternType: DogPatternType): DogBlock {
  return {
    id,
    x: 0,
    y: 0,
    z: 0,
    width: 4,
    height: 4,
    rotation: 0,
    patternType,
  };
}
