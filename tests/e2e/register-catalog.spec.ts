import { expect, test, type Page } from "@playwright/test";

test.describe("注册与游戏目录", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("首次访问注册后进入目录并看到首个游戏", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "匿名注册" }).click();

    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
      ),
    ).toBe(true);
    await expect(page.getByRole("heading", { name: "狗了个狗" })).toBeVisible();
    await expect(page.getByText("最高解锁关卡")).toBeVisible();
    await expect(page.getByText("累计积分")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "开始游戏" })).toHaveText("开始游戏");

    const catalogText = await page.locator('[data-view="catalog"]').textContent();
    expect(catalogText).not.toContain("你的游戏合集");
    expect(catalogText).not.toContain("首个游戏");
    expect(catalogText).not.toContain("更多游戏正在路上");
    expect(catalogText).not.toContain("当前浏览器身份");
    const coverSource = await page.locator(".catalog-item__cover").getAttribute("src");
    expect(decodeURIComponent(coverSource ?? "")).not.toContain("GAMEBOX · 01");

    await page.getByRole("button", { name: "开始游戏" }).click();
    await expect(page.getByTestId("dog-loadout-modal")).toBeVisible();
    await expect(page.getByTestId("dog-loadout-panel")).toBeVisible();
    await expect(page.getByTestId("dog-loadout-option")).toHaveCount(5);
    await confirmDogLoadout(page);
    await expect(page.getByTestId("dog-loadout-thumbnail")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "变更" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "狗了个狗" })).toHaveCount(0);
    const catalogButton = page.locator('[data-view="game-entry"] [data-action="catalog"]');
    await expect(catalogButton).toHaveAttribute("aria-label", "返回游戏目录");
    await expect(catalogButton).toHaveText("");
    await expect(catalogButton.locator("svg")).toBeVisible();
    await expect(page.locator('[data-testid="level-picker"]')).toHaveCount(0);
    await expect(page.locator('[data-view="game-entry"] [data-action="select-level"]')).toHaveCount(0);
    await expect(page.locator('[data-view="game-entry"] [data-action="toggle-sound"]')).toBeVisible();
    await expect(page.getByTestId("dog-active-level")).toContainText("1");
    await expect(page.locator('[data-testid="dog-game"] h2')).toHaveCount(0);
    await expect(page.getByText("游戏入口已打开")).toHaveCount(0);
    await expect(page.getByText("固定首关")).toHaveCount(0);
    await expect(page.getByText("稳定关卡")).toHaveCount(0);
    await expect(page.getByText("选择没有遮挡的方块，凑齐三个相同图案。")).toHaveCount(0);
    await expect(page.getByText("剩余方块")).toHaveCount(0);
    await expect(page.getByText("图案")).toHaveCount(0);
    await expect(page.getByText("层数")).toHaveCount(0);
  });

  test("目录卡片右侧动作行保持紧凑高度", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "匿名注册" }).click();

    const layout = await page.evaluate(() => {
      const getHeight = (selector: string): number => {
        const element = document.querySelector<HTMLElement>(selector);
        return element?.getBoundingClientRect().height ?? 0;
      };

      return {
        actionsHeight: getHeight(".catalog-item__actions"),
        levelHeight: getHeight(".catalog-item__level"),
        buttonHeight: getHeight('.catalog-item__actions [data-action="enter-game"]'),
        coverObjectFit: getComputedStyle(
          document.querySelector<HTMLElement>(".catalog-item__cover") as HTMLElement,
        ).objectFit,
      };
    });
    expect(layout.actionsHeight).toBeLessThanOrEqual(72);
    expect(layout.buttonHeight).toBeLessThanOrEqual(72);
    expect(layout.levelHeight).toBeLessThanOrEqual(72);
    expect(layout.coverObjectFit).toBe("cover");
  });

  test("回访跳过注册，确认重置后返回注册页", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.reload();

    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toHaveCount(0);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "重置本地数据" }).click();

    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem("gamebox.state"))).resolves.toBeNull();
  });

  test("浏览器后退在活动关卡中确认，取消后继续并确认后返回目录", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await confirmDogLoadout(page);
    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();
    const savedState = await page.evaluate(() => window.localStorage.getItem("gamebox.state"));

    const cancelledDialog = page.waitForEvent("dialog");
    const cancelledNavigation = page.goBack();
    const firstDialog = await cancelledDialog;
    expect(firstDialog.message()).toBe("当前关卡不会保存，确认离开？");
    await firstDialog.dismiss();
    await cancelledNavigation;
    await expect(page.getByTestId("dog-board")).toBeVisible();

    const acceptedDialog = page.waitForEvent("dialog");
    const acceptedNavigation = page.goBack();
    const secondDialog = await acceptedDialog;
    expect(secondDialog.message()).toBe("当前关卡不会保存，确认离开？");
    await secondDialog.accept();
    await acceptedNavigation;
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem("gamebox.state"))).resolves.toBe(
      savedState,
    );
  });

  test("刷新活动关卡返回目录且不保存半局", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await confirmDogLoadout(page);
    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();
    const savedState = await page.evaluate(() => window.localStorage.getItem("gamebox.state"));

    await acceptBeforeUnload(page, () => page.reload());

    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByTestId("dog-board")).toHaveCount(0);
    await expect(page.evaluate(() => window.localStorage.getItem("gamebox.state"))).resolves.toBe(
      savedState,
    );
  });

  test("关闭活动关卡后重新打开不恢复半局", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await confirmDogLoadout(page);
    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();
    const savedState = await page.evaluate(() => window.localStorage.getItem("gamebox.state"));

    await acceptBeforeUnload(page, () => page.close({ runBeforeUnload: true }));
    const reopenedPage = await page.context().newPage();
    await reopenedPage.goto("/");

    await expect(reopenedPage.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(reopenedPage.getByTestId("dog-board")).toHaveCount(0);
    await expect(
      reopenedPage.evaluate(() => window.localStorage.getItem("gamebox.state")),
    ).resolves.toBe(savedState);
    await reopenedPage.close();
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
    await expect(page.locator(".dog-loadout-thumbnail__placeholder").first()).toHaveText("道");
    await expect(page.getByRole("button", { name: "变更" })).toBeVisible();

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
    expect(layout.loadoutSummaryBackground).toBe("rgba(0, 0, 0, 0)");
    expect(layout.loadoutSummaryBorderWidth).toBe("0px");
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
    expect(layout.selectableBlock).not.toBeNull();
    expect(layout.selectableBlock?.width).toBeGreaterThan(18);
    expect(layout.selectableBlock?.height).toBeGreaterThan(18);
    expect(layout.catalogButton?.left).toBeLessThan(layout.brandLogo?.left ?? Number.POSITIVE_INFINITY);

    const selectableBlock = page.locator('[data-testid="dog-block"]:not([disabled])').first();
    await selectableBlock.click();
    await expect(page.locator('[data-testid="dog-tray-slot"][data-pattern-type]')).toHaveCount(1);
    const visualSemantics = await page.evaluate(() => {
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
      const matchingBlock = [
        ...document.querySelectorAll<HTMLElement>('[data-testid="dog-block"]:not([disabled])'),
      ].find((block) => block.dataset.patternType === filledSlot?.dataset.patternType);
      const slotStyle = filledSlot === null ? null : getComputedStyle(filledSlot);
      const blockStyle = matchingBlock === undefined ? null : getComputedStyle(matchingBlock);
      return {
        slotBackground: slotStyle?.backgroundColor ?? "",
        blockBackground: blockStyle?.backgroundColor ?? "",
        slotBorder: slotStyle?.border ?? "",
        blockBorder: blockStyle?.border ?? "",
        slotShadow: slotStyle?.boxShadow ?? "",
        blockShadow: blockStyle?.boxShadow ?? "",
        slotRect: filledSlot === null ? null : serializeRect(filledSlot),
        glyphRect: filledGlyph === null ? null : serializeRect(filledGlyph),
      };
    });
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
      const boardRect = board?.getBoundingClientRect();
      const frameRect = frame?.getBoundingClientRect();
      return {
        boardWidth: boardRect?.width ?? 0,
        boardCenter: boardRect === undefined ? 0 : boardRect.left + boardRect.width / 2,
        frameCenter: frameRect === undefined ? 0 : frameRect.left + frameRect.width / 2,
      };
    });
    expect(desktopLayout.boardWidth).toBeLessThanOrEqual(1040);
    expect(Math.abs(desktopLayout.boardCenter - desktopLayout.frameCenter)).toBeLessThanOrEqual(1);
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

async function acceptBeforeUnload<T>(page: Page, action: () => Promise<T>): Promise<T> {
  const dialogPromise = page.waitForEvent("dialog");
  const actionPromise = action();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.accept();
  return actionPromise;
}

async function confirmDogLoadout(page: Page): Promise<void> {
  for (const itemId of ["triple-removal", "tray-capacity", "wildcard"]) {
    await page.locator(
      `[data-testid="dog-loadout-option"][data-loadout-id="${itemId}"]`,
    ).click();
  }
  await page.getByTestId("dog-loadout-confirm").click();
  await expect(page.getByTestId("dog-loadout-summary")).toBeVisible();
}
