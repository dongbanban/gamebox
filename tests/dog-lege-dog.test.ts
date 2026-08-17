/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { startDogLegeDogGame } from "../src/games/dog-lege-dog";

afterEach(() => {
  vi.useRealTimers();
});

describe("狗了个狗固定首关", () => {
  it("通过公共启动与状态 seam 暴露稳定的矩形棋盘", () => {
    const firstRoot = document.createElement("div");
    const secondRoot = document.createElement("div");
    const firstGame = startDogLegeDogGame(firstRoot);
    const secondGame = startDogLegeDogGame(secondRoot);
    const state = firstGame.getState();

    expect(state.gameId).toBe("dog-lege-dog");
    expect(state.status).toBe("ready");
    expect(state.level.number).toBe(1);
    expect(state.level.seed).toBe("dog-lege-dog:first-level:v2");
    expect(state.level.board.shape).toBe("rectangle");
    expect(state.level.board.logicalCellSize).toBe(2);
    expect(state.level.blocks).toHaveLength(90);
    expect(new Set(state.level.blocks.map((block) => block.patternType))).toEqual(
      new Set(["打工狗", "单身狗", "舔狗", "看门狗"]),
    );
    expect(new Set(state.level.blocks.map((block) => block.z))).toEqual(new Set([0, 1, 2]));
    expect(state.level.blocks.every((block) => block.width === 2 && block.height === 2)).toBe(true);
    expect(
      [...new Set(state.level.blocks.map((block) => block.patternType))].every(
        (patternType) =>
          state.level.blocks.filter((block) => block.patternType === patternType).length % 3 === 0,
      ),
    ).toBe(true);
    expect(new Set(state.level.blocks.map((block) => block.id))).toHaveLength(90);
    expect(state).toEqual(secondGame.getState());
  });

  it("保持方块在棋盘形状内，且同层没有正面积重叠", () => {
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root);
    const { board, blocks } = game.getState().level;

    for (const block of blocks) {
      expect(block.x).toBeGreaterThanOrEqual(0);
      expect(block.y).toBeGreaterThanOrEqual(0);
      expect(block.x + block.width).toBeLessThanOrEqual(board.width);
      expect(block.y + block.height).toBeLessThanOrEqual(board.height);
      expect(block.rotation).toBe(0);
    }

    for (let index = 0; index < blocks.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < blocks.length; otherIndex += 1) {
        const block = blocks[index];
        const other = blocks[otherIndex];
        if (block.z !== other.z) {
          continue;
        }

        const separated =
          block.x + block.width <= other.x ||
          other.x + other.width <= block.x ||
          block.y + block.height <= other.y ||
          other.y + other.height <= block.y;
        expect(separated).toBe(true);
      }
    }
  });

  it("渲染真实首关棋盘，并支持销毁游戏", () => {
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root);

    expect(root.querySelector('[data-testid="dog-board"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="dog-block"]')).toHaveLength(90);
    expect(root.querySelectorAll('[data-testid="dog-block"] svg')).toHaveLength(90);
    expect(root.querySelector('[data-testid="dog-effects-canvas"]')).not.toBeNull();
    expect(root.textContent).not.toContain("打工狗");
    expect(root.textContent).not.toContain("单身狗");
    expect(root.textContent).not.toContain("倒计时");
    expect(root.textContent).not.toContain("难度分");
    expect(root.textContent).not.toContain("本局用时");

    game.destroy();

    expect(root.innerHTML).toBe("");
  });

  it("只让可点击方块进入暂存槽，并在三消后移除", () => {
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root);
    const blockedBlock = root.querySelector<HTMLButtonElement>(
      '[data-testid="dog-block"][data-block-id="first-level-block-16"]',
    );
    const firstTriple = [73, 74, 75].map((blockNumber) =>
      root.querySelector<HTMLButtonElement>(
        `[data-testid="dog-block"][data-block-id="first-level-block-${blockNumber}"]`,
      ),
    );

    expect(blockedBlock?.disabled).toBe(true);
    expect(firstTriple.every((block) => block?.disabled === false)).toBe(true);

    clickBlock(73);
    clickBlock(74);

    expect(game.getState().session.tray).toEqual(["打工狗", "打工狗"]);
    expect(root.querySelectorAll('[data-testid="dog-tray-slot"][data-pattern-type]')).toHaveLength(2);

    clickBlock(75);

    expect(game.getState().session.tray).toEqual([]);
    expect(root.querySelectorAll('[data-testid="dog-tray-slot"][data-pattern-type]')).toHaveLength(0);
    expect(root.querySelector('[data-testid="dog-status"]')?.textContent).toContain("选择没有遮挡");

    game.destroy();

    function clickBlock(blockNumber: number): void {
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="first-level-block-${blockNumber}"]`,
        )
        ?.click();
    }
  });

  it("Pointer Events 选择期间锁定输入，动画后解锁下层并出现通关结果", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const results: string[] = [];
    const game = startDogLegeDogGame(root, {
      onResult: (result) => results.push(result.status),
    });

    for (const blockId of game.getState().level.solutionPath) {
      const block = [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]')].find(
        (candidate) => candidate.dataset.blockId === blockId,
      );

      expect(block?.disabled).toBe(false);
      block?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      expect(game.getState().inputLocked).toBe(true);
      expect(game.getState().session.remainingBlocks.some((candidate) => candidate.id === blockId)).toBe(
        false,
      );

      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
    }

    expect(game.getState().status).toBe("won");
    expect(results).toEqual(["won"]);

    game.destroy();
  });

  it("三消反馈独立出现，并在飞行动画后开放下一次操作", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root);

    for (const blockNumber of [73, 74]) {
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="first-level-block-${blockNumber}"]`,
        )
        ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      await vi.runAllTimersAsync();
    }

    root
      .querySelector<HTMLButtonElement>(
        '[data-testid="dog-block"][data-block-id="first-level-block-75"]',
      )
      ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));

    expect(game.getState().feedback).toBe("match");
    expect(game.getState().inputLocked).toBe(true);
    expect(root.querySelector('[data-testid="dog-feedback"]')?.textContent).toContain("三消");
    expect(game.getState().session.tray).toEqual([]);

    await vi.runAllTimersAsync();

    expect(game.getState().feedback).toBe("idle");
    expect(game.getState().inputLocked).toBe(false);
    game.destroy();
  });

  it("失败拥有独立反馈，并在反馈完成后报告失败结果", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const results: string[] = [];
    const game = startDogLegeDogGame(root, {
      onResult: (result) => results.push(result.status),
    });

    for (const blockNumber of [73, 76, 79, 82, 74, 77]) {
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="first-level-block-${blockNumber}"]`,
        )
        ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      await vi.runAllTimersAsync();
    }

    root
      .querySelector<HTMLButtonElement>(
        '[data-testid="dog-block"][data-block-id="first-level-block-80"]',
      )
      ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));

    expect(game.getState().status).toBe("lost");
    expect(game.getState().feedback).toBe("lost");
    expect(game.getState().inputLocked).toBe(true);
    expect(results).toEqual([]);

    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(results).toEqual(["lost"]);
    game.destroy();
  });
});
