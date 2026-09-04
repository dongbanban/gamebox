// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOCK_FLIGHT_DURATION_MS } from "@/games/dog-lege-dog/assets/animation-effects";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_SHUFFLE_MECHANISM_TYPE,
  LevelGenerator,
  createDogShuffleMechanism,
  startDogLegeDogGame,
} from "@/games/dog-lege-dog";
import type {
  DogBlock,
  DogLegeDogLevel,
  DogPatternType,
} from "@/games/dog-lege-dog";
import { TEST_LEVEL, TEST_PATTERN_TYPES } from "../support/dog-level-fixture";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";

describe("特殊机制测试 · shuffle-ui", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("已确认道具组后在关卡行显示蓝底白字重玩按钮，输入锁定时禁用", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("single-1", 0, 0, SINGLE_DOG),
        createBlock("licking-1", 4, 0, LICKING_DOG),
      ]),
      onLoadoutConfirmed: vi.fn(),
    });

    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-replay-current-level"]')?.disabled)
      .toBe(true);

    for (const itemId of ["tray-capacity", "wildcard", "torch"]) {
      root.querySelector<HTMLButtonElement>(`[data-loadout-id="${itemId}"]`)?.click();
    }
    root.querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')?.click();

    const replayButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="dog-replay-current-level"]',
    );
    expect(replayButton?.disabled).toBe(false);
    expect(replayButton?.classList.contains("primary-button")).toBe(true);
    expect(replayButton?.classList.contains("text-button")).toBe(false);
    expect(replayButton?.textContent?.trim()).toBe("重玩本关");
    expect(replayButton?.getAttribute("aria-label")).toBe("重玩本关");
    expect(replayButton?.closest(".dog-game__level-tools")).not.toBeNull();

    game.selectBlock("single-1");
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-replay-current-level"]')?.disabled)
      .toBe(true);
    await vi.runAllTimersAsync();
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-replay-current-level"]')?.disabled)
      .toBe(false);
    game.destroy();
  });

  it("乱序方块棋盘保持普通视觉，入槽后显示待乱序状态并保留输入锁", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
        createBlock("remaining", 4, 0, SINGLE_DOG),
      ]),
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    const boardBlock = root.querySelector<HTMLElement>(
      '[data-testid="dog-block"][data-block-id="shuffle"]',
    );

    expect(boardBlock?.dataset.specialMechanism).toBe(DOG_SHUFFLE_MECHANISM_TYPE);
    expect(boardBlock?.dataset.specialMechanismState).toBe("dormant");
    expect(boardBlock?.classList.contains("dog-block--special-shuffle")).toBe(false);
    expect(boardBlock?.classList.contains("dog-block--special")).toBe(false);
    expect(boardBlock?.querySelector(".dog-block__mechanism-icon")).toBeNull();

    game.selectBlock("shuffle");

    expect(game.getState().inputLocked).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-replay-current-level"]')?.disabled)
      .toBe(true);
    expect(root.querySelector('[data-testid="dog-tray-slot"][data-block-id="shuffle"]'))
      .not.toBeNull();

    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    await vi.runAllTimersAsync();

    const shuffleSlot = root.querySelector<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-block-id="shuffle"]',
    );
    expect(game.getState().inputLocked).toBe(false);
    expect(game.getState().session.shuffle).toMatchObject({
      blockId: "shuffle",
      status: "armed",
      threshold: 5,
    });
    expect(shuffleSlot?.dataset.specialMechanism).toBe(DOG_SHUFFLE_MECHANISM_TYPE);
    expect(shuffleSlot?.dataset.specialMechanismState).toBe("armed");
    expect(shuffleSlot?.dataset.shuffleState).toBe("armed");
    expect(shuffleSlot?.classList.contains("dog-tray__slot--shuffle-armed")).toBe(true);
    expect(shuffleSlot?.getAttribute("aria-label")).toContain("待乱序");
    game.destroy();
  });

  it("正式第 3 关在机制说明中展示乱序规则", () => {
    const level = new LevelGenerator({ candidateFilter: () => true }).generate({
      levelNumber: 3,
      runSeed: "shuffle-ui-level-three",
    });
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, { level, loadout: ["tray-capacity", "wildcard", "torch"] });
    root.querySelector<HTMLButtonElement>('[data-testid="dog-special-mechanism-button"]')?.click();

    expect(root.querySelector('[data-testid="dog-special-mechanism"][data-special-mechanism="shuffle"]'))
      .not.toBeNull();
    expect(root.querySelector('[data-testid="dog-special-mechanism"][data-special-mechanism="shuffle"]')?.textContent)
      .toContain("乱序方块");
    game.destroy();
  });

  it("达到逻辑阈值后显示可触发乱序状态与可访问反馈", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const patterns: readonly DogPatternType[] = [
      WORKING_DOG,
      SINGLE_DOG,
      LICKING_DOG,
      "看门狗",
      "疯狗",
    ];
    const game = startDogLegeDogGame(root, {
      level: createLevel(patterns.map((patternType, index) =>
        createBlock(
          index === 0 ? "shuffle" : `ordinary-${index}`,
          index * 4,
          0,
          patternType,
          index === 0 ? createDogShuffleMechanism() : undefined,
        ),
      )),
      loadout: ["tray-capacity", "wildcard", "torch"],
    });

    for (const blockId of ["shuffle", "ordinary-1", "ordinary-2", "ordinary-3"]) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }

    game.selectBlock("ordinary-4");
    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);

    const shuffleSlot = root.querySelector<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-block-id="shuffle"]',
    );
    expect(game.getState().session.shuffle).toMatchObject({
      status: "consumed",
      threshold: 5,
    });
    expect(shuffleSlot?.dataset.shuffleState).toBe("consumed");
    expect(shuffleSlot?.classList.contains("dog-tray__slot--shuffle-triggerable")).toBe(false);
    expect(shuffleSlot?.getAttribute("aria-label")).toContain("已消耗");
    const shuffleEffect = root.querySelector<HTMLElement>('[data-testid="dog-shuffle-effect"]');
    expect(shuffleEffect?.dataset.shuffleOutcome).toBe("stable");
    expect(game.getState().inputLocked).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-replay-current-level"]')?.disabled ?? true)
      .toBe(true);
    const shuffleStatus = root.querySelector<HTMLElement>('[data-testid="dog-shuffle-status"]');
    expect(shuffleStatus?.dataset.shuffleState).toBe("consumed");
    expect(shuffleStatus?.textContent)
      .toContain("已消耗");
    await vi.runAllTimersAsync();
    expect(game.getState().inputLocked).toBe(false);
    game.destroy();
  });

  it("复原哨在乱序动画后开放，反向反馈期间锁定输入并在结束后复原", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createRestoreUiLevel(),
      loadout: ["restore-whistle", "tray-capacity", "torch"],
    });

    for (const blockId of ["shuffle", "single-1", "licking-1", "guard-1"]) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }
    game.selectBlock("mad-1");

    expect(game.getState().inputLocked).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-replay-current-level"]')?.disabled)
      .toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-item-id="restore-whistle"]')?.disabled)
      .toBe(true);
    await vi.runAllTimersAsync();

    const shuffledIds = game.getState().session.trayBlocks.map((block) => block.id);
    expect(game.getState().items?.items.find((item) => item.id === "restore-whistle"))
      .toMatchObject({ available: true, remainingUses: 1 });
    const whistle = root.querySelector<HTMLButtonElement>('[data-item-id="restore-whistle"]');
    expect(whistle?.disabled).toBe(false);
    expect(whistle?.getAttribute("aria-label")).toContain("复原哨");

    whistle?.click();

    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual(shuffledIds);
    expect(root.querySelector<HTMLElement>('[data-testid="dog-shuffle-effect"]')?.dataset.shuffleOutcome)
      .toBe("restored");

    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-replay-current-level"]')?.disabled)
      .toBe(false);
    expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
      "shuffle",
      "single-1",
      "licking-1",
      "guard-1",
      "mad-1",
    ]);
    expect(game.getState().session.trayBlocks[0]?.specialMechanism).toBeUndefined();
    expect(game.getState().items?.items.find((item) => item.id === "restore-whistle"))
      .toMatchObject({ available: false, remainingUses: 0 });
    game.destroy();
  });
});

function createRestoreUiLevel(): DogLegeDogLevel {
  return {
    ...createLevel([
      createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
      createBlock("single-1", 4, 0, SINGLE_DOG),
      createBlock("licking-1", 8, 0, LICKING_DOG),
      createBlock("guard-1", 12, 0, "看门狗"),
      createBlock("mad-1", 16, 0, "疯狗"),
      createBlock("working-2", 20, 0, WORKING_DOG),
      createBlock("working-3", 24, 0, WORKING_DOG),
      createBlock("single-2", 28, 0, SINGLE_DOG),
      createBlock("single-3", 32, 0, SINGLE_DOG),
      createBlock("licking-2", 36, 0, LICKING_DOG),
      createBlock("licking-3", 40, 0, LICKING_DOG),
      createBlock("guard-2", 44, 0, "看门狗"),
      createBlock("guard-3", 48, 0, "看门狗"),
      createBlock("mad-2", 52, 0, "疯狗"),
      createBlock("mad-3", 56, 0, "疯狗"),
    ]),
    runSeed: "restore-whistle-ui",
  };
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
