// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOCK_FLIGHT_DURATION_MS } from "@/games/dog-lege-dog/assets/animation-effects";
import { startDogLegeDogGame } from "@/games/dog-lege-dog/game/game-controller";
import {
  DOG_SHUFFLE_MECHANISM_TYPE,
  createDogShuffleMechanism,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import { LevelGenerator } from "@/games/dog-lege-dog/levels/level-generation-engine";
import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import { createBlock, createLevel } from "../support/item-fixtures";

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
        createBlock("single-1", SINGLE_DOG),
        createBlock("licking-1", LICKING_DOG, undefined, { x: 4 }),
      ]),
      onLoadoutConfirmed: vi.fn(),
    });

    expect(
      root.querySelector<HTMLButtonElement>(
        '[data-testid="dog-replay-current-level"]',
      )?.disabled,
    ).toBe(true);

    for (const itemId of ["tray-capacity", "wildcard", "torch"]) {
      root
        .querySelector<HTMLButtonElement>(`[data-loadout-id="${itemId}"]`)
        ?.click();
    }
    root
      .querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')
      ?.click();

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
    expect(
      root.querySelector<HTMLButtonElement>(
        '[data-testid="dog-replay-current-level"]',
      )?.disabled,
    ).toBe(true);
    await vi.runAllTimersAsync();
    expect(
      root.querySelector<HTMLButtonElement>(
        '[data-testid="dog-replay-current-level"]',
      )?.disabled,
    ).toBe(false);
    game.destroy();
  });

  it("乱序方块棋盘保持普通视觉，入槽后显示待乱序状态并保留输入锁", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("shuffle", WORKING_DOG, createDogShuffleMechanism()),
        createBlock("remaining", SINGLE_DOG, undefined, { x: 4 }),
      ]),
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    const boardBlock = root.querySelector<HTMLElement>(
      '[data-testid="dog-block"][data-block-id="shuffle"]',
    );
    const trayRegion = root.querySelector<HTMLElement>(
      '[data-testid="dog-tray-region"]',
    );

    expect(boardBlock?.dataset.specialMechanism).toBe(
      DOG_SHUFFLE_MECHANISM_TYPE,
    );
    expect(boardBlock?.dataset.specialMechanismState).toBe("dormant");
    expect(boardBlock?.classList.contains("dog-block--special-shuffle")).toBe(
      false,
    );
    expect(boardBlock?.classList.contains("dog-block--special")).toBe(false);
    expect(boardBlock?.querySelector(".dog-block__mechanism-icon")).toBeNull();
    expect(
      trayRegion?.style.getPropertyValue("--dog-shuffle-armed-duration"),
    ).toBe("");
    expect(
      trayRegion?.style.getPropertyValue("--dog-shuffle-triggerable-duration"),
    ).toBe("");

    game.selectBlock("shuffle");

    expect(game.getState().inputLocked).toBe(true);
    expect(
      root.querySelector<HTMLButtonElement>(
        '[data-testid="dog-replay-current-level"]',
      )?.disabled,
    ).toBe(true);
    expect(
      root.querySelector(
        '[data-testid="dog-tray-slot"][data-block-id="shuffle"]',
      ),
    ).not.toBeNull();

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
    expect(shuffleSlot?.dataset.specialMechanism).toBe(
      DOG_SHUFFLE_MECHANISM_TYPE,
    );
    expect(shuffleSlot?.dataset.specialMechanismState).toBe("armed");
    expect(shuffleSlot?.dataset.shuffleState).toBe("armed");
    expect(
      shuffleSlot?.classList.contains("dog-tray__slot--shuffle-armed"),
    ).toBe(true);
    expect(shuffleSlot?.getAttribute("aria-label")).toContain("待乱序");
    game.destroy();
  });

  it("已有可触发状态入槽后保持静态状态文案且复原哨不可用", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("shuffle", WORKING_DOG, {
          type: DOG_SHUFFLE_MECHANISM_TYPE,
          state: { status: "triggerable" },
        }),
        createBlock("remaining", SINGLE_DOG, undefined, { x: 4 }),
      ]),
      loadout: ["restore-whistle", "tray-capacity", "torch"],
    });

    try {
      game.selectBlock("shuffle");
      await vi.runAllTimersAsync();

      const shuffleSlot = root.querySelector<HTMLElement>(
        '[data-testid="dog-tray-slot"][data-block-id="shuffle"]',
      );
      expect(game.getState().session.shuffle).toMatchObject({
        blockId: "shuffle",
        status: "triggerable",
      });
      expect(shuffleSlot?.dataset.shuffleState).toBe("triggerable");
      expect(
        shuffleSlot?.classList.contains("dog-tray__slot--shuffle-triggerable"),
      ).toBe(true);
      expect(
        root.querySelector('[data-testid="dog-shuffle-status"]')?.textContent,
      ).toContain("可触发乱序");
      expect(
        game
          .getState()
          .items?.items.find((item) => item.id === "restore-whistle"),
      ).toMatchObject({ available: false, remainingUses: 1 });
      expect(
        root.querySelector<HTMLButtonElement>(
          '[data-item-id="restore-whistle"]',
        )?.disabled,
      ).toBe(true);
    } finally {
      game.destroy();
    }
  });

  it("正式第 3 关在机制说明中展示乱序规则", () => {
    const level = new LevelGenerator({ candidateFilter: () => true }).generate({
      levelNumber: 3,
      runSeed: "shuffle-ui-level-three",
    });
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level,
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    root
      .querySelector<HTMLButtonElement>(
        '[data-testid="dog-special-mechanism-button"]',
      )
      ?.click();

    expect(
      root.querySelector(
        '[data-testid="dog-special-mechanism"][data-special-mechanism="shuffle"]',
      ),
    ).not.toBeNull();
    expect(
      root.querySelector(
        '[data-testid="dog-special-mechanism"][data-special-mechanism="shuffle"]',
      )?.textContent,
    ).toContain("乱序方块");
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
      level: createLevel(
        patterns.map((patternType, index) =>
          createBlock(
            index === 0 ? "shuffle" : `ordinary-${index}`,
            patternType,
            index === 0 ? createDogShuffleMechanism() : undefined,
            { x: index * 4 },
          ),
        ),
      ),
      loadout: ["restore-whistle", "tray-capacity", "torch"],
    });

    for (const blockId of [
      "shuffle",
      "ordinary-1",
      "ordinary-2",
      "ordinary-3",
    ]) {
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }

    const shuffleSlotBeforeTrigger = root.querySelector<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-block-id="shuffle"]',
    );
    const shuffleGlyphBeforeTrigger =
      shuffleSlotBeforeTrigger?.querySelector(".dog-block__glyph");
    const shuffleStatusBeforeTrigger = root.querySelector<HTMLElement>(
      '[data-testid="dog-shuffle-status"]',
    );
    const trayBeforeTrigger = root.querySelector<HTMLOListElement>(
      '[data-testid="dog-tray"]',
    );
    if (trayBeforeTrigger === null) {
      throw new Error("Expected stable shuffle tray");
    }
    const trayChildrenBeforeTrigger = [...trayBeforeTrigger.children];
    const trayObserver = new MutationObserver(() => undefined);
    trayObserver.observe(trayBeforeTrigger, { childList: true });
    game.selectBlock("ordinary-4");
    const stableTrayMutations = trayObserver.takeRecords();
    trayObserver.disconnect();
    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);

    const shuffleSlot = root.querySelector<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-block-id="shuffle"]',
    );
    expect(
      stableTrayMutations.flatMap((record) => [...record.removedNodes]),
    ).toHaveLength(0);
    expect(
      stableTrayMutations.flatMap((record) => [...record.addedNodes]),
    ).toHaveLength(0);
    expect([...trayBeforeTrigger.children]).toEqual(trayChildrenBeforeTrigger);
    expect(shuffleSlot).toBe(shuffleSlotBeforeTrigger);
    expect(shuffleSlot?.querySelector(".dog-block__glyph")).toBe(
      shuffleGlyphBeforeTrigger,
    );
    expect(root.querySelector('[data-testid="dog-shuffle-status"]')).toBe(
      shuffleStatusBeforeTrigger,
    );
    expect(game.getState().session.shuffle).toMatchObject({
      status: "consumed",
      threshold: 5,
    });
    expect(shuffleSlot?.dataset.shuffleState).toBe("consumed");
    expect(
      shuffleSlot?.classList.contains("dog-tray__slot--shuffle-triggerable"),
    ).toBe(false);
    expect(shuffleSlot?.getAttribute("aria-label")).toContain("已消耗");
    const shuffleEffect = root.querySelector<HTMLElement>(
      '[data-testid="dog-shuffle-effect"]',
    );
    expect(shuffleEffect?.dataset.shuffleOutcome).toBe("stable");
    expect(game.getState().inputLocked).toBe(true);
    expect(
      root.querySelector<HTMLButtonElement>(
        '[data-testid="dog-replay-current-level"]',
      )?.disabled ?? true,
    ).toBe(true);
    expect(
      game
        .getState()
        .items?.items.find((item) => item.id === "restore-whistle"),
    ).toMatchObject({ available: false, remainingUses: 1 });
    const shuffleStatus = root.querySelector<HTMLElement>(
      '[data-testid="dog-shuffle-status"]',
    );
    expect(shuffleStatus?.dataset.shuffleState).toBe("consumed");
    expect(shuffleStatus?.textContent).toContain("已消耗");
    await vi.runAllTimersAsync();
    expect(game.getState().inputLocked).toBe(false);
    expect(game.getState().session.status).toBe("lost");
    expect(
      game
        .getState()
        .items?.items.find((item) => item.id === "restore-whistle"),
    ).toMatchObject({ available: false, remainingUses: 1 });
    expect(
      root.querySelector<HTMLButtonElement>('[data-item-id="restore-whistle"]')
        ?.disabled,
    ).toBe(true);
    game.destroy();
  });
});
