// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { startDogLegeDogGame } from "@/games/dog-lege-dog/game/game-controller";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  createDogShuffleMechanism,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config";
import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import { createBlock, createLevel } from "../support/item-fixtures";
import { createRestoreUiLevel } from "../support/shuffle-ui-fixtures";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";

afterEach(() => {
  vi.useRealTimers();
});

describe("特殊机制测试 · shuffle-ui · 复原", () => {
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

  it("下一次公开棋盘选择后使复原哨事务失效", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createRestoreUiLevel(),
      loadout: ["restore-whistle", "tray-capacity", "torch"],
    });

    try {
      for (const blockId of ["shuffle", "single-1", "licking-1", "guard-1", "mad-1"]) {
        game.selectBlock(blockId);
        await vi.runAllTimersAsync();
      }

      expect(game.getState().items?.items.find((item) => item.id === "restore-whistle"))
        .toMatchObject({ available: true, remainingUses: 1 });
      game.selectBlock("working-2");

      expect(game.getState().inputLocked).toBe(true);
      expect(game.getState().items?.items.find((item) => item.id === "restore-whistle"))
        .toMatchObject({ available: false, remainingUses: 1 });
      await vi.runAllTimersAsync();
      expect(game.getState().items?.items.find((item) => item.id === "restore-whistle"))
        .toMatchObject({ available: false, remainingUses: 1 });
    } finally {
      game.destroy();
    }
  });

  it("乱序重排和复原只移动既有暂存槽节点", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createRestoreUiLevel(),
      loadout: ["restore-whistle", "tray-capacity", "torch"],
    });

    try {
      for (const blockId of ["shuffle", "single-1", "licking-1", "guard-1"]) {
        game.selectBlock(blockId);
        await vi.runAllTimersAsync();
      }

      const tray = root.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
      if (tray === null) {
        throw new Error("Expected restore fixture tray");
      }
      const beforeShuffleIds = game.getState().session.trayBlocks.map((block) => block.id);
      const beforeShuffleChildren = [...tray.children];
      const beforeShuffleSlots = new Map(
        [...tray.querySelectorAll<HTMLElement>("[data-block-id]")]
          .map((slot) => [slot.dataset.blockId, slot] as const),
      );

      const reorderObserver = new MutationObserver(() => undefined);
      reorderObserver.observe(tray, { childList: true });
      game.selectBlock("mad-1");
      const reorderMutations = reorderObserver.takeRecords();
      reorderObserver.disconnect();

      const shuffledIds = game.getState().session.trayBlocks.map((block) => block.id);
      expect(shuffledIds).not.toEqual([...beforeShuffleIds, "mad-1"]);
      expect([...tray.querySelectorAll<HTMLElement>("[data-block-id]")]
        .map((slot) => slot.dataset.blockId)).toEqual(shuffledIds);
      expect(new Set(tray.children)).toEqual(new Set(beforeShuffleChildren));
      expect(reorderMutations.flatMap((record) => [
        ...record.addedNodes,
        ...record.removedNodes,
      ]).every((node) => node instanceof HTMLElement && beforeShuffleChildren.includes(node)))
        .toBe(true);
      for (const [blockId, slot] of beforeShuffleSlots) {
        expect(root.querySelector(`[data-block-id="${blockId}"]`)).toBe(slot);
      }

      await vi.runAllTimersAsync();
      const shuffledChildren = [...tray.children];
      const beforeRestoreSlots = new Map(
        [...tray.querySelectorAll<HTMLElement>("[data-block-id]")]
          .map((slot) => [slot.dataset.blockId, slot] as const),
      );
      const restoreObserver = new MutationObserver(() => undefined);
      restoreObserver.observe(tray, { childList: true });
      root.querySelector<HTMLButtonElement>('[data-item-id="restore-whistle"]')?.click();
      await vi.runAllTimersAsync();
      const restoreMutations = restoreObserver.takeRecords();
      restoreObserver.disconnect();

      const restoredIds = game.getState().session.trayBlocks.map((block) => block.id);
      expect(restoredIds).toEqual([
        ...beforeShuffleIds,
        "mad-1",
      ]);
      expect([...tray.querySelectorAll<HTMLElement>("[data-block-id]")]
        .map((slot) => slot.dataset.blockId)).toEqual(restoredIds);
      expect(new Set(tray.children)).toEqual(new Set(shuffledChildren));
      expect(restoreMutations.flatMap((record) => [
        ...record.addedNodes,
        ...record.removedNodes,
      ]).every((node) => node instanceof HTMLElement && shuffledChildren.includes(node)))
        .toBe(true);
      for (const [blockId, slot] of beforeRestoreSlots) {
        expect(root.querySelector(`[data-block-id="${blockId}"]`)).toBe(slot);
      }
    } finally {
      game.destroy();
    }
  });

  it("乱序结算使用最终快照并保留冻结进度与稳定节点", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const config = {
      ...DOG_V13_CONFIG,
      items: {
        ...DOG_V13_CONFIG.items,
        key: { ...DOG_V13_CONFIG.items.key, dropRate: 1 },
      },
    } satisfies typeof DOG_V13_CONFIG;
    const game = startDogLegeDogGame(root, {
      config,
      level: {
        ...createLevel([
          createBlock("frozen", "看门狗", {
            type: DOG_FREEZE_MECHANISM_TYPE,
            state: { status: "frozen", completedTriples: 0 },
          }),
          createBlock("working-1", WORKING_DOG, undefined, { x: 4 }),
          createBlock("single-1", SINGLE_DOG, undefined, { x: 8 }),
          createBlock("working-2", WORKING_DOG, undefined, { x: 12 }),
          createBlock("licking-1", LICKING_DOG, undefined, { x: 16 }),
          createBlock("shuffle", WORKING_DOG, createDogShuffleMechanism(), { x: 20 }),
          createBlock("single-2", SINGLE_DOG, undefined, { x: 24 }),
          createBlock("single-3", SINGLE_DOG, undefined, { x: 28 }),
          createBlock("licking-2", LICKING_DOG, undefined, { x: 32 }),
          createBlock("licking-3", LICKING_DOG, undefined, { x: 36 }),
          createBlock("guard-2", "看门狗", undefined, { x: 40 }),
          createBlock("guard-3", "看门狗", undefined, { x: 44 }),
        ]),
        lockedTraySlotCount: 1,
      },
      loadout: ["restore-whistle", "key", "tray-capacity"],
    });

    try {
      for (const blockId of [
        "frozen",
        "working-1",
        "single-1",
        "working-2",
        "licking-1",
      ]) {
        game.selectBlock(blockId);
        await vi.runAllTimersAsync();
      }

      const tray = root.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
      const beforeSlots = new Map(
        [...tray?.querySelectorAll<HTMLElement>("[data-block-id]") ?? []]
          .map((slot) => [slot.dataset.blockId, slot] as const),
      );
      if (tray === null) {
        throw new Error("Expected shuffle settlement tray");
      }

      game.selectBlock("shuffle");

      expect(game.getState().session.trayBlocks.find((block) => block.id === "frozen"))
        .toMatchObject({
          specialMechanism: {
            type: DOG_FREEZE_MECHANISM_TYPE,
            state: { completedTriples: 1 },
          },
        });
      expect(game.getState().session.trayBlocks.length).toBeLessThan(6);
      expect([...tray.querySelectorAll<HTMLElement>("[data-block-id]")]
        .map((slot) => slot.dataset.blockId)).toEqual(
        game.getState().session.trayBlocks.map((block) => block.id),
      );
      for (const [blockId, slot] of beforeSlots) {
        if (root.querySelector(`[data-block-id="${blockId}"]`) !== null) {
          expect(root.querySelector(`[data-block-id="${blockId}"]`)).toBe(slot);
        }
      }
      expect(root.querySelector('[data-block-id="frozen"]')).toBe(
        beforeSlots.get("frozen"),
      );
      expect(tray.querySelector<HTMLElement>('[data-block-id="frozen"]')?.dataset.specialMechanismProgress)
        .toBe("1");

      await vi.runAllTimersAsync();
      expect(game.getState().items?.items.find((item) => item.id === "restore-whistle"))
        .toMatchObject({ available: true, remainingUses: 1 });
      expect(game.getState().items?.items.find((item) => item.id === "key"))
        .toMatchObject({ available: true, remainingUses: 1 });
      const afterShuffleSlots = new Map(
        [...tray.querySelectorAll<HTMLElement>("[data-block-id]")]
          .map((slot) => [slot.dataset.blockId, slot] as const),
      );
      root.querySelector<HTMLButtonElement>('[data-item-id="restore-whistle"]')?.click();
      expect(game.getState().inputLocked).toBe(true);
      await vi.runAllTimersAsync();

      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        ...beforeSlots.keys(),
        "shuffle",
      ]);
      expect(game.getState().session.trayBlocks.find((block) => block.id === "frozen"))
        .toMatchObject({ specialMechanism: { state: { completedTriples: 0 } } });
      expect(game.getState().session.trayBlocks.find((block) => block.id === "shuffle")?.specialMechanism)
        .toBeUndefined();
      expect(game.getState().items?.items.find((item) => item.id === "key"))
        .toMatchObject({ available: false, remainingUses: 0 });
      for (const [blockId, slot] of afterShuffleSlots) {
        expect(root.querySelector(`[data-block-id="${blockId}"]`)).toBe(slot);
      }
    } finally {
      game.destroy();
    }
  });
});
