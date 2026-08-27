import { describe, expect, it } from "vitest";
import {
  DOG_V13_CONFIG,
  DOG_PATTERN_TYPES,
  GameSession,
  getBlockCount,
  getDogLogicalBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  findSolvability,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
  getDogV13SpecialMechanismBudget,
  isDifficultyWithinTarget,
  LevelGenerator,
  formatDogGenerationTestReport,
  type DogGenerationTestCase,
  type DogLegeDogLevel,
} from "@/games/dog-lege-dog";

const MAX_LEVEL_NUMBER = DOG_V13_CONFIG.game.maxLevelNumber;

const RANDOM_TEST_SEED =
  process.env.DOG_RANDOM_TEST_SEED ?? "random-regression-default-v1";

describe(`随机关卡回归 [testSeed=${RANDOM_TEST_SEED}]`, () => {
  it("每次运行生成 1–99 个关卡，并验证可重放与完整不变量", () => {
    const generator = new LevelGenerator();
    const levelCount = readCount(
      process.env.DOG_RANDOM_LEVEL_COUNT,
      seededInteger(`${RANDOM_TEST_SEED}:count`, 1, MAX_LEVEL_NUMBER),
      1,
      MAX_LEVEL_NUMBER,
    );

    const replayLevelNumber = readLevelNumber(process.env.DOG_RANDOM_LEVEL_NUMBER);
    const levelNumbers =
      replayLevelNumber === undefined
        ? Array.from({ length: levelCount }, (_, index) => index + 1)
        : [replayLevelNumber];

    for (const levelNumber of levelNumbers) {
      const regressionCase = createPendingCase(RANDOM_TEST_SEED, levelNumber);
      withRegressionReport(
        regressionCase,
        () => {
          const level = createLevel(generator, levelNumber);
          assertV13MechanismPlan(level.number, level);
          assertLevelInvariants(level, generator, true, regressionCase);
        },
      );
    }
  });

  it("固定覆盖第 1、5、10、15、30、99 关", () => {
    const generator = new LevelGenerator();
    const checkpointSeed = RANDOM_TEST_SEED;

    for (const levelNumber of [1, 5, 10, 15, 30, MAX_LEVEL_NUMBER]) {
      const regressionCase = createPendingCase(checkpointSeed, levelNumber);
      withRegressionReport(
        regressionCase,
        () => {
          const level = createLevel(generator, levelNumber, checkpointSeed);
          assertV13MechanismPlan(level.number, level);
          assertLevelInvariants(level, generator, true, regressionCase);
        },
      );
    }
  });

  it("运行最多 99 个关卡压力测试，保持生成器不抛错且每关可解", () => {
    const generator = new LevelGenerator();
    const levelCount = readCount(
      process.env.DOG_STRESS_LEVEL_COUNT,
      MAX_LEVEL_NUMBER,
      1,
      MAX_LEVEL_NUMBER,
    );
    const stressSeed = RANDOM_TEST_SEED;

    for (let levelNumber = 1; levelNumber <= levelCount; levelNumber += 1) {
      const regressionCase = createPendingCase(stressSeed, levelNumber);
      withRegressionReport(
        regressionCase,
        () => {
          const level = createLevel(generator, levelNumber, stressSeed);
          assertV13MechanismPlan(levelNumber, level);
          assertStressLevel(level);
        },
      );
    }
  });
});

type RegressionCase = DogGenerationTestCase & { readonly levelSeed: string };

function createLevel(
  generator: LevelGenerator,
  levelNumber: number,
  testSeed = RANDOM_TEST_SEED,
): DogLegeDogLevel {
  const runSeed = getRunSeed(testSeed);
  return generator.generate({
    levelNumber,
    runSeed,
    testSeed,
    generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
  });
}

function createPendingCase(
  testSeed: string,
  levelNumber: number,
): RegressionCase {
  const runSeed = getRunSeed(testSeed);
  return {
    testSeed,
    runSeed,
    levelNumber,
    levelSeed:
      `${runSeed}:v${DOG_V13_CONFIG.game.generatorVersion}:level-${levelNumber}`,
    generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
  };
}

