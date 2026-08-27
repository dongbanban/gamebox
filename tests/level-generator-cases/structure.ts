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

describe("LevelGenerator · structure", () => {
  it("生成关卡结构满足形状、图案与层叠不变量", () => {
    const generator = new LevelGenerator();

    for (const levelNumber of [2, 5, 6, 15, 16, 30, 31, 60, MAX_LEVEL_NUMBER]) {
      const level = generator.generate({
        levelNumber,
        runSeed: `invariant-${levelNumber}`,
        generatorVersion: CURRENT_GENERATOR_VERSION,
      });
      const playableCells = new Set(level.board.playableCells.map((cell) => `${cell.x}:${cell.y}`));

      expect(getDogLogicalBlockCount(level.blocks, level.specialMechanisms)).toBe(
        getBlockCount(levelNumber),
      );
      expect(new Set(level.blocks.map((block) => block.z))).toHaveLength(getMaxLayers(levelNumber));
      expect(level.patternTypes).toHaveLength(getPatternTypeCount(levelNumber));
      expect(level.patternTypes.every((patternType) => DOG_PATTERN_TYPES.includes(patternType))).toBe(
        true,
      );

      for (const patternType of level.patternTypes) {
        expect(getLogicalPatternCount(level.blocks, patternType) % 3).toBe(0);
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

  it("按关卡与 seed 稳定生成中心多数、四角非空且互相连通的空间分布", () => {
    const generator = new LevelGenerator();

    for (const levelNumber of [1, 5, 10, 15, 30, MAX_LEVEL_NUMBER]) {
      const request = {
        levelNumber,
        runSeed: `spatial-${levelNumber}`,
        generatorVersion: CURRENT_GENERATOR_VERSION,
      } as const;
      const level = generator.generate(request);
      const replayed = generator.generate(request);
      const regions = level.blocks.map((block) => classifySpatialRegion(block, level.board));
      const centerCount = regions.filter((region) => region === "center").length;

      expect(level.generatorVersion).toBe(CURRENT_GENERATOR_VERSION);
      expect(level).toEqual(replayed);
      expect(centerCount).toBeGreaterThan(level.blocks.length / 2);
      for (const region of [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "edge",
      ] as const) {
        expect(regions.filter((candidate) => candidate === region).length).toBeGreaterThan(0);
        expect(hasRegionalCrossLayerOverlap(level.blocks, level.board, region)).toBe(true);
      }
      expect(hasCrossRegionOverlap(level.blocks, level.board), `level ${levelNumber}`).toBe(true);
    }
  });

  it("可稳定加载第 2–99 关，不因模板选择抛错", () => {
    const generator = new LevelGenerator();

    for (let levelNumber = 2; levelNumber <= MAX_LEVEL_NUMBER; levelNumber += 1) {
      const level = generator.generate({
        levelNumber,
        runSeed: `range-${levelNumber}`,
        generatorVersion: CURRENT_GENERATOR_VERSION,
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
      runSeed: "replay-seed",
      testSeed: "test-seed-12",
      generatorVersion: CURRENT_GENERATOR_VERSION,
    } as const;

    const level = generator.generate(request);
    const solvability = generator.findSolvability(level);
    const path = solvability.path;
    const target = getDifficultyTarget(request.levelNumber);

    expect(solvability.status).toBe("solvable");
    expect(path).toEqual(level.solutionPath);
    expect(path?.length).toBeGreaterThan(0);
    expect(path?.length).toBeLessThanOrEqual(level.blocks.length);
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
});
