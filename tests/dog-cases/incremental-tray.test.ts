/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOCK_FLIGHT_DURATION_MS } from "@/games/dog-lege-dog/assets/animation-effects";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  startDogLegeDogGame,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import {
  createKeyUiLevel,
  createWildcardUiLevel,
  startTestGame,
} from "../support/dog-game-fixtures";
import { createBlock, createLevel } from "../support/item-fixtures";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";

afterEach(() => {
  vi.useRealTimers();
});

describe("狗了个狗增量暂存槽渲染", () => {
  it("普通三消只收拢真实变化方块并保留其他槽位节点", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("prefix", SINGLE_DOG, undefined, { x: 0 }),
        createBlock("triple-1", WORKING_DOG, undefined, { x: 4 }),
        createBlock("triple-2", WORKING_DOG, undefined, { x: 8 }),
        createBlock("suffix", LICKING_DOG, undefined, { x: 12 }),
        createBlock("triple-3", WORKING_DOG, undefined, { x: 16 }),
      ]),
      loadout: ["tray-capacity", "wildcard", "torch"],
    });

    try {
      for (const blockId of ["prefix", "suffix", "triple-1", "triple-2"]) {
        game.selectBlock(blockId);
        await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
        await vi.runAllTimersAsync();
      }

      const tray = root.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
      const prefixSlot = root.querySelector<HTMLElement>('[data-block-id="prefix"]');
      const suffixSlot = root.querySelector<HTMLElement>('[data-block-id="suffix"]');
      const emptySlots = [...tray?.querySelectorAll<HTMLElement>('[data-slot-state="empty"]') ?? []];
      if (tray === null || prefixSlot === null || suffixSlot === null) {
        throw new Error("Expected triple fixture DOM");
      }
      const prefixPattern = prefixSlot.dataset.patternType;
      const prefixAccessibleName = prefixSlot.getAttribute("aria-label");
      const suffixPattern = suffixSlot.dataset.patternType;
      const suffixAccessibleName = suffixSlot.getAttribute("aria-label");

      game.selectBlock("triple-3");

      expect(game.getState().inputLocked).toBe(true);
      expect(game.getState().feedback).toBe("match");
      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        "prefix",
        "suffix",
      ]);
      expect(root.querySelector('[data-block-id="prefix"]')).toBe(prefixSlot);
      expect(root.querySelector('[data-block-id="suffix"]')).toBe(suffixSlot);
      expect(prefixSlot.dataset.patternType).toBe(prefixPattern);
      expect(prefixSlot.getAttribute("aria-label")).toBe(prefixAccessibleName);
      expect(suffixSlot.dataset.patternType).toBe(suffixPattern);
      expect(suffixSlot.getAttribute("aria-label")).toBe(suffixAccessibleName);
      expect([...tray.querySelectorAll<HTMLElement>('[data-block-id]')].map((slot) => slot.dataset.blockId))
        .toEqual(["prefix", "suffix"]);
      expect(
        [...tray.querySelectorAll<HTMLElement>('[data-slot-state="empty"]')].slice(-emptySlots.length),
      ).toEqual(emptySlots);

      await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
      expect(game.getState().feedback).toBe("idle");
    } finally {
      game.destroy();
    }
  });

  it("一次选择产生连续多组三消时只保留最终暂存槽顺序", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("prefix", LICKING_DOG, undefined, { x: 0 }),
        createBlock("frozen", WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 1 },
        }, { x: 4 }),
        createBlock("working-1", WORKING_DOG, undefined, { x: 8 }),
        createBlock("working-2", WORKING_DOG, undefined, { x: 12 }),
        createBlock("single-1", SINGLE_DOG, undefined, { x: 16 }),
        createBlock("single-2", SINGLE_DOG, undefined, { x: 20 }),
        createBlock("single-3", SINGLE_DOG, undefined, { x: 24 }),
      ]),
      loadout: ["tray-capacity", "wildcard", "torch"],
    });

    try {
      for (const blockId of [
        "prefix",
        "frozen",
        "working-1",
        "working-2",
        "single-1",
        "single-2",
      ]) {
        game.selectBlock(blockId);
        await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
        await vi.runAllTimersAsync();
      }

      const prefixSlot = root.querySelector<HTMLElement>('[data-block-id="prefix"]');
      if (prefixSlot === null) {
        throw new Error("Expected cascade fixture prefix slot");
      }

      const tray = root.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
      if (tray === null) {
        throw new Error("Expected cascade fixture tray");
      }
      const observer = new MutationObserver(() => undefined);
      observer.observe(tray, { childList: true });
      game.selectBlock("single-3");
      const records = observer.takeRecords();
      observer.disconnect();

      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        "prefix",
      ]);
      expect(root.querySelector('[data-block-id="prefix"]')).toBe(prefixSlot);
      expect(records.flatMap((record) => [...record.removedNodes])).toHaveLength(0);
      expect(records.flatMap((record) => [...record.addedNodes])).toHaveLength(0);
    } finally {
      game.destroy();
    }
  });

  it("公开道具三消移除只移除目标槽对和自动补充的棋盘方块", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startTestGame(root, {
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    try {
      for (const blockId of game.getState().level.solutionPath) {
        const state = game.getState();
        const itemState = state.items;
        const targetBlockId = itemState?.tripleRemovalTargetBlockIds[0];
        const tripleRemoval = itemState?.items.find((item) => item.id === "triple-removal");
        if (!tripleRemoval?.available || targetBlockId === undefined) {
          if (state.session.status !== "playing") {
            break;
          }
          game.selectBlock(blockId);
          await vi.runAllTimersAsync();
          continue;
        }

        const beforeBoard = new Map(
          [...root.querySelectorAll<HTMLElement>('[data-testid="dog-block"]')]
            .map((block) => [block.dataset.blockId, block] as const),
        );
        const beforeTray = new Map(
          [...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"][data-block-id]')]
            .map((slot) => [slot.dataset.blockId, slot] as const),
        );
        const targetIndex = state.session.trayBlocks.findIndex((block) => block.id === targetBlockId);
        const adjacentTargetId = state.session.trayBlocks[targetIndex + 1]?.id;
        const targetTrayBlockIds = new Set([targetBlockId]);
        if (adjacentTargetId !== undefined) {
          targetTrayBlockIds.add(adjacentTargetId);
        }

        root.querySelector<HTMLButtonElement>(
          '[data-action="use-item"][data-item-id="triple-removal"]',
        )?.click();
        root.querySelector<HTMLElement>(
          `[data-testid="dog-tray-slot"][data-block-id="${targetBlockId}"]`,
        )?.click();
        const expectedCompensatedBlockId = root.querySelector<HTMLElement>(
          '[data-testid="dog-item-effect"][data-item-id="triple-removal"]',
        )?.dataset.blockIds;
        await vi.runAllTimersAsync();

        const afterBoard = new Map(
          [...root.querySelectorAll<HTMLElement>('[data-testid="dog-block"]')]
            .map((block) => [block.dataset.blockId, block] as const),
        );
        const afterTray = new Map(
          [...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"][data-block-id]')]
            .map((slot) => [slot.dataset.blockId, slot] as const),
        );
        const removedBoardIds = [...beforeBoard.keys()].filter((id) => !afterBoard.has(id));

        expect(removedBoardIds).toHaveLength(1);
        expect(expectedCompensatedBlockId).toBe(removedBoardIds[0]);
        expect([...targetTrayBlockIds].every((id) => !afterTray.has(id))).toBe(true);
        for (const [id, element] of beforeBoard) {
          if (!removedBoardIds.includes(id)) {
            expect(afterBoard.get(id)).toBe(element);
          }
        }
        for (const [id, element] of beforeTray) {
          if (id !== undefined && !targetTrayBlockIds.has(id) && afterTray.has(id)) {
            expect(afterTray.get(id)).toBe(element);
          }
        }
        expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual(
          [...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"][data-block-id]')]
            .map((slot) => slot.dataset.blockId),
        );
        return;
      }

      throw new Error("Expected a usable triple-removal target");
    } finally {
      game.destroy();
    }
  });

  it("万能方块只在暂存槽末尾追加节点并保留已有方块", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createWildcardUiLevel(),
      loadout: ["wildcard", "tray-capacity", "torch"],
    });

    try {
      game.selectBlock("working-target");
      await vi.runAllTimersAsync();

      const targetSlot = root.querySelector<HTMLElement>(
        '[data-testid="dog-tray-slot"][data-block-id="working-target"]',
      );
      const beforeBoard = new Map(
        [...root.querySelectorAll<HTMLElement>('[data-testid="dog-block"]')]
          .map((block) => [block.dataset.blockId, block] as const),
      );
      if (targetSlot === null) {
        throw new Error("Expected wildcard fixture tray target");
      }

      root.querySelector<HTMLButtonElement>('[data-action="use-item"][data-item-id="wildcard"]')?.click();
      root.querySelector<HTMLElement>(
        '[data-testid="dog-tray-slot"][data-block-id="working-target"]',
      )?.click();
      await vi.runAllTimersAsync();

      const afterBoard = new Map(
        [...root.querySelectorAll<HTMLElement>('[data-testid="dog-block"]')]
          .map((block) => [block.dataset.blockId, block] as const),
      );
      expect(root.querySelector('[data-block-id="working-target"]')).toBe(targetSlot);
      expect(root.querySelector('[data-testid="dog-tray-slot"][data-visual-marker="wildcard"]'))
        .not.toBeNull();
      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        "working-target",
        "wildcard-1",
      ]);
      const trayBlockIds = [...root.querySelectorAll<HTMLElement>(
        '[data-testid="dog-tray-slot"][data-block-id]',
      )].map((slot) => slot.dataset.blockId);
      expect(trayBlockIds.at(-1)).toBe("wildcard-1");
      expect(root.querySelector('[data-testid="dog-tray-slot"][data-block-id="wildcard-1"]'))
        .toBe(root.querySelector('[data-testid="dog-tray-slot"][data-block-id="working-target"]')?.nextElementSibling);
      for (const [id, element] of beforeBoard) {
        if (id !== "working-hidden") {
          expect(afterBoard.get(id)).toBe(element);
        }
      }
      expect(afterBoard.has("working-hidden")).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("暂存槽容量提升只新增一个槽位并保留现有方块与右侧锁槽", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createKeyUiLevel(),
      loadout: ["tray-capacity", "wildcard", "torch"],
    });

    try {
      game.selectBlock("working-1");
      await vi.runAllTimersAsync();

      const tray = root.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
      const initialSlots = [...tray?.children ?? []] as HTMLElement[];
      const workingSlot = root.querySelector<HTMLElement>('[data-block-id="working-1"]');
      if (tray === null || workingSlot === null) {
        throw new Error("Expected capacity fixture DOM");
      }

      root.querySelector<HTMLButtonElement>(
        '[data-action="use-item"][data-item-id="tray-capacity"]',
      )?.click();

      expect(game.getState().session).toMatchObject({
        trayCapacity: 8,
        effectiveTrayCapacity: 6,
        lockedTraySlotCount: 2,
      });
      expect([...tray.children].slice(0, initialSlots.length)).toEqual(initialSlots);
      expect(root.querySelector('[data-block-id="working-1"]')).toBe(workingSlot);
      expect(tray.children).toHaveLength(8);
      expect(tray.lastElementChild).not.toBe(initialSlots.at(-1));
      expect(tray.querySelectorAll('[data-slot-state="locked"]')).toHaveLength(2);
      expect(tray.dataset.trayCapacity).toBe("8");
      expect(tray.dataset.effectiveTrayCapacity).toBe("6");
      expect(tray.dataset.trayFreeCapacity).toBe("5");
    } finally {
      game.destroy();
    }
  });

  it("钥匙解锁只更新目标锁槽和道具次数并保留其他槽位", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createKeyUiLevel(),
      loadout: ["key", "torch", "detector"],
    });

    try {
      for (const [index, blockId] of ["working-1", "working-2", "working-3"].entries()) {
        game.selectBlock(blockId);
        if (index === 2) {
          await vi.advanceTimersByTimeAsync(700);
        }
        await vi.runAllTimersAsync();
      }

      const tray = root.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
      const initialSlots = [...tray?.children ?? []] as HTMLElement[];
      if (tray === null || initialSlots.length !== 7) {
        throw new Error("Expected key fixture tray DOM");
      }
      expect(game.getState().items?.items.find((item) => item.id === "key"))
        .toMatchObject({ remainingUses: 1, available: true });

      root.querySelector<HTMLButtonElement>('[data-action="use-item"][data-item-id="key"]')?.click();

      expect(game.getState().session).toMatchObject({
        trayCapacity: 7,
        effectiveTrayCapacity: 6,
        lockedTraySlotCount: 1,
      });
      expect([...tray.children]).toEqual(initialSlots);
      expect(tray.children[5]).toBe(initialSlots[5]);
      expect(tray.children[6]).toBe(initialSlots[6]);
      expect(tray.children[5]?.getAttribute("data-slot-state")).toBe("empty");
      expect(tray.children[6]?.getAttribute("data-slot-state")).toBe("locked");
      expect(root.querySelector('[data-testid="dog-tray-unlock-effect"]')).not.toBeNull();
      expect(tray.dataset.trayCapacity).toBe("7");
      expect(tray.dataset.effectiveTrayCapacity).toBe("6");
      expect(tray.dataset.trayFreeCapacity).toBe("6");
      expect(game.getState().items?.items.find((item) => item.id === "key"))
        .toMatchObject({ remainingUses: 0, available: false });

      await vi.runAllTimersAsync();
      expect([...tray.children]).toEqual(initialSlots);
      expect(tray.querySelectorAll('[data-slot-state="locked"]')).toHaveLength(1);
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });
});