function getRunSeed(testSeed: string): string {
  return process.env.DOG_RANDOM_RUN_SEED ??
    `${DOG_V13_CONFIG.game.id}:random-regression:${testSeed}`;
}

function assertV13MechanismPlan(levelNumber: number, level?: DogLegeDogLevel): void {
  const logicalBlockCount = getDogV13LogicalBlockCount(levelNumber);
  const plan = getDogV13MechanismPlan(logicalBlockCount);
  expect(plan.logicalUnitCount).toBe(getDogV13SpecialMechanismBudget(logicalBlockCount));
  expect(plan.logicalUnitCount).toBeLessThanOrEqual(logicalBlockCount * 0.3);
  expect(Object.values(plan.counts).every((count) => count > 0)).toBe(true);
  expect(
    plan.counts.freeze +
      plan.counts.illusion +
      plan.counts.magnetic +
      plan.counts.twin * 2,
  ).toBe(plan.logicalUnitCount);

  if (level?.generatorVersion !== undefined &&
      level.generatorVersion >= DOG_V13_CONFIG.game.generatorVersion) {
    const actualCounts = new Map<string, number>();
    for (const block of level.blocks) {
      const type = block.specialMechanism?.type;
      if (type !== undefined) {
        actualCounts.set(type, (actualCounts.get(type) ?? 0) + 1);
      }
    }
    expect(actualCounts.get("freeze")).toBeGreaterThan(0);
    expect(actualCounts.get("illusion")).toBeGreaterThan(0);
    expect(actualCounts.get("magnetic")).toBeGreaterThan(0);
    expect(actualCounts.get("twin")).toBeGreaterThan(0);
    const actualLogicalUnitCount =
      (actualCounts.get("freeze") ?? 0) +
      (actualCounts.get("illusion") ?? 0) +
      (actualCounts.get("magnetic") ?? 0) +
      (actualCounts.get("twin") ?? 0) * 2;
    expect(actualLogicalUnitCount).toBe(plan.logicalUnitCount);
    expect(level.difficulty.specialMechanismDensity).toBeLessThanOrEqual(0.3);
  }
}

