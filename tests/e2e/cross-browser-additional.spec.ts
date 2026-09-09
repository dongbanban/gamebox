import { expect, test } from "@playwright/test";
import { enterGame, leaveActiveGame } from "./support/full-flow-fixtures";
import { resetPage } from "./support/common";

test("跨浏览器减少动态效果并保留静态识别信息", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 430, height: 932 });
  await resetPage(page);
  await page.getByRole("button", { name: "匿名注册" }).click();
  await enterGame(page);

  const illusion = page.locator(
    '[data-testid="dog-block"][data-special-mechanism="illusion"]',
  ).first();
  await expect(illusion).toHaveCount(1);
  const illusionVisual = await illusion.evaluate((element) => {
    const glyph = element.querySelector(".dog-block__glyph--fuzzy");
    return {
      className: element.className,
      mechanism: element.getAttribute("data-special-mechanism"),
      asset: glyph?.querySelector("img")?.getAttribute("src") ?? null,
      borderWidth: getComputedStyle(element).borderTopWidth,
      maskAnimation: getComputedStyle(element, "::before").animationName,
      fuzzyAnimation: glyph === null ? null : getComputedStyle(glyph).animationName,
    };
  });
  expect(illusionVisual.className).toContain("dog-block--special-illusion");
  expect(illusionVisual.mechanism).toBe("illusion");
  expect(illusionVisual.asset).toContain("dog-icons-square");
  expect(illusionVisual.borderWidth).not.toBe("0px");
  expect(illusionVisual.maskAnimation).toBe("none");
  expect(illusionVisual.fuzzyAnimation).toBe("none");

  const twin = page.locator('[data-testid="dog-block"][data-special-mechanism="twin"]').first();
  const magnetic = page.locator('[data-testid="dog-block"][data-special-mechanism="magnetic"]').first();
  await expect(twin).toHaveCount(1);
  await expect(magnetic).toHaveCount(1);
  expect(await twin.evaluate((element) => getComputedStyle(element, "::after").content)).toBe('"2"');
  await expect(magnetic.locator(".dog-block__mechanism-icon")).toHaveText("🧲");

  const ordinaryBlock = page.locator(
    '[data-testid="dog-block"]:not([disabled]):not([data-special-mechanism])',
  ).first();
  await ordinaryBlock.click();
  await page.waitForFunction(() => {
    const game = document.querySelector<HTMLElement>('[data-testid="dog-game"]');
    return game?.dataset.inputLocked === "false" &&
      document.querySelector('[data-testid="dog-flight"]') === null;
  });
  const traySlot = page.locator('[data-testid="dog-tray-slot"][data-pattern-type]').first();
  await expect(traySlot).toHaveCount(1);
  expect(await traySlot.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");

  await page.getByTestId("dog-special-mechanism-button").click();
  const thumbnail = page.locator(
    '[data-testid="dog-special-mechanism-thumbnail"][data-special-mechanism="illusion"]',
  ).first();
  await expect(thumbnail).toHaveCount(1);
  const thumbnailVisual = await thumbnail.evaluate((element) => ({
    asset: element.querySelector("img")?.getAttribute("src") ?? null,
    borderWidth: getComputedStyle(element).borderTopWidth,
    maskAnimation: getComputedStyle(element, "::before").animationName,
    fuzzyAnimation: getComputedStyle(element.querySelector(".dog-block__glyph--fuzzy") ?? element).animationName,
  }));
  expect(thumbnailVisual.asset).toContain("dog-icons-square");
  expect(thumbnailVisual.borderWidth).not.toBe("0px");
  expect(thumbnailVisual.maskAnimation).toBe("none");
  expect(thumbnailVisual.fuzzyAnimation).toBe("none");
});

test("跨浏览器新获得的焦点不会被旧棋盘焦点抢回", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await resetPage(page);
  await page.getByRole("button", { name: "匿名注册" }).click();
  await enterGame(page);

  const focusedBlock = page.locator('[data-testid="dog-block"]:not([disabled])').first();
  const focusedId = await focusedBlock.getAttribute("data-block-id");
  if (focusedId === null) {
    throw new Error("Expected a focusable board block");
  }
  await focusedBlock.focus();
  const targetId = await page.evaluate((currentFocusedId) => {
    return [...document.querySelectorAll('[data-testid="dog-block"]')]
      .find((block) =>
        block.getAttribute("data-block-id") !== currentFocusedId &&
        !block.hasAttribute("disabled") &&
        block.getAttribute("data-special-mechanism") === null,
      )
      ?.getAttribute("data-block-id") ?? null;
  }, focusedId);
  if (targetId === null) {
    throw new Error("Expected a second ordinary board block");
  }

  const lockedDuringSelection = await page.evaluate((blockId) => {
    document.querySelector<HTMLElement>(
      `[data-testid="dog-block"][data-block-id="${blockId}"]`,
    )?.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
    }));
    document.querySelector<HTMLElement>('[data-testid="dog-special-mechanism-button"]')?.focus();
    return document.querySelector<HTMLElement>('[data-testid="dog-game"]')?.dataset.inputLocked === "true";
  }, targetId);

  expect(lockedDuringSelection).toBe(true);
  const mechanismButton = page.getByTestId("dog-special-mechanism-button");
  await expect(mechanismButton).toBeFocused();
  await page.waitForFunction(() => {
    const game = document.querySelector<HTMLElement>('[data-testid="dog-game"]');
    return game?.dataset.inputLocked === "false" &&
      document.querySelector('[data-testid="dog-flight"]') === null;
  });
  await expect(mechanismButton).toBeFocused();
});

test("跨浏览器键盘可以遍历并激活方块", async ({ page, browserName }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await resetPage(page);
  await page.getByRole("button", { name: "匿名注册" }).click();
  await enterGame(page);

  let activatedId: string | null = null;
  if (browserName !== "webkit") {
    const startFocus = page.getByTestId("dog-special-mechanism-button");
    await startFocus.focus();
    await expect(startFocus).toBeFocused();
    for (let tabCount = 0; tabCount < 100 && activatedId === null; tabCount += 1) {
      await page.keyboard.press("Tab");
      activatedId = await page.evaluate(() => {
        const active = document.activeElement;
        return active instanceof HTMLElement && active.dataset.testid === "dog-block"
          ? active.dataset.blockId ?? null
          : null;
      });
    }
    expect(activatedId).not.toBeNull();
  } else {
    const keyboardBlock = page.locator(
      '[data-testid="dog-block"]:not([disabled]):not([data-special-mechanism])',
    ).first();
    activatedId = await keyboardBlock.getAttribute("data-block-id");
    if (activatedId === null) {
      throw new Error("Expected a focusable ordinary board block");
    }
    await keyboardBlock.focus();
    await expect(keyboardBlock).toBeFocused();
  }

  await page.locator(`[data-testid="dog-block"][data-block-id="${activatedId}"]`).press("Enter");
  await expect(page.locator(`[data-testid="dog-block"][data-block-id="${activatedId}"]`)).toHaveCount(0);
  expect(await page.locator('[data-testid="dog-tray-slot"][data-pattern-type]').count()).toBeGreaterThan(0);
});

test("跨浏览器活动关卡可以退出回到游戏目录", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await resetPage(page);
  await page.getByRole("button", { name: "匿名注册" }).click();
  await enterGame(page);
  await leaveActiveGame(page, true);

  await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
  await expect(page.getByTestId("dog-game")).toHaveCount(0);
});
