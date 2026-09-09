import { chromium, devices } from "@playwright/test";

const URL = process.env.DOG_PERFORMANCE_URL ?? "http://127.0.0.1:4173/";
const RUN_SEED = "dog-performance-final-qa-2026-09-09";
const SAMPLE_MS = 8_000;
const SOURCE_REVISION = process.env.DOG_PERFORMANCE_SOURCE_REVISION ?? "working-tree";
const SAMPLE_LABEL = process.env.DOG_PERFORMANCE_SAMPLE_LABEL ?? "optimized";
const DEVICE_NAME = "Pixel 5";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices[DEVICE_NAME] });
const page = await context.newPage();
const pageSession = await context.newCDPSession(page);
const browserSession = await browser.newBrowserCDPSession();

try {
  await page.goto(URL);
  await pageSession.send("Performance.enable");
  await page.evaluate(async (runSeed) => {
    const { startDogLegeDogGame } = await import("/src/games/dog-lege-dog/index.ts");
    const root = document.createElement("div");
    root.id = "dog-performance-sample";
    document.body.append(root);
    const game = startDogLegeDogGame(root, {
      runSeed,
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
      soundEnabled: true,
    });
    Object.defineProperty(window, "__dogPerformanceSampleGame", {
      configurable: true,
      value: game,
    });
  }, RUN_SEED);

  await page.waitForFunction(() =>
    document.querySelector("#dog-performance-sample [data-testid=dog-game]")?.dataset.inputLocked === "false",
  );
  await page.waitForTimeout(1_000);

  const level = await page.evaluate(() => {
    const game = document.querySelector("#dog-performance-sample [data-testid=dog-game]");
    return {
      levelNumber: game?.querySelector("[data-testid=dog-active-level] strong")?.textContent ?? null,
      blockCount: game?.querySelectorAll("[data-testid=dog-block]").length ?? 0,
      specialCount: game?.querySelectorAll("[data-testid=dog-block][data-special-mechanism]").length ?? 0,
    };
  });
  const beforeMetrics = await getPageMetrics();
  const beforeProcesses = await getProcesses();
  const animations = await page.evaluate(() => {
    const persistent = document.getAnimations().filter((animation) =>
      animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity,
    );
    const byName = new Map();
    for (const animation of persistent) {
      const name = animation.animationName ?? "unknown";
      byName.set(name, (byName.get(name) ?? 0) + 1);
    }
    return {
      count: persistent.length,
      names: Object.fromEntries([...byName.entries()].sort()),
    };
  });

  await page.waitForTimeout(SAMPLE_MS);
  const afterMetrics = await getPageMetrics();
  const afterProcesses = await getProcesses();
  const mutations = await sampleOrdinarySelection();

  console.log(JSON.stringify({
    url: URL,
    browserVersion: browser.version(),
    headless: true,
    device: DEVICE_NAME,
    viewport: devices[DEVICE_NAME].viewport,
    sampleLabel: SAMPLE_LABEL,
    sourceRevision: SOURCE_REVISION,
    runSeed: RUN_SEED,
    level,
    sampleMs: SAMPLE_MS,
    animations,
    rendererMetricsDelta: deltaMetrics(beforeMetrics, afterMetrics),
    browserProcessCpuDelta: processCpuDelta(beforeProcesses, afterProcesses),
    mutations,
  }, null, 2));
} finally {
  await page.evaluate(() => window.__dogPerformanceSampleGame?.destroy()).catch(() => undefined);
  await browser.close();
}

async function getPageMetrics() {
  const result = await pageSession.send("Performance.getMetrics");
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]));
}

async function getProcesses() {
  try {
    const result = await browserSession.send("SystemInfo.getProcessInfo");
    return result.processInfo.map(({ id, type, cpuTime }) => ({ id, type, cpuTime }));
  } catch (error) {
    return { unavailable: String(error) };
  }
}

function deltaMetrics(before, after) {
  return Object.fromEntries(
    ["TaskDuration", "ThreadTime", "ProcessTime"].map((name) => [
      name,
      round((after[name] ?? 0) - (before[name] ?? 0)),
    ]),
  );
}

function processCpuDelta(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after)) {
    return { unavailable: after.unavailable ?? before.unavailable ?? "unknown" };
  }

  const beforeById = new Map(before.map((process) => [process.id, process.cpuTime]));
  const byType = new Map();
  for (const process of after) {
    const delta = Math.max(0, process.cpuTime - (beforeById.get(process.id) ?? process.cpuTime));
    byType.set(process.type, (byType.get(process.type) ?? 0) + delta);
  }
  return {
    totalSeconds: round([...byType.values()].reduce((total, value) => total + value, 0)),
    byType: Object.fromEntries([...byType.entries()].sort()),
  };
}

async function sampleOrdinarySelection() {
  return page.evaluate(async () => {
    const root = document.querySelector("#dog-performance-sample");
    const board = root?.querySelector("[data-testid=dog-board]");
    const tray = root?.querySelector("[data-testid=dog-tray]");
    const target = [...(board?.querySelectorAll("[data-testid=dog-block]") ?? [])]
      .find((block) => !block.hasAttribute("disabled") && block.dataset.specialMechanism === undefined);
    const preserved = [...(board?.querySelectorAll("[data-testid=dog-block]") ?? [])]
      .find((block) => block !== target);
    const initialTraySlot = tray?.children[0] ?? null;
    if (root === null || board === null || tray === null || target === undefined || preserved === undefined) {
      throw new Error("Expected ordinary selection performance fixture");
    }

    const boardRecords = [];
    const trayRecords = [];
    const boardObserver = new MutationObserver((records) => boardRecords.push(...records));
    const trayObserver = new MutationObserver((records) => trayRecords.push(...records));
    boardObserver.observe(board, { childList: true });
    trayObserver.observe(tray, { childList: true });
    target.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
    }));

    const game = root.querySelector("[data-testid=dog-game]");
    const lockedDuringSelection = game?.dataset.inputLocked === "true";
    const deadline = Date.now() + 5_000;
    while (
      game?.dataset.inputLocked !== "false" ||
      root.querySelector('[data-testid="dog-flight"]') !== null
    ) {
      if (Date.now() > deadline) {
        throw new Error("Timed out waiting for ordinary selection");
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    boardObserver.disconnect();
    trayObserver.disconnect();

    const summarize = (records) => {
      const added = records.flatMap((record) => [...record.addedNodes]);
      const removed = records.flatMap((record) => [...record.removedNodes]);
      return {
        records: records.length,
        added: added.length,
        removed: removed.length,
        addedIds: added.map((node) => node instanceof HTMLElement ? node.dataset.blockId ?? null : null),
        removedIds: removed.map((node) => node instanceof HTMLElement ? node.dataset.blockId ?? null : null),
      };
    };
    return {
      targetId: target.dataset.blockId,
      lockedDuringSelection,
      board: summarize(boardRecords),
      tray: summarize(trayRecords),
      targetRemoved: !board.contains(target),
      preservedNodeReused: board.querySelector(`[data-block-id="${preserved.dataset.blockId}"]`) === preserved,
      trayTargetSlotReused: tray.querySelector(`[data-block-id="${target.dataset.blockId}"]`) === initialTraySlot,
      inputUnlockedAfterSelection: game?.dataset.inputLocked === "false",
    };
  });
}

function round(value) {
  return Number(value.toFixed(6));
}