function assertLevelInvariants(
  level: DogLegeDogLevel,
  generator: LevelGenerator,
  playSolution: boolean,
  regressionCase: RegressionCase,
): void {
  const { board, blocks, difficulty, generation } = level;
  const playableCells = new Set(board.playableCells.map((cell) => `${cell.x}:${cell.y}`));

  expect(level.number).toBeGreaterThanOrEqual(1);
  expect(getDogLogicalBlockCount(blocks, level.specialMechanisms)).toBe(
    getBlockCount(level.number),
  );
  expect(level.maxLayers).toBe(getMaxLayers(level.number));
  expect(level.patternTypes).toHaveLength(
    level.number === 1 ? 6 : getPatternTypeCount(level.number),
  );
  expect(board.shape).toBe("irregular");
  expect(level.patternTypes.every((patternType) => DOG_PATTERN_TYPES.includes(patternType))).toBe(
    true,
  );
  expect(new Set(blocks.map((block) => block.id))).toHaveLength(blocks.length);
  expect(new Set(blocks.map((block) => block.z))).toHaveLength(level.maxLayers);

  for (const patternType of level.patternTypes) {
    const logicalPatternCount = blocks
      .filter((block) => block.patternType === patternType)
      .reduce(
        (total, block) => total + (block.specialMechanism?.type === "twin" ? 2 : 1),
        0,
      );
    expect(logicalPatternCount % 3).toBe(0);
  }

  for (const block of blocks) {
    expect(block.patternType).toBeDefined();
    expect(block.width).toBe(4);
    expect(block.height).toBe(4);
    expect(block.rotation).toBe(0);
    expect(Number.isInteger(block.x)).toBe(true);
    expect(Number.isInteger(block.y)).toBe(true);
    for (let y = block.y; y < block.y + block.height; y += 1) {
      for (let x = block.x; x < block.x + block.width; x += 1) {
        expect(playableCells.has(`${x}:${y}`)).toBe(true);
      }
    }
  }

  for (let firstIndex = 0; firstIndex < blocks.length; firstIndex += 1) {
    const first = blocks[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < blocks.length; secondIndex += 1) {
      const second = blocks[secondIndex];
      if (first.z === second.z) {
        expect(hasPositiveAreaOverlap(first, second)).toBe(false);
      }
    }

    expect(
      blocks.filter(
        (higher) => higher.z > first.z && hasPositiveAreaOverlap(first, higher),
      ).length,
    ).toBeLessThanOrEqual(4);
  }

  const solvability = generator.findSolvability(level);
  expect(solvability.status).toBe("solvable");
  expect(solvability.path).toEqual(level.solutionPath);
  expect(difficulty.blockCount).toBe(blocks.length);
  expect(difficulty.logicalBlockCount).toBe(getBlockCount(level.number));
  expect(difficulty.maxLayers).toBe(level.maxLayers);
  expect(difficulty.patternTypeCount).toBe(level.patternTypes.length);
  expect(difficulty.safeChoiceCount).toBeGreaterThanOrEqual(
    difficulty.target.safeChoiceCount.min,
  );
  expect(Number.isFinite(difficulty.target.safeChoiceCount.max)).toBe(true);
  if (difficulty.target.safeChoiceRate !== undefined) {
    expect(difficulty.safeChoiceRate).toBeGreaterThanOrEqual(
      difficulty.target.safeChoiceRate.min,
    );
  }
  expect(difficulty.estimatedDurationMinutes).toBeGreaterThanOrEqual(
    difficulty.target.durationMinutes.min,
  );
  expect(Number.isFinite(difficulty.trayPeakPressure)).toBe(true);
  expect(Number.isFinite(difficulty.operationCost)).toBe(true);
  expect(Number.isFinite(difficulty.mistakeRisk)).toBe(true);
  if (difficulty.target.trayPeakPressure !== undefined) {
    expect(difficulty.trayPeakPressure).toBeGreaterThanOrEqual(
      difficulty.target.trayPeakPressure.min,
    );
  }
  if (difficulty.target.mechanismDensity !== undefined) {
    expect(difficulty.specialMechanismDensity).toBeGreaterThanOrEqual(
      difficulty.target.mechanismDensity.min,
    );
  }
  if (difficulty.target.operationCost !== undefined) {
    expect(difficulty.operationCost).toBeGreaterThanOrEqual(
      difficulty.target.operationCost.min,
    );
  }
  if (difficulty.target.mistakeRisk !== undefined) {
    expect(difficulty.mistakeRisk).toBeGreaterThanOrEqual(
      difficulty.target.mistakeRisk.min,
    );
  }
  if (difficulty.withinTarget) {
    if (Number.isFinite(difficulty.target.safeChoiceCount.max)) {
      expect(difficulty.safeChoiceCount).toBeLessThanOrEqual(
        difficulty.target.safeChoiceCount.max,
      );
    }
    if (difficulty.target.safeChoiceRate !== undefined) {
      expect(difficulty.safeChoiceRate).toBeLessThanOrEqual(
        difficulty.target.safeChoiceRate.max,
      );
    }
    if (Number.isFinite(difficulty.target.durationMinutes.max)) {
      expect(difficulty.estimatedDurationMinutes).toBeLessThanOrEqual(
        difficulty.target.durationMinutes.max,
      );
    }
    if (difficulty.target.trayPeakPressure !== undefined) {
      expect(difficulty.trayPeakPressure).toBeLessThanOrEqual(
        difficulty.target.trayPeakPressure.max,
      );
    }
    if (difficulty.target.mechanismDensity !== undefined) {
      expect(difficulty.specialMechanismDensity).toBeLessThanOrEqual(
        difficulty.target.mechanismDensity.max,
      );
    }
    if (difficulty.target.operationCost !== undefined) {
      expect(difficulty.operationCost).toBeLessThanOrEqual(
        difficulty.target.operationCost.max,
      );
    }
    if (difficulty.target.mistakeRisk !== undefined) {
      expect(difficulty.mistakeRisk).toBeLessThanOrEqual(
        difficulty.target.mistakeRisk.max,
      );
    }
    expect(isDifficultyWithinTarget(difficulty)).toBe(true);
  } else {
    expect(generation.fallbackUsed).toBe(true);
    expect(generation.failures.length).toBeGreaterThan(0);
  }

  assertReplayMetadata(level);
  expect(generation.replay.testSeed).toBe(regressionCase.testSeed);
  expect(generation.replay.runSeed).toBe(regressionCase.runSeed);
  expect(generator.replay(generation.replay)).toEqual(level);

  for (const failure of generation.failures.slice(0, 1)) {
    expect(failure.levelNumber).toBe(level.number);
    expect(failure.levelSeed).toBe(level.seed);
    expect(failure.generatorVersion).toBe(level.generatorVersion);
    const replayedFailure = generator.replayAttempt(failure);
    expect(replayedFailure).toMatchObject({
      number: failure.levelNumber,
      seed: failure.levelSeed,
      runSeed: failure.runSeed,
      generatorVersion: failure.generatorVersion,
    });
    expect(replayedFailure.generation.replay).toMatchObject({
      attempt: failure.attempt,
      randomSeed: failure.randomSeed,
      testSeed: failure.testSeed,
    });
    expect(replayedFailure.blocks).toEqual(generator.replayAttempt(failure).blocks);
  }

  if (!playSolution) {
    return;
  }

  const session = new GameSession(level);
  let state = session.getState();
  for (const blockId of level.solutionPath) {
    state = session.selectBlock(blockId);
  }
  expect(state.status).toBe("won");
  expect(state.remainingBlocks).toEqual([]);
}

