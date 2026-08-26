import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

test.describe("狗了个狗完整浏览器闭环", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("注册、目录、进入、通关、刷新回访、音效设置与重置", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "狗了个狗" })).toBeVisible();

    await enterGame(page);
    await expect(page.getByTestId("dog-board")).toBeVisible();
    await expect(page.getByRole("button", { name: "音效开启" })).toBeVisible();

    await page.getByRole("button", { name: "音效开启" }).click();
    await expect(page.getByRole("button", { name: "音效关闭" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await enterGame(page);
    await expect(page.getByRole("button", { name: "音效关闭" })).toBeVisible();

    await winCurrentLevel(page);
    await expect(page.locator('[data-view="game-result"]')).toHaveAttribute(
      "data-result",
      "won",
    );
    await expect(page.getByText("通关奖励")).toBeVisible();
    await expect(page.getByText("累计积分")).toBeVisible();
    const resultVisuals = await page.evaluate(() => {
      const eyebrow = document.querySelector<HTMLElement>(
        ".game-result-card--won .eyebrow",
      );
      const catalogButton = document.querySelector<HTMLElement>(
        ".game-result-card--won [data-action=\"catalog\"]",
      );
      return {
        eyebrowColor: eyebrow === null ? "" : getComputedStyle(eyebrow).color,
        catalogBorderColor:
          catalogButton === null ? "" : getComputedStyle(catalogButton).borderTopColor,
      };
    });
    expect(resultVisuals.eyebrowColor).toBe("rgb(63, 148, 195)");
    expect(resultVisuals.catalogBorderColor).toBe("rgb(63, 148, 195)");
    expect(
      await page.evaluate(() =>
        window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "返回游戏目录" }).click();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByText("第 2 关")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await enterGame(page);
    await expect(page.getByTestId("dog-active-level")).toContainText("2");

    await leaveActiveGame(page, false);
    await expect(page.getByTestId("dog-board")).toBeVisible();
    await leaveActiveGame(page, true);
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await reset(page);
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem("gamebox.state"))).resolves.toBeNull();
  });

  test("失败、重新挑战、返回与浏览器后退离开保护", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await enterGame(page);

    await loseCurrentLevel(page);

    await expect(page.locator('[data-view="game-result"]')).toHaveAttribute(
      "data-result",
      "lost",
    );
    await expect(page.getByRole("button", { name: "重新挑战" })).toBeVisible();
    await page.getByRole("button", { name: "重新挑战" }).click();
    await expect(page.getByTestId("dog-board")).toBeVisible();

    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();
    const cancelledDialog = page.waitForEvent("dialog");
    const cancelledNavigation = page.goBack();
    const firstDialog = await cancelledDialog;
    expect(firstDialog.message()).toBe("当前关卡不会保存，确认离开？");
    await firstDialog.dismiss();
    await cancelledNavigation;
    await expect(page.getByTestId("dog-board")).toBeVisible();

    await leaveActiveGame(page, true);
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
  });

  test("通关后直接进入下一关并创建空的新局内状态", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await enterGame(page);
    const firstLevelBlockIds = await getBlockIds(page);

    await winCurrentLevel(page);
    await page.getByRole("button", { name: "进入下一关" }).click();

    await expect(page.getByTestId("dog-game")).toBeVisible();
    await expect(page.getByTestId("dog-active-level")).toContainText("2");
    await expect(page.getByTestId("dog-board")).toBeVisible();
    const nextLevelPhysicalBlockCount = await page
      .locator('[data-testid="dog-block"]')
      .count();
    const nextLevelTwinCount = await page
      .locator('[data-testid="dog-block"][data-special-mechanism="twin"]')
      .count();
    expect(nextLevelPhysicalBlockCount + nextLevelTwinCount).toBe(90);
    await expect(page.locator('[data-testid="dog-tray-slot"][data-pattern-type]')).toHaveCount(0);
    const nextLevelBlockIds = await getBlockIds(page);
    expect(nextLevelBlockIds).not.toEqual(firstLevelBlockIds);
  });

  test("损坏存储显示降级提示", async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.setItem("gamebox.state", "{damaged");
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    await expect(page.getByTestId("persistence-warning")).toContainText("无法持久化");
  });

  test("不可用存储仍允许临时打开应用", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("storage unavailable");
        },
      });
    });
    await page.reload();
    await expect(page.getByTestId("persistence-warning")).toContainText("无法持久化");
    await page.getByRole("button", { name: "匿名注册" }).click();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
  });

  test("写入失败显示降级提示", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = function setItem(): never {
        throw new Error("storage write failed");
      };
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    await page.getByRole("button", { name: "匿名注册" }).click();
    await expect(page.getByTestId("persistence-warning")).toContainText("无法持久化");
  });
});

