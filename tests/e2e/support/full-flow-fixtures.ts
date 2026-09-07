import { expect, type Page } from "@playwright/test";
import { confirmDogLoadout } from "./common";

export async function enterGame(page: Page): Promise<void> {
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByTestId("dog-game")).toBeVisible();
  await confirmDogLoadout(page);
}

export async function getBlockIds(page: Page): Promise<(string | null)[]> {
  return page
    .locator('[data-testid="dog-block"]')
    .evaluateAll((blocks) => blocks.map((block) => block.getAttribute("data-block-id")));
}

export async function clickBlock(page: Page, blockId: string): Promise<void> {
  await page.locator(`[data-testid="dog-block"][data-block-id="${blockId}"]`).click();
  await page.waitForFunction(() => {
    const game = document.querySelector<HTMLElement>('[data-testid="dog-game"]');
    return game === null || (
      game.dataset.inputLocked === "false" &&
      document.querySelector('[data-testid="dog-flight"]') === null
    );
  });
}

export async function loseCurrentLevel(page: Page): Promise<void> {
  const selectedPatterns: string[] = [];
  for (let selectionNumber = 0; selectionNumber < 10; selectionNumber += 1) {
    if (await page.locator('[data-result="lost"]').isVisible().catch(() => false)) {
      break;
    }
    const blockId = await page
      .locator('[data-testid="dog-block"]:not([disabled])')
      .evaluateAll((blocks, patterns) => {
        const counts = new Map<string, number>();
        for (const pattern of patterns) {
          counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
        }
        return blocks.find((block) => {
          const pattern = block.dataset.patternType;
          return pattern !== undefined && (counts.get(pattern) ?? 0) < 2;
        })?.dataset.blockId ?? null;
      }, selectedPatterns);
    if (blockId === null) {
      break;
    }
    const pattern = await page
      .locator(`[data-testid="dog-block"][data-block-id="${blockId}"]`)
      .getAttribute("data-pattern-type");
    if (pattern === null) {
      break;
    }
    selectedPatterns.push(pattern);
    await clickBlock(page, blockId);
  }
  await expect(page.locator('[data-result="lost"]')).toBeVisible();
}

export async function winCurrentLevel(page: Page): Promise<void> {
  const solutionPath = await getVerifiedSolutionPath(page);
  for (const blockId of solutionPath) {
    if (await page.locator('[data-result="won"]').isVisible().catch(() => false)) {
      return;
    }

    await clickBlock(page, blockId);
  }

  await expect(page.locator('[data-result="won"]')).toBeVisible();
}

export async function getVerifiedSolutionPath(page: Page): Promise<string[]> {
  const levelNumber = Number(
    await page.getByTestId("dog-active-level").locator("strong").textContent(),
  );
  const runSeed = await page.getByTestId("dog-game").getAttribute("data-run-seed");
  if (!Number.isSafeInteger(levelNumber) || runSeed === null) {
    throw new Error("E2E could not read current level number or runSeed");
  }

  return page.evaluate(
    async ({ levelNumber: currentLevelNumber, runSeed: currentRunSeed }) => {
      const configModulePath: string = "/src/games/dog-lege-dog/game/v13-config.ts";
      const generationServiceModulePath: string =
        "/src/games/dog-lege-dog/levels/level-generation-service.ts";
      const [{ DOG_V13_CONFIG }, { DogLevelGenerationService, getPreparedDogLevel }] =
        await Promise.all([
          import(configModulePath),
          import(generationServiceModulePath),
        ]);
      const preparation = await new DogLevelGenerationService().prepare({
        levelNumber: currentLevelNumber,
        runSeed: currentRunSeed,
        config: DOG_V13_CONFIG,
      });
      const level = getPreparedDogLevel(preparation, {
        levelNumber: currentLevelNumber,
        runSeed: currentRunSeed,
        config: DOG_V13_CONFIG,
      });
      return [...level.solutionPath];
    },
    { levelNumber, runSeed },
  );
}

export async function leaveActiveGame(page: Page, accept: boolean): Promise<void> {
  const dialog = page.waitForEvent("dialog");
  const navigation = page.getByRole("button", { name: "返回游戏目录" }).click();
  const confirmation = await dialog;
  expect(confirmation.message()).toBe("当前关卡不会保存，确认离开？");
  if (accept) {
    await confirmation.accept();
  } else {
    await confirmation.dismiss();
  }
  await navigation;
}

export async function reset(page: Page): Promise<void> {
  const dialog = page.waitForEvent("dialog");
  const resetAction = page.getByRole("button", { name: "重置本地数据" }).click();
  const confirmation = await dialog;
  expect(confirmation.message()).toBe(
    "确认重置本地数据？用户、游戏进度、积分与应用设置都会被清除。",
  );
  await confirmation.accept();
  await resetAction;
}
