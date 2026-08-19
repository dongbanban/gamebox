/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameResult } from "../src/catalog";
import {
  DOG_PATTERN_TYPES,
  FIRST_LEVEL,
  startDogLegeDogGame,
} from "../src/games/dog-lege-dog";
import { renderDogPatternAsset } from "../src/games/dog-lege-dog/assets/game-assets";

afterEach(() => {
  vi.useRealTimers();
});

describe("狗了个狗首关", () => {
  it("按图片行优先顺序提供十种独立狗主题 SVG", () => {
    expect(DOG_PATTERN_TYPES).toEqual([
      "打工狗",
      "单身狗",
      "舔狗",
      "看门狗",
      "疯狗",
      "拆家狗",
      "龇牙狗",
      "社恐狗",
      "吃货狗",
      "傻狗",
    ]);

    const assets = DOG_PATTERN_TYPES.map((patternType) => renderDogPatternAsset(patternType));
    expect(new Set(assets)).toHaveLength(10);
    expect(assets.every((asset) => asset.includes("<svg") && asset.includes("<image"))).toBe(true);
  });

  it("通过公共启动与状态 seam 暴露稳定的不规则棋盘", () => {
    const firstRoot = document.createElement("div");
    const secondRoot = document.createElement("div");
    const firstGame = startDogLegeDogGame(firstRoot);
    const secondGame = startDogLegeDogGame(secondRoot);
    const state = firstGame.getState();

    expect(state.gameId).toBe("dog-lege-dog");
    expect(state.status).toBe("ready");
    expect(state.level.number).toBe(1);
    expect(state.level.seed).toBe("dog-lege-dog:first-level:v5");
    expect(state.level.board.shape).toBe("irregular");
    expect(state.level.board.logicalCellSize).toBe(4);
    expect(state.level.blocks).toHaveLength(90);
    expect(new Set(state.level.blocks.map((block) => block.patternType))).toEqual(
      new Set(["打工狗", "单身狗", "舔狗", "看门狗", "疯狗", "拆家狗"]),
    );
    expect(new Set(state.level.blocks.map((block) => block.z))).toEqual(new Set([0, 1, 2]));
    expect(state.level.blocks.every((block) => block.width === 4 && block.height === 4)).toBe(true);
    expect(
      [...new Set(state.level.blocks.map((block) => block.patternType))].every(
        (patternType) =>
          state.level.blocks.filter((block) => block.patternType === patternType).length % 3 === 0,
      ),
    ).toBe(true);
    expect(new Set(state.level.blocks.map((block) => block.id))).toHaveLength(90);
    expect(state).toEqual(secondGame.getState());
  });

  it("保持方块在不规则棋盘内，且同层没有正面积重叠", () => {
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

    const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
    const firstBlock = root.querySelector<HTMLElement>('[data-testid="dog-block"]');
    expect(board).not.toBeNull();
    expect(board?.dataset.surfaceShape).toBe("rectangle");
    expect(board?.style.clipPath).toBe("");
    expect(root.querySelectorAll('[data-testid="dog-block"]')).toHaveLength(90);
    expect(root.querySelectorAll('[data-testid="dog-block"] svg')).toHaveLength(90);
    expect(parseFloat(firstBlock?.style.getPropertyValue("--block-width") ?? "0")).toBeGreaterThan(0);
    expect(parseFloat(firstBlock?.style.getPropertyValue("--block-height") ?? "0")).toBeGreaterThan(0);
    expect(root.querySelector(".dog-game__stats")).toBeNull();
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
    const level = game.getState().level;
    const blockedBlockId = level.blocks.find(
      (block) => !game.getState().session.selectableBlockIds.includes(block.id),
    )?.id;
    const blockedBlock = root.querySelector<HTMLButtonElement>(
      `[data-testid="dog-block"][data-block-id="${blockedBlockId}"]`,
    );

    expect(blockedBlock?.disabled).toBe(true);
    let matched = false;
    for (const blockId of level.solutionPath) {
      const beforeTrayLength = game.getState().session.tray.length;
      clickBlock(blockId);
      const afterTrayLength = game.getState().session.tray.length;
      if (afterTrayLength < beforeTrayLength + 1) {
        matched = true;
        break;
      }
    }

    expect(matched).toBe(true);
    expect(root.querySelectorAll('[data-testid="dog-tray-slot"][data-pattern-type]')).toHaveLength(
      game.getState().session.tray.length,
    );
    expect(
      [...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"][data-pattern-type]')].every(
        (slot) => slot.className.includes("dog-block--") && slot.querySelector("svg") !== null,
      ),
    ).toBe(true);
    expect(root.querySelector('[data-testid="dog-status"]')?.textContent).not.toContain("选择没有遮挡");

    game.destroy();

    function clickBlock(blockId: string): void {
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="${blockId}"]`,
        )
        ?.click();
    }
  });

  it("Pointer Events 选择期间锁定输入，动画后解锁下层并出现通关结果", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const results: GameResult[] = [];
    const game = startDogLegeDogGame(root, {
      onResult: (result) => results.push(result),
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
    expect(results).toEqual([
      expect.objectContaining({
        gameId: "dog-lege-dog",
        levelNumber: 1,
        status: "won",
        reward: FIRST_LEVEL.reward,
        display: {
          eyebrow: "狗了个狗 · 关卡结果",
          title: "通关！",
          description: "完成。",
        },
        actions: ["next-level", "catalog"],
      }),
    ]);

    game.destroy();
  });

  it("三消只显示显眼动画，不渲染中间文案，并在动画后开放下一次操作", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root);

    let matched = false;
    for (const blockId of game.getState().level.solutionPath) {
      const beforeTrayLength = game.getState().session.tray.length;
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="${blockId}"]`,
        )
        ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      const afterTrayLength = game.getState().session.tray.length;
      if (afterTrayLength < beforeTrayLength + 1) {
        matched = true;
        break;
      }
      await vi.runAllTimersAsync();
    }

    expect(matched).toBe(true);
    expect(game.getState().feedback).toBe("match");
    expect(game.getState().inputLocked).toBe(true);
    expect(root.querySelector('[data-testid="dog-feedback"]')).toBeNull();
    const matchEffect = root.querySelector('[data-testid="dog-match-effect"]');
    expect(matchEffect?.getAttribute("role")).toBe("status");
    expect(matchEffect?.getAttribute("aria-label")).toBe("三消成功");
    expect(root.querySelectorAll('.dog-match-effect__spark')).toHaveLength(8);
    expect(root.textContent).not.toContain("三消");
    expect(game.getState().session.tray.length).toBeLessThan(7);

    await vi.runAllTimersAsync();

    expect(game.getState().feedback).toBe("idle");
    expect(game.getState().inputLocked).toBe(false);
    game.destroy();
  });

  it("失败拥有独立反馈，并在反馈完成后报告失败结果", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const results: GameResult[] = [];
    const game = startDogLegeDogGame(root, {
      onResult: (result) => results.push(result),
    });

    const level = game.getState().level;
    const selectedPatterns: string[] = [];
    for (let selectionNumber = 0; selectionNumber < 7; selectionNumber += 1) {
      const candidateId = game.getState().session.selectableBlockIds.find((blockId) => {
        const patternType = level.blocks.find((block) => block.id === blockId)?.patternType;
        return patternType !== undefined &&
          selectedPatterns.filter((selected) => selected === patternType).length < 2;
      });
      expect(candidateId).toBeDefined();
      const patternType = level.blocks.find((block) => block.id === candidateId)?.patternType;
      if (patternType !== undefined) {
        selectedPatterns.push(patternType);
      }
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="${candidateId}"]`,
        )
        ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      if (selectionNumber < 6) {
        await vi.runAllTimersAsync();
      }
    }

    expect(game.getState().status).toBe("lost");
    expect(game.getState().feedback).toBe("lost");
    expect(game.getState().inputLocked).toBe(true);
    expect(results).toEqual([]);

    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(results).toEqual([
      expect.objectContaining({
        gameId: "dog-lege-dog",
        levelNumber: 1,
        status: "lost",
        reward: 0,
        display: {
          eyebrow: "狗了个狗 · 关卡结果",
          title: "失败",
          description: "暂存槽已满，进度未改变。",
        },
        actions: ["retry", "catalog"],
      }),
    ]);
    game.destroy();
  });
});
