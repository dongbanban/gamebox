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

describe("特殊机制测试 · selection-runtime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("幻化方块直接进入暂存槽时揭示真实图案并按真实图案三消", () => {
    const illusionBlock = createBlock("illusion", 0, 0, WORKING_DOG, {
      type: DOG_ILLUSION_MECHANISM_TYPE,
      state: { status: "masked", disguisedPatternType: SINGLE_DOG },
    });
    const session = new GameSession(
      createLevel([
        illusionBlock,
        createBlock("working-1", 4, 0, WORKING_DOG),
        createBlock("working-2", 8, 0, WORKING_DOG),
        createBlock("remaining", 12, 0, LICKING_DOG),
      ]),
    );

    const firstSelection = session.selectBlock("illusion");
    expect(firstSelection.selected).toBe(true);
    expect(firstSelection.snapshot.trayBlocks[0]).toMatchObject({
      id: "illusion",
      patternType: WORKING_DOG,
    });
    expect(firstSelection.snapshot.trayBlocks[0]).not.toHaveProperty("specialMechanism");

    session.selectBlock("working-1");
    const triple = session.selectBlock("working-2");

    expect(triple.removedCount).toBe(3);
    expect(triple.snapshot.tray).toEqual([]);
  });

  it("特殊方块入槽追加并保持点击相对顺序", () => {
    const session = new GameSession(
      createLevel([
        createBlock("freeze", 0, 0, WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }),
        createBlock("illusion", 4, 0, SINGLE_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: LICKING_DOG },
        }),
        createBlock("ordinary", 8, 0, LICKING_DOG),
      ]),
    );

    session.selectBlock("freeze");
    session.selectBlock("illusion");
    const state = session.selectBlock("ordinary");

    expect(state.trayBlocks.map((block) => block.id)).toEqual([
      "freeze",
      "illusion",
      "ordinary",
    ]);
    expect(state.trayBlocks[1]).not.toHaveProperty("specialMechanism");
  });

  it("双生方块占一个棋盘对象，入槽后分裂为相邻的两个普通方块", () => {
    const session = new GameSession(
      createLevel([
        createBlock("twin", 0, 0, WORKING_DOG, {
          type: DOG_TWIN_MECHANISM_TYPE,
          state: { status: "twin" },
        }),
        createBlock("working-3", 4, 0, WORKING_DOG),
      ]),
    );

    expect(session.getState().remainingBlocks).toHaveLength(2);
    expect(session.getState().remainingLogicalUnitCount).toBe(3);
    expect(session.getState().selectableBlockIds).toContain("twin");

    const split = session.selectBlock("twin");

    expect(split.selected).toBe(true);
    expect(split.snapshot.trayBlocks.map((block) => block.id)).toEqual([
      "twin-1",
      "twin-2",
    ]);
    expect(split.snapshot.trayBlocks.map((block) => block.patternType)).toEqual([
      WORKING_DOG,
      WORKING_DOG,
    ]);
    expect(split.snapshot.trayLogicalUnitCount).toBe(2);
    expect(split.snapshot.remainingLogicalUnitCount).toBe(1);
    expect(split.snapshot.trayBlocks.every((block) => block.specialMechanism === undefined)).toBe(
      true,
    );

    const triple = session.selectBlock("working-3");
    expect(triple.removedCount).toBe(3);
    expect(triple.snapshot.trayBlocks).toEqual([]);
    expect(triple.snapshot.status).toBe("won");
  });

  it("双生分裂不因空闲槽少于两个而提前禁用，最终超容量按操作失败", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("twin", 0, 0, WORKING_DOG, {
          type: DOG_TWIN_MECHANISM_TYPE,
          state: { status: "twin" },
        }),
      ]),
      initialTray: [
        WORKING_DOG,
        SINGLE_DOG,
        LICKING_DOG,
        "看门狗",
        WORKING_DOG,
        SINGLE_DOG,
      ],
    });

    expect(session.getState().tray).toHaveLength(6);
    expect(session.canSelectBlock("twin")).toBe(true);

    const result = session.selectBlock("twin");

    expect(result.selected).toBe(true);
    expect(result.snapshot.trayBlocks.map((block) => block.id)).toEqual([
      "initial-tray-1",
      "initial-tray-2",
      "initial-tray-3",
      "initial-tray-4",
      "initial-tray-5",
      "initial-tray-6",
      "twin-1",
      "twin-2",
    ]);
    expect(result.snapshot.status).toBe("lost");
  });

  it("磁吸先入槽，再优先吸取可点击的不同真实图案方块并保留目标机制", () => {
    const source = {
      ...createBlock("magnetic", 0, 0, WORKING_DOG, {
        type: DOG_MAGNETIC_MECHANISM_TYPE,
        state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
      }),
      z: 1,
    };
    const target = createBlock("clickable-freeze", 0, 0, SINGLE_DOG, {
      type: DOG_FREEZE_MECHANISM_TYPE,
      state: { status: "frozen", completedTriples: 0 },
    });
    const blocked = {
      ...createBlock("blocked-target", 4, 0, LICKING_DOG),
      z: 0,
    };
    const cover = {
      ...createBlock("same-pattern-cover", 4, 0, WORKING_DOG),
      z: 1,
    };
    const session = new GameSession(
      createLevel([source, target, blocked, cover]),
    );

    const result = session.selectBlock(source.id);

    expect(result.selected).toBe(true);
    expect(result.magneticResolution).toEqual({
      sourceBlockId: source.id,
      targetBlockId: target.id,
      targetTrayBlockIds: [target.id],
    });
    expect(result.snapshot.trayBlocks.map((block) => block.id)).toEqual([
      source.id,
      target.id,
    ]);
    expect(result.snapshot.trayBlocks[0]).not.toHaveProperty("specialMechanism");
    expect(result.snapshot.trayBlocks[1]).toHaveProperty(
      "specialMechanism.type",
      DOG_FREEZE_MECHANISM_TYPE,
    );
    expect(result.snapshot.remainingBlocks.map((block) => block.id)).toEqual([
      blocked.id,
      cover.id,
    ]);
  });

  it("磁吸目标入槽与统一三消分阶段，结算前不判失败", () => {
    const source = createBlock("magnetic", 0, 0, WORKING_DOG, {
      type: DOG_MAGNETIC_MECHANISM_TYPE,
      state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
    });
    const target = createBlock("freeze-target", 4, 0, SINGLE_DOG, {
      type: DOG_FREEZE_MECHANISM_TYPE,
      state: { status: "frozen", completedTriples: 0 },
    });
    const session = new GameSession({
      level: createLevel([source, target, createBlock("remaining", 8, 0, LICKING_DOG)]),
      initialTray: [WORKING_DOG, WORKING_DOG],
    });

    const pending = session.beginBlockSelection(source.id);
    expect(pending.magneticResolution?.targetBlockId).toBe(target.id);

    const entered = session.completeMagneticEntry();

    expect(entered).toMatchObject({
      sourceBlockId: source.id,
      targetBlockId: target.id,
      targetTrayBlockIds: [target.id],
    });
    expect(session.getState().status).toBe("playing");
    expect(session.getState().trayBlocks.map((block) => block.id)).toEqual([
      "initial-tray-1",
      "initial-tray-2",
      source.id,
      target.id,
    ]);
    expect(session.canSelectBlock("remaining")).toBe(false);

    const resolved = session.resolveMagneticEntry();

    expect(resolved.removedCount).toBe(3);
    expect(resolved.snapshot.trayBlocks.map((block) => block.id)).toEqual([target.id]);
    expect(resolved.snapshot.status).toBe("playing");
  });

  it("磁吸没有可点击候选时回退到不可点击方块，双生目标沿用分裂规则", () => {
    const source = createBlock("magnetic", 0, 0, WORKING_DOG, {
      type: DOG_MAGNETIC_MECHANISM_TYPE,
      state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
    });
    const target = {
      ...createBlock("blocked-twin", 4, 0, SINGLE_DOG, {
        type: DOG_TWIN_MECHANISM_TYPE,
        state: { status: DOG_TWIN_MECHANISM_TYPE },
      }),
      z: 0,
    };
    const cover = {
      ...createBlock("cover", 4, 0, WORKING_DOG),
      z: 1,
    };
    const session = new GameSession(createLevel([source, target, cover]));

    const result = session.selectBlock(source.id);

    expect(result.magneticResolution).toEqual({
      sourceBlockId: source.id,
      targetBlockId: target.id,
      targetTrayBlockIds: [`${target.id}-1`, `${target.id}-2`],
    });
    expect(result.snapshot.trayBlocks.map((block) => block.id)).toEqual([
      source.id,
      `${target.id}-1`,
      `${target.id}-2`,
    ]);
    expect(result.snapshot.trayBlocks.every((block) => block.specialMechanism === undefined)).toBe(
      true,
    );
  });

  it("磁吸排除同图案与其他磁吸方块，没有合法目标时独自普通入槽", () => {
    const source = createBlock("magnetic", 0, 0, WORKING_DOG, {
      type: DOG_MAGNETIC_MECHANISM_TYPE,
      state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
    });
    const samePattern = createBlock("same-pattern", 4, 0, WORKING_DOG);
    const otherMagnetic = createBlock("other-magnetic", 8, 0, SINGLE_DOG, {
      type: DOG_MAGNETIC_MECHANISM_TYPE,
      state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
    });
    const session = new GameSession(createLevel([source, samePattern, otherMagnetic]));

    const result = session.selectBlock(source.id);

    expect(result.magneticResolution).toEqual({
      sourceBlockId: source.id,
      targetBlockId: null,
      targetTrayBlockIds: [],
    });
    expect(result.snapshot.trayBlocks.map((block) => block.id)).toEqual([source.id]);
    expect(result.snapshot.trayBlocks[0]).not.toHaveProperty("specialMechanism");
    expect(result.snapshot.remainingBlocks.map((block) => block.id)).toEqual([
      samePattern.id,
      otherMagnetic.id,
    ]);
  });

  it("磁吸同 seed 与操作路径复现目标，不用有利目标替换失败结果", () => {
    const createMagneticLevel = (runSeed: string): DogLegeDogLevel => ({
      ...createLevel([
        createBlock("magnetic", 0, 0, WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("target-a", 4, 0, SINGLE_DOG),
        createBlock("target-b", 8, 0, LICKING_DOG),
      ]),
      runSeed,
    });

    const first = new GameSession(createMagneticLevel("magnetic-replay-seed"));
    const repeated = new GameSession(createMagneticLevel("magnetic-replay-seed"));
    const firstResult = first.selectBlock("magnetic");
    const repeatedResult = repeated.selectBlock("magnetic");

    expect(repeatedResult.magneticResolution).toEqual(firstResult.magneticResolution);
    expect(repeatedResult.snapshot.trayBlocks).toEqual(firstResult.snapshot.trayBlocks);

    const createMultiMagneticLevel = (runSeed: string): DogLegeDogLevel => ({
      ...createLevel([
        createBlock("magnetic-1", 0, 0, WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("magnetic-2", 4, 0, SINGLE_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("target-a", 8, 0, LICKING_DOG),
        createBlock("target-b", 12, 0, "看门狗"),
      ]),
      runSeed,
    });
    const firstPathSession = new GameSession(createMultiMagneticLevel("magnetic-path-seed"));
    const repeatedPathSession = new GameSession(createMultiMagneticLevel("magnetic-path-seed"));
    const firstPath = [
      firstPathSession.selectBlock("magnetic-1"),
      firstPathSession.selectBlock("magnetic-2"),
    ];
    const repeatedPath = [
      repeatedPathSession.selectBlock("magnetic-1"),
      repeatedPathSession.selectBlock("magnetic-2"),
    ];

    expect(repeatedPath.map(({ magneticResolution }) => magneticResolution)).toEqual(
      firstPath.map(({ magneticResolution }) => magneticResolution),
    );
    expect(repeatedPathSession.getState().trayBlocks).toEqual(firstPathSession.getState().trayBlocks);

    const failureSession = new GameSession({
      level: createMagneticLevel("magnetic-failure-seed"),
      initialTray: [
        WORKING_DOG,
        SINGLE_DOG,
        LICKING_DOG,
        "看门狗",
        "疯狗",
        "拆家狗",
      ],
    });
    const failure = failureSession.selectBlock("magnetic");
    expect(failure.selected).toBe(true);
    expect(failure.snapshot.status).toBe("lost");
    expect(failure.snapshot.trayLogicalUnitCount).toBeGreaterThan(7);
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
