import { describe, expect, it } from "vitest";
import { GameSession } from "@/games/dog-lege-dog/game/game-session";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import { createBlock, createLevel } from "../support/item-fixtures";
import { DogItemRuntime } from "@/games/dog-lege-dog/game/dog-item-runtime";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";
const GUARD_DOG: DogPatternType = "看门狗";

describe("DogItemRuntime · torch-detector", () => {
  it("动画后真实目标失效时恢复次数且不留下完成效果", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("freeze", WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }),
        createBlock("ordinary", SINGLE_DOG),
      ]),
    });
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["torch"],
    });

    runtime.begin("torch");
    expect(runtime.confirmTarget({ type: "block", blockId: "freeze" })).toMatchObject({
      accepted: true,
      success: true,
    });
    expect(runtime.getState().items[0]?.remainingUses).toBe(0);
    expect(session.meltFrozenBlock("freeze", "board").melted).toBe(true);

    runtime.completeAnimation();

    expect(runtime.getState()).toMatchObject({ phase: "idle" });
    expect(runtime.getState().items[0]).toMatchObject({
      remainingUses: 1,
    });
    expect(runtime.getLastCompletedEffect()).toBeNull();
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
      available: true,
      remainingUses: 1,
    });
    expect(runtime.begin("torch")).toMatchObject({
      accepted: true,
      success: false,
      requiresTarget: true,
    });
    expect(
      runtime.confirmTarget({ type: "block", blockId: "ordinary" }),
    ).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(runtime.cancel().phase).toBe("idle");
    expect(
      session.getState().remainingBlocks.find((block) => block.id === "freeze"),
    ).toHaveProperty("specialMechanism.type", DOG_FREEZE_MECHANISM_TYPE);
  });

  it("火把与检测仪不能选择被遮挡的棋盘方块", () => {
    const session = new GameSession(
      createLevel([
        createBlock(
          "freeze",
          WORKING_DOG,
          {
            type: DOG_FREEZE_MECHANISM_TYPE,
            state: { status: "frozen", completedTriples: 0 },
          },
          { x: 0, y: 0, z: 0 },
        ),
        createBlock("freeze-cover", SINGLE_DOG, undefined, {
          x: 0,
          y: 0,
          z: 1,
        }),
        createBlock(
          "illusion",
          LICKING_DOG,
          {
            type: DOG_ILLUSION_MECHANISM_TYPE,
            state: { status: "masked", disguisedPatternType: SINGLE_DOG },
          },
          { x: 8, y: 0, z: 0 },
        ),
        createBlock("illusion-cover", GUARD_DOG, undefined, {
          x: 8,
          y: 0,
          z: 1,
        }),
      ]),
    );

    expect(session.getState().selectableBlockIds).toEqual([
      "freeze-cover",
      "illusion-cover",
    ]);
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

    expect(torch.getState().items[0]).toMatchObject({
      available: false,
      remainingUses: 1,
    });
    expect(detector.getState().items[0]).toMatchObject({
      available: false,
      remainingUses: 1,
    });
    expect(torch.begin("torch")).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(detector.begin("detector")).toMatchObject({
      accepted: false,
      success: false,
    });
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
    expect(runtime.getState().items[0]).toMatchObject({
      remainingUses: 0,
      available: false,
    });
    expect(
      session.getState().remainingBlocks.find((block) => block.id === "freeze"),
    ).toHaveProperty("specialMechanism.type", DOG_FREEZE_MECHANISM_TYPE);

    runtime.completeAnimation();

    expect(runtime.getState().phase).toBe("idle");
    expect(
      session.getState().remainingBlocks.find((block) => block.id === "freeze"),
    ).not.toHaveProperty("specialMechanism");
  });
});
