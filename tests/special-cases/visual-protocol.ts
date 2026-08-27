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

describe("特殊机制测试 · visual-protocol", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("幻化飞行期间只占用暂存槽，飞行完成后才执行三消", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("illusion", 0, 0, WORKING_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: SINGLE_DOG },
        }),
      ]),
      initialTray: [WORKING_DOG, WORKING_DOG],
    });

    const pending = session.beginBlockSelection("illusion");

    expect(pending.selected).toBe(true);
    expect(pending.snapshot.status).toBe("playing");
    expect(pending.snapshot.tray).toEqual([WORKING_DOG, WORKING_DOG, WORKING_DOG]);
    expect(pending.snapshot.trayBlocks[2]).toMatchObject({
      id: "illusion",
      patternType: WORKING_DOG,
      specialMechanism: {
        type: DOG_ILLUSION_MECHANISM_TYPE,
      },
    });

    const completed = session.completeBlockSelection();

    expect(completed.removedCount).toBe(3);
    expect(completed.snapshot.tray).toEqual([]);
    expect(completed.snapshot.status).toBe("won");
  });

  it("初始暂存槽不接受仍处于幻化状态的方块", () => {
    expect(
      () =>
        new GameSession({
          level: createLevel([createBlock("remaining", 0, 0, WORKING_DOG)]),
          initialTrayBlocks: [
            {
              id: "initial-illusion",
              patternType: WORKING_DOG,
              specialMechanism: {
                type: DOG_ILLUSION_MECHANISM_TYPE,
                state: { status: "masked", disguisedPatternType: SINGLE_DOG },
              },
            },
          ],
        }),
    ).toThrow("GameSession illusion blocks cannot start in the tray");
  });

  it("冻结方块棋盘与暂存槽状态带有特殊视觉协议", () => {
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed: "freeze-visual-seed",
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    const frozenBlock = root.querySelector<HTMLElement>(
      '[data-testid="dog-block"][data-special-mechanism="freeze"]',
    );
    expect(frozenBlock).not.toBeNull();
    expect(frozenBlock?.classList.contains("dog-block--special")).toBe(true);
    expect(frozenBlock?.classList.contains("dog-block--special-freeze")).toBe(true);
    expect(frozenBlock?.dataset.specialMechanismState).toBe("frozen");
    expect(frozenBlock?.dataset.specialMechanismProgress).toBe("0");

    game.destroy();
  });

  it("磁吸方块持续显示识别状态，并按指向、目标飞入、状态消耗顺序锁定输入", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const level = createLevel([
      createBlock("magnetic", 0, 0, WORKING_DOG, {
        type: DOG_MAGNETIC_MECHANISM_TYPE,
        state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
      }),
      createBlock("target", 4, 0, SINGLE_DOG, {
        type: DOG_FREEZE_MECHANISM_TYPE,
        state: { status: "frozen", completedTriples: 0 },
      }),
      createBlock("remaining", 8, 0, LICKING_DOG),
    ]);
    const game = startDogLegeDogGame(root, {
      level,
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    const boardMagnetic = root.querySelector<HTMLElement>(
      '[data-testid="dog-block"][data-block-id="magnetic"]',
    );
    expect(boardMagnetic?.classList.contains("dog-block--special-magnetic")).toBe(true);
    expect(boardMagnetic?.dataset.specialMechanismState).toBe(DOG_MAGNETIC_MECHANISM_TYPE);

    game.selectBlock("magnetic");

    expect(game.getState().inputLocked).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-testid="dog-flight"]')?.dataset.magneticFlight).toBe(
      "true",
    );
    expect(game.getState().session.remainingBlocks.map((block) => block.id)).toContain("target");
    expect(root.querySelector('[data-testid="dog-magnetic-effect"]')).toBeNull();

    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    await Promise.resolve();
    expect(root.querySelector<HTMLElement>('[data-testid="dog-magnetic-effect"]')?.dataset.sourceId).toBe(
      "magnetic",
    );
    expect(root.querySelector<HTMLElement>('[data-testid="dog-magnetic-effect"]')?.dataset.targetId).toBe(
      "target",
    );
    expect(game.getState().session.remainingBlocks.map((block) => block.id)).toContain("target");

    await vi.advanceTimersByTimeAsync(DOG_MAGNETIC_ATTRACTION_DURATION_MS);
    await Promise.resolve();
    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().session.remainingBlocks.map((block) => block.id)).toContain("target");
    expect(root.querySelector<HTMLElement>('[data-testid="dog-flight"]')?.dataset.patternType).toBe(
      SINGLE_DOG,
    );

    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    await vi.runAllTimersAsync();
    expect(game.getState().inputLocked).toBe(false);
    expect(game.getState().session.remainingBlocks.map((block) => block.id)).not.toContain("target");
    expect(root.querySelector('[data-testid="dog-magnetic-effect"]')).toBeNull();
    expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
      "magnetic",
      "target",
    ]);
    expect(game.getState().session.trayBlocks[0]).not.toHaveProperty("specialMechanism");
    expect(game.getState().session.trayBlocks[1]).toHaveProperty(
      "specialMechanism.type",
      DOG_FREEZE_MECHANISM_TYPE,
    );
    game.destroy();
  });

  it("磁吸吸入幻化目标后先揭示，再统一结算", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("magnetic", 0, 0, WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("illusion-target", 4, 0, SINGLE_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: LICKING_DOG },
        }),
        createBlock("remaining", 8, 0, WORKING_DOG),
      ]),
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    game.selectBlock("magnetic");
    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    await vi.advanceTimersByTimeAsync(DOG_MAGNETIC_ATTRACTION_DURATION_MS);
    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    await Promise.resolve();

    expect(game.getState().session.remainingBlocks.map((block) => block.id)).not.toContain(
      "illusion-target",
    );
    expect(
      root.querySelector<HTMLElement>(
        '[data-testid="dog-tray-slot"][data-block-id="illusion-target"][data-illusion-reveal="true"]',
      ),
    ).not.toBeNull();

    await vi.advanceTimersByTimeAsync(DOG_ILLUSION_REVEAL_DURATION_MS);
    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
      "magnetic",
      "illusion-target",
    ]);
    expect(game.getState().session.trayBlocks[1]).not.toHaveProperty("specialMechanism");
    game.destroy();
  });

  it("磁吸触发非终局三消后恢复输入", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("working-1", 0, 0, WORKING_DOG),
        createBlock("working-2", 4, 0, WORKING_DOG),
        createBlock("magnetic", 8, 0, WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("target", 12, 0, SINGLE_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }),
        createBlock("remaining", 16, 0, WORKING_DOG),
      ]),
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    for (const blockId of ["working-1", "working-2"]) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }
    game.selectBlock("magnetic");
    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    await vi.advanceTimersByTimeAsync(DOG_MAGNETIC_ATTRACTION_DURATION_MS);
    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(game.getState().session.status).toBe("playing");
    expect(game.getState().session.remainingBlocks.map((block) => block.id)).toEqual(["remaining"]);
    expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual(["target"]);
    game.destroy();
  });

  it("磁吸吸入双生目标后先分裂，再统一结算", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("magnetic", 0, 0, WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("twin-target", 4, 0, SINGLE_DOG, {
          type: DOG_TWIN_MECHANISM_TYPE,
          state: { status: DOG_TWIN_MECHANISM_TYPE },
        }),
        createBlock("remaining", 8, 0, WORKING_DOG),
      ]),
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    game.selectBlock("magnetic");
    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    await vi.advanceTimersByTimeAsync(DOG_MAGNETIC_ATTRACTION_DURATION_MS);
    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    await Promise.resolve();

    expect(root.querySelector<HTMLElement>('[data-testid="dog-twin-split-effect"]')?.dataset.twinSourceId)
      .toBe("twin-target");
    expect(root.querySelector<HTMLElement>('[data-testid="dog-twin-split-effect"]')?.dataset.twinBlockIds)
      .toBe("twin-target-1,twin-target-2");

    await vi.advanceTimersByTimeAsync(DOG_TWIN_SPLIT_DURATION_MS);
    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
      "magnetic",
      "twin-target-1",
      "twin-target-2",
    ]);
    game.destroy();
  });

  it("首关启动沿用生成器结果，不额外注入冻结方块", () => {
    const runSeed = "restore-first-level-freeze-preview";
    const generated = new LevelGenerator().generate({
      levelNumber: 1,
      runSeed,
    });
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed,
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    expect(game.getState().level.blocks).toEqual(generated.blocks);

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
