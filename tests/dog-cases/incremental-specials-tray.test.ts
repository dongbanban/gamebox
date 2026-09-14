/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BLOCK_FLIGHT_DURATION_MS,
  DOG_DEMAGNETIZER_DURATION_MS,
  DOG_MAGNETIC_ATTRACTION_DURATION_MS,
} from "@/games/dog-lege-dog/assets/animation-effects";
import { getDogPatternAssetUrl } from "@/games/dog-lege-dog/assets/game-assets";
import { startDogLegeDogGame } from "@/games/dog-lege-dog/game/game-controller";
import {
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import { createBlock, createLevel } from "../support/item-fixtures";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";

afterEach(() => {
  vi.useRealTimers();
});

describe("狗了个狗特殊状态增量渲染 · 暂存槽结算", () => {
  it("双生只移除一个棋盘节点并在暂存槽相邻新增稳定普通节点", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("twin", WORKING_DOG, {
          type: DOG_TWIN_MECHANISM_TYPE,
          state: { status: DOG_TWIN_MECHANISM_TYPE },
        }),
        createBlock("untouched", SINGLE_DOG, undefined, { x: 4 }),
        createBlock("remaining", "舔狗", undefined, { x: 8 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const tray = root.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
      const twin = root.querySelector<HTMLElement>('[data-block-id="twin"]');
      const untouched = root.querySelector<HTMLElement>('[data-block-id="untouched"]');
      if (board === null || tray === null || twin === null || untouched === null) {
        throw new Error("Expected twin fixture DOM");
      }

      const initialSlots = [...tray.children];
      const boardRecords: MutationRecord[] = [];
      const boardObserver = new MutationObserver((records) => boardRecords.push(...records));
      boardObserver.observe(board, { childList: true });

      game.selectBlock("twin");

      expect(game.getState().inputLocked).toBe(true);
      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        "twin-1",
        "twin-2",
      ]);
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="twin"]')).toBeNull();
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="untouched"]')).toBe(untouched);
      expect([...tray.querySelectorAll<HTMLElement>('[data-block-id]')].map((slot) => slot.dataset.blockId))
        .toEqual(["twin-1", "twin-2"]);
      expect(tray.querySelector('[data-block-id="twin-1"]')?.nextElementSibling)
        .toBe(tray.querySelector('[data-block-id="twin-2"]'));
      expect([...tray.children].slice(2)).toEqual(initialSlots.slice(2));
      expect([...tray.querySelectorAll<HTMLElement>('[data-block-id]')].every((slot) =>
        slot.dataset.specialMechanism === undefined,
      )).toBe(true);

      await vi.runAllTimersAsync();
      boardObserver.disconnect();

      expect(root.querySelector('[data-testid="dog-block"][data-block-id="untouched"]')).toBe(untouched);
      expect(boardRecords.flatMap((record) => [...record.removedNodes])).toEqual([twin]);
      expect(boardRecords.flatMap((record) => [...record.addedNodes])).toEqual([]);
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("消磁仪只替换目标棋盘节点并保留其他节点", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("magnetic", WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("untouched", SINGLE_DOG, undefined, { x: 4 }),
      ]),
      loadout: ["demagnetizer", "wildcard", "torch"],
    });

    try {
      const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const target = root.querySelector<HTMLElement>('[data-block-id="magnetic"]');
      const untouched = root.querySelector<HTMLElement>('[data-block-id="untouched"]');
      if (board === null || target === null || untouched === null) {
        throw new Error("Expected demagnetizer fixture DOM");
      }

      const boardRecords: MutationRecord[] = [];
      const boardObserver = new MutationObserver((records) => boardRecords.push(...records));
      boardObserver.observe(board, { childList: true });

      root.querySelector<HTMLButtonElement>('[data-item-id="demagnetizer"]')?.click();
      target.click();

      expect(game.getState().inputLocked).toBe(true);
      expect(target.dataset.specialMechanism).toBe(DOG_MAGNETIC_MECHANISM_TYPE);
      expect(root.querySelector('[data-testid="dog-demagnetizer-effect"]')).not.toBeNull();

      await vi.advanceTimersByTimeAsync(DOG_DEMAGNETIZER_DURATION_MS);
      await vi.runAllTimersAsync();
      boardObserver.disconnect();

      const replacement = root.querySelector<HTMLElement>('[data-block-id="magnetic"]');
      expect(replacement).not.toBe(target);
      expect(replacement?.dataset.specialMechanism).toBeUndefined();
      expect(root.querySelector('[data-block-id="untouched"]')).toBe(untouched);
      expect(boardRecords.flatMap((record) => [...record.removedNodes])).toEqual([target]);
      expect(boardRecords.flatMap((record) => [...record.addedNodes])).toEqual([replacement]);
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("磁吸被吸幻化方块时先飞行伪装图案再原位揭示真实图案", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("magnetic", WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("illusion-target", SINGLE_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: "舔狗" },
        }, { x: 4 }),
        createBlock("untouched", WORKING_DOG, undefined, { x: 8 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      game.selectBlock("magnetic");
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="illusion-target"]'))
        .not.toBeNull();

      await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
      await vi.advanceTimersByTimeAsync(DOG_MAGNETIC_ATTRACTION_DURATION_MS);
      expect(root.querySelector('[data-testid="dog-flight"][data-pattern-type="单身狗"] img')
        ?.getAttribute("src"))
        .toBe(getDogPatternAssetUrl("舔狗"));

      await vi.runAllTimersAsync();

      const targetSlot = root.querySelector<HTMLElement>('[data-block-id="illusion-target"]');
      expect(targetSlot).not.toBeNull();
      expect(targetSlot?.dataset.specialMechanism).toBeUndefined();
      expect(targetSlot?.querySelector("img")?.getAttribute("src"))
        .toBe(getDogPatternAssetUrl(SINGLE_DOG));
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="untouched"]'))
        .not.toBeNull();
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("磁吸被吸双生方块时只新增两个稳定相邻的普通节点", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("magnetic", WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("twin-target", SINGLE_DOG, {
          type: DOG_TWIN_MECHANISM_TYPE,
          state: { status: DOG_TWIN_MECHANISM_TYPE },
        }, { x: 4 }),
        createBlock("untouched", WORKING_DOG, undefined, { x: 8 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const magnetic = root.querySelector<HTMLElement>('[data-block-id="magnetic"]');
      const target = root.querySelector<HTMLElement>('[data-block-id="twin-target"]');
      const untouched = root.querySelector<HTMLElement>('[data-block-id="untouched"]');
      if (board === null || magnetic === null || target === null || untouched === null) {
        throw new Error("Expected magnetic twin fixture DOM");
      }
      const boardRecords: MutationRecord[] = [];
      const boardObserver = new MutationObserver((records) => boardRecords.push(...records));
      boardObserver.observe(board, { childList: true });

      game.selectBlock("magnetic");
      await vi.runAllTimersAsync();
      boardObserver.disconnect();

      expect(root.querySelector('[data-testid="dog-block"][data-block-id="twin-target"]')).toBeNull();
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="untouched"]')).toBe(untouched);
      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        "magnetic",
        "twin-target-1",
        "twin-target-2",
      ]);
      const splitSlots = [
        root.querySelector<HTMLElement>('[data-block-id="twin-target-1"]'),
        root.querySelector<HTMLElement>('[data-block-id="twin-target-2"]'),
      ];
      expect(splitSlots[0]?.nextElementSibling).toBe(splitSlots[1]);
      expect(splitSlots.every((slot) => slot?.dataset.specialMechanism === undefined)).toBe(true);
      expect(boardRecords.flatMap((record) => [...record.removedNodes])).toEqual([magnetic, target]);
      expect(boardRecords.flatMap((record) => [...record.addedNodes])).toEqual([]);
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("磁吸没有合法目标时只入槽自身并保留其他棋盘节点", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("magnetic", WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("same-pattern", WORKING_DOG, undefined, { x: 4 }),
        createBlock("other-magnetic", SINGLE_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }, { x: 8 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      const samePattern = root.querySelector<HTMLElement>('[data-block-id="same-pattern"]');
      const otherMagnetic = root.querySelector<HTMLElement>('[data-block-id="other-magnetic"]');
      const tray = root.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
      if (samePattern === null || otherMagnetic === null || tray === null) {
        throw new Error("Expected magnetic no-target fixture DOM");
      }
      const initialSlots = [...tray.children];

      game.selectBlock("magnetic");
      expect(game.getState().session.remainingBlocks.map((block) => block.id)).toEqual([
        "same-pattern",
        "other-magnetic",
      ]);
      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual(["magnetic"]);
      expect(root.querySelector('[data-block-id="same-pattern"]')).toBe(samePattern);
      expect(root.querySelector('[data-block-id="other-magnetic"]')).toBe(otherMagnetic);
      expect(game.getState().inputLocked).toBe(true);

      await vi.runAllTimersAsync();

      expect(root.querySelector('[data-block-id="same-pattern"]')).toBe(samePattern);
      expect(root.querySelector('[data-block-id="other-magnetic"]')).toBe(otherMagnetic);
      expect([...tray.children].slice(1)).toEqual(initialSlots.slice(1));
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("磁吸入槽触发三消时只保留最终目标槽并复用增量结算", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("prefix", "舔狗"),
        createBlock("working-1", WORKING_DOG, undefined, { x: 4 }),
        createBlock("working-2", WORKING_DOG, undefined, { x: 8 }),
        createBlock("magnetic", WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }, { x: 12 }),
        createBlock("target", SINGLE_DOG, undefined, { x: 16 }),
        createBlock("untouched", WORKING_DOG, undefined, { x: 20 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      for (const blockId of ["prefix", "working-1", "working-2"]) {
        game.selectBlock(blockId);
        await vi.runAllTimersAsync();
      }

      const prefixSlot = root.querySelector<HTMLElement>('[data-block-id="prefix"]');
      const targetBefore = root.querySelector<HTMLElement>('[data-block-id="target"]');
      const untouched = root.querySelector<HTMLElement>('[data-block-id="untouched"]');
      if (prefixSlot === null || targetBefore === null || untouched === null) {
        throw new Error("Expected magnetic match fixture DOM");
      }

      game.selectBlock("magnetic");
      expect(game.getState().inputLocked).toBe(true);

      await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
      await vi.advanceTimersByTimeAsync(DOG_MAGNETIC_ATTRACTION_DURATION_MS);
      await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);

      expect(game.getState().feedback).toBe("match");
      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        "prefix",
        "target",
      ]);
      expect(root.querySelector('[data-block-id="prefix"]')).toBe(prefixSlot);
      expect(root.querySelector('[data-block-id="target"]')).not.toBe(targetBefore);
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="target"]')).toBeNull();
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="untouched"]')).toBe(untouched);

      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
      expect(game.getState().feedback).toBe("idle");
    } finally {
      game.destroy();
    }
  });

  it("双生分裂触发三消后按最终槽状态结算", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("prefix", "舔狗"),
        createBlock("working-1", WORKING_DOG, undefined, { x: 4 }),
        createBlock("working-2", WORKING_DOG, undefined, { x: 8 }),
        createBlock("twin", WORKING_DOG, {
          type: DOG_TWIN_MECHANISM_TYPE,
          state: { status: DOG_TWIN_MECHANISM_TYPE },
        }, { x: 12 }),
        createBlock("untouched", SINGLE_DOG, undefined, { x: 16 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      for (const blockId of ["prefix", "working-1", "working-2"]) {
        game.selectBlock(blockId);
        await vi.runAllTimersAsync();
      }

      const prefixSlot = root.querySelector<HTMLElement>('[data-block-id="prefix"]');
      const untouched = root.querySelector<HTMLElement>('[data-block-id="untouched"]');
      if (prefixSlot === null || untouched === null) {
        throw new Error("Expected twin match fixture DOM");
      }

      game.selectBlock("twin");
      expect(game.getState().feedback).toBe("match");
      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        "prefix",
        "twin-2",
      ]);
      expect(root.querySelector('[data-block-id="prefix"]')).toBe(prefixSlot);
      expect(root.querySelector<HTMLElement>('[data-testid="dog-twin-split-effect"]')?.dataset.twinBlockIds)
        .toBe("twin-1,twin-2");
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="twin"]')).toBeNull();
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="untouched"]')).toBe(untouched);

      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("双生分裂超出容量时保留两个独立节点并判定失败", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("working", WORKING_DOG),
        createBlock("single", SINGLE_DOG, undefined, { x: 4 }),
        createBlock("licking", "舔狗", undefined, { x: 8 }),
        createBlock("guard", "看门狗", undefined, { x: 12 }),
        createBlock("crazy", "疯狗", undefined, { x: 16 }),
        createBlock("destroyer", "拆家狗", undefined, { x: 20 }),
        createBlock("twin", "社恐狗", {
          type: DOG_TWIN_MECHANISM_TYPE,
          state: { status: DOG_TWIN_MECHANISM_TYPE },
        }, { x: 24 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      for (const blockId of ["working", "single", "licking", "guard", "crazy", "destroyer"]) {
        game.selectBlock(blockId);
        await vi.runAllTimersAsync();
      }

      game.selectBlock("twin");
      expect(game.getState().status).toBe("lost");
      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        "working",
        "single",
        "licking",
        "guard",
        "crazy",
        "destroyer",
        "twin-1",
        "twin-2",
      ]);
      expect(root.querySelector('[data-block-id="twin-1"]')?.nextElementSibling)
        .toBe(root.querySelector('[data-block-id="twin-2"]'));
      expect(game.getState().inputLocked).toBe(true);

      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("双生分裂恰好填满容量时保留原子结果并不提前失败", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("working", WORKING_DOG),
        createBlock("single", SINGLE_DOG, undefined, { x: 4 }),
        createBlock("licking", "舔狗", undefined, { x: 8 }),
        createBlock("guard", "看门狗", undefined, { x: 12 }),
        createBlock("crazy", "疯狗", undefined, { x: 16 }),
        createBlock("twin", "社恐狗", {
          type: DOG_TWIN_MECHANISM_TYPE,
          state: { status: DOG_TWIN_MECHANISM_TYPE },
        }, { x: 20 }),
        createBlock("remaining", "社恐狗", undefined, { x: 24 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      for (const blockId of ["working", "single", "licking", "guard", "crazy"]) {
        game.selectBlock(blockId);
        await vi.runAllTimersAsync();
      }

      game.selectBlock("twin");
      expect(game.getState().status).toBe("playing");
      expect(game.getState().session.trayFreeCapacity).toBe(0);
      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        "working",
        "single",
        "licking",
        "guard",
        "crazy",
        "twin-1",
        "twin-2",
      ]);
      expect(game.getState().inputLocked).toBe(true);

      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });
});