function assertStressLevel(level: DogLegeDogLevel): void {
  const loadedSession = new GameSession(level);
  expect(loadedSession.getState().remainingBlocks).toHaveLength(level.blocks.length);
  expect(getDogLogicalBlockCount(level.blocks, level.specialMechanisms)).toBe(
    getBlockCount(level.number),
  );
  expect(level.maxLayers).toBe(getMaxLayers(level.number));
  expect(level.patternTypes).toHaveLength(
    level.number === 1 ? 6 : getPatternTypeCount(level.number),
  );
  expect(level.board.shape).toBe("irregular");
  expect(level.solutionPath.length).toBeGreaterThan(0);
  expect(level.solutionPath.length).toBeLessThanOrEqual(level.blocks.length);
  expect(new Set(level.solutionPath)).toHaveLength(level.solutionPath.length);
  expect(findSolvability(level).status).toBe("solvable");
  expect(level.generation.attempts).toBeGreaterThanOrEqual(1);
  expect(level.generation.attempts).toBeLessThanOrEqual(100);

  let state = loadedSession.getState();
  for (const blockId of level.solutionPath) {
    state = loadedSession.selectBlock(blockId);
  }
  expect(state.status).toBe("won");
  expect(state.remainingBlocks).toEqual([]);
}

function assertReplayMetadata(level: DogLegeDogLevel): void {
  expect(level.generation.replay.levelNumber).toBe(level.number);
  expect(level.generation.replay.levelSeed).toBe(level.seed);
  expect(level.generation.replay.generatorVersion).toBe(level.generatorVersion);
}

function withRegressionReport(
  regressionCase: RegressionCase,
  assertion: () => void,
): void {
  try {
    assertion();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}\n\n${formatRegressionReport(regressionCase)}`,
    );
  }
}

function formatRegressionReport(regressionCase: RegressionCase): string {
  return [
    "随机回归失败报告",
    formatDogGenerationTestReport(regressionCase),
  ].join("\n");
}

function readCount(
  rawValue: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`测试关卡数量必须是 ${min}–${max} 的整数，收到：${rawValue}`);
  }

  return parsed;
}

function readLevelNumber(rawValue: string | undefined): number | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_LEVEL_NUMBER) {
    throw new Error(
      `重放关卡号必须是 1–${MAX_LEVEL_NUMBER} 的整数，收到：${rawValue}`,
    );
  }

  return parsed;
}

function seededInteger(seed: string, min: number, max: number): number {
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  const normalized = (hash >>> 0) / 4_294_967_296;
  return min + Math.floor(normalized * (max - min + 1));
}

function hasPositiveAreaOverlap(
  first: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  second: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}
