import { describe, expect, it, vi } from "vitest";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  calculateDifficultyMetrics,
  DOG_PATTERN_TYPES,
  DOG_SHAPE_TEMPLATES,
  DOG_V13_CONFIG,
  GameSession,
  MAX_LEVEL_GENERATION_ATTEMPTS,
  LevelGenerator,
  getDifficultyTarget,
  getBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  getDogLegeDogLevel,
  getDogLogicalBlockCount,
  DOG_REWARD_CONFIG_VERSION,
  getDogTrayLockCount,
} from "@/games/dog-lege-dog";

const MAX_LEVEL_NUMBER = DOG_V13_CONFIG.game.maxLevelNumber;
const CURRENT_GENERATOR_VERSION = DOG_V13_CONFIG.game.generatorVersion;
const MAX_LOCKED_TRAY_SLOTS = DOG_V13_CONFIG.tray.maxLockedSlotCount;
import {
  createLongSearchFixture,
  createBudgetFixture,
  createFiniteBranchFixture,
  classifySpatialRegion,
  hasRegionalCrossLayerOverlap,
  hasCrossRegionOverlap,
  hasPositiveAreaOverlap,
  cellKey,
  getLogicalPatternCount,
  overlapArea,
  getCrossLayerOverlapRatios,
  isConnected,
  countInteriorConcavities,
  isReflectionSymmetric,
} from "../support/level-generator-fixtures";

