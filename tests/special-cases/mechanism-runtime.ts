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

describe("特殊机制测试 · mechanism-runtime", () => {
  afterEach(() => {
    vi.useRealTimers();
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
        createBlock("working-5", 20, 0, WORKING_DOG),
        createBlock("working-6", 24, 0, WORKING_DOG),
        createBlock("single-2", 28, 0, SINGLE_DOG),
        createBlock("single-3", 32, 0, SINGLE_DOG),
      ]),
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    for (const blockId of ["working-1", "working-2", "single"]) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }

    expect(game.getState().session.trayBlocks.map((block) => block.patternType)).toEqual([
      WORKING_DOG,
      WORKING_DOG,
      SINGLE_DOG,
    ]);
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
