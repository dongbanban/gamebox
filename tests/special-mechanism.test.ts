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
  DOG_FREEZE_GENERATOR_VERSION,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
  DOG_ILLUSION_GENERATOR_VERSION,
  DOG_SPECIAL_MECHANISM_GENERATOR_VERSION,
  FIRST_LEVEL,
  GameSession,
  LEVEL_GENERATOR_VERSION,
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
import { createDogSpecialMechanismHandlerMap } from "@/games/dog-lege-dog/game/special-mechanisms";
import {
  applyDogTraySuccessfulTripleEffects,
  resolveDogTrayMatches,
} from "@/games/dog-lege-dog/levels/level-rules";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";

describe("狗了个狗特殊机制", () => {
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

    expect(getDogSpecialMechanismConfigs(16, DOG_SPECIAL_MECHANISM_GENERATOR_VERSION - 1)).toEqual([
      { type: "freeze", min: 1, max: 2 },
      { type: "illusion", min: 1, max: 2 },
    ]);
    expect(getDogSpecialMechanismConfigs(16, DOG_FREEZE_GENERATOR_VERSION)).toEqual([
      { type: "freeze", min: 1, max: 2 },
    ]);
    expect(getDogSpecialMechanismConfigs(16, DOG_FREEZE_GENERATOR_VERSION - 1)).toEqual([]);
    expect(getDogSpecialMechanismConfigs(16, DOG_ILLUSION_GENERATOR_VERSION)).toEqual([
      { type: "freeze", min: 1, max: 2 },
      { type: "illusion", min: 1, max: 2 },
    ]);
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

  it("三消道具只高亮相邻暂存槽方块对并置灰其他目标", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("working-1", 0, 0, WORKING_DOG),
        createBlock("single", 4, 0, SINGLE_DOG),
        createBlock("working-2", 8, 0, WORKING_DOG),
        createBlock("working-3", 12, 0, WORKING_DOG),
        createBlock("working-4", 16, 0, WORKING_DOG),
      ]),
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    for (const blockId of ["working-1", "working-2", "single"]) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }

    expect(game.getState().session.tray).toEqual([WORKING_DOG, WORKING_DOG, SINGLE_DOG]);
    expect(
      root.querySelector<HTMLButtonElement>('[data-action="use-item"][data-item-id="triple-removal"]')
        ?.disabled,
    ).toBe(false);

    root.querySelector<HTMLButtonElement>(
      '[data-action="use-item"][data-item-id="triple-removal"]',
    )?.click();

    expect(game.getState().items?.selectedItemTargetType).toBe("tray-block");
    expect(root.querySelector('[data-testid="dog-item-targeting"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="dog-item-targeting"]')?.textContent).toContain("选择道具目标");
    const targetableSlots = root.querySelectorAll<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-item-targetable="true"]',
    );
    expect(targetableSlots).toHaveLength(2);
    expect([...targetableSlots].map((slot) => slot.dataset.patternType)).toEqual([
      WORKING_DOG,
      WORKING_DOG,
    ]);
    const blockedTraySlots = root.querySelectorAll<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-item-target-disabled="true"]',
    );
    expect(blockedTraySlots).toHaveLength(1);
    expect([...blockedTraySlots].every((slot) =>
      slot.classList.contains("dog-tray__slot--item-target-disabled") &&
      slot.getAttribute("aria-disabled") === "true",
    )).toBe(true);
    expect(root.querySelectorAll('[data-testid="dog-block"][data-item-targetable="true"]')).toHaveLength(0);

    targetableSlots[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(game.getState().items?.phase).toBe("animating");

    game.destroy();
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

    expect(first.specialMechanisms.map((mechanism) => mechanism.type)).toEqual([
      "freeze",
      "illusion",
      "magnetic",
      "twin",
    ]);
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

  it("生成器按双生逻辑单位闭合图案配额并可重放求解", () => {
    const generator = new LevelGenerator();
    for (const levelNumber of [1, 6, 31]) {
      const request = {
        levelNumber,
        runSeed: `twin-logical-quota-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
      } as const;
      const level = generator.generate(request);
      const repeated = generator.generate(request);
      const twinBlocks = level.blocks.filter(
        (block) => block.specialMechanism?.type === DOG_TWIN_MECHANISM_TYPE,
      );

      expect(twinBlocks.length).toBeGreaterThan(0);
      expect(level.blocks.length + twinBlocks.length).toBe(getBlockCount(levelNumber));
      expect(getDogLogicalBlockCount(level.blocks, level.specialMechanisms)).toBe(
        getBlockCount(levelNumber),
      );
      for (const patternType of level.patternTypes) {
        const logicalPatternCount = level.blocks
          .filter((block) => block.patternType === patternType)
          .reduce(
            (total, block) => total + (block.specialMechanism?.type === DOG_TWIN_MECHANISM_TYPE ? 2 : 1),
            0,
          );
        expect(logicalPatternCount % 3).toBe(0);
      }
      expect(level.difficulty.logicalBlockCount).toBe(getBlockCount(levelNumber));
      expect(generator.findSolvability(level).status).toBe("solvable");
      expect(repeated).toEqual(level);
    }
  });

  it("组合特殊机制只分配到高层，且中间层占比至少七成", () => {
    const generator = new LevelGenerator();

    for (const levelNumber of [1, 6, 31]) {
      const level = generator.generate({
        levelNumber,
        runSeed: `composition-layer-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
      });
      const specialBlocks = level.blocks.filter(
        (block) => block.specialMechanism !== undefined,
      );
      const middleBlocks = specialBlocks.filter(
        (block) => block.z > 0 && block.z < level.maxLayers - 1,
      );

      expect(specialBlocks.length).toBeGreaterThan(1);
      expect(specialBlocks.every((block) => block.z > 0)).toBe(true);
      expect(middleBlocks.length / specialBlocks.length).toBeGreaterThanOrEqual(0.7);
      expect(new Set(specialBlocks.map((block) => block.id)).size).toBe(
        specialBlocks.length,
      );
      expect(level.difficulty.specialMechanismDensity).toBeGreaterThan(0);
    }
  });

  it("组合校验拒绝底层位置与超过 30% 的机制密度", () => {
    const configurations = [
      { type: DOG_FREEZE_MECHANISM_TYPE, min: 1, max: 2 },
      { type: DOG_ILLUSION_MECHANISM_TYPE, min: 1, max: 1 },
    ] as const;
    const bottomBlock = {
      ...createBlock("bottom-freeze", 0, 0, WORKING_DOG, createDogSpecialMechanism("freeze")),
      z: 0,
    };
    expect(
      validateDogSpecialMechanismComposition(
        [bottomBlock],
        3,
        configurations,
      ),
    ).toContain("base layer");

    const denseBlocks = Array.from({ length: 5 }, (_, index) => ({
      ...createBlock(`dense-${index}`, index * BLOCK_WIDTH, 0, WORKING_DOG),
      z: index < 2 ? 1 : 0,
      ...(index < 2
        ? { specialMechanism: createDogSpecialMechanism("freeze") }
        : {}),
    }));
    const composition = getDogSpecialMechanismComposition(
      denseBlocks,
      3,
      [configurations[0]],
    );
    expect(composition.specialMechanismDensity).toBe(0.4);
    expect(
      validateDogSpecialMechanismComposition(
        denseBlocks,
        3,
        [configurations[0]],
      ),
    ).toContain("30%");
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

    await vi.advanceTimersByTimeAsync(900);
    expect(game.getState().inputLocked).toBe(true);
    const blockedBlockId = game.getState().session.selectableBlockIds[0];
    if (blockedBlockId !== undefined) {
      game.selectBlock(blockedBlockId);
      expect(game.getState().session.remainingBlocks.map((block) => block.id)).toContain(
        blockedBlockId,
      );
    }
    await vi.advanceTimersByTimeAsync(DOG_FREEZE_MELT_DURATION_MS - 900);
    await Promise.resolve();
    expect(game.getState().inputLocked).toBe(false);

    game.destroy();
  });

  it("火把目标选择只暴露当前可点击冻结方块，取消不扣次数", async () => {
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
    for (const blockId of level.solutionPath.slice(0, freezePathIndex)) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }

    const torchButton = root.querySelector<HTMLButtonElement>(
      '[data-action="use-item"][data-item-id="torch"]',
    );
    const freezeBlocks = root.querySelectorAll<HTMLElement>(
      '[data-testid="dog-block"][data-special-mechanism="freeze"]',
    );

    expect(torchButton?.disabled).toBe(false);
    expect(freezeBlocks.length).toBeGreaterThan(0);
    torchButton?.click();

    const ordinaryBlock = root.querySelector<HTMLElement>(
      '[data-testid="dog-block"]:not([data-special-mechanism])',
    );

    expect(game.getState().items?.phase).toBe("targeting");
    expect(root.querySelector('[data-testid="dog-item-targeting"]')).not.toBeNull();
    expect(
      root.querySelector('[data-testid="dog-loadout-actions"] [data-action="edit-loadout"]'),
    ).not.toBeNull();
    expect(
      root.querySelector('[data-testid="dog-loadout-actions"] [data-action="cancel-item-target"]'),
    ).not.toBeNull();
    const activeFreezeBlocks = root.querySelectorAll<HTMLElement>(
      '[data-testid="dog-block"][data-special-mechanism="freeze"]',
    );
    const selectableBlockIds = new Set(game.getState().session.selectableBlockIds);
    const selectableFreezeBlocks = [...activeFreezeBlocks].filter((block) =>
      selectableBlockIds.has(block.dataset.blockId ?? ""),
    );
    expect(root.querySelectorAll('[data-item-targetable="true"]')).toHaveLength(
      selectableFreezeBlocks.length,
    );
    expect(
      selectableFreezeBlocks.every((block) => block.dataset.itemTargetable === "true"),
    ).toBe(true);
    expect(
      selectableFreezeBlocks.every((block) => block.classList.contains("dog-block--item-targetable")),
    ).toBe(true);
    expect(
      [...root.querySelectorAll<HTMLElement>(
        '[data-testid="dog-block"][data-special-mechanism="freeze"]',
      )].every((block) =>
        game.getState().session.selectableBlockIds.includes(block.dataset.blockId ?? "")
          ? block.dataset.itemTargetable === "true"
          : block.dataset.itemTargetable === undefined,
      ),
    ).toBe(true);
    expect(ordinaryBlock?.dataset.itemTargetable).toBeUndefined();
    expect(ordinaryBlock?.classList.contains("dog-block--item-targetable")).toBe(false);
    expect(ordinaryBlock?.hasAttribute("disabled")).toBe(true);

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
    expect(
      [...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"][data-pattern-type]')]
        .filter((slot) => slot.dataset.itemTargetable !== "true")
        .every((slot) =>
          slot.dataset.itemTargetDisabled === "true" &&
          slot.classList.contains("dog-tray__slot--item-target-disabled") &&
          slot.getAttribute("aria-disabled") === "true",
        ),
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

    const level = game.getState().level;
    const freezePathIndex = level.solutionPath.indexOf(freezeBlock.dataset.blockId ?? "");
    if (freezePathIndex < 0) {
      throw new Error("Expected freeze block in solution path");
    }
    for (const blockId of level.solutionPath.slice(0, freezePathIndex)) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }
    expect(game.getState().session.selectableBlockIds).toContain(freezeBlock.dataset.blockId);

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

  it("双生方块静态识别，分裂期间锁定输入，完成后恢复普通视觉", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed: "twin-split-ui-seed",
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    const level = game.getState().level;
    const selectableBefore = game.getState().session.selectableBlockIds;
    const twin = level.blocks.find(
      (block) =>
        block.specialMechanism?.type === DOG_TWIN_MECHANISM_TYPE &&
        selectableBefore.includes(block.id),
    );
    if (twin === undefined) {
      throw new Error("Expected generated twin block");
    }

    const boardBlock = root.querySelector<HTMLElement>(
      `[data-testid="dog-block"][data-block-id="${twin.id}"]`,
    );
    expect(boardBlock?.classList.contains("dog-block--special-twin")).toBe(true);
    expect(boardBlock?.dataset.specialMechanismState).toBe(DOG_TWIN_MECHANISM_TYPE);

    game.selectBlock(twin.id);

    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().session.remainingBlocks.map((block) => block.id)).not.toContain(twin.id);
    expect(game.getState().session.trayBlocks.slice(-2).map((block) => block.id)).toEqual([
      `${twin.id}-1`,
      `${twin.id}-2`,
    ]);
    const splitEffect = root.querySelector<HTMLElement>('[data-testid="dog-twin-split-effect"]');
    expect(splitEffect?.dataset.twinSourceId).toBe(twin.id);
    expect(splitEffect?.dataset.twinBlockIds).toBe(`${twin.id}-1,${twin.id}-2`);

    const otherBlockId = selectableBefore.find((blockId) => blockId !== twin.id);
    if (otherBlockId !== undefined) {
      game.selectBlock(otherBlockId);
      expect(game.getState().session.remainingBlocks.map((block) => block.id)).toContain(
        otherBlockId,
      );
    }

    await vi.advanceTimersByTimeAsync(DOG_TWIN_SPLIT_DURATION_MS - 1);
    expect(game.getState().inputLocked).toBe(true);
    expect(root.querySelector('[data-testid="dog-twin-split-effect"]')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();
    expect(game.getState().inputLocked).toBe(false);
    expect(root.querySelector('[data-testid="dog-twin-split-effect"]')).toBeNull();
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-tray-slot"][data-block-id="${twin.id}-1"]`,
      )?.classList.contains("dog-block--special-twin"),
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
    expect(root.querySelector('[data-testid="dog-item-targeting"]')?.textContent).toContain("选择道具目标");
    expect(
      root.querySelectorAll<HTMLElement>('[data-testid="dog-block"][data-item-targetable="true"]'),
    ).toHaveLength(
      game.getState().session.remainingBlocks.filter(
        (block) =>
          block.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE &&
          game.getState().session.selectableBlockIds.includes(block.id),
      ).length,
    );
    for (const block of game.getState().session.remainingBlocks) {
      if (block.specialMechanism?.type !== DOG_ILLUSION_MECHANISM_TYPE) {
        continue;
      }

      expect(
        root.querySelector<HTMLElement>(
          `[data-testid="dog-block"][data-block-id="${block.id}"]`,
        )?.dataset.itemTargetable,
      ).toBe(game.getState().session.selectableBlockIds.includes(block.id) ? "true" : undefined);
    }
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-block"][data-block-id="${ordinary.id}"]`,
      )?.dataset.itemTargetable,
    ).toBeUndefined();
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-block"][data-block-id="${illusion.id}"]`,
      )?.classList.contains("dog-block--item-targetable"),
    ).toBe(true);
    expect(root.querySelector('[data-testid="dog-tray-slot"][data-item-targetable="true"]')).toBeNull();
    expect(
      [...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"][data-pattern-type]')]
        .every((slot) =>
          slot.dataset.itemTargetDisabled === "true" &&
          slot.classList.contains("dog-tray__slot--item-target-disabled") &&
          slot.getAttribute("aria-disabled") === "true",
        ),
    ).toBe(true);

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
    const detectorReveal = root.querySelector<HTMLElement>('[data-testid="dog-detector-reveal"]');
    expect(detectorReveal).not.toBeNull();
    expect(detectorReveal?.parentElement).toBe(
      root.querySelector(`[data-testid="dog-block"][data-block-id="${illusion.id}"]`),
    );
    expect(detectorReveal?.style.position).toBe("absolute");
    expect(detectorReveal?.style.inset).toBe("4px");
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

  it("消磁仪只高亮可点击磁吸方块，原位播放动效并在结束后恢复普通视觉", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const magnetic = createBlock("magnetic", 0, 0, WORKING_DOG, {
      type: DOG_MAGNETIC_MECHANISM_TYPE,
      state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
    });
    const ordinary = createBlock("ordinary", 4, 0, SINGLE_DOG);
    const game = startDogLegeDogGame(root, {
      level: createLevel([magnetic, ordinary]),
      loadout: ["demagnetizer", "tray-capacity", "wildcard"],
    });

    const magneticElement = root.querySelector<HTMLElement>(
      '[data-testid="dog-block"][data-block-id="magnetic"]',
    );
    expect(magneticElement?.classList.contains("dog-block--special-magnetic")).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-item-id="demagnetizer"]')?.click();

    expect(game.getState().items).toMatchObject({
      phase: "targeting",
      selectedItemId: "demagnetizer",
      selectedItemTargetType: "block",
      demagnetizerTargetBlockIds: ["magnetic"],
    });
    expect(root.querySelectorAll('[data-item-targetable="true"]')).toHaveLength(1);
    expect(
      root.querySelector<HTMLElement>('[data-testid="dog-block"][data-block-id="magnetic"]')
        ?.classList.contains("dog-block--item-targetable"),
    ).toBe(true);
    expect(
      root.querySelector<HTMLElement>('[data-testid="dog-block"][data-block-id="ordinary"]')
        ?.dataset.itemTargetable,
    ).toBeUndefined();
    expect(
      root.querySelector<HTMLElement>('[data-testid="dog-block"][data-block-id="ordinary"]')
        ?.hasAttribute("disabled"),
    ).toBe(true);

    root.querySelector<HTMLButtonElement>(
      '[data-testid="dog-block"][data-block-id="magnetic"]',
    )?.click();

    expect(game.getState()).toMatchObject({
      inputLocked: true,
      items: {
        phase: "animating",
        selectedItemId: "demagnetizer",
        demagnetizerTargetBlockIds: [],
      },
    });
    expect(game.getState().session.remainingBlocks.find((block) => block.id === "magnetic"))
      .toHaveProperty("specialMechanism.type", DOG_MAGNETIC_MECHANISM_TYPE);
    expect(
      root.querySelector<HTMLElement>('[data-testid="dog-demagnetizer-effect"]'),
    ).toMatchObject({
      dataset: { blockId: "magnetic", itemId: "demagnetizer" },
    });

    await vi.advanceTimersByTimeAsync(DOG_DEMAGNETIZER_DURATION_MS - 1);
    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().session.remainingBlocks.find((block) => block.id === "magnetic"))
      .toHaveProperty("specialMechanism.type", DOG_MAGNETIC_MECHANISM_TYPE);

    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(game.getState().items?.phase).toBe("idle");
    expect(game.getState().items?.items.find((item) => item.id === "demagnetizer"))
      .toMatchObject({ remainingUses: 0, available: false });
    expect(
      game.getState().session.remainingBlocks.find((block) => block.id === "magnetic"),
    ).not.toHaveProperty("specialMechanism");
    expect(
      root.querySelector<HTMLElement>('[data-testid="dog-block"][data-block-id="magnetic"]')
        ?.classList.contains("dog-block--special-magnetic"),
    ).toBe(false);
    expect(root.querySelector('[data-testid="dog-demagnetizer-effect"]')).toBeNull();
    expect(game.getState().session.selectableBlockIds).toContain("magnetic");
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
