import { describe, expect, it } from "vitest";
import {
  getBlockCount,
  DOG_DIFFICULTY_CURVE_GENERATOR_VERSION,
  getDifficultyTarget,
  getDogLogicalBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  isDifficultyWithinTarget,
  LEVEL_GENERATOR_VERSION,
  LevelGenerator,
} from "@/games/dog-lege-dog";

describe("狗了个狗难度曲线", () => {
  it("前五关使用有限且逐步收紧的安全选择/时长目标", () => {
    const targets = [1, 2, 3, 4, 5].map(getDifficultyTarget);

    expect(targets.map((target) => target.safeChoiceCount.min)).toEqual([
      1, 1, 1, 1, 1,
    ]);
    expect(targets.map((target) => target.safeChoiceCount.max)).toEqual([
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    ]);
    expect(targets.every((target) => Number.isFinite(target.safeChoiceCount.max))).toBe(true);
    expect(targets.map((target) => target.safeChoiceRate?.min)).toEqual([
      0.18, 0.18, 0.18, 0.18, 0.16,
    ]);
    expect(targets.map((target) => target.durationMinutes.min)).toEqual([
      9, 9, 9, 9, 9.8,
    ]);
    expect(targets.map((target) => target.durationMinutes.max)).toEqual([
      10, 10, 10, 10, 10.8,
    ]);
  });

  it("v13 难度验收包含压力、机制密度、操作成本与误操作风险", () => {
    const target = getDifficultyTarget(1);
    expect(target).toMatchObject({
      trayPeakPressure: { min: 0.78, max: 0.98 },
      mechanismDensity: { min: 0.29, max: 0.3 },
      operationCost: { min: 0.3, max: 1 },
      mistakeRisk: { min: 0.1, max: 0.99 },
    });

    const level = new LevelGenerator().generate({
      levelNumber: 1,
      runSeed: "difficulty-curve-v13-metrics",
      testSeed: "difficulty-curve-v13-metrics",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });
    expect(level.difficulty.trayPeakPressure).toBeGreaterThanOrEqual(
      target.trayPeakPressure!.min,
    );
    expect(level.difficulty.trayPeakPressure).toBeLessThanOrEqual(
      target.trayPeakPressure!.max,
    );
    expect(level.difficulty.specialMechanismDensity).toBeGreaterThanOrEqual(
      target.mechanismDensity!.min,
    );
    expect(level.difficulty.specialMechanismDensity).toBeLessThanOrEqual(
      target.mechanismDensity!.max,
    );
    expect(level.difficulty.operationCost).toBeGreaterThanOrEqual(
      target.operationCost!.min,
    );
    expect(level.difficulty.operationCost).toBeLessThanOrEqual(
      target.operationCost!.max,
    );
    expect(level.difficulty.mistakeRisk).toBeGreaterThanOrEqual(
      target.mistakeRisk!.min,
    );
    expect(level.difficulty.mistakeRisk).toBeLessThanOrEqual(
      target.mistakeRisk!.max,
    );
    expect(level.difficulty.withinTarget).toBe(true);

    expect(isDifficultyWithinTarget({
      ...level.difficulty,
      trayPeakPressure: target.trayPeakPressure!.max + 0.01,
    })).toBe(false);
    expect(isDifficultyWithinTarget({
      ...level.difficulty,
      specialMechanismDensity: target.mechanismDensity!.max + 0.01,
    })).toBe(false);
    expect(isDifficultyWithinTarget({
      ...level.difficulty,
      operationCost: target.operationCost!.max + 0.01,
    })).toBe(false);
    expect(isDifficultyWithinTarget({
      ...level.difficulty,
      mistakeRisk: target.mistakeRisk!.max + 0.01,
    })).toBe(false);
  });

  it("固定 1–30 批次覆盖阶段边界与真实生成指标", () => {
    const generator = new LevelGenerator();
    const testSeed = "difficulty-curve-batch-v1";
    const levels = Array.from({ length: 30 }, (_, index) => {
      const levelNumber = index + 1;
      return generator.generate({
        levelNumber,
        runSeed: `${testSeed}:${levelNumber}`,
        testSeed,
        generatorVersion: LEVEL_GENERATOR_VERSION,
      });
    });

    expect(levels.every((level) => !level.generation.fallbackUsed)).toBe(true);
    expect(levels.every((level) => isDifficultyWithinTarget(level.difficulty))).toBe(true);
    expect(levels.every((level) => {
      const { difficulty } = level;
      return (
        getDogLogicalBlockCount(level.blocks, level.specialMechanisms) === getBlockCount(level.number) &&
        level.maxLayers === getMaxLayers(level.number) &&
        level.patternTypes.length === getPatternTypeCount(level.number) &&
        difficulty.solutionPathLength > 0 &&
        difficulty.solutionPathLength <= level.blocks.length &&
        difficulty.crossLayerOverlapCount > 0 &&
        difficulty.partialOverlapRate > 0 &&
        Number.isFinite(difficulty.specialMechanismDensity) &&
        Number.isFinite(difficulty.estimatedDurationMinutes)
      );
    })).toBe(true);

    const boundaryLevels = [1, 5, 6, 10, 11, 15, 16, 20, 21, 25, 26, 30, 31];
    const boundaryTargets = boundaryLevels.map(getDifficultyTarget);
    expect(boundaryTargets.every((target) =>
      Number.isFinite(target.safeChoiceCount.max) && target.safeChoiceRate !== undefined,
    )).toBe(true);
    for (let index = 1; index < boundaryTargets.length; index += 1) {
      expect(boundaryTargets[index]!.safeChoiceRate!.min).toBeLessThanOrEqual(
        boundaryTargets[index - 1]!.safeChoiceRate!.min,
      );
      expect(boundaryTargets[index]!.durationMinutes.min).toBeGreaterThanOrEqual(
        boundaryTargets[index - 1]!.durationMinutes.min,
      );
    }
  });

  it("固定 runSeed 生成候选落在当前关目标内并可重放", () => {
    const generator = new LevelGenerator();
    const level = generator.generate({
      levelNumber: 5,
      runSeed: "difficulty-curve-fixed-run-seed",
      testSeed: "difficulty-curve-fixed-test-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });

    expect(level.generation.fallbackUsed).toBe(false);
    expect(isDifficultyWithinTarget(level.difficulty)).toBe(true);
    expect(level.difficulty.logicalBlockCount).toBe(getBlockCount(level.number));
    expect(level.difficulty.solutionPathLength).toBeGreaterThan(0);
    expect(level.difficulty.solutionPathLength).toBeLessThanOrEqual(level.blocks.length);
    expect(level.difficulty.crossLayerOverlapCount).toBeGreaterThan(0);
    expect(level.difficulty.partialOverlapRate).toBeGreaterThan(0);
    expect(level.difficulty.safeChoiceRate).toBeGreaterThanOrEqual(
      level.difficulty.target.safeChoiceRate?.min ?? 0,
    );
    expect(generator.replay(level.generation.replay)).toEqual(level);
  });

  it("不同 runSeed 保留目标内自然波动，旧 generator version 使用旧目标语义", () => {
    const generator = new LevelGenerator();
    const levels = ["difficulty-curve-seed-a", "difficulty-curve-seed-b"].map((runSeed) =>
      generator.generate({
        levelNumber: 5,
        runSeed,
        generatorVersion: LEVEL_GENERATOR_VERSION,
      }),
    );
    expect(levels[0]).not.toEqual(levels[1]);
    expect(levels.every((level) => isDifficultyWithinTarget(level.difficulty))).toBe(true);

    const legacy = generator.generate({
      levelNumber: 5,
      runSeed: "difficulty-curve-legacy-seed",
      generatorVersion: DOG_DIFFICULTY_CURVE_GENERATOR_VERSION - 1,
    });
    expect(legacy.difficulty.target.safeChoiceCount.max).toBe(Number.MAX_SAFE_INTEGER);
    expect(legacy.difficulty.target.safeChoiceRate).toBeUndefined();
    expect(legacy.difficulty.trayPeakPressure).toBeGreaterThan(1);
    expect(generator.replay(legacy.generation.replay)).toEqual(legacy);
  });
});
