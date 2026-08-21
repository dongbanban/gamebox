// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOCK_FLIGHT_DURATION_MS } from "@/games/dog-lege-dog/assets/animation-effects";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_PATTERN_TYPES,
  DOG_FREEZE_MECHANISM_TYPE,
  FIRST_LEVEL,
  GameSession,
  LEVEL_GENERATOR_VERSION,
  LevelGenerator,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
  startDogLegeDogGame,
} from "@/games/dog-lege-dog";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";

describe("狗了个狗特殊机制", () => {
  afterEach(() => {
    vi.useRealTimers();
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
    expect(samePatternTriple.snapshot.trayBlocks[0]?.specialMechanism?.state.completedTriples).toBe(0);

    const firstTriple = selectAll(session, ["single-1", "single-2", "single-3"]);
    expect(firstTriple.snapshot.trayBlocks[0]?.specialMechanism?.state.completedTriples).toBe(1);

    const secondTriple = selectAll(session, ["licking-1", "licking-2", "licking-3"]);
    expect(secondTriple.removedCount).toBe(3);
    expect(secondTriple.meltedBlockIds).toEqual(["freeze"]);
    expect(secondTriple.snapshot.tray).toEqual([WORKING_DOG]);

    const finalTriple = selectAll(session, ["working-4", "working-5"]);
    expect(finalTriple.removedCount).toBe(3);
    expect(finalTriple.snapshot.tray).toEqual([]);
    expect(finalTriple.snapshot.status).toBe("won");
  });

  it("生成器按关卡配置生成冻结机制，固定 runSeed 可完整复现", () => {
    const generator = new LevelGenerator();
    const request = {
      levelNumber: 1,
      runSeed: "freeze-replay-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    } as const;

    const first = generator.generate(request);
    const repeated = generator.generate(request);
    const different = generator.generate({
      ...request,
      runSeed: "freeze-replay-seed-other",
    });
    const frozen = first.blocks.filter(
      (block) => block.specialMechanism?.type === DOG_FREEZE_MECHANISM_TYPE,
    );
    const configured = first.specialMechanisms.find(
      (mechanism) => mechanism.type === DOG_FREEZE_MECHANISM_TYPE,
    );

    expect(configured).toEqual(
      expect.objectContaining({
        min: expect.any(Number),
        max: expect.any(Number),
      }),
    );
    expect(frozen.length).toBeGreaterThanOrEqual(configured?.min ?? 1);
    expect(frozen.length).toBeLessThanOrEqual(configured?.max ?? 0);
    expect(frozen.every((block) => block.specialMechanism?.state.status === "frozen")).toBe(true);
    expect(repeated).toEqual(first);
    expect(different).not.toEqual(first);
    expect(generator.findSolvability(first).status).toBe("solvable");
  });

  it("生成器按 runSeed 稳定生成幻化位置、真实图案与伪装图案", () => {
    const generator = new LevelGenerator();
    const request = {
      levelNumber: 1,
      runSeed: "illusion-replay-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    } as const;

    const first = generator.generate(request);
    const repeated = generator.generate(request);
    const different = generator.generate({
      ...request,
      runSeed: "illusion-replay-seed-other",
    });
    const illusions = first.blocks.filter(
      (block) => block.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE,
    );
    const configured = first.specialMechanisms.find(
      (mechanism) => mechanism.type === DOG_ILLUSION_MECHANISM_TYPE,
    );

    expect(illusions.length).toBeGreaterThanOrEqual(configured?.min ?? 1);
    expect(illusions.length).toBeLessThanOrEqual(configured?.max ?? 0);
    expect(
      illusions.every((block) => {
        const disguisedPatternType = block.specialMechanism?.state.disguisedPatternType;
        return (
          block.patternType !== disguisedPatternType &&
          typeof disguisedPatternType === "string" &&
          DOG_PATTERN_TYPES.includes(disguisedPatternType as DogPatternType)
        );
      }),
    ).toBe(true);
    expect(repeated).toEqual(first);
    expect(different).not.toEqual(first);
    expect(generator.findSolvability(first).status).toBe("solvable");
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

  it("首关启动沿用生成器结果，不额外注入冻结方块", () => {
    const runSeed = "restore-first-level-freeze-preview";
    const generated = new LevelGenerator().generate({
      levelNumber: 1,
      runSeed,
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed,
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    expect(game.getState().level.blocks).toEqual(generated.blocks);

    game.destroy();
  });

  it("冻结方块融化时在 UI 动画层显示冰壳消散效果", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed: "freeze-melt-ui-seed",
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });
    let meltEffect: HTMLElement | null = null;

    for (const blockId of game.getState().level.solutionPath) {
      game.selectBlock(blockId);
      meltEffect = root.querySelector<HTMLElement>(".dog-melt-effect");
      if (meltEffect !== null) {
        break;
      }
      await vi.advanceTimersByTimeAsync(900);
    }

    expect(meltEffect).not.toBeNull();
    expect(meltEffect?.getAttribute("aria-hidden")).toBe("true");
    expect(meltEffect?.querySelector(".dog-melt-effect__flake")).not.toBeNull();
    expect(meltEffect?.querySelectorAll(".dog-melt-effect__drop")).toHaveLength(4);

    game.destroy();
  });

  it("直接点击幻化方块飞行时揭示真实图案、占槽并锁定重复输入", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed: "illusion-flight-ui-seed",
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    const level = game.getState().level;
    const illusion = level.blocks.find(
      (block) => block.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE,
    );
    if (illusion === undefined) {
      throw new Error("Expected generated illusion block");
    }

    for (const blockId of level.solutionPath) {
      if (blockId === illusion.id) {
        break;
      }
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }

    const boardBlock = root.querySelector<HTMLElement>(
      `[data-testid="dog-block"][data-block-id="${illusion.id}"]`,
    );
    const disguisedPatternType = illusion.specialMechanism?.state.disguisedPatternType;
    expect(boardBlock?.dataset.patternType).toBe(illusion.patternType);
    expect(boardBlock?.dataset.disguisedPatternType).toBe(disguisedPatternType);
    expect(boardBlock?.dataset.specialMechanismState).toBe("masked");
    expect(boardBlock?.classList.contains("dog-block--special-illusion")).toBe(true);

    const beforeTrayLength = game.getState().session.tray.length;
    game.selectBlock(illusion.id);

    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().session.tray).toHaveLength(beforeTrayLength + 1);
    expect(
      root.querySelectorAll('[data-testid="dog-tray-slot"][data-pattern-type]'),
    ).toHaveLength(beforeTrayLength + 1);
    const selectedTrayBlock = game.getState().session.trayBlocks.at(-1);
    expect(selectedTrayBlock).toMatchObject({
      id: illusion.id,
      patternType: illusion.patternType,
    });
    expect(selectedTrayBlock).not.toHaveProperty("specialMechanism");
    expect(root.querySelector<HTMLElement>('[data-testid="dog-flight"]')?.dataset.patternType).toBe(
      illusion.patternType,
    );
    expect(
      root.querySelector<HTMLElement>('[data-testid="dog-flight"]')?.dataset.illusionReveal,
    ).toBe("true");
    root.querySelector<HTMLButtonElement>(
      '[data-action="use-item"][data-item-id="tray-capacity"]',
    )?.click();
    expect(game.getState().session.trayCapacity).toBe(7);
    expect(game.getState().items?.items.find((item) => item.id === "tray-capacity"))
      .toMatchObject({ remainingUses: 1 });

    const secondBlockId = game.getState().session.selectableBlockIds.find(
      (blockId) => blockId !== illusion.id,
    );
    if (secondBlockId !== undefined) {
      game.selectBlock(secondBlockId);
      expect(game.getState().session.tray).toHaveLength(beforeTrayLength + 1);
    }

    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(root.querySelector('[data-testid="dog-flight"]')).toBeNull();
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
    ...FIRST_LEVEL,
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
