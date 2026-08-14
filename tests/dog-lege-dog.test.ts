/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { startDogLegeDogGame } from "../src/games/dog-lege-dog";

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
});
