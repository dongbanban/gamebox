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
import {
  createKeyUiLevel,
  createWildcardMatchUiLevel,
  createWildcardUiLevel,
  startTestGame,
} from "../support/dog-game-fixtures";

afterEach(() => {
  vi.useRealTimers();
});

describe("狗了个狗测试 · items", () => {
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
    expect(root.querySelectorAll('[data-slot-state="locked"]')).toHaveLength(0);
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
    expect(root.querySelectorAll('[data-testid="dog-special-mechanism-thumbnail"]')).toHaveLength(4);
    const freezeThumbnail = root.querySelector<HTMLElement>(
      '[data-testid="dog-special-mechanism-thumbnail"][data-special-mechanism="freeze"]',
    );
    const illusionThumbnail = root.querySelector<HTMLElement>(
      '[data-testid="dog-special-mechanism-thumbnail"][data-special-mechanism="illusion"]',
    );
    const illusionBlock = game.getState().level.blocks.find(
      (block) => block.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE,
    );
    const twinThumbnail = root.querySelector<HTMLElement>(
      `[data-testid="dog-special-mechanism-thumbnail"][data-special-mechanism="${DOG_TWIN_MECHANISM_TYPE}"]`,
    );
    expect(freezeThumbnail?.classList.contains("dog-block--mechanism-preview")).toBe(true);
    expect(freezeThumbnail?.classList.contains("dog-block--special-freeze")).toBe(true);
    expect(freezeThumbnail?.querySelector("img")).not.toBeNull();
    expect(illusionThumbnail?.classList.contains("dog-block--mechanism-preview")).toBe(true);
    expect(illusionThumbnail?.classList.contains("dog-block--special-illusion")).toBe(false);
    expect(illusionBlock).not.toBeUndefined();
    expect(
      illusionThumbnail?.classList.contains(
        `dog-block--${getDogPatternClassName(illusionBlock?.patternType ?? "傻狗")}`,
      ),
    ).toBe(true);
    expect(illusionThumbnail?.querySelector(".dog-block__glyph--fuzzy")).toBeNull();
    expect(twinThumbnail?.classList.contains("dog-block--special-twin")).toBe(false);
    expect(twinThumbnail?.querySelector(".dog-block__glyph")).not.toBeNull();
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

  it("渲染右侧锁槽，合格三消掉钥匙并按顺序解锁", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const level = createKeyUiLevel();
    const game = startDogLegeDogGame(root, {
      level,
      loadout: ["key", "torch", "detector"],
    });

    expect(root.querySelectorAll('[data-slot-state="locked"]')).toHaveLength(2);
    expect(root.querySelector<HTMLElement>('[data-testid="dog-tray"]')?.dataset.effectiveTrayCapacity).toBe("5");
    for (const [index, blockId] of ["working-1", "working-2", "working-3"].entries()) {
      game.selectBlock(blockId);
      if (index === 2) {
        await vi.advanceTimersByTimeAsync(700);
        expect(root.querySelector('[data-testid="dog-key-drop-effect"]')).not.toBeNull();
      } else {
        await vi.runAllTimersAsync();
      }
    }

    expect(game.getState().items?.items.find((item) => item.id === "key")).toMatchObject({
      maxUses: 2,
      remainingUses: 1,
      available: true,
    });
    await vi.runAllTimersAsync();
    expect(root.querySelector('[data-testid="dog-key-drop-effect"]')).toBeNull();

    root.querySelector<HTMLButtonElement>('[data-action="use-item"][data-item-id="key"]')?.click();
    expect(game.getState().session).toMatchObject({
      effectiveTrayCapacity: 6,
      lockedTraySlotCount: 1,
    });
    expect(root.querySelector('[data-testid="dog-tray-unlock-effect"]')).not.toBeNull();
    await vi.runAllTimersAsync();
    expect(root.querySelectorAll('[data-slot-state="locked"]')).toHaveLength(1);
    expect(game.getState().items?.items.find((item) => item.id === "key")).toMatchObject({
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
