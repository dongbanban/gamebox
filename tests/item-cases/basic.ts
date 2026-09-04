import { describe, expect, it } from "vitest";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  getDogV13ItemUses,
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

describe("DogItemRuntime · basic", () => {
  it("v13 非钥匙道具每关只有一次，不读取机制数量或权重 bonus", () => {
    const level = {
      ...TEST_LEVEL,
      number: 1,
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
      specialMechanisms: [
        { type: DOG_FREEZE_MECHANISM_TYPE, min: 3, max: 4 },
        { type: DOG_ILLUSION_MECHANISM_TYPE, min: 3, max: 5 },
        { type: DOG_MAGNETIC_MECHANISM_TYPE, min: 3, max: 5, densityWeight: 2 },
      ],
    } satisfies DogLegeDogLevel;

    const nonKeyItemIds = DOG_ITEM_IDS.filter((itemId) => itemId !== "key");
    expect(nonKeyItemIds.every((itemId) => getDogV13ItemUses(itemId) === 1)).toBe(true);
    expect(getDogV13ItemUses("key")).toBe(0);

    const session = new GameSession(level);
    const runtime = new DogItemRuntime({
      level,
      session,
      loadout: DOG_ITEM_IDS,
    });
    expect(runtime.getState().items).toEqual(
      expect.arrayContaining(
        nonKeyItemIds.map((id) => expect.objectContaining({ id, remainingUses: 1 })),
      ),
    );
  });

  it("钥匙可加入道具组但初始次数为零且没有锁槽时不可用", () => {
    const level = createLevel([createBlock("remaining", WORKING_DOG)]);
    const session = new GameSession(level);
    const runtime = new DogItemRuntime({
      level,
      session,
      loadout: ["key", "demagnetizer"],
    });

    expect(runtime.getState().items).toEqual([
      expect.objectContaining({
        id: "key",
        remainingUses: 0,
        available: false,
      }),
      expect.objectContaining({
        id: "demagnetizer",
        remainingUses: 1,
        available: false,
      }),
    ]);
    expect(runtime.begin("key")).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(runtime.begin("demagnetizer")).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(session.getState().trayBlocks).toEqual([]);
  });

  it("钥匙在合格三消后按独立随机流掉落并逐格解锁", () => {
    const level = {
      ...createLevel([
        createBlock("working-1", WORKING_DOG),
        createBlock("working-2", WORKING_DOG, undefined, { x: 4 }),
        createBlock("working-3", WORKING_DOG, undefined, { x: 8 }),
        ...Array.from({ length: 6 }, (_, index) =>
          createBlock(`remaining-${index + 1}`, SINGLE_DOG, undefined, { x: 12 + index * 4 }),
        ),
      ]),
      runSeed: "key-drop-seed-0",
      lockedTraySlotCount: 2,
    } satisfies DogLegeDogLevel;
    const session = new GameSession(level);
    const runtime = new DogItemRuntime({
      level,
      session,
      loadout: ["key", "torch", "detector"],
    });

    expect(runtime.getState().items.find((item) => item.id === "key")).toMatchObject({
      remainingUses: 0,
      available: false,
    });
    session.selectBlock("working-1");
    session.selectBlock("working-2");
    const triple = session.selectBlock("working-3");

    expect(triple.tripleCount).toBe(1);
    expect(runtime.settleSuccessfulTriples(triple.tripleCount)).toMatchObject({
      dropped: true,
      remainingUses: 1,
    });
    expect(runtime.getState().items.find((item) => item.id === "key")).toMatchObject({
      remainingUses: 1,
      available: true,
    });

    const unlock = runtime.begin("key");
    expect(unlock).toMatchObject({
      accepted: true,
      success: true,
      effect: { type: "unlock", unlockedSlotIndex: 5 },
    });
    expect(session.getState()).toMatchObject({
      effectiveTrayCapacity: 6,
      lockedTraySlotCount: 1,
    });
    runtime.completeAnimation();
    expect(runtime.getState().items.find((item) => item.id === "key")).toMatchObject({
      remainingUses: 0,
      available: false,
    });
  });

  it("终局三消与低空槽局面跳过钥匙掉落", () => {
    const createKeyRuntime = (remainingCount: number, runSeed: string) => {
      const blocks: DogBlock[] = [
        createBlock("working-1", WORKING_DOG),
        createBlock("working-2", WORKING_DOG, undefined, { x: 4 }),
        createBlock("working-3", WORKING_DOG, undefined, { x: 8 }),
        ...Array.from({ length: remainingCount }, (_, index) =>
          createBlock(`remaining-${index + 1}`, SINGLE_DOG, undefined, { x: 12 + index * 4 }),
        ),
      ];
      const level = {
        ...createLevel(blocks),
        runSeed,
        lockedTraySlotCount: 2,
      } satisfies DogLegeDogLevel;
      const session = new GameSession(level);
      const runtime = new DogItemRuntime({
        level,
        session,
        loadout: ["key", "torch", "detector"],
      });
      session.selectBlock("working-1");
      session.selectBlock("working-2");
      const triple = session.selectBlock("working-3");
      return { runtime, triple };
    };

    const terminal = createKeyRuntime(0, "key-drop-seed-0");
    expect(terminal.triple.snapshot.status).toBe("won");
    expect(terminal.runtime.settleSuccessfulTriples(terminal.triple.tripleCount).dropped).toBe(false);

    const lowPressure = createKeyRuntime(2, "key-drop-seed-0");
    expect(lowPressure.triple.snapshot.remainingLogicalUnitCount).toBe(2);
    expect(lowPressure.runtime.settleSuccessfulTriples(lowPressure.triple.tripleCount).dropped).toBe(
      false,
    );
    expect(lowPressure.runtime.settleSuccessfulTriples(0.5).dropped).toBe(false);
  });

  it("钥匙掉落判定不会推进磁吸目标随机流", () => {
    const level = {
      ...createLevel([
        createBlock("magnetic", WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        ...Array.from({ length: 6 }, (_, index) =>
          createBlock(`candidate-${index + 1}`, SINGLE_DOG, undefined, { x: 4 + index * 4 }),
        ),
      ]),
      runSeed: "independent-rng-seed",
      lockedTraySlotCount: 2,
    } satisfies DogLegeDogLevel;
    const withKeyDrop = new GameSession(level);
    const withoutKeyDrop = new GameSession(level);
    const runtime = new DogItemRuntime({
      level,
      session: withKeyDrop,
      loadout: ["key", "torch", "detector"],
    });

    expect(runtime.settleSuccessfulTriples(1).snapshot.remainingLogicalUnitCount).toBe(7);
    expect(withKeyDrop.beginBlockSelection("magnetic").magneticResolution?.targetBlockId).toBe(
      withoutKeyDrop.beginBlockSelection("magnetic").magneticResolution?.targetBlockId,
    );
  });

  it("消磁仪只暴露可点击磁吸方块，取消和无效目标不改局面，成功后原位去磁", () => {
    const magneticMechanism = {
      type: DOG_MAGNETIC_MECHANISM_TYPE,
      state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
    } as const;
    const level = createLevel([
      createBlock("magnetic-clickable", WORKING_DOG, magneticMechanism),
      createBlock("magnetic-blocked", SINGLE_DOG, magneticMechanism, { x: 8 }),
      createBlock("magnetic-cover", LICKING_DOG, undefined, { x: 8, z: 1 }),
      createBlock("freeze", GUARD_DOG, {
        type: DOG_FREEZE_MECHANISM_TYPE,
        state: { status: "frozen", completedTriples: 0 },
      }, { x: 16 }),
      createBlock("ordinary", "疯狗", undefined, { x: 24 }),
    ]);
    const session = new GameSession({
      level,
      initialTrayBlocks: [{ id: "tray-target", patternType: "拆家狗" }],
    });
    const runtime = new DogItemRuntime({
      level,
      session,
      loadout: ["demagnetizer"],
    });
    const initial = session.getState();

    expect(runtime.getState()).toMatchObject({
      phase: "idle",
      demagnetizerTargetBlockIds: [],
      items: [expect.objectContaining({ available: true, remainingUses: 1 })],
    });

    expect(runtime.begin("demagnetizer")).toMatchObject({
      accepted: true,
      success: false,
      requiresTarget: true,
    });
    expect(runtime.getState()).toMatchObject({
      phase: "targeting",
      demagnetizerTargetBlockIds: ["magnetic-clickable"],
    });

    for (const invalidTarget of [
      { type: "block", blockId: "ordinary" },
      { type: "block", blockId: "magnetic-blocked" },
      { type: "block", blockId: "freeze" },
      { type: "tray-block", blockId: "tray-target" },
    ] as const) {
      expect(runtime.confirmTarget(invalidTarget)).toMatchObject({
        accepted: false,
        success: false,
        requiresTarget: true,
      });
      expect(session.getState()).toEqual(initial);
      expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    }

    runtime.cancel();
    expect(runtime.getState()).toMatchObject({ phase: "idle" });
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(session.getState()).toEqual(initial);

    runtime.begin("demagnetizer");
    const action = runtime.confirmTarget({
      type: "block",
      blockId: "magnetic-clickable",
    });
    expect(action).toMatchObject({
      accepted: true,
      success: true,
      itemId: "demagnetizer",
      effect: { type: "demagnetize", blockId: "magnetic-clickable" },
    });
    expect(runtime.getState()).toMatchObject({
      phase: "animating",
      demagnetizerTargetBlockIds: [],
      items: [expect.objectContaining({ remainingUses: 0, available: false })],
    });
    expect(session.getState()).toEqual(initial);

    runtime.completeAnimation();

    const completed = session.getState();
    const demagnetized = completed.remainingBlocks.find(
      (block) => block.id === "magnetic-clickable",
    );
    expect(demagnetized).toMatchObject({
      id: "magnetic-clickable",
      x: 0,
      y: 0,
      z: 0,
      patternType: WORKING_DOG,
    });
    expect(demagnetized?.specialMechanism).toBeUndefined();
    expect(completed.selectableBlockIds).toContain("magnetic-clickable");
    expect(completed.trayBlocks).toEqual(initial.trayBlocks);
    expect(runtime.begin("demagnetizer")).toMatchObject({
      accepted: false,
      success: false,
    });
  });

  it("消磁仪没有可点击磁吸目标时不可用且不扣次数", () => {
    const level = createLevel([
      createBlock("magnetic-blocked", WORKING_DOG, {
        type: DOG_MAGNETIC_MECHANISM_TYPE,
        state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
      }),
      createBlock("cover", SINGLE_DOG, undefined, { z: 1 }),
    ]);
    const session = new GameSession(level);
    const runtime = new DogItemRuntime({
      level,
      session,
      loadout: ["demagnetizer"],
    });

    expect(runtime.getState().demagnetizerTargetBlockIds).toEqual([]);
    expect(runtime.getState().items[0]).toMatchObject({
      available: false,
      remainingUses: 1,
    });
    expect(runtime.begin("demagnetizer")).toMatchObject({
      accepted: false,
      success: false,
    });
    expect(runtime.getState().items[0]?.remainingUses).toBe(1);
    expect(session.getState().remainingBlocks.map((block) => block.id)).toEqual([
      "magnetic-blocked",
      "cover",
    ]);
  });

  it("容量提升无目标直执行，成功扣次并在动画完成后重新计算可用性", () => {
    const session = new GameSession(createLevel([createBlock("remaining", WORKING_DOG)]));
    const runtime = new DogItemRuntime({
      level: session.getState().level,
      session,
      loadout: ["tray-capacity"],
    });

    expect(runtime.getState().items[0]).toMatchObject({
      id: "tray-capacity",
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

});
