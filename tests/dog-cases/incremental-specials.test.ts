/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BLOCK_FLIGHT_DURATION_MS,
  DOG_DETECTOR_REVEAL_DURATION_MS,
  DOG_TORCH_MELT_DURATION_MS,
  DOG_ILLUSION_REVEAL_DURATION_MS,
} from "@/games/dog-lege-dog/assets/animation-effects";
import { getDogPatternAssetUrl } from "@/games/dog-lege-dog/assets/game-assets";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
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
});
