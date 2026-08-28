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
  findSolvabilityFromState,
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

describe("LevelGenerator · solvability", () => {
  it("按阶段筛选安全选择与目标时长，失败时保留有限重试与重放 seam", () => {
    const generator = new LevelGenerator();

    for (const levelNumber of [2, 6, 16, 31, 60, MAX_LEVEL_NUMBER]) {
      const level = generator.generate({
        levelNumber,
        runSeed: "difficulty-seed",
        testSeed: `test-seed-${levelNumber}`,
        generatorVersion: CURRENT_GENERATOR_VERSION,
      });
      const target = getDifficultyTarget(levelNumber);

      expect(generator.isSolvable(level)).toBe(true);
      expect(level.difficulty.withinTarget || level.generation.fallbackUsed).toBe(true);
      expect(level.difficulty.safeChoiceCount).toBeGreaterThanOrEqual(
        target.safeChoiceCount.min,
      );
      expect(level.difficulty.estimatedDurationMinutes).toBeGreaterThanOrEqual(
        target.durationMinutes.min,
      );
      if (level.difficulty.withinTarget) {
        expect(level.difficulty.safeChoiceCount).toBeLessThanOrEqual(target.safeChoiceCount.max);
        expect(level.difficulty.estimatedDurationMinutes).toBeLessThanOrEqual(
          target.durationMinutes.max,
        );
      } else {
        expect(level.generation.failures.length).toBeGreaterThan(0);
      }
      expect(level.generation.attempts).toBeLessThanOrEqual(MAX_LEVEL_GENERATION_ATTEMPTS);
      expect(level.generation.replay.levelSeed).toBe(level.seed);
      expect(level.generation.replay.testSeed).toBe(`test-seed-${levelNumber}`);
      expect(generator.replay(level.generation.replay)).toEqual(level);
    }
  });

  it("三态搜索允许超过 16 个剩余方块，并寻找替代通关路径", () => {
    const generator = new LevelGenerator();
    const level = createLongSearchFixture();

    const solvability = generator.findSolvability(level);
    const difficulty = generator.getDifficultyMetrics(level);
    const descendingPath = [...level.blocks]
      .sort((first, second) => second.z - first.z || first.id.localeCompare(second.id))
      .map((block) => block.id);

    expect(solvability.status).toBe("solvable");
    expect(solvability.path).toHaveLength(level.blocks.length);
    expect(solvability.path).not.toEqual(descendingPath);
    expect(difficulty.solvabilityStatus).toBe("solvable");
    expect(difficulty.safeChoiceSearchStatus).toBe("complete");
    expect(difficulty.certainty).toBe("certain");
    expect(difficulty.withinTarget).toBe(false);
  });

  it("搜索预算不足保留不确定状态，完整搜索才确认无通关路径", () => {
    const generator = new LevelGenerator();
    const level = createBudgetFixture();
    const finiteBranchLevel = createFiniteBranchFixture();

    expect(generator.findSolvability(level, { branchBudget: 0 }).status).toBe(
      "budget-exhausted",
    );
    expect(generator.findSolvability(finiteBranchLevel, { branchBudget: 0 }).status).toBe(
      "budget-exhausted",
    );
    expect(generator.findSolvability(finiteBranchLevel, { branchBudget: 100 }).status).toBe(
      "unsolvable",
    );

    const difficulty = generator.getDifficultyMetrics(level);
    const directDifficulty = calculateDifficultyMetrics(
      level,
      undefined,
      undefined,
      undefined,
      { branchBudget: 0 },
    );
    expect(difficulty.solvabilityStatus).toBe("budget-exhausted");
    expect(difficulty.safeChoiceSearchStatus).toBe("budget-exhausted");
    expect(difficulty.certainty).toBe("uncertain");
    expect(difficulty.withinTarget).toBe(false);
    expect(directDifficulty.solvabilityStatus).toBe("budget-exhausted");
    expect(directDifficulty.certainty).toBe("uncertain");
  });

  it("棋盘清空但暂存槽仍有方块时不判定为可解", () => {
    const level = createLongSearchFixture();
    const result = findSolvabilityFromState(level, {
      remainingBlockIds: [],
      initialTray: [{ id: "leftover", patternType: DOG_PATTERN_TYPES[0]! }],
      trayCapacity: 7,
    });

    expect(result.status).toBe("unsolvable");
  });
});