describe("LevelGenerator · shape-and-progression", () => {
  it("通过明确的关卡号、runSeed 与生成器版本稳定生成同一棋盘", () => {
    const generator = new LevelGenerator();
    const request = {
      levelNumber: 12,
      runSeed: "replay-seed",
      generatorVersion: CURRENT_GENERATOR_VERSION,
    } as const;

    const first = generator.generate(request);
    const second = generator.generate(request);

    expect(second).toEqual(first);
    expect(first.number).toBe(request.levelNumber);
    expect(first.generatorVersion).toBe(request.generatorVersion);
    expect(first.seed).toContain(request.runSeed);
  });

  it("显式首关 runSeed 继续走生成器并可重放", () => {
    const generator = new LevelGenerator();
    const request = {
      levelNumber: 1,
      runSeed: "explicit-first-level-run-seed",
      generatorVersion: CURRENT_GENERATOR_VERSION,
    } as const;

    const level = generator.generate(request);
    const repeated = generator.generate(request);

    expect(repeated).toEqual(level);
    expect(level.seed).toContain(request.runSeed);
    expect(level.generation.replay).toMatchObject({
      levelNumber: request.levelNumber,
      runSeed: request.runSeed,
      generatorVersion: request.generatorVersion,
      mode: "generated",
    });
    expect(generator.replay(level.generation.replay)).toEqual(level);
  });

  it("首关由 runSeed 驱动，重复 runSeed 可复现且不同 runSeed 可变化", () => {
    const generator = new LevelGenerator();
    const firstRequest = {
      levelNumber: 1,
      runSeed: "first-run-seed-a",
      generatorVersion: CURRENT_GENERATOR_VERSION,
    } as const;

    const first = generator.generate(firstRequest);
    const repeated = generator.generate(firstRequest);
    const sameRunSeedWithDifferentTestSeed = generator.generate({
      ...firstRequest,
      testSeed: "diagnostic-seed-only",
    });
    const different = generator.generate({
      ...firstRequest,
      runSeed: "first-run-seed-b",
    });

    expect(first.runSeed).toBe(firstRequest.runSeed);
    expect(first).toEqual(repeated);
    expect(first.generation.replay.runSeed).toBe(firstRequest.runSeed);
    expect(generator.replay(first.generation.replay)).toEqual(first);
    expect(levelShape(sameRunSeedWithDifferentTestSeed)).toEqual(levelShape(first));
    expect(different.runSeed).toBe("first-run-seed-b");
    expect(levelShape(different)).not.toEqual(levelShape(first));

    function levelShape(level: typeof first) {
      return {
        templateId: level.board.templateId,
        patternTypes: level.patternTypes,
        blocks: level.blocks.map(({ x, y, z, patternType }) => ({
          x,
          y,
          z,
          patternType,
        })),
      };
    }
  });

  it("全部固定检查点统一生成不规则棋盘与阶段图案数量", () => {
    const generator = new LevelGenerator();

    for (const levelNumber of [1, 2, 5, 6, 10, 15, 16, 30, 31, MAX_LEVEL_NUMBER]) {
      const level = generator.generate({
        levelNumber,
        runSeed: `irregular-checkpoint-${levelNumber}`,
        generatorVersion: CURRENT_GENERATOR_VERSION,
      });

      expect(level.board.shape).toBe("irregular");
      expect(level.patternTypes).toHaveLength(getPatternTypeCount(levelNumber));
      expect(new Set(level.blocks.map((block) => block.patternType))).toHaveLength(
        getPatternTypeCount(levelNumber),
      );
    }
  });

  it("全部检查点跨层重叠以四分之一或二分之一为主", () => {
    const generator = new LevelGenerator();

    for (const levelNumber of [1, 2, 5, 6, 10, 15, 16, 30, 31, 60, MAX_LEVEL_NUMBER]) {
      const level = generator.generate({
        levelNumber,
        runSeed: `overlap-checkpoint-${levelNumber}`,
        generatorVersion: CURRENT_GENERATOR_VERSION,
      });
      const ratios = getCrossLayerOverlapRatios(level.blocks);
      const partialCount = ratios.filter((ratio) => ratio === 0.25 || ratio === 0.5).length;
      const alignedCount = ratios.filter((ratio) => ratio === 1).length;

      expect(ratios.length).toBeGreaterThan(0);
      expect(partialCount / ratios.length, `level ${levelNumber}`).toBeGreaterThanOrEqual(0.7);
      expect(alignedCount / ratios.length, `level ${levelNumber}`).toBeLessThanOrEqual(0.1);
    }
  });

  it("按关卡阶段递增方块数量、层数与图案池", () => {
    expect([1, 5, 6, 10, 11, 15, 16, 20, 21, 25, 26].map((levelNumber) =>
      getBlockCount(levelNumber),
    )).toEqual([
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
    expect([1, 5, 6, 15, 16, 30, 31, MAX_LEVEL_NUMBER].map((levelNumber) =>
      getMaxLayers(levelNumber),
    )).toEqual([
      3,
      3,
      4,
      4,
      5,
      5,
      6,
      6,
    ]);
    expect([1, 5, 6, 15, 16, 30, 31, MAX_LEVEL_NUMBER].map((levelNumber) =>
      getPatternTypeCount(levelNumber),
    )).toEqual([
      6,
      6,
      8,
      8,
      10,
      10,
      10,
      10,
    ]);
  });

  it("为不规则形提供多个预定义网格变体", () => {
    const variantsByShape = new Map<string, Set<string>>();
    for (const template of DOG_SHAPE_TEMPLATES) {
      const variants = variantsByShape.get(template.shape) ?? new Set<string>();
      variants.add(template.id);
      variantsByShape.set(template.shape, variants);
      expect(template.rows).toHaveLength(template.height);
      expect(template.rows.every((row) => row.length === template.width)).toBe(true);
    }

    expect([...variantsByShape.keys()].sort()).toEqual(["irregular"]);
    expect([...variantsByShape.values()].every((variants) => variants.size >= 2)).toBe(true);
  });

  it("每个不规则模板保持连通、非对称并包含凹口", () => {
    for (const template of DOG_SHAPE_TEMPLATES) {
      expect(isConnected(template.playableCells), template.id).toBe(true);
      expect(countInteriorConcavities(template.playableCells), template.id).toBeGreaterThanOrEqual(2);
      expect(isReflectionSymmetric(template.playableCells), template.id).toBe(false);
    }
  });
});
