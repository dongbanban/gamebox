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

  const renderedAsset = await page.evaluate(async () => {
    const host = document.createElement("div");
    host.style.width = "335px";
    host.style.height = "388px";
    host.innerHTML =
      '<img src="assets/dog-icons-square/07-snarling-dog.svg" width="100%" height="100%" alt="" aria-hidden="true" />';
    document.body.append(host);

    const image = host.querySelector<HTMLImageElement>("img");
    if (image === null) {
      return { tagName: host.firstElementChild?.tagName ?? "", naturalWidth: 0, whitePixels: 0 };
    }

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
  });

  expect(renderedAsset.tagName).toBe("IMG");
  expect(renderedAsset.naturalWidth).toBe(335);
  expect(renderedAsset.whitePixels).toBeGreaterThan(100);
});
