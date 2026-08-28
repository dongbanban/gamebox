// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOCK_FLIGHT_DURATION_MS } from "@/games/dog-lege-dog/assets/animation-effects";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_SHUFFLE_MECHANISM_TYPE,
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

    for (const blockId of ["shuffle", "ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4"]) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }

    const shuffleSlot = root.querySelector<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-block-id="shuffle"]',
    );
    expect(game.getState().session.shuffle).toMatchObject({
      status: "triggerable",
      threshold: 5,
    });
    expect(shuffleSlot?.dataset.shuffleState).toBe("triggerable");
    expect(shuffleSlot?.classList.contains("dog-tray__slot--shuffle-triggerable")).toBe(true);
    expect(shuffleSlot?.getAttribute("aria-label")).toContain("可触发乱序");
    const shuffleStatus = root.querySelector<HTMLElement>('[data-testid="dog-shuffle-status"]');
    expect(shuffleStatus?.dataset.shuffleState).toBe("triggerable");
    expect(shuffleStatus?.textContent)
      .toContain("可触发乱序");
    game.destroy();
  });
});

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
