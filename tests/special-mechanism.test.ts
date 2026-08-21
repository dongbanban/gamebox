// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BLOCK_FLIGHT_DURATION_MS,
  DOG_DETECTOR_REVEAL_DURATION_MS,
  DOG_TORCH_MELT_DURATION_MS,
  DOG_ILLUSION_REVEAL_DURATION_MS,
} from "@/games/dog-lege-dog/assets/animation-effects";
import { getDogPatternAssetUrl } from "@/games/dog-lege-dog/assets/game-assets";
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

  it("火把融化棋盘冻结方块后保留原位置并移除冻结状态", () => {
    const freezeBlock = createBlock("freeze", 4, 8, WORKING_DOG, {
      type: DOG_FREEZE_MECHANISM_TYPE,
      state: { status: "frozen", completedTriples: 0 },
    });
    const session = new GameSession(
      createLevel([freezeBlock, createBlock("remaining", 12, 8, SINGLE_DOG)]),
    );

    const result = session.meltFrozenBlock("freeze", "board");

    expect(result).toMatchObject({
      melted: true,
      location: "board",
      removedCount: 0,
      tripleCount: 0,
    });
    expect(result.snapshot.remainingBlocks).toHaveLength(2);
    expect(result.snapshot.remainingBlocks.find((block) => block.id === "freeze")).not.toHaveProperty(
      "specialMechanism",
    );
    expect(result.snapshot.remainingBlocks.find((block) => block.id === "freeze")).toMatchObject({
      x: 4,
      y: 8,
      patternType: WORKING_DOG,
    });
    expect(session.canMeltFrozenBlock("freeze", "board")).toBe(false);
  });

  it("火把融化暂存槽冻结方块后立即结算同图案三消", () => {
    const session = new GameSession({
      level: createLevel([createBlock("remaining", 12, 8, SINGLE_DOG)]),
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

    const result = session.meltFrozenBlock("freeze", "tray");

    expect(result).toMatchObject({
      melted: true,
      location: "tray",
      removedCount: 3,
      tripleCount: 1,
    });
    expect(result.snapshot.tray).toEqual([]);
    expect(result.snapshot.trayBlocks).toEqual([]);
  });

  it("火把不能融化普通方块或不存在目标", () => {
    const session = new GameSession(createLevel([createBlock("ordinary", 4, 8, WORKING_DOG)]));
    const initial = session.getState();

    expect(session.meltFrozenBlock("ordinary", "board").melted).toBe(false);
    expect(session.meltFrozenBlock("missing", "tray").melted).toBe(false);
    expect(session.getState()).toEqual(initial);
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

  it("火把目标选择只暴露冻结方块，取消不扣次数", () => {
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed: "freeze-visual-seed",
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    const torchButton = root.querySelector<HTMLButtonElement>(
      '[data-action="use-item"][data-item-id="torch"]',
    );
    const freezeBlocks = root.querySelectorAll<HTMLElement>(
      '[data-testid="dog-block"][data-special-mechanism="freeze"]',
    );
    const ordinaryBlock = root.querySelector<HTMLElement>(
      '[data-testid="dog-block"]:not([data-special-mechanism])',
    );

    expect(torchButton?.disabled).toBe(false);
    expect(freezeBlocks.length).toBeGreaterThan(0);
    torchButton?.click();

    expect(game.getState().items?.phase).toBe("targeting");
    expect(root.querySelector('[data-testid="dog-item-targeting"]')).toBeNull();
    expect(
      root.querySelector('[data-testid="dog-loadout-actions"] [data-action="edit-loadout"]'),
    ).not.toBeNull();
    expect(
      root.querySelector('[data-testid="dog-loadout-actions"] [data-action="cancel-item-target"]'),
    ).not.toBeNull();
    const activeFreezeBlocks = root.querySelectorAll<HTMLElement>(
      '[data-testid="dog-block"][data-special-mechanism="freeze"]',
    );
    expect(root.querySelectorAll('[data-item-targetable="true"]')).toHaveLength(
      activeFreezeBlocks.length,
    );
    expect(
      [...activeFreezeBlocks].every((block) => block.dataset.itemTargetable === "true"),
    ).toBe(true);
    expect(ordinaryBlock?.dataset.itemTargetable).toBeUndefined();

    root.querySelector<HTMLButtonElement>('[data-action="cancel-item-target"]')?.click();

    expect(game.getState().items?.phase).toBe("idle");
    expect(game.getState().items?.items.find((item) => item.id === "torch"))
      .toMatchObject({ remainingUses: 1 });
    game.destroy();
  });

  it("火把目标选择高亮暂存槽冻结方块", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed: "freeze-visual-seed",
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    const level = game.getState().level;
    const freezeBlock = level.blocks.find(
      (block) => block.specialMechanism?.type === DOG_FREEZE_MECHANISM_TYPE,
    );
    if (freezeBlock === undefined) {
      throw new Error("Expected generated freeze block");
    }
    const freezePathIndex = level.solutionPath.indexOf(freezeBlock.id);
    if (freezePathIndex < 0) {
      throw new Error("Expected freeze block in solution path");
    }

    for (const blockId of level.solutionPath.slice(0, freezePathIndex + 1)) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }

    const trayFreezeBlocks = game.getState().session.trayBlocks.filter(
      (block) => block.specialMechanism?.type === DOG_FREEZE_MECHANISM_TYPE,
    );
    expect(trayFreezeBlocks.length).toBeGreaterThan(0);

    root.querySelector<HTMLButtonElement>('[data-item-id="torch"]')?.click();

    const targetableTraySlots = root.querySelectorAll<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-item-targetable="true"]',
    );
    expect(targetableTraySlots).toHaveLength(trayFreezeBlocks.length);
    expect(
      [...targetableTraySlots].every((slot) =>
        slot.classList.contains("dog-tray__slot--item-targetable"),
      ),
    ).toBe(true);
    expect(
      [...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"]')]
        .filter((slot) => slot.dataset.itemTargetable !== "true")
        .every((slot) => !slot.classList.contains("dog-tray__slot--item-targetable")),
    ).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-action="cancel-item-target"]')?.click();
    expect(game.getState().items?.phase).toBe("idle");
    game.destroy();
  });

  it("火把融化棋盘冻结方块时显示融化特效并锁定至动画结束", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed: "freeze-visual-seed",
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    const freezeBlock = root.querySelector<HTMLElement>(
      '[data-testid="dog-block"][data-special-mechanism="freeze"]',
    );
    if (freezeBlock === null) {
      throw new Error("Expected generated freeze block");
    }

    root.querySelector<HTMLButtonElement>('[data-item-id="torch"]')?.click();
    root
      .querySelector<HTMLElement>(
        `[data-testid="dog-block"][data-block-id="${freezeBlock.dataset.blockId}"]`,
      )
      ?.click();

    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().items?.items.find((item) => item.id === "torch"))
      .toMatchObject({ remainingUses: 0 });
    expect(
      root.querySelector<HTMLElement>('[data-testid="dog-melt-effect"][data-item-id="torch"]'),
    ).not.toBeNull();
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-block"][data-block-id="${freezeBlock.dataset.blockId}"]`,
      )?.dataset.specialMechanism,
    ).toBe(DOG_FREEZE_MECHANISM_TYPE);

    await vi.advanceTimersByTimeAsync(DOG_TORCH_MELT_DURATION_MS - 1);
    expect(game.getState().inputLocked).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    expect(game.getState().inputLocked).toBe(false);
    expect(root.querySelector('[data-testid="dog-melt-effect"][data-item-id="torch"]')).toBeNull();
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-block"][data-block-id="${freezeBlock.dataset.blockId}"]`,
      )?.dataset.specialMechanism,
    ).toBeUndefined();
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
    expect(boardBlock?.querySelector(".dog-block__glyph--fuzzy")).not.toBeNull();
    expect(boardBlock?.style.getPropertyValue("--dog-illusion-image")).toContain(
      getDogPatternAssetUrl(disguisedPatternType as DogPatternType),
    );

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
    expect(selectedTrayBlock).toHaveProperty("specialMechanism");
    expect(root.querySelector<HTMLElement>('[data-testid="dog-flight"]')?.dataset.patternType).toBe(
      illusion.patternType,
    );
    expect(
      root.querySelector<HTMLElement>('[data-testid="dog-flight"]')?.querySelector("img")?.getAttribute("src"),
    ).toBe(getDogPatternAssetUrl(disguisedPatternType as DogPatternType));
    expect(
      root.querySelector<HTMLElement>('[data-testid="dog-flight"]')?.dataset.illusionFlight,
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
    expect(game.getState().inputLocked).toBe(true);
    expect(root.querySelector('[data-testid="dog-flight"]')).toBeNull();
    expect(game.getState().session.trayBlocks.at(-1)).not.toHaveProperty("specialMechanism");
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-tray-slot"][data-block-id="${illusion.id}"]`,
      )?.classList.contains("dog-tray__slot--illusion-reveal"),
    ).toBe(true);
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-tray-slot"][data-block-id="${illusion.id}"]`,
      )?.dataset.illusionReveal,
    ).toBe("true");

    await vi.advanceTimersByTimeAsync(DOG_ILLUSION_REVEAL_DURATION_MS);
    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-tray-slot"][data-block-id="${illusion.id}"]`,
      )?.classList.contains("dog-tray__slot--illusion-reveal"),
    ).toBe(false);
    game.destroy();
  });

  it("检测仪只高亮棋盘幻化目标，原位揭示且动画期间锁定输入", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed: "detector-illusion-ui-seed",
      loadout: ["detector", "tray-capacity", "wildcard"],
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

    const beforeTrayLength = game.getState().session.tray.length;
    const ordinary = game.getState().session.remainingBlocks.find(
      (block) => block.specialMechanism === undefined,
    );
    if (ordinary === undefined) {
      throw new Error("Expected an ordinary block beside illusion target");
    }

    root.querySelector<HTMLButtonElement>(
      '[data-action="use-item"][data-item-id="detector"]',
    )?.click();

    expect(game.getState().items).toMatchObject({
      phase: "targeting",
      selectedItemId: "detector",
      selectedItemTargetType: "block",
    });
    expect(
      root.querySelectorAll<HTMLElement>('[data-testid="dog-block"][data-item-targetable="true"]'),
    ).toHaveLength(
      game.getState().session.remainingBlocks.filter(
        (block) => block.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE,
      ).length,
    );
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-block"][data-block-id="${ordinary.id}"]`,
      )?.dataset.itemTargetable,
    ).toBeUndefined();
    expect(root.querySelector('[data-testid="dog-tray-slot"][data-item-targetable="true"]')).toBeNull();

    root.querySelector<HTMLButtonElement>(
      `[data-testid="dog-block"][data-block-id="${ordinary.id}"]`,
    )?.click();
    expect(game.getState().items?.phase).toBe("targeting");
    expect(game.getState().items?.items.find((item) => item.id === "detector"))
      .toMatchObject({ remainingUses: 1 });

    root.querySelector<HTMLButtonElement>(
      `[data-testid="dog-block"][data-block-id="${illusion.id}"]`,
    )?.click();

    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().items).toMatchObject({
      phase: "animating",
      selectedItemId: "detector",
    });
    expect(game.getState().session.tray).toHaveLength(beforeTrayLength);
    expect(game.getState().session.remainingBlocks.find((block) => block.id === illusion.id))
      .toHaveProperty("specialMechanism.type", DOG_ILLUSION_MECHANISM_TYPE);
    expect(root.querySelector('[data-testid="dog-detector-reveal"]')).not.toBeNull();
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-block"][data-block-id="${ordinary.id}"]`,
      )?.getAttribute("disabled"),
    ).not.toBeNull();

    await vi.advanceTimersByTimeAsync(DOG_DETECTOR_REVEAL_DURATION_MS - 1);
    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().session.tray).toHaveLength(beforeTrayLength);
    expect(game.getState().session.remainingBlocks.find((block) => block.id === illusion.id))
      .toHaveProperty("specialMechanism.type", DOG_ILLUSION_MECHANISM_TYPE);

    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(game.getState().items?.phase).toBe("idle");
    expect(game.getState().session.tray).toHaveLength(beforeTrayLength);
    expect(game.getState().session.remainingBlocks.find((block) => block.id === illusion.id))
      .not.toHaveProperty("specialMechanism");
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-block"][data-block-id="${illusion.id}"]`,
      )?.dataset.specialMechanism,
    ).toBeUndefined();
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-block"][data-block-id="${illusion.id}"] .dog-block__glyph img`,
      )?.getAttribute("src"),
    ).toBe(getDogPatternAssetUrl(illusion.patternType));

    game.selectBlock(illusion.id);
    expect(root.querySelector<HTMLElement>('[data-testid="dog-flight"]')?.dataset.illusionFlight)
      .toBeUndefined();
    expect(root.querySelector<HTMLElement>('[data-testid="dog-flight"] img')?.getAttribute("src"))
      .toBe(getDogPatternAssetUrl(illusion.patternType));
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
