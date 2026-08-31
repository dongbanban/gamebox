// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BLOCK_FLIGHT_DURATION_MS,
  DOG_DEMAGNETIZER_DURATION_MS,
  DOG_MAGNETIC_ATTRACTION_DURATION_MS,
  DOG_FREEZE_MELT_DURATION_MS,
  DOG_DETECTOR_REVEAL_DURATION_MS,
  DOG_TORCH_MELT_DURATION_MS,
  DOG_ILLUSION_REVEAL_DURATION_MS,
  DOG_TWIN_SPLIT_DURATION_MS,
} from "@/games/dog-lege-dog/assets/animation-effects";
import { getDogPatternAssetUrl } from "@/games/dog-lege-dog/assets/game-assets";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_PATTERN_TYPES,
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
  GameSession,
  LevelGenerator,
  createDogSpecialMechanism,
  getBlockCount,
  getDogLogicalBlockCount,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
  getDogSpecialMechanismComposition,
  getDogSpecialMechanismConfigs,
  validateDogSpecialMechanismComposition,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
  type DogTrayBlock,
  startDogLegeDogGame,
} from "@/games/dog-lege-dog";
import { TEST_LEVEL, TEST_PATTERN_TYPES } from "../support/dog-level-fixture";
import { createDogSpecialMechanismHandlerMap } from "@/games/dog-lege-dog/game/special-mechanisms";
import {
  applyDogTraySuccessfulTripleEffects,
  resolveDogTrayMatches,
} from "@/games/dog-lege-dog/levels/level-rules";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";

