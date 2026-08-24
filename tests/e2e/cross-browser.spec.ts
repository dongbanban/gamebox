import { expect, test } from "@playwright/test";

test("跨浏览器核心 smoke：注册、目录与首关入口可用", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "匿名注册" }).click();
  await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByTestId("dog-board")).toBeVisible();
  await expect(page.getByTestId("dog-loadout-modal")).toBeVisible();
  await expect(page.getByTestId("dog-loadout-panel")).toBeVisible();
  const modalPosition = await page.getByTestId("dog-loadout-modal").evaluate(
    (modal) => getComputedStyle(modal).position,
  );
  expect(modalPosition).toBe("fixed");
  await expect(page.getByTestId("dog-active-level")).toContainText("1");

  const boardLayout = await page.evaluate(() => {
    const board = document.querySelector<HTMLElement>('[data-testid="dog-board"]');
    const block = document.querySelector<HTMLElement>('[data-testid="dog-block"]');
    const rect = board?.getBoundingClientRect();
    return {
      left: rect?.left ?? 0,
      right: rect?.right ?? 0,
      viewportWidth: window.innerWidth,
      blockWidth: block?.style.getPropertyValue("--block-width") ?? "",
      blockHeight: block?.style.getPropertyValue("--block-height") ?? "",
    };
  });
  expect(boardLayout.left).toBeGreaterThanOrEqual(0);
  expect(boardLayout.right).toBeLessThanOrEqual(boardLayout.viewportWidth);
  expect(boardLayout.blockWidth).toBe("48px");
  expect(boardLayout.blockHeight).toBe("48px");
});

test("龇牙狗图案在跨浏览器中保留白色牙齿", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "匿名注册" }).click();

  const catalogCoverSource = await page.locator(".catalog-item__cover").getAttribute("src");
  expect(catalogCoverSource).not.toBeNull();
  const snarlingDogSource = catalogCoverSource?.replace(
    "10-silly-dog.svg",
    "07-snarling-dog.svg",
  );

  const renderedAsset = await page.evaluate(async (assetSource) => {
    const host = document.createElement("div");
    host.style.width = "335px";
    host.style.height = "388px";
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";
    image.width = 335;
    image.height = 388;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.src = assetSource;
    host.append(image);
    document.body.append(host);

    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 335;
    canvas.height = 388;
    const context = canvas.getContext("2d");
    if (context === null) {
      return { tagName: image.tagName, naturalWidth: image.naturalWidth, whitePixels: 0 };
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let whitePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] > 220 && pixels[index + 1] > 220 && pixels[index + 2] > 220) {
        whitePixels += 1;
      }
    }

    return { tagName: image.tagName, naturalWidth: image.naturalWidth, whitePixels };
  }, snarlingDogSource ?? "");

  expect(renderedAsset.tagName).toBe("IMG");
  expect(renderedAsset.naturalWidth).toBe(335);
  expect(renderedAsset.whitePixels).toBeGreaterThan(100);
});

test("跨浏览器三消期间道具栏保持稳定", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "匿名注册" }).click();
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByTestId("dog-loadout-panel")).toBeVisible();

  for (const itemId of ["triple-removal", "tray-capacity", "wildcard"]) {
    await page.locator(`[data-testid="dog-loadout-option"][data-loadout-id="${itemId}"]`).click();
  }
  await page.getByTestId("dog-loadout-confirm").click();
  await expect(page.getByTestId("dog-loadout-summary")).toBeVisible();

  let matched = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const before = await page.evaluate(() => {
      const trayBlocks = [...document.querySelectorAll<HTMLElement>(
        '[data-testid="dog-tray-slot"][data-pattern-type]',
      )].filter((slot) => slot.dataset.specialMechanismState !== "frozen");
      const trayCounts = new Map<string, number>();
      for (const slot of trayBlocks) {
        const pattern = slot.dataset.patternType;
        if (pattern !== undefined) {
          trayCounts.set(pattern, (trayCounts.get(pattern) ?? 0) + 1);
        }
      }

      const block = [...document.querySelectorAll<HTMLElement>(
        '[data-testid="dog-block"]:not([disabled])',
      )]
        .filter((candidate) => candidate.dataset.specialMechanism !== "freeze")
        .sort((first, second) => {
          const firstPattern = first.dataset.patternType ?? "";
          const secondPattern = second.dataset.patternType ?? "";
          return (
            (trayCounts.get(secondPattern) ?? 0) - (trayCounts.get(firstPattern) ?? 0) ||
            Number(second.dataset.z ?? 0) - Number(first.dataset.z ?? 0)
          );
        })
        .at(0);
      const thumbnail = document.querySelector<HTMLElement>(
        '[data-testid="dog-loadout-thumbnail"][data-loadout-id="tray-capacity"]',
      );
      thumbnail?.setAttribute("data-cross-browser-probe", "true");
      const rect = thumbnail?.getBoundingClientRect();
      return {
        blockId: block?.dataset.blockId ?? null,
        trayCount: trayBlocks.length,
        thumbnailLeft: rect?.left ?? null,
        thumbnailTop: rect?.top ?? null,
      };
    });
    if (before.blockId === null) {
      break;
    }

    await page.locator(`[data-testid="dog-block"][data-block-id="${before.blockId}"]`).click();
    const after = await page.waitForFunction(
      ({ trayCount }) => {
        const game = document.querySelector<HTMLElement>('[data-testid="dog-game"]');
        const match = document.querySelector('[data-testid="dog-match-effect"]') !== null;
        const currentTrayCount = document.querySelectorAll(
          '[data-testid="dog-tray-slot"][data-pattern-type]',
        ).length;
        const ready = game?.dataset.inputLocked === "false" &&
          document.querySelector('[data-testid="dog-flight"]') === null;
        return match || (ready && currentTrayCount >= trayCount + 1)
          ? {
              match,
              currentTrayCount,
              probe: document.querySelector<HTMLElement>(
                '[data-testid="dog-loadout-thumbnail"][data-loadout-id="tray-capacity"]',
              )?.dataset.crossBrowserProbe ?? null,
              rect: document.querySelector<HTMLElement>(
                '[data-testid="dog-loadout-thumbnail"][data-loadout-id="tray-capacity"]',
              )?.getBoundingClientRect().toJSON() ?? null,
            }
          : null;
      },
      { trayCount: before.trayCount },
    ).then((handle) => handle.jsonValue()).then((value) => value as {
      readonly match: boolean;
      readonly currentTrayCount: number;
      readonly probe: string | null;
      readonly rect: { readonly left: number; readonly top: number } | null;
    });

    if (after?.match === true) {
      matched = true;
      expect(after.probe).toBe("true");
      expect(after.rect?.left ?? 0).toBeCloseTo(before.thumbnailLeft ?? 0, 0);
      expect(after.rect?.top ?? 0).toBeCloseTo(before.thumbnailTop ?? 0, 0);
      await page.waitForFunction(() => {
        const game = document.querySelector<HTMLElement>('[data-testid="dog-game"]');
        return game?.dataset.inputLocked === "false" &&
          document.querySelector('[data-testid="dog-match-effect"]') === null;
      });
      expect(
        await page.locator('[data-testid="dog-loadout-thumbnail"][data-loadout-id="tray-capacity"]').getAttribute(
          "data-cross-browser-probe",
        ),
      ).toBe("true");
      break;
    }
  }

  expect(matched).toBe(true);
});
