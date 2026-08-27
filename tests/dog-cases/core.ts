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

describe("狗了个狗测试 · core", () => {
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
    expect(assets.every((asset) => asset.includes("<img") && !asset.includes("<image"))).toBe(true);
    expect(assets.every((asset) => asset.includes('src="assets/dog-icons-square/'))).toBe(true);
  });

  it("以直接图片节点渲染龇牙狗，避免 Safari 嵌套 SVG 丢失牙齿", () => {
    const asset = renderDogPatternAsset("龇牙狗");

    expect(asset).toContain("<img");
    expect(asset).not.toContain("<image");
  });

  it("按 CDN 前缀解析狗图资源，并保留本地路径回退", () => {
    expect(resolveAssetUrl("assets/dog-icons-square/07-snarling-dog.svg")).toBe(
      "assets/dog-icons-square/07-snarling-dog.svg",
    );
    expect(
      resolveAssetUrl(
        "assets/dog-icons-square/07-snarling-dog.svg",
        " https://cdn.example.com/gamebox/v1/ ",
      ),
    ).toBe("https://cdn.example.com/gamebox/v1/assets/dog-icons-square/07-snarling-dog.svg");
  });

  it("通过公共启动与状态 seam 暴露稳定的不规则棋盘", () => {
    const firstRoot = document.createElement("div");
    const secondRoot = document.createElement("div");
    const firstGame = startTestGame(firstRoot);
    const secondGame = startTestGame(secondRoot);
    const state = firstGame.getState();

    expect(state.gameId).toBe("dog-lege-dog");
    expect(state.status).toBe("ready");
    expect(state.level.number).toBe(1);
    expect(state.level.seed).toBe(TEST_LEVEL.seed);
    expect(state.level.board.shape).toBe("irregular");
    expect(state.level.board.logicalCellSize).toBe(4);
    expect(state.level.board.width / state.level.board.logicalCellSize).toBe(9);
    expect(state.level.board.height / state.level.board.logicalCellSize).toBe(12);
    expect(getDogLogicalBlockCount(state.level.blocks, state.level.specialMechanisms)).toBe(90);
    expect(new Set(state.level.blocks.map((block) => block.patternType))).toHaveLength(6);
    expect(new Set(state.level.blocks.map((block) => block.z))).toEqual(new Set([0, 1, 2]));
    expect(state.level.blocks.every((block) => block.width === 4 && block.height === 4)).toBe(true);
    expect(
      [...new Set(state.level.blocks.map((block) => block.patternType))].every(
        (patternType) =>
          state.level.blocks
            .filter((block) => block.patternType === patternType)
            .reduce(
              (total, block) => total + (block.specialMechanism?.type === DOG_TWIN_MECHANISM_TYPE ? 2 : 1),
              0,
            ) % 3 === 0,
      ),
    ).toBe(true);
    expect(new Set(state.level.blocks.map((block) => block.id))).toHaveLength(
      state.level.blocks.length,
    );
    expect(state).toEqual(secondGame.getState());
    firstGame.destroy();
    secondGame.destroy();
  });

  it("每次未指定 runSeed 的启动都会创建新的首关尝试", () => {
    const firstRoot = document.createElement("div");
    const secondRoot = document.createElement("div");
    const firstGame = startDogLegeDogGame(firstRoot);
    const secondGame = startDogLegeDogGame(secondRoot);

    expect(firstGame.getState().level.runSeed).not.toBe(secondGame.getState().level.runSeed);
    expect(firstGame.getState().level).not.toEqual(secondGame.getState().level);

    firstGame.destroy();
    secondGame.destroy();
  });

  it("保持方块在不规则棋盘内，且同层没有正面积重叠", () => {
    const root = document.createElement("div");
    const game = startTestGame(root);
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
    const game = startTestGame(root);

    const board = root.querySelector<HTMLElement>('[data-testid="dog-board"]');
    const firstBlock = root.querySelector<HTMLElement>('[data-testid="dog-block"]');
    expect(board).not.toBeNull();
    expect(board?.dataset.surfaceShape).toBe("rectangle");
    expect(board?.style.clipPath).toBe("");
    expect(board?.style.getPropertyValue("--board-pixel-width")).toBe("432px");
    expect(board?.style.getPropertyValue("--board-pixel-height")).toBe("576px");
    expect(DOG_BLOCK_VISUAL_SIZE_PX).toBe(48);
    expect(DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX).toBe(12);
    expect(firstBlock?.style.getPropertyValue("--block-width")).toBe("48px");
    expect(firstBlock?.style.getPropertyValue("--block-height")).toBe("48px");
    expect(root.querySelectorAll('[data-testid="dog-block"]')).toHaveLength(TEST_LEVEL.blocks.length);
    expect(root.querySelectorAll('[data-testid="dog-block"] img')).toHaveLength(TEST_LEVEL.blocks.length);
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

  it("按 12px 逻辑单位映射棋盘，并为视觉方块保留边界", () => {
    const root = document.createElement("div");
    const game = startTestGame(root);
    const { board, blocks } = game.getState().level;

    for (const block of blocks) {
      const element = root.querySelector<HTMLElement>(
        `[data-testid="dog-block"][data-block-id="${block.id}"]`,
      );
      expect(element).not.toBeNull();
      const left = Number.parseFloat(element?.style.getPropertyValue("--block-left") ?? "NaN");
      const top = Number.parseFloat(element?.style.getPropertyValue("--block-top") ?? "NaN");
      const blockWidth = block.width * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX;
      const blockHeight = block.height * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX;
      expect(left).toBe(
        Math.min(
          Math.max(block.x * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX, DOG_BOARD_SAFE_MARGIN_PX),
          board.width * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX - blockWidth - DOG_BOARD_SAFE_MARGIN_PX,
        ),
      );
      expect(top).toBe(
        Math.min(
          Math.max(block.y * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX, DOG_BOARD_SAFE_MARGIN_PX),
          board.height * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX - blockHeight - DOG_BOARD_SAFE_MARGIN_PX,
        ),
      );
    }

    expect(board.width * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX).toBe(432);
    expect(board.height * DOG_LOGICAL_UNIT_VISUAL_WIDTH_PX).toBe(576);
    game.destroy();
  });

  it("底层方块使用多个 4×4 细网格相位，避免初始行列完全对齐", () => {
    const bottomBlocks = TEST_LEVEL.blocks.filter((block) => block.z === 0);

    expect(new Set(bottomBlocks.map((block) => block.x % 4)).size).toBeGreaterThan(1);
    expect(new Set(bottomBlocks.map((block) => block.y % 4)).size).toBeGreaterThan(1);
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
        (slot) => slot.className.includes("dog-block--") && slot.querySelector("img") !== null,
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
});