describe("特殊机制测试 · core", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("按 v13 逻辑预算解析四种机制的固定数量", () => {
    for (const levelNumber of [1, 5, 6, 15, 16, 30, 31, 99]) {
      const plan = getDogV13MechanismPlan(getDogV13LogicalBlockCount(levelNumber));
      const configs = getDogSpecialMechanismConfigs(levelNumber);
      expect(configs.map(({ type, min, max }) => [type, min, max])).toEqual([
        ["freeze", plan.counts.freeze, plan.counts.freeze],
        ["illusion", plan.counts.illusion, plan.counts.illusion],
        ["magnetic", plan.counts.magnetic, plan.counts.magnetic],
        ["twin", plan.counts.twin, plan.counts.twin],
      ]);
    }

    expect(getDogSpecialMechanismConfigs(16).find(({ type }) => type === "twin"))
      .toMatchObject({ densityWeight: 2 });
  });

  it("冻结方块进入暂存槽后不参与三消，并记录后续三消进度", () => {
    const freezeBlock = createBlock("freeze", 0, 0, WORKING_DOG, {
      type: DOG_FREEZE_MECHANISM_TYPE,
      state: { status: "frozen", completedTriples: 0 },
    });
    const session = new GameSession(
      createLevel([
        freezeBlock,
        createBlock("working-1", 4, 0, WORKING_DOG),
        createBlock("working-2", 8, 0, WORKING_DOG),
        createBlock("working-3", 12, 0, WORKING_DOG),
        createBlock("single-1", 16, 0, SINGLE_DOG),
        createBlock("single-2", 20, 0, SINGLE_DOG),
        createBlock("single-3", 24, 0, SINGLE_DOG),
        createBlock("licking-1", 28, 0, LICKING_DOG),
        createBlock("licking-2", 32, 0, LICKING_DOG),
        createBlock("licking-3", 36, 0, LICKING_DOG),
        createBlock("working-4", 40, 0, WORKING_DOG),
        createBlock("working-5", 44, 0, WORKING_DOG),
      ]),
    );

    session.selectBlock("freeze");
    session.selectBlock("working-1");
    const beforeMatch = session.selectBlock("working-2");

    expect(beforeMatch.removedCount).toBe(0);
    expect(beforeMatch.snapshot.tray).toEqual([WORKING_DOG, WORKING_DOG, WORKING_DOG]);
    expect(beforeMatch.snapshot.trayBlocks[0]?.specialMechanism?.type).toBe(
      DOG_FREEZE_MECHANISM_TYPE,
    );

    const samePatternTriple = session.selectBlock("working-3");
    expect(samePatternTriple.removedCount).toBe(3);
    expect(samePatternTriple.snapshot.trayBlocks[0]?.specialMechanism?.state.completedTriples).toBe(1);

    const firstTriple = selectAll(session, ["single-1", "single-2", "single-3"]);
    expect(firstTriple.meltedBlockIds).toEqual(["freeze"]);
    expect(firstTriple.snapshot.trayBlocks[0]).not.toHaveProperty("specialMechanism");

    const secondTriple = selectAll(session, ["licking-1", "licking-2", "licking-3"]);
    expect(secondTriple.removedCount).toBe(3);
    expect(secondTriple.meltedBlockIds).toEqual([]);
    expect(secondTriple.snapshot.tray).toEqual([WORKING_DOG]);

    const finalTriple = selectAll(session, ["working-4", "working-5"]);
    expect(finalTriple.removedCount).toBe(3);
    expect(finalTriple.snapshot.tray).toEqual([]);
    expect(finalTriple.snapshot.status).toBe("won");
  });

  it("同图案普通三消也计入冻结方块融化次数", () => {
    const tray = [
      createTrayBlock("freeze", WORKING_DOG, {
        type: DOG_FREEZE_MECHANISM_TYPE,
        state: { status: "frozen", completedTriples: 1 },
      }),
    ];

    const meltedBlockIds = applyDogTraySuccessfulTripleEffects(
      tray,
      createDogSpecialMechanismHandlerMap(),
      1,
      [WORKING_DOG],
    );

    expect(meltedBlockIds).toEqual(["freeze"]);
    expect(tray[0]).not.toHaveProperty("specialMechanism");
  });

  it("规则 seam 允许终局完整三消组直接移除冻结方块", () => {
    const handlers = createDogSpecialMechanismHandlerMap();
    const tray = [
      createTrayBlock("freeze", WORKING_DOG, {
        type: DOG_FREEZE_MECHANISM_TYPE,
        state: { status: "frozen", completedTriples: 0 },
      }),
      createTrayBlock("working-1", WORKING_DOG),
      createTrayBlock("working-2", WORKING_DOG),
    ];

    const resolution = resolveDogTrayMatches(tray, handlers, {
      allowFrozenFinalTriple: true,
    });

    expect(resolution).toMatchObject({ removedCount: 3, tripleCount: 1 });
    expect(resolution.meltedBlockIds).toEqual([]);
    expect(tray).toEqual([]);
  });

  it("终局三消也不跨非相邻方块移除冻结方块", () => {
    const handlers = createDogSpecialMechanismHandlerMap();
    const tray = [
      createTrayBlock("freeze", WORKING_DOG, {
        type: DOG_FREEZE_MECHANISM_TYPE,
        state: { status: "frozen", completedTriples: 0 },
      }),
      createTrayBlock("single", SINGLE_DOG),
      createTrayBlock("working-1", WORKING_DOG),
    ];

    const resolution = resolveDogTrayMatches(tray, handlers, {
      allowFrozenFinalTriple: true,
    });

    expect(resolution).toMatchObject({ removedCount: 0, tripleCount: 0 });
    expect(tray.map((block) => block.id)).toEqual(["freeze", "single", "working-1"]);
  });

  it("终局结算先移除包含冻结方块的合法相邻三连", () => {
    const handlers = createDogSpecialMechanismHandlerMap();
    const tray = [
      createTrayBlock("freeze", WORKING_DOG, {
        type: DOG_FREEZE_MECHANISM_TYPE,
        state: { status: "frozen", completedTriples: 0 },
      }),
      createTrayBlock("working-1", WORKING_DOG),
      createTrayBlock("working-2", WORKING_DOG),
      createTrayBlock("single", SINGLE_DOG),
    ];

    const resolution = resolveDogTrayMatches(tray, handlers, {
      allowFrozenFinalTriple: true,
    });

    expect(resolution).toMatchObject({ removedCount: 3, tripleCount: 1 });
    expect(tray.map((block) => block.id)).toEqual(["single"]);
  });

  it("终局冻结三消允许先消除其他组再级联覆盖全部相邻方块", () => {
    const handlers = createDogSpecialMechanismHandlerMap();
    const tray = [
      createTrayBlock("freeze", WORKING_DOG, {
        type: DOG_FREEZE_MECHANISM_TYPE,
        state: { status: "frozen", completedTriples: 0 },
      }),
      createTrayBlock("working-1", WORKING_DOG),
      createTrayBlock("single-1", SINGLE_DOG),
      createTrayBlock("single-2", SINGLE_DOG),
      createTrayBlock("single-3", SINGLE_DOG),
      createTrayBlock("working-2", WORKING_DOG),
    ];

    const resolution = resolveDogTrayMatches(tray, handlers, {
      allowFrozenFinalTriple: true,
    });

    expect(resolution).toMatchObject({ removedCount: 6, tripleCount: 2 });
    expect(tray).toEqual([]);
  });

  it("同次多个其他图案三消只让冻结方块累计对应成功组三消", () => {
    const tray = [
      createTrayBlock("freeze", LICKING_DOG, {
        type: DOG_FREEZE_MECHANISM_TYPE,
        state: { status: "frozen", completedTriples: 0 },
      }),
      createTrayBlock("working-1", WORKING_DOG),
      createTrayBlock("working-2", WORKING_DOG),
      createTrayBlock("working-3", WORKING_DOG),
      createTrayBlock("single-1", SINGLE_DOG),
      createTrayBlock("single-2", SINGLE_DOG),
      createTrayBlock("single-3", SINGLE_DOG),
    ];

    const resolution = resolveDogTrayMatches(
      tray,
      createDogSpecialMechanismHandlerMap(),
    );

    expect(resolution).toMatchObject({ removedCount: 6, tripleCount: 2 });
    expect(tray).toHaveLength(1);
    expect(tray[0]).toMatchObject({ id: "freeze", patternType: LICKING_DOG });
    expect(tray[0]).not.toHaveProperty("specialMechanism");
    expect(tray[0]?.id).toBe("freeze");
  });

  it("冻结方块第二组其他图案三消融化后立即重新检查同图案三消", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("other-1", 0, 0, SINGLE_DOG),
        createBlock("other-2", 4, 0, SINGLE_DOG),
        createBlock("other-3", 8, 0, SINGLE_DOG),
        createBlock("remaining", 12, 0, LICKING_DOG),
      ]),
      initialTrayBlocks: [
        createTrayBlock("freeze", WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 1 },
        }),
        createTrayBlock("working-1", WORKING_DOG),
        createTrayBlock("working-2", WORKING_DOG),
      ],
    });

    const result = selectAll(session, ["other-1", "other-2", "other-3"]);

    expect(result.removedCount).toBe(6);
    expect(result.tripleCount).toBe(2);
    expect(result.meltedBlockIds).toEqual(["freeze"]);
    expect(result.snapshot.tray).toEqual([]);
    expect(result.snapshot.status).toBe("playing");
  });

  it("活动游戏终局三消包含冻结方块时直接通关并完成反馈", async () => {
    vi.useFakeTimers();
    const level = createLevel([
      createBlock("freeze", 0, 0, WORKING_DOG, {
        type: DOG_FREEZE_MECHANISM_TYPE,
        state: { status: "frozen", completedTriples: 0 },
      }),
      createBlock("working-1", 4, 0, WORKING_DOG),
      createBlock("working-2", 8, 0, WORKING_DOG),
    ]);
    const root = document.createElement("div");
    const results: string[] = [];
    const game = startDogLegeDogGame(root, {
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
      onResult: (result) => results.push(result.status),
      level,
    });

    for (const blockId of ["freeze", "working-1", "working-2"]) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }

    expect(game.getState().session.status).toBe("won");
    expect(game.getState().session.trayBlocks).toEqual([]);
    expect(root.querySelector('[data-testid="dog-status"]')?.textContent).toContain("通关");
    expect(results).toEqual(["won"]);
    game.destroy();
  });
});

function selectAll(session: GameSession, blockIds: readonly string[]) {
  let result;
  for (const blockId of blockIds) {
    result = session.selectBlock(blockId);
  }
  if (result === undefined) {
    throw new Error("Expected at least one block to select");
  }
  return result;
}

function createLevel(blocks: readonly DogBlock[]): DogLegeDogLevel {
  return {
    ...TEST_LEVEL,
    patternTypes: TEST_PATTERN_TYPES,
    blocks,
  };
}

function createBlock(
  id: string,
  x: number,
  y: number,
  patternType: DogPatternType,
  specialMechanism?: DogBlock["specialMechanism"],
): DogBlock {
  return {
    id,
    x,
    y,
    z: 0,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    rotation: 0,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}

function createTrayBlock(
  id: string,
  patternType: DogPatternType,
  specialMechanism?: DogTrayBlock["specialMechanism"],
): DogTrayBlock {
  return {
    id,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}
