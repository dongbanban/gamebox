import { describe, expect, it } from "vitest";
import {
  DOG_GAME_ID,
  DOG_PATTERN_TYPES,
  FIRST_LEVEL,
  GameSession,
  getBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  getShapePool,
  isDifficultyWithinTarget,
  isLevelSolvable,
  LEVEL_GENERATOR_VERSION,
  LevelGenerator,
  type DogLegeDogLevel,
} from "../src/games/dog-lege-dog";

const RANDOM_TEST_SEED =
  process.env.DOG_RANDOM_TEST_SEED ?? "random-regression-default-v1";
const GENERATOR_SEED = `${DOG_GAME_ID}:random-regression:${RANDOM_TEST_SEED}`;

describe(`随机关卡回归 [testSeed=${RANDOM_TEST_SEED}]`, () => {
  it("每次运行生成 1–100 个关卡，并验证可重放与完整不变量", () => {
    const generator = new LevelGenerator();
    const levelCount = readCount(
      process.env.DOG_RANDOM_LEVEL_COUNT,
      seededInteger(`${RANDOM_TEST_SEED}:count`, 1, 100),
      1,
      100,
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
          assertLevelInvariants(level, generator, true, regressionCase);
        },
      );
    }
  });

  it("固定覆盖第 1、5、10、15、30、100 关", () => {
    const generator = new LevelGenerator();
    const checkpointSeed = RANDOM_TEST_SEED;

    for (const levelNumber of [1, 5, 10, 15, 30, 100]) {
      const regressionCase = createPendingCase(checkpointSeed, levelNumber);
      withRegressionReport(
        regressionCase,
        () => {
          const level = createLevel(generator, levelNumber, checkpointSeed);
          assertLevelInvariants(level, generator, true, regressionCase);
        },
      );
    }
  });

  it("运行 100–1000 个关卡压力测试，保持生成器不抛错且每关可解", () => {
    const generator = new LevelGenerator();
    const levelCount = readCount(
      process.env.DOG_STRESS_LEVEL_COUNT,
      100,
      100,
      1000,
    );
    const stressSeed = RANDOM_TEST_SEED;

    for (let levelNumber = 1; levelNumber <= levelCount; levelNumber += 1) {
      const regressionCase = createPendingCase(stressSeed, levelNumber);
      withRegressionReport(
        regressionCase,
        () => assertStressLevel(createLevel(generator, levelNumber, stressSeed)),
      );
    }
  });
});

interface RegressionCase {
  readonly testSeed: string;
  readonly levelNumber: number;
  readonly levelSeed: string;
  readonly generatorVersion: number;
}

function createLevel(
  generator: LevelGenerator,
  levelNumber: number,
  testSeed = RANDOM_TEST_SEED,
): DogLegeDogLevel {
  if (levelNumber === FIRST_LEVEL.number) {
    return FIRST_LEVEL;
  }

  return generator.generate({
    levelNumber,
    seed: GENERATOR_SEED,
    testSeed,
    generatorVersion: LEVEL_GENERATOR_VERSION,
  });
}

function createPendingCase(
  testSeed: string,
  levelNumber: number,
): RegressionCase {
  return {
    testSeed,
    levelNumber,
    levelSeed:
      levelNumber === FIRST_LEVEL.number
        ? FIRST_LEVEL.seed
        : `${GENERATOR_SEED}:v${LEVEL_GENERATOR_VERSION}:level-${levelNumber}`,
    generatorVersion: LEVEL_GENERATOR_VERSION,
  };
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
  expect(blocks).toHaveLength(getBlockCount(level.number));
  expect(level.maxLayers).toBe(getMaxLayers(level.number));
  expect(level.patternTypes).toHaveLength(getPatternTypeCount(level.number));
  expect(getShapePool(level.number)).toContain(board.shape);
  expect(level.patternTypes.every((patternType) => DOG_PATTERN_TYPES.includes(patternType))).toBe(
    true,
  );
  expect(new Set(blocks.map((block) => block.id))).toHaveLength(blocks.length);
  expect(new Set(blocks.map((block) => block.z))).toHaveLength(level.maxLayers);

  for (const patternType of level.patternTypes) {
    expect(blocks.filter((block) => block.patternType === patternType).length % 3).toBe(0);
  }

  for (const block of blocks) {
    expect(block.patternType).toBeDefined();
    expect(block.width).toBe(2);
    expect(block.height).toBe(2);
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

  expect(isLevelSolvable(level)).toBe(true);
  expect(generator.findSolvablePath(level)).toEqual(level.solutionPath);
  expect(difficulty.blockCount).toBe(blocks.length);
  expect(difficulty.maxLayers).toBe(level.maxLayers);
  expect(difficulty.patternTypeCount).toBe(level.patternTypes.length);
  expect(difficulty.safeChoiceCount).toBeGreaterThanOrEqual(
    difficulty.target.safeChoiceCount.min,
  );
  expect(difficulty.estimatedDurationMinutes).toBeGreaterThanOrEqual(
    difficulty.target.durationMinutes.min,
  );
  if (difficulty.withinTarget) {
    if (Number.isFinite(difficulty.target.safeChoiceCount.max)) {
      expect(difficulty.safeChoiceCount).toBeLessThanOrEqual(
        difficulty.target.safeChoiceCount.max,
      );
    }
    if (Number.isFinite(difficulty.target.durationMinutes.max)) {
      expect(difficulty.estimatedDurationMinutes).toBeLessThanOrEqual(
        difficulty.target.durationMinutes.max,
      );
    }
    expect(isDifficultyWithinTarget(difficulty)).toBe(true);
  } else {
    expect(generation.fallbackUsed).toBe(true);
    expect(generation.failures.length).toBeGreaterThan(0);
  }

  assertReplayMetadata(level);
  if (level.number > FIRST_LEVEL.number) {
    expect(generation.replay.testSeed).toBe(regressionCase.testSeed);
    expect(generator.replay(generation.replay)).toEqual(level);
  }

  for (const failure of generation.failures.slice(0, 1)) {
    expect(failure.levelNumber).toBe(level.number);
    expect(failure.levelSeed).toBe(level.seed);
    expect(failure.generatorVersion).toBe(level.generatorVersion);
    expect(generator.replayFailure(failure).blocks).toEqual(
      generator.replayAttempt(failure).blocks,
    );
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
  expect(level.blocks).toHaveLength(getBlockCount(level.number));
  expect(level.maxLayers).toBe(getMaxLayers(level.number));
  expect(level.patternTypes).toHaveLength(getPatternTypeCount(level.number));
  expect(getShapePool(level.number)).toContain(level.board.shape);
  expect(level.solutionPath).toHaveLength(level.blocks.length);
  expect(new Set(level.solutionPath)).toHaveLength(level.blocks.length);
  expect(isLevelSolvable(level)).toBe(true);
  expect(level.generation.attempts).toBeGreaterThanOrEqual(1);
  expect(level.generation.attempts).toBeLessThanOrEqual(100);
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
    `testSeed=${regressionCase.testSeed}`,
    `levelNumber=${regressionCase.levelNumber}`,
    `levelSeed=${regressionCase.levelSeed}`,
    `generatorVersion=${regressionCase.generatorVersion}`,
    `replay=DOG_RANDOM_TEST_SEED=${regressionCase.testSeed} DOG_RANDOM_LEVEL_NUMBER=${regressionCase.levelNumber} pnpm test:random`,
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
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`重放关卡号必须是正整数，收到：${rawValue}`);
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
