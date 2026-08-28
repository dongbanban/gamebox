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
