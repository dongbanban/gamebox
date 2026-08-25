/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAssetUrl } from "@/asset-url";
import type { GameResult } from "@/catalog";
import {
  BLOCK_FLIGHT_DURATION_MS,
  DOG_ITEM_FEEDBACK_DURATION_MS,
} from "@/games/dog-lege-dog/assets/animation-effects";
import {
  DEFAULT_LEVEL_SEED,
  DOG_PATTERN_TYPES,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
  FIRST_LEVEL,
  getDogLogicalBlockCount,
  startDogLegeDogGame,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import type { GameLaunchContext } from "@/game-contracts";
import { renderDogPatternAsset } from "@/games/dog-lege-dog/assets/game-assets";
import {
  DOG_BLOCK_VISUAL_SIZE_PX,
  DOG_BOARD_SAFE_MARGIN_PX,
  DOG_LOGICAL_UNIT_VISUAL_SIZE_PX,
} from "@/games/dog-lege-dog/game/game-renderer";

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
    expect(state.level.seed).toBe(FIRST_LEVEL.seed);
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
    expect(DOG_LOGICAL_UNIT_VISUAL_SIZE_PX).toBe(12);
    expect(firstBlock?.style.getPropertyValue("--block-width")).toBe("48px");
    expect(firstBlock?.style.getPropertyValue("--block-height")).toBe("48px");
    expect(root.querySelectorAll('[data-testid="dog-block"]')).toHaveLength(FIRST_LEVEL.blocks.length);
    expect(root.querySelectorAll('[data-testid="dog-block"] img')).toHaveLength(FIRST_LEVEL.blocks.length);
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
      const blockWidth = block.width * DOG_LOGICAL_UNIT_VISUAL_SIZE_PX;
      const blockHeight = block.height * DOG_LOGICAL_UNIT_VISUAL_SIZE_PX;
      expect(left).toBe(
        Math.min(
          Math.max(block.x * DOG_LOGICAL_UNIT_VISUAL_SIZE_PX, DOG_BOARD_SAFE_MARGIN_PX),
          board.width * DOG_LOGICAL_UNIT_VISUAL_SIZE_PX - blockWidth - DOG_BOARD_SAFE_MARGIN_PX,
        ),
      );
      expect(top).toBe(
        Math.min(
          Math.max(block.y * DOG_LOGICAL_UNIT_VISUAL_SIZE_PX, DOG_BOARD_SAFE_MARGIN_PX),
          board.height * DOG_LOGICAL_UNIT_VISUAL_SIZE_PX - blockHeight - DOG_BOARD_SAFE_MARGIN_PX,
        ),
      );
    }

    expect(board.width * DOG_LOGICAL_UNIT_VISUAL_SIZE_PX).toBe(432);
    expect(board.height * DOG_LOGICAL_UNIT_VISUAL_SIZE_PX).toBe(576);
    game.destroy();
  });

  it("底层方块使用多个 4×4 细网格相位，避免初始行列完全对齐", () => {
    const bottomBlocks = FIRST_LEVEL.blocks.filter((block) => block.z === 0);

    expect(new Set(bottomBlocks.map((block) => block.x % 4)).size).toBeGreaterThan(1);
    expect(new Set(bottomBlocks.map((block) => block.y % 4)).size).toBeGreaterThan(1);
  });

  it("渲染方块的跨层可见盒保持逻辑四分之一或二分之一覆盖比例", () => {
    const root = document.createElement("div");
    const game = startTestGame(root);
    const level = game.getState().level;
    const renderedBlocks = new Map(
      [...root.querySelectorAll<HTMLElement>('[data-testid="dog-block"]')].map((element) => [
        element.dataset.blockId,
        {
          left:
            parseFloat(element.style.getPropertyValue("--block-left")) /
            DOG_LOGICAL_UNIT_VISUAL_SIZE_PX,
          top:
            parseFloat(element.style.getPropertyValue("--block-top")) /
            DOG_LOGICAL_UNIT_VISUAL_SIZE_PX,
          width:
            parseFloat(element.style.getPropertyValue("--block-width")) /
            DOG_LOGICAL_UNIT_VISUAL_SIZE_PX,
          height:
            parseFloat(element.style.getPropertyValue("--block-height")) /
            DOG_LOGICAL_UNIT_VISUAL_SIZE_PX,
        },
      ]),
    );
    const partialOverlaps = level.blocks.flatMap((block, index) =>
      level.blocks.slice(index + 1).flatMap((other) => {
        if (block.z === other.z) {
          return [];
        }

        const logicalRatio = overlapRatio(block, other);
        if (logicalRatio !== 0.25 && logicalRatio !== 0.5) {
          return [];
        }

        const first = renderedBlocks.get(block.id);
        const second = renderedBlocks.get(other.id);
        if (first === undefined || second === undefined) {
          return [];
        }

        return [{ logicalRatio, visualRatio: overlapRatio(first, second) }];
      }),
    );

    expect(partialOverlaps.length).toBeGreaterThan(0);
    expect(
      partialOverlaps.every(({ logicalRatio, visualRatio }) =>
        Math.abs(logicalRatio - visualRatio) <= 0.05,
      ),
    ).toBe(true);

    game.destroy();

    function overlapRatio(
      first: { x?: number; y?: number; width: number; height: number; left?: number; top?: number },
      second: { x?: number; y?: number; width: number; height: number; left?: number; top?: number },
    ): number {
      const firstLeft = first.left ?? first.x ?? 0;
      const firstTop = first.top ?? first.y ?? 0;
      const secondLeft = second.left ?? second.x ?? 0;
      const secondTop = second.top ?? second.y ?? 0;
      const width = Math.max(
        0,
        Math.min(firstLeft + first.width, secondLeft + second.width) -
          Math.max(firstLeft, secondLeft),
      );
      const height = Math.max(
        0,
        Math.min(firstTop + first.height, secondTop + second.height) -
          Math.max(firstTop, secondTop),
      );
      return (width * height) / (first.width * first.height);
    }
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

  it("暂存槽容量提升显示剩余次数，成功后锁定输入并扩展当前暂存槽", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startTestGame(root, {
      loadout: ["tray-capacity", "wildcard", "torch"],
    });
    const capacityButton = root.querySelector<HTMLButtonElement>(
      '[data-action="use-item"][data-item-id="tray-capacity"]',
    );

    expect(capacityButton).not.toBeNull();
    expect(capacityButton?.disabled).toBe(false);
    expect(capacityButton?.getAttribute("data-testid")).toBe("dog-loadout-thumbnail");
    expect(root.querySelector('[data-testid="dog-item-panel"]')).toBeNull();
    expect(
      root.querySelector('[data-testid="dog-loadout-thumbnail"][data-loadout-id="tray-capacity"]'),
    ).not.toBeNull();
    expect(
      root.querySelector('[data-testid="dog-loadout-thumbnail"][data-loadout-id="tray-capacity"]')?.classList.contains("dog-loadout-thumbnail--unavailable"),
    ).toBe(false);
    expect(
      root.querySelector('[data-testid="dog-loadout-thumbnail"][data-loadout-id="wildcard"]')?.classList.contains("dog-loadout-thumbnail--unavailable"),
    ).toBe(true);
    expect(
      root.querySelector('[data-testid="dog-loadout-thumbnail"][data-loadout-id="tray-capacity"] [data-testid="dog-loadout-thumbnail-uses"]')?.textContent,
    ).toBe("1");
    expect(root.querySelectorAll('[data-testid="dog-tray-slot"]')).toHaveLength(7);
    expect(root.querySelector('[data-testid="dog-tray-region"] h3')).toBeNull();
    expect(root.querySelector('[data-testid="dog-tray-count"]')).toBeNull();
    expect(root.querySelector('[data-testid="dog-tray-region"] .dog-tray__heading')).toBeNull();
    expect(root.querySelector('[data-testid="dog-tray"]')?.getAttribute("data-tray-capacity")).toBe("7");

    const mechanismButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="dog-special-mechanism-button"]',
    );
    expect(mechanismButton).not.toBeNull();
    mechanismButton?.click();
    expect(root.querySelector('[data-testid="dog-special-mechanism-modal"]')).not.toBeNull();
    expect(
      root.querySelector('[data-testid="dog-special-mechanism"][data-special-mechanism="freeze"]'),
    ).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="dog-special-mechanism-thumbnail"]')).toHaveLength(3);
    const freezeThumbnail = root.querySelector<HTMLElement>(
      '[data-testid="dog-special-mechanism-thumbnail"][data-special-mechanism="freeze"]',
    );
    const illusionThumbnail = root.querySelector<HTMLElement>(
      '[data-testid="dog-special-mechanism-thumbnail"][data-special-mechanism="illusion"]',
    );
    expect(freezeThumbnail?.classList.contains("dog-block--mechanism-preview")).toBe(true);
    expect(freezeThumbnail?.classList.contains("dog-block--special-freeze")).toBe(true);
    expect(freezeThumbnail?.querySelector("img")).not.toBeNull();
    expect(illusionThumbnail?.classList.contains("dog-block--mechanism-preview")).toBe(true);
    expect(illusionThumbnail?.classList.contains("dog-block--special-illusion")).toBe(true);
    expect(illusionThumbnail?.querySelector(".dog-block__glyph--fuzzy")).not.toBeNull();
    expect(
      root.querySelector<HTMLElement>(
        `[data-testid="dog-special-mechanism-thumbnail"][data-special-mechanism="${DOG_TWIN_MECHANISM_TYPE}"]`,
      )?.classList.contains("dog-block--special-twin"),
    ).toBe(true);
    expect(root.querySelectorAll(".dog-special-mechanism-card__icon")).toHaveLength(0);
    expect(root.querySelector('[data-testid="dog-special-mechanism-modal"]')?.textContent).toContain(
      "冻结方块",
    );
    expect(root.querySelector('[data-testid="dog-special-mechanism-modal"]')?.textContent).toContain(
      "无需使用道具也可应对本关机制",
    );
    expect(root.querySelector('[data-testid="dog-special-mechanism-modal"]')?.textContent).toContain(
      "火把可将其解冻为普通方块，万能方块可直接消除",
    );
    root.querySelector<HTMLButtonElement>('[data-action="close-special-mechanisms"]')?.click();
    expect(root.querySelector('[data-testid="dog-special-mechanism-modal"]')).toBeNull();

    capacityButton?.click();

    expect(game.getState().session.trayCapacity).toBe(8);
    expect(game.getState().inputLocked).toBe(true);
    expect(
      root.querySelector<HTMLButtonElement>(
        '[data-action="use-item"][data-item-id="tray-capacity"]',
      )?.disabled,
    ).toBe(true);
    expect(root.querySelectorAll('[data-testid="dog-tray-slot"]')).toHaveLength(8);
    expect(root.querySelector('[data-testid="dog-tray"]')?.getAttribute("data-tray-capacity")).toBe("8");
    expect(root.querySelector('[data-testid="dog-tray"]')?.getAttribute("style")).toContain(
      "--dog-tray-columns: 8",
    );
    expect(root.querySelector('[data-testid="dog-item-effect"]')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(DOG_ITEM_FEEDBACK_DURATION_MS);

    expect(game.getState().inputLocked).toBe(false);
    expect(root.querySelector('[data-testid="dog-item-effect"]')).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-edit-loadout"]')?.disabled).toBe(
      true,
    );
    expect(game.getState().items?.items.find((item) => item.id === "tray-capacity")).toMatchObject({
      remainingUses: 0,
      available: false,
    });
    game.destroy();
  });

  it("万能方块只高亮槽内合法方块，取消无副作用，点击目标后高亮入槽并锁定动画", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const level = createWildcardUiLevel();
    const game = startDogLegeDogGame(root, {
      level,
      loadout: ["wildcard", "tray-capacity", "torch"],
    });
    game.selectBlock("working-target");
    await vi.runAllTimersAsync();
    const initial = game.getState();
    const wildcardButton = root.querySelector<HTMLButtonElement>(
      '[data-action="use-item"][data-item-id="wildcard"]',
    );

    expect(wildcardButton?.disabled).toBe(false);
    wildcardButton?.click();

    expect(game.getState().items?.phase).toBe("targeting");
    expect(game.getState().inputLocked).toBe(true);
    expect(
      [...root.querySelectorAll<HTMLElement>(
        '[data-testid="dog-tray-slot"][data-item-targetable="true"]',
      )].map(
        (slot) => slot.dataset.blockId,
      ),
    ).toEqual(["working-target"]);
    expect(root.querySelector('[data-action="select-item-pattern"]')).toBeNull();

    root.querySelector<HTMLButtonElement>('[data-action="cancel-item-target"]')?.click();

    expect(game.getState().items?.phase).toBe("idle");
    expect(game.getState().items?.items.find((item) => item.id === "wildcard"))
      .toMatchObject({ remainingUses: 1, available: true });
    expect(game.getState().session).toEqual(initial.session);

    root.querySelector<HTMLButtonElement>('[data-item-id="wildcard"]')?.click();
    root.querySelector<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-block-id="working-target"]',
    )?.click();

    expect(game.getState().items?.phase).toBe("animating");
    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().session).toEqual(initial.session);
    expect(
      root.querySelector('[data-testid="dog-item-effect"][data-item-id="wildcard"]'),
    ).not.toBeNull();
    game.selectBlock("single-cover");
    expect(game.getState().session.remainingBlocks.map((block) => block.id)).toEqual([
      "working-hidden",
      "single-cover",
    ]);

    await vi.advanceTimersByTimeAsync(DOG_ITEM_FEEDBACK_DURATION_MS);

    expect(game.getState().inputLocked).toBe(false);
    expect(game.getState().session.remainingBlocks.map((block) => block.id)).toEqual([
      "single-cover",
    ]);
    expect(game.getState().items?.items.find((item) => item.id === "wildcard"))
      .toMatchObject({ remainingUses: 0, available: false });
    const wildcardSlot = root.querySelector<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-visual-marker="wildcard"]',
    );
    expect(wildcardSlot).not.toBeNull();
    expect(wildcardSlot?.classList.contains("dog-tray__slot--wildcard")).toBe(true);
    expect(wildcardSlot?.dataset.patternType).toBe("打工狗");
    game.destroy();
  });

  it("万能方块消除冻结同款后保持三消反馈锁，反馈结束才恢复输入", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const level = createWildcardMatchUiLevel();
    const game = startDogLegeDogGame(root, {
      level,
      loadout: ["wildcard", "tray-capacity", "torch"],
    });

    game.selectBlock("frozen-working-1");
    await vi.runAllTimersAsync();
    game.selectBlock("frozen-working-2");
    await vi.runAllTimersAsync();
    expect(game.getState().session.trayBlocks).toHaveLength(2);

    root.querySelector<HTMLButtonElement>('[data-item-id="wildcard"]')?.click();
    root.querySelector<HTMLElement>(
      '[data-testid="dog-tray-slot"][data-block-id="frozen-working-1"]',
    )?.click();
    expect(game.getState().items?.phase).toBe("animating");

    await vi.advanceTimersByTimeAsync(DOG_ITEM_FEEDBACK_DURATION_MS);

    expect(game.getState().session.trayBlocks).toEqual([]);
    expect(game.getState().feedback).toBe("match");
    expect(game.getState().inputLocked).toBe(true);
    expect(root.querySelector('[data-testid="dog-match-effect"]')).not.toBeNull();

    await vi.runAllTimersAsync();

    expect(game.getState().feedback).toBe("idle");
    expect(game.getState().inputLocked).toBe(false);
    game.destroy();
  });

  it("道具三消移除自动补齐棋盘方块并在动画期间锁定输入", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startTestGame(root, {
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });
    let targetBlockId: string | undefined;

    for (const blockId of game.getState().level.solutionPath) {
      const state = game.getState();
      const tripleRemoval = state.items?.items.find((item) => item.id === "triple-removal");
      const targetBlock = state.session.trayBlocks.find((block, index) =>
        block.specialMechanism === undefined &&
        state.session.trayBlocks[index + 1]?.specialMechanism === undefined &&
        state.session.trayBlocks[index + 1]?.patternType === block.patternType,
      );
      if (tripleRemoval?.available && targetBlock !== undefined) {
        targetBlockId = targetBlock.id;
        break;
      }

      if (state.session.status !== "playing") {
        break;
      }
      game.selectBlock(blockId);
      await vi.runAllTimersAsync();
    }

    expect(targetBlockId).toBeDefined();
    const itemButton = root.querySelector<HTMLButtonElement>(
      '[data-action="use-item"][data-item-id="triple-removal"]',
    );
    expect(itemButton?.disabled).toBe(false);
    itemButton?.click();

    expect(game.getState().items?.phase).toBe("targeting");
    expect(game.getState().inputLocked).toBe(true);
    const targetButton = root.querySelector<HTMLElement>(
      `[data-testid="dog-tray-slot"][data-block-id="${targetBlockId}"][data-item-targetable="true"]`,
    );
    expect(targetButton).not.toBeNull();
    targetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(game.getState().items?.phase).toBe("animating");
    expect(game.getState().inputLocked).toBe(true);
    expect(game.getState().session.status).toBe("playing");
    expect(root.querySelector('[data-testid="dog-item-effect"][data-item-id="triple-removal"]'))
      .not.toBeNull();
    expect(root.querySelector('[data-testid="dog-triple-removal-effect"]')).not.toBeNull();

    await vi.runAllTimersAsync();

    expect(game.getState().items?.phase).toBe("idle");
    expect(game.getState().inputLocked).toBe(false);
    expect(root.querySelector('[data-testid="dog-item-effect"]')).toBeNull();
    game.destroy();
  });

  it("挑战开始后禁止更换道具组，容量加成与次数保持", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const game = startTestGame(root, {
      runSeed: "capacity-loadout-reset",
      loadout: ["tray-capacity", "wildcard", "torch"],
    });

    root.querySelector<HTMLButtonElement>('[data-item-id="tray-capacity"]')?.click();
    await vi.advanceTimersByTimeAsync(DOG_ITEM_FEEDBACK_DURATION_MS);
    expect(game.getState().session.trayCapacity).toBe(8);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-edit-loadout"]')?.disabled).toBe(
      true,
    );

    root.querySelector<HTMLButtonElement>('[data-action="edit-loadout"]')?.click();
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).toBeNull();

    expect(game.getState().session.trayCapacity).toBe(8);
    expect(game.getState().items?.items.find((item) => item.id === "tray-capacity")).toMatchObject({
      remainingUses: 0,
      available: false,
    });
    game.destroy();
  });
});

