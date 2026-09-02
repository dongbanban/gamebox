import { expect, test } from "@playwright/test";
import { acceptBeforeUnload, confirmDogLoadout, resetPage } from "../support/common";

test.describe.configure({ timeout: 120_000 });

test.describe("注册与游戏目录 · responsive", () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test("移动端竖屏活动游戏将棋盘、暂存槽与控制压入无滚动视口", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await expect(page.getByTestId("dog-loadout-modal")).toBeVisible();
    const loadoutModalLayout = await page.evaluate(() => {
      const modal = document.querySelector<HTMLElement>('[data-testid="dog-loadout-modal"]');
      const panel = document.querySelector<HTMLElement>('[data-testid="dog-loadout-panel"]');
      return {
        position: modal === null ? "" : getComputedStyle(modal).position,
        overflowY: panel === null ? "" : getComputedStyle(panel).overflowY,
        maxHeight: panel === null ? "" : getComputedStyle(panel).maxHeight,
      };
    });
    expect(loadoutModalLayout.position).toBe("fixed");
    expect(loadoutModalLayout.overflowY).toBe("auto");
    expect(loadoutModalLayout.maxHeight).not.toBe("none");
    const loadoutOptionLayout = await page.evaluate(() => {
      const option = document.querySelector<HTMLElement>('[data-testid="dog-loadout-option"]');
      const optionIcon = document.querySelector<HTMLElement>('.dog-loadout-option__icon');
      return {
        direction: option === null ? "" : getComputedStyle(option).flexDirection,
        icon: optionIcon === null ? null : {
          width: optionIcon.getBoundingClientRect().width,
          height: optionIcon.getBoundingClientRect().height,
        },
      };
    });
    expect(loadoutOptionLayout.direction).toBe("row");
    expect(loadoutOptionLayout.icon?.width).toBe(48);
    expect(loadoutOptionLayout.icon?.height).toBe(48);
    await confirmDogLoadout(page);
    await expect(page.getByTestId("dog-loadout-thumbnail")).toHaveCount(3);
    await expect(page.locator(".dog-loadout-thumbnail__name")).toHaveCount(0);
    await expect(page.locator(".dog-loadout-thumbnail__icon img").first()).toHaveAttribute(
      "src",
      "assets/dog-item-icons/triple-removal.svg",
    );
    await expect(page.getByRole("button", { name: "变更" })).toBeVisible();
    const replayButton = page.getByRole("button", { name: "重玩本关" });
    await expect(replayButton).toBeVisible();
    await expect(replayButton).toHaveAttribute("aria-label", "重玩本关");

    const layout = await page.evaluate(() => {
      const serializeRect = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      };
      const getRect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        return element === null ? null : serializeRect(element);
      };
      const board = document.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const rect = board?.getBoundingClientRect();
      const traySlots = [
        ...document.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"]'),
      ];
      const selectableBlock = document.querySelector<HTMLElement>(
        '[data-testid="dog-block"]:not([disabled])',
      );
      const summary = document.querySelector<HTMLElement>('[data-testid="dog-loadout-summary"]');
      const changeButton = document.querySelector<HTMLElement>('[data-testid="dog-edit-loadout"]');
      const thumbnail = document.querySelector<HTMLElement>('[data-testid="dog-loadout-thumbnail"]');
      const itemIcons = [
        ...document.querySelectorAll<HTMLElement>('.dog-loadout-thumbnail__icon'),
      ];
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        bodyScrollWidth: document.body.scrollWidth,
        bodyScrollHeight: document.body.scrollHeight,
        boardLeft: rect?.left ?? 0,
        boardRight: rect?.right ?? 0,
        boardTop: rect?.top ?? 0,
        boardBottom: rect?.bottom ?? 0,
        boardWidth: rect?.width ?? 0,
        boardBackgroundImage: board === null ? "" : getComputedStyle(board).backgroundImage,
        tray: getRect('[data-testid="dog-tray"]'),
        loadoutSummary: summary === null ? null : serializeRect(summary),
        loadoutChangeButton: changeButton === null ? null : serializeRect(changeButton),
        loadoutThumbnail: thumbnail === null ? null : serializeRect(thumbnail),
        loadoutItemIcons: itemIcons.map((itemIcon) => {
          const style = getComputedStyle(itemIcon);
          const itemIconRect = itemIcon.getBoundingClientRect();
          return {
            width: itemIconRect.width,
            height: itemIconRect.height,
            backgroundColor: style.backgroundColor,
            color: style.color,
          };
        }),
        loadoutSummaryBackground: summary === null ? "" : getComputedStyle(summary).backgroundColor,
        loadoutSummaryBorderWidth: summary === null ? "" : getComputedStyle(summary).borderTopWidth,
        loadoutChangeButtonColor: changeButton === null ? "" : getComputedStyle(changeButton).color,
        loadoutChangeButtonBackground: changeButton === null ? "" : getComputedStyle(changeButton).backgroundColor,
        loadoutChangeButtonBorderWidth: changeButton === null ? "" : getComputedStyle(changeButton).borderBottomWidth,
        traySlots: traySlots.map(serializeRect),
        levelPicker: getRect('[data-testid="level-picker"]'),
        soundButton: getRect('[data-view="game-entry"] [data-action="toggle-sound"]'),
        catalogButton: getRect('[data-view="game-entry"] [data-action="catalog"]'),
        brandLogo: getRect('[data-view="game-entry"] .brand-lockup'),
        replayButton: getRect('[data-testid="dog-replay-current-level"]'),
        selectableBlock:
          selectableBlock === null
            ? null
            : getRect('[data-testid="dog-block"]:not([disabled])'),
      };
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.bodyScrollHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.boardLeft).toBeGreaterThanOrEqual(0);
    expect(layout.boardRight).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.boardTop).toBeGreaterThanOrEqual(0);
    expect(layout.boardBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.boardWidth).toBeGreaterThan(0);
    expect(layout.boardWidth).toBeGreaterThan(300);
    expect(layout.boardBackgroundImage).toBe("none");
    expect(layout.tray).not.toBeNull();
    expect(layout.tray?.top).toBeGreaterThanOrEqual(0);
    expect(layout.tray?.bottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.loadoutSummary).not.toBeNull();
    expect(layout.loadoutChangeButton).not.toBeNull();
    expect(layout.loadoutSummary?.top).toBeCloseTo(layout.boardBottom + 8, 1);
    expect(layout.loadoutSummaryBackground).toBe("rgba(0, 0, 0, 0)");
    expect(layout.loadoutSummaryBorderWidth).toBe("0px");
    expect(layout.loadoutItemIcons).toHaveLength(3);
    expect(
      layout.loadoutItemIcons.every(
        (itemIcon) =>
          itemIcon.width === 48 &&
          itemIcon.height === 48 &&
          itemIcon.backgroundColor === "rgb(255, 209, 102)" &&
          itemIcon.color === "rgb(255, 253, 248)",
      ),
    ).toBe(true);
    expect(layout.loadoutChangeButtonColor).toBe("rgb(63, 148, 195)");
    expect(layout.loadoutChangeButtonBackground).toBe("rgba(0, 0, 0, 0)");
    expect(layout.loadoutChangeButtonBorderWidth).toBe("0px");
    expect(layout.loadoutThumbnail).not.toBeNull();
    expect(layout.loadoutThumbnail?.width).toBe(48);
    expect(layout.loadoutThumbnail?.height).toBe(48);
    expect(layout.loadoutSummary?.bottom).toBeLessThanOrEqual(layout.tray?.top ?? 0);
    expect(layout.loadoutChangeButton?.right).toBeLessThanOrEqual(
      (layout.loadoutSummary?.right ?? 0) + 1,
    );
    expect(layout.traySlots).toHaveLength(7);
    expect(layout.traySlots.every((slot) => slot.width > 0 && slot.height > 0)).toBe(true);
    expect(
      layout.traySlots.every(
        (slot) => slot.top >= 0 && slot.bottom <= layout.viewportHeight,
      ),
    ).toBe(true);
    expect(layout.levelPicker).toBeNull();
    expect(layout.soundButton).not.toBeNull();
    expect(layout.soundButton?.top).toBeGreaterThanOrEqual(0);
    expect(layout.soundButton?.bottom).toBeLessThanOrEqual(layout.boardTop);
    expect(layout.replayButton).not.toBeNull();
    expect(layout.replayButton?.left).toBeGreaterThanOrEqual(0);
    expect(layout.replayButton?.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.selectableBlock).not.toBeNull();
    expect(layout.selectableBlock?.width).toBeGreaterThan(18);
    expect(layout.selectableBlock?.height).toBeGreaterThan(18);
    expect(layout.catalogButton?.left).toBeLessThan(layout.brandLogo?.left ?? Number.POSITIVE_INFINITY);

    const selectableBlock = page.locator(
      '[data-testid="dog-block"]:not([disabled]):not([data-special-mechanism])',
    ).first();
    const blockVisualSemantics = await selectableBlock.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        border: style.border,
        boxShadow: style.boxShadow,
      };
    });
    await selectableBlock.click();
    await expect(page.locator('[data-testid="dog-tray-slot"][data-pattern-type]')).toHaveCount(1);
    const visualSemantics = await page.evaluate((blockStyle) => {
      const serializeRect = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      };
      const filledSlot = document.querySelector<HTMLElement>(
        '[data-testid="dog-tray-slot"][data-pattern-type]',
      );
      const filledGlyph = filledSlot?.querySelector<HTMLElement>(".dog-block__glyph") ?? null;
      const slotStyle = filledSlot === null ? null : getComputedStyle(filledSlot);
      return {
        slotBackground: slotStyle?.backgroundColor ?? "",
        blockBackground: blockStyle.backgroundColor,
        slotBorder: slotStyle?.border ?? "",
        blockBorder: blockStyle.border,
        slotShadow: slotStyle?.boxShadow ?? "",
        blockShadow: blockStyle.boxShadow,
        slotRect: filledSlot === null ? null : serializeRect(filledSlot),
        glyphRect: filledGlyph === null ? null : serializeRect(filledGlyph),
      };
    }, blockVisualSemantics);
    expect(visualSemantics.slotBackground).toBe(visualSemantics.blockBackground);
    expect(visualSemantics.slotBorder).toBe(visualSemantics.blockBorder);
    expect(visualSemantics.slotShadow).toBe(visualSemantics.blockShadow);
    expect(visualSemantics.glyphRect).not.toBeNull();
    expect(visualSemantics.slotRect).not.toBeNull();
    expect(visualSemantics.glyphRect?.left).toBeGreaterThan(visualSemantics.slotRect?.left ?? 0);
    expect(visualSemantics.glyphRect?.right).toBeLessThan(visualSemantics.slotRect?.right ?? 0);
    expect(visualSemantics.glyphRect?.top).toBeGreaterThan(visualSemantics.slotRect?.top ?? 0);
    expect(visualSemantics.glyphRect?.bottom).toBeLessThan(visualSemantics.slotRect?.bottom ?? 0);
    await page.getByRole("button", { name: "音效开启" }).click();
    await expect(page.getByRole("button", { name: "音效关闭" })).toBeVisible();
    await page.getByRole("button", { name: "音效关闭" }).click();
    await expect(page.getByRole("button", { name: "音效开启" })).toBeVisible();
    await expect(page.getByTestId("dog-active-level")).toContainText("1");

    await page.setViewportSize({ width: 390, height: 667 });
    const compactLayout = await page.evaluate(() => {
      const boardRect = document
        .querySelector<HTMLElement>('[data-testid="dog-board"]')
        ?.getBoundingClientRect();
      const trayRect = document
        .querySelector<HTMLElement>('[data-testid="dog-tray"]')
        ?.getBoundingClientRect();
      return {
        scrollHeight: document.documentElement.scrollHeight,
        bodyScrollHeight: document.body.scrollHeight,
        boardWidth: boardRect?.width ?? 0,
        boardBottom: boardRect?.bottom ?? 0,
        trayBottom: trayRect?.bottom ?? 0,
      };
    });
    expect(compactLayout.scrollHeight).toBeLessThanOrEqual(667);
    expect(compactLayout.bodyScrollHeight).toBeLessThanOrEqual(667);
    expect(compactLayout.boardWidth).toBeLessThanOrEqual(layout.boardWidth);
    expect(compactLayout.boardBottom).toBeLessThanOrEqual(667);
    expect(compactLayout.trayBottom).toBeLessThanOrEqual(667);

    await page.setViewportSize({ width: 320, height: 568 });
    const tinyLayout = await page.evaluate(() => {
      const board = document.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const rect = board?.getBoundingClientRect();
      return {
        scrollHeight: document.documentElement.scrollHeight,
        bodyScrollHeight: document.body.scrollHeight,
        visualAspectRatio: rect === undefined ? 0 : rect.width / rect.height,
        logicalAspectRatio:
          Number(board?.dataset.logicalWidth ?? 0) / Number(board?.dataset.logicalHeight ?? 1),
        boardBottom: rect?.bottom ?? 0,
        selectableBlockWidth:
          document.querySelector<HTMLElement>('[data-testid="dog-block"]')
            ?.getBoundingClientRect().width ?? 0,
        selectableBlockHeight:
          document.querySelector<HTMLElement>('[data-testid="dog-block"]')
            ?.getBoundingClientRect().height ?? 0,
        trayBottom:
          document.querySelector<HTMLElement>('[data-testid="dog-tray"]')?.getBoundingClientRect()
            .bottom ?? 0,
        replayButtonRight:
          document.querySelector<HTMLElement>('[data-testid="dog-replay-current-level"]')
            ?.getBoundingClientRect().right ?? 0,
      };
    });
    expect(tinyLayout.scrollHeight).toBeLessThanOrEqual(568);
    expect(tinyLayout.bodyScrollHeight).toBeLessThanOrEqual(568);
    expect(Math.abs(tinyLayout.visualAspectRatio - tinyLayout.logicalAspectRatio)).toBeLessThanOrEqual(
      0.01,
    );
    expect(tinyLayout.selectableBlockWidth).toBeGreaterThan(14);
    expect(tinyLayout.selectableBlockHeight).toBeGreaterThan(14);
    expect(tinyLayout.boardBottom).toBeLessThanOrEqual(568);
    expect(tinyLayout.trayBottom).toBeLessThanOrEqual(568);
    expect(tinyLayout.replayButtonRight).toBeLessThanOrEqual(320);
    await expect(page.getByRole("button", { name: "重玩本关" })).toHaveText("重玩本关");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const desktopLayout = await page.evaluate(() => {
      const board = document.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const frame = document.querySelector<HTMLElement>('.dog-board-frame');
      const summary = document.querySelector<HTMLElement>('[data-testid="dog-loadout-summary"]');
      const boardRect = board?.getBoundingClientRect();
      const frameRect = frame?.getBoundingClientRect();
      const summaryRect = summary?.getBoundingClientRect();
      return {
        boardWidth: boardRect?.width ?? 0,
        boardBottom: boardRect?.bottom ?? 0,
        boardCenter: boardRect === undefined ? 0 : boardRect.left + boardRect.width / 2,
        frameCenter: frameRect === undefined ? 0 : frameRect.left + frameRect.width / 2,
        summaryTop: summaryRect?.top ?? 0,
      };
    });
    expect(desktopLayout.boardWidth).toBeLessThanOrEqual(1040);
    expect(Math.abs(desktopLayout.boardCenter - desktopLayout.frameCenter)).toBeLessThanOrEqual(1);
    expect(desktopLayout.summaryTop).toBeCloseTo(desktopLayout.boardBottom + 8, 1);
  });

  test("容量提升后暂存槽保持单行并按容量缩放槽块", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await confirmDogLoadout(page);

    const beforeWidth = await page.locator('[data-testid="dog-tray-slot"]').first().evaluate(
      (slot) => slot.getBoundingClientRect().width,
    );
    await page.locator('[data-action="use-item"][data-item-id="tray-capacity"]').click();
    await expect(page.locator('[data-testid="dog-tray"][data-tray-capacity="8"]')).toBeVisible();

    const afterLayout = await page.evaluate(() => {
      const tray = document.querySelector<HTMLElement>('[data-testid="dog-tray"]');
      const slots = [...document.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"]')];
      return {
        gridColumns: tray === null ? [] : getComputedStyle(tray).gridTemplateColumns.trim().split(/\s+/),
        slotWidth: slots[0]?.getBoundingClientRect().width ?? 0,
        slotTops: slots.map((slot) => Math.round(slot.getBoundingClientRect().top)),
      };
    });
    expect(afterLayout.gridColumns).toHaveLength(8);
    expect(new Set(afterLayout.slotTops).size).toBe(1);
    expect(afterLayout.slotWidth).toBeLessThan(beforeWidth);
  });

  test("棋盘狗图标不显示白色下沿，暂存槽图片不溢出", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await confirmDogLoadout(page);
    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();

    const visuals = await page.evaluate(() => {
      const boardGlyph = document.querySelector<HTMLElement>(
        ".dog-board .dog-block__glyph",
      );
      const boardImage = boardGlyph?.querySelector<HTMLImageElement>("img");
      const filledSlot = document.querySelector<HTMLElement>(
        '[data-testid="dog-tray-slot"][data-pattern-type]',
      );
      const trayGlyph = filledSlot?.querySelector<HTMLElement>(".dog-block__glyph");
      const trayImage = trayGlyph?.querySelector<HTMLImageElement>("img");
      const slotRect = filledSlot?.getBoundingClientRect();
      const imageRect = trayImage?.getBoundingClientRect();
      const renderedBlocks = [
        ...document.querySelectorAll<HTMLElement>('[data-testid="dog-block"]'),
      ].map((block) => ({
        left: Number.parseFloat(block.style.getPropertyValue("--block-left")),
        top: Number.parseFloat(block.style.getPropertyValue("--block-top")),
        width: Number.parseFloat(block.style.getPropertyValue("--block-width")),
        height: Number.parseFloat(block.style.getPropertyValue("--block-height")),
      }));
      const board = document.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const boardWidth = Number.parseFloat(
        board?.style.getPropertyValue("--board-pixel-width") ?? "0",
      );
      const boardHeight = Number.parseFloat(
        board?.style.getPropertyValue("--board-pixel-height") ?? "0",
      );

      return {
        boardGlyphFilter: boardGlyph === null ? "" : getComputedStyle(boardGlyph).filter,
        boardImageDisplay: boardImage == null ? "" : getComputedStyle(boardImage).display,
        trayImageDisplay: trayImage == null ? "" : getComputedStyle(trayImage).display,
        trayImageBottom: imageRect?.bottom ?? 0,
        traySlotBottom: slotRect?.bottom ?? 0,
        minBlockLeft: Math.min(...renderedBlocks.map((block) => block.left)),
        minBlockTop: Math.min(...renderedBlocks.map((block) => block.top)),
        minBlockRightGap: Math.min(
          ...renderedBlocks.map((block) => boardWidth - block.left - block.width),
        ),
        minBlockBottomGap: Math.min(
          ...renderedBlocks.map((block) => boardHeight - block.top - block.height),
        ),
      };
    });
    expect(visuals.boardGlyphFilter).toBe("none");
    expect(visuals.boardImageDisplay).toBe("block");
    expect(visuals.trayImageDisplay).toBe("block");
    expect(visuals.trayImageBottom).toBeLessThanOrEqual(visuals.traySlotBottom);
    expect(visuals.minBlockLeft).toBeGreaterThanOrEqual(12);
    expect(visuals.minBlockTop).toBeGreaterThanOrEqual(12);
    expect(visuals.minBlockRightGap).toBeGreaterThanOrEqual(12);
    expect(visuals.minBlockBottomGap).toBeGreaterThanOrEqual(12);
  });

  test("活动棋盘使用 48px 方块与同尺寸底层网格", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await confirmDogLoadout(page);

    const layout = await page.evaluate(() => {
      const board = document.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const block = document.querySelector<HTMLElement>('[data-testid="dog-block"]');
      const boardRect = board?.getBoundingClientRect();
      const blockRect = block?.getBoundingClientRect();
      const boardStyle = board === null ? null : getComputedStyle(board);
      const scale = Number(board?.style.getPropertyValue("--board-display-scale") || 1);
      return {
        viewportWidth: window.innerWidth,
        boardLeft: boardRect?.left ?? 0,
        boardRight: boardRect?.right ?? 0,
        boardContentWidth:
          (boardRect?.width ?? 0) / scale -
          Number.parseFloat(boardStyle?.borderLeftWidth ?? "0") -
          Number.parseFloat(boardStyle?.borderRightWidth ?? "0"),
        boardContentHeight:
          (boardRect?.height ?? 0) / scale -
          Number.parseFloat(boardStyle?.borderTopWidth ?? "0") -
          Number.parseFloat(boardStyle?.borderBottomWidth ?? "0"),
        blockWidth: (blockRect?.width ?? 0) / scale,
        blockHeight: (blockRect?.height ?? 0) / scale,
        columns: Number(board?.style.getPropertyValue("--board-columns") ?? 0),
        rows: Number(board?.style.getPropertyValue("--board-rows") ?? 0),
        scale,
      };
    });

    expect(layout.blockWidth).toBeCloseTo(48, 1);
    expect(layout.blockHeight).toBeCloseTo(48, 1);
    expect(layout.columns).toBe(9);
    expect(layout.rows).toBe(12);
    expect(layout.boardContentWidth / layout.columns).toBeCloseTo(48, 1);
    expect(layout.boardContentHeight / layout.rows).toBeCloseTo(48, 1);
    expect(layout.scale).toBeLessThan(1);
    expect(layout.boardLeft).toBeGreaterThanOrEqual(0);
    expect(layout.boardRight).toBeLessThanOrEqual(layout.viewportWidth);
  });
});