async function enterGame(page: Page): Promise<void> {
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByTestId("dog-game")).toBeVisible();
  await confirmDogLoadout(page);
}

async function confirmDogLoadout(page: Page): Promise<void> {
  const panel = page.getByTestId("dog-loadout-panel");
  if (!(await panel.isVisible().catch(() => false))) {
    return;
  }

  for (const itemId of ["triple-removal", "tray-capacity", "wildcard"]) {
    await page.locator(
      `[data-testid="dog-loadout-option"][data-loadout-id="${itemId}"]`,
    ).click();
  }
  await page.getByTestId("dog-loadout-confirm").click();
  await expect(page.getByTestId("dog-loadout-summary")).toBeVisible();
}

async function getBlockIds(page: Page): Promise<(string | null)[]> {
  return page
    .locator('[data-testid="dog-block"]')
    .evaluateAll((blocks) => blocks.map((block) => block.getAttribute("data-block-id")));
}

async function clickBlock(page: Page, blockId: string): Promise<void> {
  await page.locator(`[data-testid="dog-block"][data-block-id="${blockId}"]`).click();
  await page.waitForFunction(() => {
    const game = document.querySelector<HTMLElement>('[data-testid="dog-game"]');
    return game === null || (
      game.dataset.inputLocked === "false" &&
      document.querySelector('[data-testid="dog-flight"]') === null
    );
  });
}

