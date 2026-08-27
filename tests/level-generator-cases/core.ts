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

describe("LevelGenerator · core", () => {
  it("允许生成第 99 关并拒绝第 100 关", () => {
    const generator = new LevelGenerator();

    expect(
      generator.generate({
        levelNumber: MAX_LEVEL_NUMBER,
        runSeed: "max-level-seed",
        generatorVersion: CURRENT_GENERATOR_VERSION,
      }).number,
    ).toBe(MAX_LEVEL_NUMBER);
    expect(() =>
      generator.generate({
        levelNumber: MAX_LEVEL_NUMBER + 1,
        runSeed: "over-max-level-seed",
        generatorVersion: CURRENT_GENERATOR_VERSION,
      }),
    ).toThrow("狗了个狗 level number must be an integer from 1 to 99");
  });

  it("按公开难度计算稳定、非负且随阶段变化的通关奖励", () => {
    const generator = new LevelGenerator();
    const levels = [1, 6, 31].map((levelNumber) =>
      generator.generate({
        levelNumber,
        runSeed: "reward-seed",
        generatorVersion: CURRENT_GENERATOR_VERSION,
      }),
    );

    expect(levels[0]?.reward).toBe(100);
    expect(new Set(levels.map((level) => level.reward)).size).toBeGreaterThan(1);

    for (const level of levels) {
      expect(Number.isSafeInteger(level.reward)).toBe(true);
      expect(level.reward).toBeGreaterThanOrEqual(0);
      expect(level.rewardConfigVersion).toBe(DOG_REWARD_CONFIG_VERSION);
      expect(level.generation.replay.rewardConfigVersion).toBe(DOG_REWARD_CONFIG_VERSION);
      expect(generator.replay(level.generation.replay).reward).toBe(level.reward);
    }
  });

  it("奖励不依赖用户或本局用时", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const generator = new LevelGenerator();
      const earlyLevel = generator.generate({
        levelNumber: 16,
        runSeed: "reward-time-seed",
        generatorVersion: CURRENT_GENERATOR_VERSION,
      });
      vi.setSystemTime(86_400_000);
      const lateLevel = generator.generate({
        levelNumber: 16,
        runSeed: "reward-time-seed",
        generatorVersion: CURRENT_GENERATOR_VERSION,
      });

      expect(lateLevel.reward).toBe(earlyLevel.reward);
    } finally {
      vi.useRealTimers();
    }
  });

  it("高难关单次选择复用一次公开状态快照并保持响应", () => {
    const generator = new LevelGenerator();
    const generationStartedAt = performance.now();
    const level = generator.generate({
      levelNumber: 31,
      runSeed: "selection-performance-seed",
      generatorVersion: CURRENT_GENERATOR_VERSION,
    });
    const generationMs = performance.now() - generationStartedAt;
    const session = new GameSession(level);
    const getState = vi.spyOn(session, "getState");
    const selectionStartedAt = performance.now();
    const selection = session.selectBlock(level.solutionPath[0]!);
    const selectionMs = performance.now() - selectionStartedAt;

    console.info(
      `[性能回归] level=31 blocks=${level.blocks.length} generationMs=${generationMs.toFixed(1)} selectionMs=${selectionMs.toFixed(1)} stateReads=${getState.mock.calls.length}`,
    );
    expect(getDogLogicalBlockCount(level.blocks, level.specialMechanisms)).toBe(180);
    expect(selection.selected).toBe(true);
    expect(selection.snapshot.level).toBe(level);
    expect(selection.snapshot.remainingBlocks).toHaveLength(level.blocks.length - 1);
    expect(getState).toHaveBeenCalledTimes(1);
    expect(generationMs).toBeLessThan(10_000);
    expect(selectionMs).toBeLessThan(1_000);
  });

  it("首关与后续关卡都通过同一个生成器 seam 提供", () => {
    const generator = new LevelGenerator();
    const firstRunSeed = "first-level-run-seed";
    const firstLevel = getDogLegeDogLevel(1, firstRunSeed);
    const generatedFirstLevel = generator.generate({
      levelNumber: 1,
      runSeed: firstRunSeed,
      generatorVersion: CURRENT_GENERATOR_VERSION,
    });
    const secondLevel = generator.generate({
      levelNumber: 2,
      runSeed: firstRunSeed,
      generatorVersion: CURRENT_GENERATOR_VERSION,
    });

    expect(firstLevel).toEqual(generatedFirstLevel);
    expect(firstLevel.generation.replay.mode).toBe("generated");
    expect(getDogLegeDogLevel(1, firstRunSeed)).toEqual(firstLevel);
    expect(getDogLegeDogLevel(secondLevel.number, firstRunSeed)).toEqual(secondLevel);
  });

  it("首关 replay 返回相同的不规则棋盘", () => {
    const generator = new LevelGenerator();

    const level = generator.generate({
      levelNumber: 1,
      runSeed: "first-level-replay-seed",
      generatorVersion: CURRENT_GENERATOR_VERSION,
    });

    expect(generator.replay(level.generation.replay)).toEqual(level);
    expect(generator.replayAttempt(level.generation.replay)).toEqual(level);
  });

  it("按 runSeed 独立生成 0–2 个锁槽", () => {
    const counts = ["run-a", "run-b", "seed-a"].map((runSeed) =>
      getDogTrayLockCount(runSeed),
    );

    expect(counts.every((count) => count >= 0 && count <= MAX_LOCKED_TRAY_SLOTS)).toBe(true);
    expect(getDogTrayLockCount("run-a")).toBe(counts[0]);
  });

  it("生成关卡携带锁槽配置，并让锁槽参与可解性校验", () => {
    const runSeed = "run-a";
    const generator = new LevelGenerator();
    const level = generator.generate({
      levelNumber: 1,
      runSeed,
      generatorVersion: CURRENT_GENERATOR_VERSION,
    });

    expect(level.lockedTraySlotCount).toBe(getDogTrayLockCount(runSeed));
    expect(level.lockedTraySlotCount).toBe(2);
    expect(generator.findSolvability(level).status).toBe("solvable");
  });

  it("首关满足不规则轮廓、四分之一精度与部分重叠硬约束", () => {
    const level = new LevelGenerator().generate({
      levelNumber: 1,
      runSeed: "first-level-geometry-seed",
      generatorVersion: CURRENT_GENERATOR_VERSION,
    });
    const playableCells = new Set(level.board.playableCells.map(cellKey));
    const crossLayerOverlaps = level.blocks.flatMap((block, index) =>
      level.blocks.slice(index + 1).flatMap((other) => {
        if (block.z === other.z) {
          return [];
        }

        const area = overlapArea(block, other);
        return area > 0 ? [{ ratio: area / (BLOCK_WIDTH * BLOCK_HEIGHT) }] : [];
      }),
    );
    const quarterOrHalfCount = crossLayerOverlaps.filter(
      ({ ratio }) => ratio === 0.25 || ratio === 0.5,
    ).length;
    const quarterCount = crossLayerOverlaps.filter(({ ratio }) => ratio === 0.25).length;
    const halfCount = crossLayerOverlaps.filter(({ ratio }) => ratio === 0.5).length;
    const alignedCount = crossLayerOverlaps.filter(({ ratio }) => ratio === 1).length;

    expect(level.board.shape).toBe("irregular");
    expect(level.board.logicalCellSize).toBe(4);
    expect(getDogLogicalBlockCount(level.blocks, level.specialMechanisms)).toBe(90);
    expect(new Set(level.blocks.map((block) => block.z))).toHaveLength(3);
    expect(level.blocks.every((block) =>
      block.width === 4 &&
      block.height === 4 &&
      block.rotation === 0 &&
      Number.isInteger(block.x) &&
      Number.isInteger(block.y) &&
      Number.isInteger(block.z),
    )).toBe(true);
    expect(level.patternTypes).toHaveLength(6);
    expect(new Set(level.blocks.map((block) => block.patternType))).toHaveLength(6);
    expect(level.patternTypes.every((patternType) =>
      getLogicalPatternCount(level.blocks, patternType) % 3 === 0,
    )).toBe(true);
    expect(isConnected(level.board.playableCells)).toBe(true);
    expect(countInteriorConcavities(level.board.playableCells)).toBeGreaterThanOrEqual(2);
    expect(isReflectionSymmetric(level.board.playableCells)).toBe(false);

    for (const block of level.blocks) {
      for (let y = block.y; y < block.y + block.height; y += 1) {
        for (let x = block.x; x < block.x + block.width; x += 1) {
          expect(playableCells.has(`${x}:${y}`)).toBe(true);
        }
      }
    }

    for (let index = 0; index < level.blocks.length; index += 1) {
      const block = level.blocks[index];
      for (const other of level.blocks.slice(index + 1)) {
        if (block.z === other.z) {
          expect(overlapArea(block, other)).toBe(0);
        }
      }

      const coveredByHigherBlocks = level.blocks.filter(
        (other) => other.z > block.z && overlapArea(block, other) > 0,
      );
      expect(coveredByHigherBlocks.length).toBeLessThanOrEqual(4);
    }

    expect(crossLayerOverlaps.length).toBeGreaterThan(0);
    expect(quarterOrHalfCount / crossLayerOverlaps.length).toBeGreaterThanOrEqual(0.7);
    expect(quarterCount / crossLayerOverlaps.length).toBeGreaterThanOrEqual(0.2);
    expect(halfCount / crossLayerOverlaps.length).toBeGreaterThanOrEqual(0.2);
    expect(alignedCount / crossLayerOverlaps.length).toBeLessThanOrEqual(0.1);
    expect(new GameSession(level).selectBlock(level.solutionPath[0]!).selected).toBe(true);
  });
});