describe("狗了个狗活动道具组变更", () => {
  it("准备态更换组合需要二次确认，挑战开始后禁止再次更换", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const confirmedLoadouts: string[][] = [];
    const game = startDogLegeDogGame(root, {
      runSeed: "stable-loadout-run",
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
      onLoadoutConfirmed: (loadout) => confirmedLoadouts.push([...loadout]),
    });
    const before = game.getState();

    root.querySelector<HTMLButtonElement>('[data-action="edit-loadout"]')?.click();
    expect(
      root.querySelector<HTMLButtonElement>('[data-loadout-id="triple-removal"]')?.getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(root.querySelector('[data-action="cancel-loadout"]')?.textContent).toBe("取消");
    expect(root.querySelector('[data-action="confirm-loadout"]')?.textContent).toContain("确认");
    expect(root.querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')?.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-action="cancel-loadout"]')?.click();
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).toBeNull();
    expect(game.getState().session.tray).toHaveLength(0);

    root.querySelector<HTMLButtonElement>('[data-action="edit-loadout"]')?.click();

    root.querySelector<HTMLButtonElement>('[data-loadout-id="triple-removal"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-loadout-id="torch"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')?.click();

    expect(root.querySelector('[data-testid="dog-loadout-confirmation"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="dog-loadout-confirmation"] p')?.textContent).toBe(
      "确认后将重置本关局内状态",
    );
    expect(confirmedLoadouts).toEqual([]);

    root.querySelector<HTMLButtonElement>('[data-action="apply-loadout-change"]')?.click();

    const after = game.getState();
    expect(confirmedLoadouts).toEqual([
      ["tray-capacity", "wildcard", "torch"],
    ]);
    expect(after.level).toEqual(before.level);
    expect(after.session.remainingBlocks).toEqual(before.session.remainingBlocks);
    expect(after.session.tray).toEqual([]);
    expect(after.session.status).toBe("playing");
    expect(after.loadout).toEqual(["tray-capacity", "wildcard", "torch"]);
    expect(after.loadoutEditor).toBeNull();

    game.selectBlock(after.session.selectableBlockIds[0] ?? "");
    expect(game.getState().session.tray).toHaveLength(1);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-edit-loadout"]')?.disabled).toBe(
      true,
    );
    await vi.runAllTimersAsync();
    expect(root.querySelector<HTMLButtonElement>('[data-testid="dog-edit-loadout"]')?.disabled).toBe(
      true,
    );
    root.querySelector<HTMLButtonElement>('[data-action="edit-loadout"]')?.click();
    expect(root.querySelector('[data-testid="dog-loadout-panel"]')).toBeNull();

    game.destroy();
  });
});

