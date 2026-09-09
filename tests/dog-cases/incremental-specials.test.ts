/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BLOCK_FLIGHT_DURATION_MS,
  DOG_DEMAGNETIZER_DURATION_MS,
  DOG_DETECTOR_REVEAL_DURATION_MS,
  DOG_MAGNETIC_ATTRACTION_DURATION_MS,
  DOG_TORCH_MELT_DURATION_MS,
  DOG_ILLUSION_REVEAL_DURATION_MS,
} from "@/games/dog-lege-dog/assets/animation-effects";
import { getDogPatternAssetUrl } from "@/games/dog-lege-dog/assets/game-assets";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
  startDogLegeDogGame,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import { createBlock, createLevel } from "../support/item-fixtures";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";

afterEach(() => {
  vi.useRealTimers();
});

describe("狗了个狗特殊状态增量渲染", () => {
  it("检测仪揭示只替换目标幻化方块并保留其他棋盘节点", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("illusion", WORKING_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: SINGLE_DOG },
        }),
        createBlock("ordinary", SINGLE_DOG, undefined, { x: 4 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const target = root.querySelector<HTMLElement>('[data-block-id="illusion"]');
      const ordinary = root.querySelector<HTMLElement>('[data-block-id="ordinary"]');
      if (board === null || target === null || ordinary === null) {
        throw new Error("Expected detector fixture DOM");
      }

      const mutationRecords: MutationRecord[] = [];
      const observer = new MutationObserver((records) => mutationRecords.push(...records));
      observer.observe(board, { childList: true });
      root.querySelector<HTMLButtonElement>('[data-item-id="detector"]')?.click();
      target.click();

      expect(root.querySelector('[data-testid="dog-detector-reveal"]')?.parentElement).toBe(target);
      expect(game.getState().inputLocked).toBe(true);

      await vi.advanceTimersByTimeAsync(DOG_DETECTOR_REVEAL_DURATION_MS);
      await vi.runAllTimersAsync();
      observer.disconnect();

      const replacement = root.querySelector<HTMLElement>('[data-block-id="illusion"]');
      expect(replacement).not.toBe(target);
      expect(root.querySelector('[data-block-id="ordinary"]')).toBe(ordinary);
      expect(mutationRecords.flatMap((record) => [...record.removedNodes])).toEqual([target]);
      expect(mutationRecords.flatMap((record) => [...record.addedNodes])).toEqual([replacement]);
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("幻化飞行只移除棋盘目标并在入槽后才显示真实图案", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("illusion", WORKING_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: SINGLE_DOG },
        }),
        createBlock("ordinary", SINGLE_DOG, undefined, { x: 4 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const tray = root.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
      const target = root.querySelector<HTMLElement>('[data-block-id="illusion"]');
      const ordinary = root.querySelector<HTMLElement>('[data-block-id="ordinary"]');
      if (board === null || tray === null || target === null || ordinary === null) {
        throw new Error("Expected illusion fixture DOM");
      }

      const initialSlots = [...tray.children];
      const boardRecords: MutationRecord[] = [];
      const trayRecords: MutationRecord[] = [];
      const boardObserver = new MutationObserver((records) => boardRecords.push(...records));
      const trayObserver = new MutationObserver((records) => trayRecords.push(...records));
      boardObserver.observe(board, { childList: true });
      trayObserver.observe(tray, { childList: true });

      game.selectBlock("illusion");

      const pendingSlot = root.querySelector<HTMLElement>('[data-block-id="illusion"]');
      expect(pendingSlot).not.toBeNull();
      expect(pendingSlot?.querySelector("img")?.getAttribute("src")).toBe(
        getDogPatternAssetUrl(SINGLE_DOG),
      );
      expect(root.querySelector<HTMLElement>('[data-testid="dog-flight"] img')?.getAttribute("src"))
        .toBe(getDogPatternAssetUrl(SINGLE_DOG));
      expect(root.querySelector('[data-block-id="ordinary"]')).toBe(ordinary);
      await Promise.resolve();
      expect(boardRecords.flatMap((record) => [...record.removedNodes])).toEqual([target]);
      expect(boardRecords.flatMap((record) => [...record.addedNodes])).toEqual([]);
      expect(trayRecords.flatMap((record) => [...record.removedNodes])).toEqual([]);
      expect(trayRecords.flatMap((record) => [...record.addedNodes])).toEqual([]);
      expect([...tray.children]).toEqual(initialSlots);

      await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
      const revealedSlot = root.querySelector<HTMLElement>('[data-block-id="illusion"]');
      expect(revealedSlot).toBe(pendingSlot);
      expect(revealedSlot?.dataset.specialMechanism).toBeUndefined();
      expect(revealedSlot?.querySelector("img")?.getAttribute("src")).toBe(
        getDogPatternAssetUrl(WORKING_DOG),
      );

      await vi.advanceTimersByTimeAsync(DOG_ILLUSION_REVEAL_DURATION_MS);
      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("幻化入槽触发冻结融化时保留原槽位的一次性反馈", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("freeze", WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 1 },
        }),
        createBlock("working-1", WORKING_DOG, undefined, { x: 4 }),
        createBlock("working-2", WORKING_DOG, undefined, { x: 8 }),
        createBlock("illusion", WORKING_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: SINGLE_DOG },
        }, { x: 12 }),
        createBlock("remaining", SINGLE_DOG, undefined, { x: 16 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      for (const blockId of ["freeze", "working-1", "working-2"]) {
        game.selectBlock(blockId);
        await vi.runAllTimersAsync();
      }

      const freezeSlot = root.querySelector<HTMLElement>('[data-block-id="freeze"]');
      if (freezeSlot === null) {
        throw new Error("Expected illusion melt fixture slot");
      }

      game.selectBlock("illusion");
      await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);

      expect(root.querySelector('.dog-melt-effect')).not.toBeNull();
      expect(root.querySelector('[data-block-id="freeze"]')).toBe(freezeSlot);
      expect(freezeSlot.dataset.specialMechanism).toBeUndefined();

      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("幻化立即三消后不等待不存在的揭示节点", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("working-1", WORKING_DOG),
        createBlock("working-2", WORKING_DOG, undefined, { x: 4 }),
        createBlock("illusion", WORKING_DOG, {
          type: DOG_ILLUSION_MECHANISM_TYPE,
          state: { status: "masked", disguisedPatternType: SINGLE_DOG },
        }, { x: 8 }),
        createBlock("remaining", SINGLE_DOG, undefined, { x: 12 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      for (const blockId of ["working-1", "working-2"]) {
        game.selectBlock(blockId);
        await vi.runAllTimersAsync();
      }

      game.selectBlock("illusion");
      await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();

      expect(root.querySelector('[data-block-id="illusion"]')).toBeNull();
      expect(root.querySelector('[data-testid="dog-detector-reveal"]')).toBeNull();
      expect(game.getState().feedback).toBe("match");

      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("三消只同步冻结进度变化并保留其他冻结槽位", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("freeze-melts", WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 1 },
        }),
        createBlock("freeze-stays", SINGLE_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }, { x: 4 }),
        createBlock("working-1", WORKING_DOG, undefined, { x: 8 }),
        createBlock("working-2", WORKING_DOG, undefined, { x: 12 }),
        createBlock("working-3", WORKING_DOG, undefined, { x: 16 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      for (const blockId of ["freeze-melts", "freeze-stays", "working-1", "working-2"]) {
        game.selectBlock(blockId);
        await vi.runAllTimersAsync();
      }

      const meltingSlot = root.querySelector<HTMLElement>('[data-block-id="freeze-melts"]');
      const stayingSlot = root.querySelector<HTMLElement>('[data-block-id="freeze-stays"]');
      if (meltingSlot === null || stayingSlot === null) {
        throw new Error("Expected freeze fixture tray DOM");
      }

      game.selectBlock("working-3");

      expect(root.querySelector('[data-block-id="freeze-melts"]')).toBe(meltingSlot);
      expect(root.querySelector('[data-block-id="freeze-stays"]')).toBe(stayingSlot);
      expect(meltingSlot.dataset.specialMechanism).toBeUndefined();
      expect(stayingSlot.dataset.specialMechanism).toBe(DOG_FREEZE_MECHANISM_TYPE);
      expect(stayingSlot.dataset.specialMechanismProgress).toBe("1");
      expect(game.getState().inputLocked).toBe(true);

      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("火把棋盘融化只替换目标节点并保留其他棋盘节点", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("freeze", WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }),
        createBlock("ordinary", SINGLE_DOG, undefined, { x: 4 }),
      ]),
      loadout: ["torch", "wildcard", "detector"],
    });

    try {
      const target = root.querySelector<HTMLElement>('[data-block-id="freeze"]');
      const ordinary = root.querySelector<HTMLElement>('[data-block-id="ordinary"]');
      if (target === null || ordinary === null) {
        throw new Error("Expected torch board fixture DOM");
      }

      root.querySelector<HTMLButtonElement>('[data-item-id="torch"]')?.click();
      target.click();

      expect(game.getState().inputLocked).toBe(true);
      expect(target.dataset.specialMechanism).toBe(DOG_FREEZE_MECHANISM_TYPE);
      expect(root.querySelector('[data-testid="dog-melt-effect"][data-item-id="torch"]'))
        .not.toBeNull();

      await vi.advanceTimersByTimeAsync(DOG_TORCH_MELT_DURATION_MS);
      await vi.runAllTimersAsync();

      const replacement = root.querySelector<HTMLElement>('[data-block-id="freeze"]');
      expect(replacement).not.toBe(target);
      expect(replacement?.dataset.specialMechanism).toBeUndefined();
      expect(root.querySelector('[data-block-id="ordinary"]')).toBe(ordinary);
      expect(root.querySelector('[data-testid="dog-melt-effect"]')).toBeNull();
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("火把暂存槽冻结方块后复用目标槽位并完成后续状态重检", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("freeze", WORKING_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }),
        createBlock("remaining", SINGLE_DOG, undefined, { x: 4 }),
      ]),
      loadout: ["torch", "wildcard", "detector"],
    });

    try {
      game.selectBlock("freeze");
      await vi.runAllTimersAsync();
      const target = root.querySelector<HTMLElement>('[data-block-id="freeze"]');
      if (target === null) {
        throw new Error("Expected torch tray fixture slot");
      }

      root.querySelector<HTMLButtonElement>('[data-item-id="torch"]')?.click();
      target.click();

      expect(game.getState().inputLocked).toBe(true);
      expect(target.dataset.specialMechanism).toBe(DOG_FREEZE_MECHANISM_TYPE);
      await vi.advanceTimersByTimeAsync(DOG_TORCH_MELT_DURATION_MS);
      await vi.runAllTimersAsync();

      expect(root.querySelector('[data-block-id="freeze"]')).toBe(target);
      expect(target.dataset.specialMechanism).toBeUndefined();
      expect(game.getState().items?.phase).toBe("idle");
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

  it("磁吸只移除真实参与节点并保留被吸冻结方块", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      level: createLevel([
        createBlock("prefix", WORKING_DOG),
        createBlock("magnetic", WORKING_DOG, {
          type: DOG_MAGNETIC_MECHANISM_TYPE,
          state: { status: DOG_MAGNETIC_MECHANISM_TYPE },
        }),
        createBlock("freeze-target", SINGLE_DOG, {
          type: DOG_FREEZE_MECHANISM_TYPE,
          state: { status: "frozen", completedTriples: 0 },
        }, { x: 4 }),
        createBlock("untouched", WORKING_DOG, undefined, { x: 8 }),
      ]),
      loadout: ["detector", "wildcard", "torch"],
    });

    try {
      const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const tray = root.querySelector<HTMLOListElement>('[data-testid="dog-tray"]');
      const magnetic = root.querySelector<HTMLElement>('[data-block-id="magnetic"]');
      const target = root.querySelector<HTMLElement>('[data-block-id="freeze-target"]');
      const untouched = root.querySelector<HTMLElement>('[data-block-id="untouched"]');
      if (board === null || tray === null || magnetic === null || target === null || untouched === null) {
        throw new Error("Expected magnetic fixture DOM");
      }

      game.selectBlock("prefix");
      await vi.runAllTimersAsync();
      const prefixSlot = root.querySelector<HTMLElement>('[data-block-id="prefix"]');
      if (prefixSlot === null) {
        throw new Error("Expected magnetic fixture prefix slots");
      }

      const targetRectBeforeSelection = createTestRect(24, 4, 40, 40);
      target.getBoundingClientRect = () => targetRectBeforeSelection;

      const initialSlots = [...tray.children];
      const boardRecords: MutationRecord[] = [];
      const boardObserver = new MutationObserver((records) => boardRecords.push(...records));
      boardObserver.observe(board, { childList: true });

      game.selectBlock("magnetic");

      expect(root.querySelector('[data-testid="dog-block"][data-block-id="magnetic"]')).toBeNull();
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="freeze-target"]')).toBe(target);
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="untouched"]')).toBe(untouched);
      expect(root.querySelector('[data-testid="dog-tray-slot"][data-block-id="magnetic"]')).not.toBeNull();
      expect(game.getState().inputLocked).toBe(true);

      target.getBoundingClientRect = () => createTestRect(224, 4, 40, 40);

      await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
      const magneticEffect = root.querySelector<HTMLElement>('[data-testid="dog-magnetic-effect"]');
      expect(magneticEffect).not.toBeNull();
      expect(magneticEffect?.style.width).toBe("20px");
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="freeze-target"]')).toBe(target);
      expect(game.getState().inputLocked).toBe(true);

      await vi.advanceTimersByTimeAsync(DOG_MAGNETIC_ATTRACTION_DURATION_MS);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      const targetFlight = root.querySelector<HTMLElement>(
        '[data-testid="dog-flight"][data-pattern-type="单身狗"]',
      );
      expect(targetFlight?.style.left).toBe("24px");
      expect(targetFlight?.style.top).toBe("4px");
      expect(game.getState().inputLocked).toBe(true);

      await vi.runAllTimersAsync();
      boardObserver.disconnect();

      expect(game.getState().session.trayBlocks.map((block) => block.id)).toEqual([
        "prefix",
        "magnetic",
        "freeze-target",
      ]);
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="freeze-target"]')).toBeNull();
      expect(root.querySelector('[data-testid="dog-block"][data-block-id="untouched"]')).toBe(untouched);
      expect(root.querySelector('[data-block-id="prefix"]')).toBe(prefixSlot);
      expect(root.querySelector<HTMLElement>('[data-testid="dog-tray-slot"][data-block-id="freeze-target"]')?.dataset.specialMechanism)
        .toBe(DOG_FREEZE_MECHANISM_TYPE);
      expect([...tray.children].slice(3)).toEqual(initialSlots.slice(3));
      expect(boardRecords.flatMap((record) => [...record.removedNodes])).toEqual([magnetic, target]);
      expect(boardRecords.flatMap((record) => [...record.addedNodes])).toEqual([]);
      expect(game.getState().inputLocked).toBe(false);
    } finally {
      game.destroy();
    }
  });

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

function createTestRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}
