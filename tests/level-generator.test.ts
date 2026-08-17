import { describe, expect, it } from "vitest";
import {
  DOG_PATTERN_TYPES,
  DOG_SHAPE_TEMPLATES,
  FIRST_LEVEL,
  GameSession,
  LEVEL_GENERATOR_VERSION,
  MAX_LEVEL_GENERATION_ATTEMPTS,
  LevelGenerator,
  getDifficultyTarget,
  getBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  getShapePool,
  getDogLegeDogLevel,
  DEFAULT_LEVEL_SEED,
} from "../src/games/dog-lege-dog";

describe("LevelGenerator", () => {
  it("通过统一关卡提供器取得首关与后续关卡", () => {
    const generator = new LevelGenerator();
    const firstLevel = getDogLegeDogLevel(FIRST_LEVEL.number);
    const secondLevel = generator.generate({
      levelNumber: FIRST_LEVEL.number + 1,
      seed: DEFAULT_LEVEL_SEED,
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });

    expect(firstLevel).toEqual(FIRST_LEVEL);
    expect(getDogLegeDogLevel(FIRST_LEVEL.number)).toEqual(firstLevel);
    expect(getDogLegeDogLevel(secondLevel.number)).toEqual(secondLevel);
  });

  it("固定首关 replay 返回固定棋盘", () => {
    const generator = new LevelGenerator();

    expect(generator.replay(FIRST_LEVEL.generation.replay)).toEqual(FIRST_LEVEL);
    expect(generator.replayAttempt(FIRST_LEVEL.generation.replay)).toEqual(FIRST_LEVEL);
  });

  it("guaranteed fallback replay 保持相同候选", () => {
    const generator = new LevelGenerator();
    const replay = {
      attempt: MAX_LEVEL_GENERATION_ATTEMPTS,
      levelNumber: 31,
      seed: "fallback-seed",
      levelSeed: "fallback-seed:v2:level-31",
      testSeed: "fallback-test-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
      mode: "guaranteed" as const,
      randomSeed: "fallback-random-seed",
    };

    const level = generator.replayAttempt(replay);

    expect(generator.replayAttempt(level.generation.replay)).toEqual(level);
  });

  it("通过明确的关卡号、seed 与生成器版本稳定生成同一棋盘", () => {
    const generator = new LevelGenerator();
    const request = {
      levelNumber: 12,
      seed: "replay-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    } as const;

    const first = generator.generate(request);
    const second = generator.generate(request);

    expect(second).toEqual(first);
    expect(first.number).toBe(request.levelNumber);
    expect(first.generatorVersion).toBe(request.generatorVersion);
    expect(first.seed).toContain(request.seed);
  });

  it("显式首关 seed/version 继续走生成器并可重放", () => {
    const generator = new LevelGenerator();
    const request = {
      levelNumber: FIRST_LEVEL.number,
      seed: "explicit-first-level-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    } as const;

    const level = generator.generate(request);
    const repeated = generator.generate(request);

    expect(level).not.toEqual(FIRST_LEVEL);
    expect(repeated).toEqual(level);
    expect(level.seed).toContain(request.seed);
    expect(level.generation.replay).toMatchObject({
      levelNumber: request.levelNumber,
      seed: request.seed,
      generatorVersion: request.generatorVersion,
      mode: "generated",
    });
    expect(generator.replay(level.generation.replay)).toEqual(level);
  });

  it("按关卡阶段递增方块数量、层数、形状池与图案池", () => {
    expect([1, 5, 6, 10, 11, 15, 16, 20, 21, 25, 26].map(getBlockCount)).toEqual([
      90,
      90,
      108,
      108,
      126,
      126,
      144,
      144,
      162,
      162,
      180,
    ]);
    expect([1, 5, 6, 15, 16, 30, 31, 100].map(getMaxLayers)).toEqual([
      3,
      3,
      4,
      4,
      5,
      5,
      6,
      6,
    ]);
    expect([1, 5, 6, 15, 16, 30, 31, 100].map(getPatternTypeCount)).toEqual([
      4,
      4,
      6,
      6,
      8,
      8,
      10,
      10,
    ]);
    expect(getShapePool(5)).toEqual(["rectangle"]);
    expect(getShapePool(6)).toEqual(["rectangle", "star"]);
    expect(getShapePool(16)).toEqual(["rectangle", "star", "heart"]);
    expect(getShapePool(31)).toEqual(["rectangle", "star", "heart", "irregular"]);
  });

  it("为四类形状提供多个预定义网格变体", () => {
    const variantsByShape = new Map<string, Set<string>>();
    for (const template of DOG_SHAPE_TEMPLATES) {
      const variants = variantsByShape.get(template.shape) ?? new Set<string>();
      variants.add(template.id);
      variantsByShape.set(template.shape, variants);
      expect(template.rows).toHaveLength(template.height);
      expect(template.rows.every((row) => row.length === template.width)).toBe(true);
    }

    expect([...variantsByShape.keys()].sort()).toEqual([
      "heart",
      "irregular",
      "rectangle",
      "star",
    ]);
    expect([...variantsByShape.values()].every((variants) => variants.size >= 2)).toBe(true);
  });

  it("生成关卡结构满足形状、图案与层叠不变量", () => {
    const generator = new LevelGenerator();

    for (const levelNumber of [2, 5, 6, 15, 16, 30, 31, 60, 100]) {
      const level = generator.generate({
        levelNumber,
        seed: `invariant-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
      });
      const playableCells = new Set(level.board.playableCells.map((cell) => `${cell.x}:${cell.y}`));

      expect(level.blocks).toHaveLength(getBlockCount(levelNumber));
      expect(new Set(level.blocks.map((block) => block.z))).toHaveLength(getMaxLayers(levelNumber));
      expect(level.patternTypes).toHaveLength(getPatternTypeCount(levelNumber));
      expect(level.patternTypes.every((patternType) => DOG_PATTERN_TYPES.includes(patternType))).toBe(
        true,
      );

      for (const patternType of level.patternTypes) {
        expect(
          level.blocks.filter((block) => block.patternType === patternType).length % 3,
        ).toBe(0);
      }

      for (const block of level.blocks) {
        expect(Number.isInteger(block.x)).toBe(true);
        expect(Number.isInteger(block.y)).toBe(true);
        expect(block.rotation).toBe(0);
        for (let y = block.y; y < block.y + block.height; y += 1) {
          for (let x = block.x; x < block.x + block.width; x += 1) {
            expect(playableCells.has(`${x}:${y}`)).toBe(true);
          }
        }
      }

      for (let index = 0; index < level.blocks.length; index += 1) {
        const block = level.blocks[index];
        for (let otherIndex = index + 1; otherIndex < level.blocks.length; otherIndex += 1) {
          const other = level.blocks[otherIndex];
          if (block.z === other.z) {
            expect(hasPositiveAreaOverlap(block, other)).toBe(false);
          }
        }

        const higherBlocks = level.blocks.filter(
          (other) => other.z > block.z && hasPositiveAreaOverlap(block, other),
        );
        expect(higherBlocks.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it("可稳定加载第 2–100 关，不因模板选择抛错", () => {
    const generator = new LevelGenerator();

    for (let levelNumber = 2; levelNumber <= 100; levelNumber += 1) {
      const level = generator.generate({
        levelNumber,
        seed: `range-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
      });
      const session = new GameSession(level);
      let state = session.getState();
      for (const blockId of level.solutionPath) {
        state = session.selectBlock(blockId);
      }

      expect(state.status).toBe("won");
    }
  });

  it("先验证无道具通关路径，再暴露难度指标与可重放信息", () => {
    const generator = new LevelGenerator();
    const request = {
      levelNumber: 12,
      seed: "replay-seed",
      testSeed: "test-seed-12",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    } as const;

    const level = generator.generate(request);
    const path = generator.findSolvablePath(level);
    const target = getDifficultyTarget(request.levelNumber);

    expect(generator.isSolvable(level)).toBe(true);
    expect(path).not.toBeNull();
    expect(path).toEqual(level.solutionPath);
    expect(path).toHaveLength(level.blocks.length);
    const session = new GameSession(level);
    let replayedState = session.getState();
    for (const blockId of path ?? []) {
      replayedState = session.selectBlock(blockId);
    }
    expect(replayedState.status).toBe("won");
    expect(level.difficulty).toMatchObject({
      blockCount: level.blocks.length,
      maxLayers: level.maxLayers,
      patternTypeCount: level.patternTypes.length,
    });
    expect(level.difficulty.estimatedDurationMinutes).toBeGreaterThanOrEqual(
      target.durationMinutes.min,
    );
    expect(level.difficulty.estimatedDurationMinutes).toBeLessThanOrEqual(
      target.durationMinutes.max,
    );
    expect(level.difficulty.safeChoiceCount).toBeGreaterThanOrEqual(
      target.safeChoiceCount.min,
    );
    expect(level.generation.replay).toMatchObject({
      levelNumber: request.levelNumber,
      testSeed: request.testSeed,
      generatorVersion: request.generatorVersion,
    });
    expect(generator.replay(level.generation.replay)).toEqual(level);
    expect(generator.replayAttempt(level.generation.replay)).toMatchObject({
      seed: level.seed,
      blocks: level.blocks,
      solutionPath: level.solutionPath,
    });
  });

  it("按阶段筛选安全选择与目标时长，失败时保留有限重试与重放 seam", () => {
    const generator = new LevelGenerator();

    for (const levelNumber of [2, 6, 16, 31, 60, 100]) {
      const level = generator.generate({
        levelNumber,
        seed: "difficulty-seed",
        testSeed: `test-seed-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
      });
      const target = getDifficultyTarget(levelNumber);

      expect(generator.isSolvable(level)).toBe(true);
      expect(level.difficulty.withinTarget).toBe(true);
      expect(level.difficulty.safeChoiceCount).toBeGreaterThanOrEqual(
        target.safeChoiceCount.min,
      );
      expect(level.difficulty.safeChoiceCount).toBeLessThanOrEqual(
        target.safeChoiceCount.max,
      );
      expect(level.difficulty.estimatedDurationMinutes).toBeGreaterThanOrEqual(
        target.durationMinutes.min,
      );
      expect(level.difficulty.estimatedDurationMinutes).toBeLessThanOrEqual(
        target.durationMinutes.max,
      );
      expect(level.generation.attempts).toBeLessThanOrEqual(MAX_LEVEL_GENERATION_ATTEMPTS);
      expect(level.generation.replay.levelSeed).toBe(level.seed);
      expect(level.generation.replay.testSeed).toBe(`test-seed-${levelNumber}`);
      expect(generator.replay(level.generation.replay)).toEqual(level);
    }
  });
});

function hasPositiveAreaOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}
