/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAssetUrl } from "@/asset-url";
import type { GameResult } from "@/catalog";
import {
  BLOCK_FLIGHT_DURATION_MS,
  DOG_ITEM_FEEDBACK_DURATION_MS,
} from "@/games/dog-lege-dog/assets/animation-effects";
import {
  DOG_PATTERN_TYPES,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
  getDogLogicalBlockCount,
  startDogLegeDogGame,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import type { GameLaunchContext } from "@/game-contracts";
import {
  getDogPatternClassName,
  renderDogPatternAsset,
} from "@/games/dog-lege-dog/assets/game-assets";
import {
  DOG_BLOCK_VISUAL_SIZE_PX,
  DOG_BOARD_SAFE_MARGIN_PX,
  DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX,
} from "@/games/dog-lege-dog/game/game-renderer";
import { TEST_LEVEL, TEST_RUN_SEED } from "../support/dog-level-fixture";
import { startTestGame } from "../support/dog-game-fixtures";

afterEach(() => {
  vi.useRealTimers();
});

describe("狗了个狗测试 · runtime", () => {
  it("方块飞入暂存槽期间保持棋盘输入，动画后解锁下层并出现通关结果", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const results: GameResult[] = [];
    const game = startTestGame(root, {
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
      onResult: (result) => results.push(result),
    });

    for (const blockId of game.getState().level.solutionPath) {
      const block = [...root.querySelectorAll<HTMLButtonElement>('[data-testid="dog-block"]')].find(
        (candidate) => candidate.dataset.blockId === blockId,
      );

      expect(block?.disabled).toBe(false);
      const selectedLevelBlock = game.getState().level.blocks.find(
        (candidate) => candidate.id === blockId,
      );
      const isIllusion =
        selectedLevelBlock?.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE;
      block?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      const isTerminal = game.getState().session.status !== "playing";
      const isMatchAnimating = game.getState().feedback === "match";
      expect(game.getState().inputLocked).toBe(true);
      if (!isTerminal && !isMatchAnimating && !isIllusion) {
        expect(root.querySelector('[data-testid="dog-block"]:not([disabled])')).toBeNull();
      }
      expect(game.getState().session.remainingBlocks.some((candidate) => candidate.id === blockId)).toBe(
        false,
      );

      await vi.runAllTimersAsync();
      expect(game.getState().inputLocked).toBe(false);
      if (isTerminal) {
        expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-edit-loadout"]')?.disabled).toBe(
          true,
        );
      }
    }

    expect(game.getState().status).toBe("won");
    expect(root.querySelector('[data-testid="dog-feedback"]')).toBeNull();
    expect(root.querySelector('.dog-board-frame [role="status"]')).toBeNull();
    expect(results).toEqual([
      expect.objectContaining({
        gameId: "dog-lege-dog",
        levelNumber: 1,
        status: "won",
        reward: TEST_LEVEL.reward,
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

  it("普通方块飞入期间锁定棋盘，飞入完成后立即恢复点击", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startTestGame(root);
    const firstBlockId = game.getState().session.selectableBlockIds[0];
    if (firstBlockId === undefined) {
      throw new Error("Expected first-level selectable block");
    }

    dispatchPointerUp(firstBlockId);
    expect(BLOCK_FLIGHT_DURATION_MS).toBeLessThan(240);
    expect(game.getState().inputLocked).toBe(true);

    const secondBlockId = game.getState().session.selectableBlockIds.find(
      (blockId) => blockId !== firstBlockId,
    );
    if (secondBlockId === undefined) {
      throw new Error("Expected another selectable block during flight");
    }
    dispatchPointerUp(secondBlockId);

    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().session.remainingBlocks.some((block) => block.id === secondBlockId)).toBe(
      true,
    );
    expect(root.querySelectorAll('[data-testid="dog-flight"]')).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS - 1);
    expect(game.getState().inputLocked).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(game.getState().inputLocked).toBe(false);
    expect(root.querySelectorAll('[data-testid="dog-flight"]')).toHaveLength(0);

    dispatchPointerUp(secondBlockId);
    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().session.remainingBlocks.some((block) => block.id === firstBlockId)).toBe(
      false,
    );
    expect(game.getState().session.remainingBlocks.some((block) => block.id === secondBlockId)).toBe(
      false,
    );
    expect(root.querySelectorAll('[data-testid="dog-flight"]')).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);

    expect(root.querySelectorAll('[data-testid="dog-flight"]')).toHaveLength(0);
    expect(game.getState().inputLocked).toBe(false);
    game.destroy();

    function dispatchPointerUp(blockId: string): void {
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="${blockId}"]`,
        )
        ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
    }
  });

  it("三消只显示显眼动画，不渲染中间文案，并在动画后开放下一次操作", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startTestGame(root, {
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    let matched = false;
    for (const blockId of game.getState().level.solutionPath) {
      const beforeTrayLength = game.getState().session.tray.length;
      const loadoutThumbnailBeforeMatch = root.querySelector<HTMLElement>(
        '[data-testid="dog-loadout-thumbnail"][data-loadout-id="tray-capacity"]',
      );
      const loadoutIconBeforeMatch = loadoutThumbnailBeforeMatch
        ?.querySelector("img")
        ?.getAttribute("src");
      loadoutThumbnailBeforeMatch?.setAttribute("data-stable-loadout-probe", "true");
      root
        .querySelector<HTMLButtonElement>(
          `[data-testid="dog-block"][data-block-id="${blockId}"]`,
        )
        ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
      const afterTrayLength = game.getState().session.tray.length;
      if (afterTrayLength < beforeTrayLength + 1) {
        matched = true;
        const loadoutThumbnailDuringMatch = root.querySelector<HTMLButtonElement>(
          '[data-testid="dog-loadout-thumbnail"][data-loadout-id="tray-capacity"]',
        );
        expect(loadoutThumbnailDuringMatch?.dataset.stableLoadoutProbe).toBe("true");
        expect(loadoutThumbnailDuringMatch?.querySelector("img")?.getAttribute("src")).toBe(
          loadoutIconBeforeMatch,
        );
        expect(loadoutThumbnailDuringMatch?.disabled).toBe(true);
        expect(
          loadoutThumbnailDuringMatch?.querySelector(
            '[data-testid="dog-loadout-thumbnail-uses"]',
          )?.textContent,
        ).toBe("1");
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
    expect(matchEffect?.closest('[data-testid="dog-tray-region"]')).not.toBeNull();
    expect(root.querySelector('.dog-board-frame [data-testid="dog-match-effect"]')).toBeNull();
    expect(root.querySelectorAll('.dog-match-effect__spark')).toHaveLength(8);
    expect(root.textContent).not.toContain("三消");
    expect(game.getState().session.tray.length).toBeLessThan(7);

    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);
    expect(root.querySelector('[data-testid="dog-match-effect"]')).toBe(matchEffect);

    await vi.runAllTimersAsync();

    expect(game.getState().feedback).toBe("idle");
    expect(game.getState().inputLocked).toBe(false);
    expect(
      root.querySelector<HTMLElement>(
        '[data-testid="dog-loadout-thumbnail"][data-loadout-id="tray-capacity"]',
      )?.dataset.stableLoadoutProbe,
    ).toBe("true");
    game.destroy();
  });

  it("失败提示显示在暂存槽下方，并在反馈完成后报告失败结果", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const results: GameResult[] = [];
    const game = startTestGame(root, {
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
      onResult: (result) => results.push(result),
    });

    const level = game.getState().level;
    const selectedPatterns: string[] = [];
    for (let selectionNumber = 0; selectionNumber < 20 && game.getState().status !== "lost"; selectionNumber += 1) {
      const candidateId = game.getState().session.selectableBlockIds.find((blockId) => {
        const block = level.blocks.find((candidate) => candidate.id === blockId);
        const patternType = block?.patternType;
        return patternType !== undefined &&
          block?.specialMechanism === undefined &&
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
      if (game.getState().status === "playing") {
        await vi.runAllTimersAsync();
      }
    }

    expect(game.getState().status).toBe("lost");
    expect(game.getState().feedback).toBe("lost");
    expect(game.getState().inputLocked).toBe(true);
    expect(results).toEqual([]);
    const lossStatus = root.querySelector<HTMLElement>('[data-testid="dog-status"]');
    const traySlots = root.querySelector<HTMLElement>('[data-testid="dog-tray"]');
    expect(lossStatus?.textContent).toContain("失败！暂存槽已满。");
    expect(lossStatus?.closest('[data-testid="dog-tray-region"]')).not.toBeNull();
    expect(traySlots?.nextElementSibling).toBe(lossStatus);
    expect(root.querySelector('.dog-board-frame [data-testid="dog-feedback"]')).toBeNull();
    expect(root.textContent).not.toContain("失败反馈");

    await vi.runAllTimersAsync();

    expect(game.getState().inputLocked).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-edit-loadout"]')?.disabled).toBe(
      true,
    );
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
