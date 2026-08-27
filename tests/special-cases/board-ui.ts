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

describe("特殊机制测试 · board-ui", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("直接点击幻化方块飞行时揭示真实图案、占槽并锁定重复输入", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("illusion", 0, 0, WORKING_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: SINGLE_DOG },
        }),
        createBlock("working-1", 4, 0, WORKING_DOG),
        createBlock("working-2", 8, 0, WORKING_DOG),
        createBlock("remaining", 12, 0, SINGLE_DOG),
      ]),
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    const level = game.getState().level;
    const illusion = level.blocks.find(
      (block) => block.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE,
    );
    if (illusion === undefined) {
      throw new Error("Expected generated illusion block");
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
