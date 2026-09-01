import { describe, expect, it } from "vitest";
import {
  DOG_V13_CONFIG,
  GameSession,
  createDogShuffleMechanism,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import {
  DogItemRuntime,
} from "@/games/dog-lege-dog/game/dog-item-runtime";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";
import { createBlock, createLevel } from "../support/item-fixtures";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";
const GUARD_DOG: DogPatternType = "看门狗";

describe("DogItemRuntime · restore-whistle", () => {
  it("仅在成功乱序后无目标直执行，恢复完整事务并消耗一次", () => {
    const { runtime, session } = createRestoreFixture([
      "restore-whistle",
      "key",
      "tray-capacity",
    ]);

    expect(runtime.getState().items[0]).toMatchObject({
      id: "restore-whistle",
      targetType: "none",
      remainingUses: 1,
      available: false,
    });
    expect(runtime.begin("restore-whistle")).toMatchObject({ accepted: false, success: false });

    triggerShuffle(session);
    const shuffled = session.getState();
    expect(runtime.settleSuccessfulTriples(
      session.getLastShuffleTransaction()?.replayEvent.secondaryTripleCount ?? 0,
    )).toMatchObject({ dropped: true, remainingUses: 1 });
    expect(runtime.getState().items[0]).toMatchObject({ available: true, remainingUses: 1 });

    expect(runtime.begin("restore-whistle")).toMatchObject({
      accepted: true,
      success: true,
      requiresTarget: false,
      effect: { type: "restore-shuffle" },
    });
    expect(runtime.getState().phase).toBe("animating");
    expect(session.getState()).toEqual(shuffled);

    runtime.completeAnimation();

    expect(session.getState().trayBlocks.map((block) => block.id)).toEqual([
      "frozen",
      "working-1",
      "single-1",
      "working-2",
      "licking-1",
      "shuffle",
    ]);
    expect(session.getState().trayBlocks.find((block) => block.id === "shuffle")?.specialMechanism)
      .toBeUndefined();
    expect(runtime.getState().items.find((item) => item.id === "key"))
      .toMatchObject({ remainingUses: 0 });
    expect(runtime.getState().items[0]).toMatchObject({ available: false, remainingUses: 0 });
    expect(runtime.begin("restore-whistle")).toMatchObject({ accepted: false, success: false });
  });

  it("下一次其他道具成功使用后快照失效且复原哨不扣次", () => {
    const { runtime, session } = createRestoreFixture(["restore-whistle", "torch", "key"]);
    triggerShuffle(session);
    expect(runtime.getState().items[0]?.available).toBe(true);

    expect(runtime.begin("torch")).toMatchObject({ accepted: true, requiresTarget: true });
    expect(runtime.confirmTarget({ type: "tray-block", blockId: "frozen" }))
      .toMatchObject({ accepted: true, success: true });
    runtime.completeAnimation();

    expect(session.canRestoreLastShuffle()).toBe(false);
    expect(runtime.getState().items[0]).toMatchObject({ available: false, remainingUses: 1 });
  });
});

function createRestoreFixture(loadout: readonly DogItemId[]) {
  const config = {
    ...DOG_V13_CONFIG,
    items: {
      ...DOG_V13_CONFIG.items,
      key: { ...DOG_V13_CONFIG.items.key, dropRate: 1 },
    },
  } satisfies typeof DOG_V13_CONFIG;
  const level = {
    ...createLevel([
      createBlock("working-1", WORKING_DOG),
      createBlock("single-1", SINGLE_DOG, undefined, { x: 4 }),
      createBlock("working-2", WORKING_DOG, undefined, { x: 8 }),
      createBlock("licking-1", LICKING_DOG, undefined, { x: 12 }),
      createBlock("shuffle", WORKING_DOG, createDogShuffleMechanism(), { x: 16 }),
      createBlock("single-2", SINGLE_DOG, undefined, { x: 20 }),
      createBlock("single-3", SINGLE_DOG, undefined, { x: 24 }),
      createBlock("licking-2", LICKING_DOG, undefined, { x: 28 }),
      createBlock("licking-3", LICKING_DOG, undefined, { x: 32 }),
      createBlock("guard-2", GUARD_DOG, undefined, { x: 36 }),
      createBlock("guard-3", GUARD_DOG, undefined, { x: 40 }),
    ]),
    runSeed: "secondary-0",
    lockedTraySlotCount: 1,
  } satisfies DogLegeDogLevel;
  const session = new GameSession({
    config,
    level,
    initialTrayCapacity: 8,
    initialTrayBlocks: [{
      id: "frozen",
      patternType: GUARD_DOG,
      specialMechanism: {
        type: "freeze",
        state: { status: "frozen", completedTriples: 0 },
      },
    }],
  });
  return {
    runtime: new DogItemRuntime({ config, level, session, loadout }),
    session,
  };
}

function triggerShuffle(session: GameSession): void {
  for (const blockId of ["working-1", "single-1", "working-2", "licking-1", "shuffle"]) {
    session.selectBlock(blockId);
  }
  expect(session.getLastShuffleTransaction()).not.toBeNull();
}