async function loseCurrentLevel(page: Page): Promise<void> {
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

async function winCurrentLevel(page: Page): Promise<void> {
  const solutionPath = await findBrowserSolvablePath(page);
  for (const blockId of solutionPath) {
    if (await page.locator('[data-result="won"]').isVisible().catch(() => false)) {
      return;
    }

    await clickBlock(page, blockId);
  }

  await expect(page.locator('[data-result="won"]')).toBeVisible();
}

async function findBrowserSolvablePath(page: Page): Promise<string[]> {
  const blocks = await page.locator('[data-testid="dog-block"]').evaluateAll((elements) =>
    elements.map((element): BrowserBlock => {
      const specialMechanism = element.dataset.specialMechanism;
      return {
        id: element.dataset.blockId ?? "",
        patternType: element.dataset.patternType ?? "",
        specialMechanism:
          specialMechanism === "freeze" ||
          specialMechanism === "illusion" ||
          specialMechanism === "magnetic" ||
          specialMechanism === "twin"
            ? specialMechanism
            : undefined,
        x: Number(element.dataset.x),
        y: Number(element.dataset.y),
        z: Number(element.dataset.z),
      };
    }),
  );
  const runSeed = await page.getByTestId("dog-game").getAttribute("data-run-seed");
  const trayCapacity = Number(
    await page.getByTestId("dog-tray").getAttribute("data-effective-tray-capacity"),
  );
  if (runSeed === null || !Number.isSafeInteger(trayCapacity) || trayCapacity < 1) {
    throw new Error("E2E could not read level seed or effective tray capacity");
  }

  return findIndependentSolvablePath(
    blocks,
    runSeed,
    trayCapacity,
  );
}

type BrowserSpecialMechanism = "freeze" | "illusion" | "magnetic" | "twin";

interface BrowserBlock {
  readonly id: string;
  readonly patternType: string;
  readonly specialMechanism?: BrowserSpecialMechanism;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface BrowserTrayBlock {
  readonly id: string;
  readonly patternType: string;
  readonly frozen: boolean;
  readonly freezeProgress: number;
}

function findIndependentSolvablePath(
  blocks: readonly BrowserBlock[],
  runSeed: string,
  trayCapacity: number,
): string[] {
  const remaining = new Set(blocks.map((block) => block.id));
  const result = searchIndependentSolvability(
    blocks,
    remaining,
    [],
    [],
    new Set(),
    new BrowserSeededRandom(`${runSeed}:magnetic-target`),
    trayCapacity,
    { attempts: 0, maxAttempts: 100_000 },
  );
  if (result === undefined) {
    throw new Error("E2E could not find an independent solvable path");
  }

  return [...result];
}

function searchIndependentSolvability(
  blocks: readonly BrowserBlock[],
  remaining: ReadonlySet<string>,
  tray: readonly BrowserTrayBlock[],
  path: readonly string[],
  failedStates: Set<string>,
  magneticRandom: BrowserSeededRandom,
  trayCapacity: number,
  context: { attempts: number; readonly maxAttempts: number },
): readonly string[] | undefined {
  if (remaining.size === 0) {
    return tray.length === 0 ? path : undefined;
  }

  const stateKey = `${[...remaining].sort().join(",")}:${tray
    .map((block) => `${block.id}:${block.patternType}:${block.frozen}:${block.freezeProgress}`)
    .join(",")}:${magneticRandom.stateKey()}`;
  if (failedStates.has(stateKey)) {
    return undefined;
  }

  const selectable = blocks
    .filter((block) => remaining.has(block.id))
    .filter((block) => !blocks.some(
      (higher) => remaining.has(higher.id) && higher.z > block.z && overlaps(higher, block),
    ))
    .sort((first, second) => {
      const firstMatches = trailingMatchCount(tray, first.patternType);
      const secondMatches = trailingMatchCount(tray, second.patternType);
      return (
        secondMatches - firstMatches ||
        second.z - first.z ||
        first.id.localeCompare(second.id)
      );
    });

  for (const block of selectable) {
    context.attempts += 1;
    if (context.attempts > context.maxAttempts) {
      return undefined;
    }

    const resolution = resolveIndependentSelection(
      blocks,
      block,
      remaining,
      tray,
      magneticRandom,
    );
    resolveIndependentTrayMatches(
      resolution.tray,
      resolution.remaining.size === 0 && canResolveAllIndependentTrayBlocks(resolution.tray),
    );
    if (
      resolution.tray.length > trayCapacity ||
      (resolution.tray.length === trayCapacity &&
        resolution.remaining.size > 0 &&
        !hasCapacityRelievingSelection(
          blocks,
          resolution.remaining,
          resolution.tray,
          resolution.magneticRandom,
          trayCapacity,
        ))
    ) {
      continue;
    }

    const result = searchIndependentSolvability(
      blocks,
      resolution.remaining,
      resolution.tray,
      [...path, block.id],
      failedStates,
      resolution.magneticRandom,
      trayCapacity,
      context,
    );
    if (result !== undefined) {
      return result;
    }
  }

  failedStates.add(stateKey);
  return undefined;
}

interface IndependentSelectionResolution {
  readonly remaining: Set<string>;
  readonly tray: BrowserTrayBlock[];
  readonly magneticRandom: BrowserSeededRandom;
}

function resolveIndependentSelection(
  blocks: readonly BrowserBlock[],
  selectedBlock: BrowserBlock,
  remaining: ReadonlySet<string>,
  tray: readonly BrowserTrayBlock[],
  magneticRandom: BrowserSeededRandom,
): IndependentSelectionResolution {
  const nextRemaining = new Set(remaining);
  nextRemaining.delete(selectedBlock.id);
  const nextTray = tray.map((trayBlock) => ({ ...trayBlock }));
  const nextMagneticRandom = magneticRandom.clone();
  const target = selectedBlock.specialMechanism === "magnetic"
    ? chooseIndependentMagneticTarget(
        blocks,
        selectedBlock,
        nextRemaining,
        nextMagneticRandom,
      )
    : undefined;
  if (target !== undefined) {
    nextRemaining.delete(target.id);
  }

  nextTray.push(...toIndependentTrayBlocks(selectedBlock));
  if (target !== undefined) {
    nextTray.push(...toIndependentTrayBlocks(target));
  }
  return {
    remaining: nextRemaining,
    tray: nextTray,
    magneticRandom: nextMagneticRandom,
  };
}

function toIndependentTrayBlocks(
  block: BrowserBlock,
): BrowserTrayBlock[] {
  if (block.specialMechanism === "twin") {
    return [
      {
        id: `${block.id}-1`,
        patternType: block.patternType,
        frozen: false,
        freezeProgress: 0,
      },
      {
        id: `${block.id}-2`,
        patternType: block.patternType,
        frozen: false,
        freezeProgress: 0,
      },
    ];
  }
  return [
    {
      id: block.id,
      patternType: block.patternType,
      frozen: block.specialMechanism === "freeze",
      freezeProgress: 0,
    },
  ];
}

function chooseIndependentMagneticTarget(
  blocks: readonly BrowserBlock[],
  source: BrowserBlock,
  remaining: ReadonlySet<string>,
  magneticRandom: BrowserSeededRandom,
): BrowserBlock | undefined {
  const candidates = blocks.filter((block) =>
    remaining.has(block.id) &&
    block.specialMechanism !== "magnetic" &&
    block.patternType !== source.patternType,
  );
  if (candidates.length === 0) {
    return undefined;
  }

  const selectableCandidates = candidates.filter((block) =>
    isIndependentSelectable(blocks, block, remaining),
  );
  const candidatePool = selectableCandidates.length > 0
    ? selectableCandidates
    : candidates;
  return candidatePool[magneticRandom.nextInt(candidatePool.length)];
}

function isIndependentSelectable(
  blocks: readonly BrowserBlock[],
  block: BrowserBlock,
  remaining: ReadonlySet<string>,
): boolean {
  return !blocks.some((higher) =>
    remaining.has(higher.id) &&
    higher.z > block.z &&
    overlaps(higher, block),
  );
}

function hasCapacityRelievingSelection(
  blocks: readonly BrowserBlock[],
  remaining: ReadonlySet<string>,
  tray: readonly BrowserTrayBlock[],
  magneticRandom: BrowserSeededRandom,
  trayCapacity: number,
): boolean {
  for (const block of blocks) {
    if (!remaining.has(block.id) || !isIndependentSelectable(blocks, block, remaining)) {
      continue;
    }
    const resolution = resolveIndependentSelection(
      blocks,
      block,
      remaining,
      tray,
      magneticRandom,
    );
    resolveIndependentTrayMatches(
      resolution.tray,
      resolution.remaining.size === 0 && canResolveAllIndependentTrayBlocks(resolution.tray),
    );
    if (resolution.tray.length <= trayCapacity) {
      return true;
    }
  }
  return false;
}

function overlaps(first: BrowserBlock, second: BrowserBlock): boolean {
  return (
    Math.min(first.x + 4, second.x + 4) > Math.max(first.x, second.x) &&
    Math.min(first.y + 4, second.y + 4) > Math.max(first.y, second.y)
  );
}

function trailingMatchCount(
  tray: readonly BrowserTrayBlock[],
  patternType: string,
): number {
  let count = 0;
  for (let index = tray.length - 1; index >= 0; index -= 1) {
    const block = tray[index];
    if (
      block === undefined ||
      block.frozen ||
      block.patternType !== patternType
    ) {
      break;
    }

    count += 1;
  }

  return count;
}

function resolveIndependentTrayMatches(
  tray: BrowserTrayBlock[],
  allowFrozenMatches: boolean,
): void {
  while (true) {
    const groups: Array<{ patternType: string; indexes: number[] }> = [];
    let currentGroup: { patternType: string; indexes: number[] } | undefined;
    for (let index = 0; index < tray.length; index += 1) {
      const block = tray[index];
      const matchable = block !== undefined && (!block.frozen || allowFrozenMatches);
      if (!matchable) {
        currentGroup = undefined;
        continue;
      }

      if (
        currentGroup !== undefined &&
        currentGroup.patternType === block.patternType
      ) {
        currentGroup.indexes.push(index);
      } else {
        currentGroup = { patternType: block.patternType, indexes: [index] };
        groups.push(currentGroup);
      }
    }

    const removalIndexes = groups.flatMap(({ indexes }) =>
      indexes.slice(0, Math.floor(indexes.length / 3) * 3),
    );
    if (removalIndexes.length === 0) {
      return;
    }

    const removalSet = new Set(removalIndexes);
    const triplePatterns = groups.flatMap(({ patternType, indexes }) =>
      Array.from({ length: Math.floor(indexes.length / 3) }, () => patternType),
    );
    tray.splice(
      0,
      tray.length,
      ...tray.filter((_, index) => !removalSet.has(index)),
    );
    for (let index = 0; index < tray.length; index += 1) {
      const block = tray[index];
      if (block === undefined || !block.frozen) {
        continue;
      }

      const successfulTripleCount = triplePatterns.length;
      if (successfulTripleCount === 0) {
        continue;
      }

      const freezeProgress = block.freezeProgress + successfulTripleCount;
      tray[index] = {
        ...block,
        frozen: freezeProgress < 2,
        freezeProgress,
      };
    }
  }
}

function canResolveAllIndependentTrayBlocks(
  tray: readonly BrowserTrayBlock[],
): boolean {
  const simulatedTray = tray.map((block) => ({ ...block }));
  while (simulatedTray.length > 0) {
    const beforeLength = simulatedTray.length;
    resolveIndependentTrayMatches(simulatedTray, true);
    if (simulatedTray.length === beforeLength) {
      return false;
    }
  }

  return true;
}

class BrowserSeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = hashBrowserSeed(seed);
  }

  next(): number {
    this.state = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    this.state ^= this.state + Math.imul(this.state ^ (this.state >>> 7), 61 | this.state);
    return ((this.state ^ (this.state >>> 14)) >>> 0) / 4_294_967_296;
  }

  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  clone(): BrowserSeededRandom {
    const clone = new BrowserSeededRandom("clone");
    clone.state = this.state;
    return clone;
  }

  stateKey(): string {
    return this.state.toString(36);
  }
}

function hashBrowserSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash || 1;
}

async function leaveActiveGame(page: Page, accept: boolean): Promise<void> {
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

async function reset(page: Page): Promise<void> {
  const dialog = page.waitForEvent("dialog");
  const resetAction = page.getByRole("button", { name: "重置本地数据" }).click();
  const confirmation = await dialog;
  expect(confirmation.message()).toBe(
    "确认重置本地数据？用户、游戏进度、积分与应用设置都会被清除。",
  );
  await confirmation.accept();
  await resetAction;
}