function startTestGame(root: HTMLElement, options: GameLaunchContext = {}) {
  return startDogLegeDogGame(root, {
    runSeed: DEFAULT_LEVEL_SEED,
    ...options,
  });
}

function createWildcardUiLevel(): DogLegeDogLevel {
  const patternTypes = ["打工狗", "单身狗"] as const satisfies readonly DogPatternType[];
  const blocks: readonly DogBlock[] = [
    createTestBlock("working-hidden", "打工狗", 0),
    createTestBlock("single-cover", "单身狗", 1),
    createTestBlock("working-target", "打工狗", 0, 8),
  ];
  return {
    ...FIRST_LEVEL,
    patternTypes,
    blocks,
    solutionPath: ["working-target", "single-cover", "working-hidden"],
  };
}

function createWildcardMatchUiLevel(): DogLegeDogLevel {
  const patternTypes = ["打工狗", "单身狗"] as const satisfies readonly DogPatternType[];
  const frozenMechanism = {
    type: "freeze",
    state: { status: "frozen", completedTriples: 0 },
  } as const;
  const blocks: readonly DogBlock[] = [
    createTestBlock("working-hidden", "打工狗", 0),
    createTestBlock("single-cover", "单身狗", 1),
    createTestBlock("frozen-working-1", "打工狗", 0, 8, frozenMechanism),
    createTestBlock("frozen-working-2", "打工狗", 0, 16, frozenMechanism),
  ];
  return {
    ...FIRST_LEVEL,
    patternTypes,
    blocks,
    solutionPath: blocks.map((block) => block.id),
  };
}

function createTestBlock(
  id: string,
  patternType: DogPatternType,
  z: number,
  x = 0,
  specialMechanism?: DogBlock["specialMechanism"],
): DogBlock {
  return {
    id,
    x,
    y: 0,
    z,
    width: 4,
    height: 4,
    rotation: 0,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}
