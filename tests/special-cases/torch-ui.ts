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

describe("特殊机制测试 · torch-ui", () => {
  afterEach(() => {
    vi.useRealTimers();
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
    expect(root.querySelectorAll('[data-testid="dog-block"][data-item-targetable="true"]')).toHaveLength(
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
