import { describe, expect, it, vi } from "vitest";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  calculateDifficultyMetrics,
  DOG_PATTERN_TYPES,
  DOG_SHAPE_TEMPLATES,
  FIRST_LEVEL,
  GameSession,
  LEVEL_GENERATOR_VERSION,
  MAX_LEVEL_NUMBER,
  MAX_LEVEL_GENERATION_ATTEMPTS,
  LevelGenerator,
  getDifficultyTarget,
  getBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  getDogLegeDogLevel,
  getDogLogicalBlockCount,
  DEFAULT_LEVEL_SEED,
  DOG_DIFFICULTY_CURVE_GENERATOR_VERSION,
  DOG_REWARD_CONFIG_VERSION,
  DOG_MAX_LOCKED_TRAY_SLOTS,
  getDogTrayLockCount,
} from "@/games/dog-lege-dog";

describe("LevelGenerator", () => {
  it("允许生成第 99 关并拒绝第 100 关", () => {
    const generator = new LevelGenerator();

    expect(
      generator.generate({
        levelNumber: MAX_LEVEL_NUMBER,
        seed: "max-level-seed",
        generatorVersion: LEVEL_GENERATOR_VERSION,
      }).number,
    ).toBe(MAX_LEVEL_NUMBER);
    expect(() =>
      generator.generate({
        levelNumber: MAX_LEVEL_NUMBER + 1,
        seed: "over-max-level-seed",
        generatorVersion: LEVEL_GENERATOR_VERSION,
      }),
    ).toThrow("狗了个狗 level number must be an integer from 1 to 99");
  });

  it("按公开难度计算稳定、非负且随阶段变化的通关奖励", () => {
    const generator = new LevelGenerator();
    const levels = [1, 6, 31].map((levelNumber) =>
      generator.generate({
        levelNumber,
        seed: "reward-seed",
        generatorVersion: LEVEL_GENERATOR_VERSION,
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
        seed: "reward-time-seed",
        generatorVersion: LEVEL_GENERATOR_VERSION,
      });
      vi.setSystemTime(86_400_000);
      const lateLevel = generator.generate({
        levelNumber: 16,
        seed: "reward-time-seed",
        generatorVersion: LEVEL_GENERATOR_VERSION,
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
      seed: "selection-performance-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
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
    const firstLevel = getDogLegeDogLevel(FIRST_LEVEL.number, FIRST_LEVEL.runSeed);
    const generatedFirstLevel = generator.generate({
      levelNumber: FIRST_LEVEL.number,
      seed: DEFAULT_LEVEL_SEED,
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });
    const secondLevel = generator.generate({
      levelNumber: FIRST_LEVEL.number + 1,
      seed: DEFAULT_LEVEL_SEED,
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });

    expect(firstLevel).toEqual(FIRST_LEVEL);
    expect(firstLevel).toEqual(generatedFirstLevel);
    expect(firstLevel.generation.replay.mode).toBe("generated");
    expect(getDogLegeDogLevel(FIRST_LEVEL.number, FIRST_LEVEL.runSeed)).toEqual(firstLevel);
    expect(getDogLegeDogLevel(secondLevel.number, DEFAULT_LEVEL_SEED)).toEqual(secondLevel);
  });

  it("首关 replay 返回相同的不规则棋盘", () => {
    const generator = new LevelGenerator();

    expect(generator.replay(FIRST_LEVEL.generation.replay)).toEqual(FIRST_LEVEL);
    expect(generator.replayAttempt(FIRST_LEVEL.generation.replay)).toEqual(FIRST_LEVEL);
  });

  it("按 runSeed 独立生成 0–2 个锁槽，并在旧生成器版本关闭该机制", () => {
    const counts = ["run-a", "run-b", "seed-a"].map((runSeed) =>
      getDogTrayLockCount(runSeed, LEVEL_GENERATOR_VERSION),
    );

    expect(counts.every((count) => count >= 0 && count <= DOG_MAX_LOCKED_TRAY_SLOTS)).toBe(true);
    expect(getDogTrayLockCount("run-a", LEVEL_GENERATOR_VERSION)).toBe(counts[0]);
    expect(getDogTrayLockCount("run-a", LEVEL_GENERATOR_VERSION - 1)).toBe(0);
    expect(FIRST_LEVEL.lockedTraySlotCount).toBe(
      getDogTrayLockCount(FIRST_LEVEL.runSeed, FIRST_LEVEL.generatorVersion),
    );
  });

  it("生成关卡携带锁槽配置，并让锁槽参与可解性校验", () => {
    const runSeed = "run-a";
    const generator = new LevelGenerator();
    const level = generator.generate({
      levelNumber: 1,
      runSeed,
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });

    expect(level.lockedTraySlotCount).toBe(getDogTrayLockCount(runSeed, LEVEL_GENERATOR_VERSION));
    expect(level.lockedTraySlotCount).toBe(2);
    expect(generator.findSolvability(level).status).toBe("solvable");
  });

  it("保留 v11 首关回放种子并关闭 v12 新增锁槽", () => {
    const generator = new LevelGenerator();
    const level = generator.generate({
      levelNumber: FIRST_LEVEL.number,
      seed: DEFAULT_LEVEL_SEED,
      generatorVersion: DOG_DIFFICULTY_CURVE_GENERATOR_VERSION,
    });

    expect(level.seed).toBe(FIRST_LEVEL.seed);
    expect(level.lockedTraySlotCount).toBe(0);
    expect(generator.replay(level.generation.replay)).toEqual(level);
  });


  it("首关满足不规则轮廓、四分之一精度与部分重叠硬约束", () => {
    const level = FIRST_LEVEL;
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

  it("guaranteed fallback replay 保持相同候选", () => {
    const generator = new LevelGenerator();
    const replay = {
      attempt: MAX_LEVEL_GENERATION_ATTEMPTS,
      levelNumber: 31,
      seed: "fallback-seed",
      levelSeed: "fallback-seed:v2:level-31",
      testSeed: "fallback-test-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
      rewardConfigVersion: DOG_REWARD_CONFIG_VERSION,
      mode: "guaranteed" as const,
      randomSeed: "fallback-random-seed",
    };

    const level = generator.replayAttempt(replay);

    const ratios = getCrossLayerOverlapRatios(level.blocks);
    expect(level.board.shape).toBe("irregular");
    expect(ratios.filter((ratio) => ratio === 0.25 || ratio === 0.5).length / ratios.length)
      .toBeGreaterThanOrEqual(0.7);
    expect(ratios.filter((ratio) => ratio === 1).length / ratios.length).toBeLessThanOrEqual(0.1);
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

  it("首关由 runSeed 驱动，重复 seed 可复现且不同 seed 可变化", () => {
    const generator = new LevelGenerator();
    const firstRequest = {
      levelNumber: FIRST_LEVEL.number,
      runSeed: "first-run-seed-a",
      generatorVersion: LEVEL_GENERATOR_VERSION,
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
        seed: `irregular-checkpoint-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
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
        seed: `overlap-checkpoint-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
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
    expect([1, 5, 6, 15, 16, 30, 31, MAX_LEVEL_NUMBER].map(getMaxLayers)).toEqual([
      3,
      3,
      4,
      4,
      5,
      5,
      6,
      6,
    ]);
    expect([1, 5, 6, 15, 16, 30, 31, MAX_LEVEL_NUMBER].map(getPatternTypeCount)).toEqual([
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

  it("生成关卡结构满足形状、图案与层叠不变量", () => {
    const generator = new LevelGenerator();

    for (const levelNumber of [2, 5, 6, 15, 16, 30, 31, 60, MAX_LEVEL_NUMBER]) {
      const level = generator.generate({
        levelNumber,
        seed: `invariant-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
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
        seed: `spatial-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
      } as const;
      const level = generator.generate(request);
      const replayed = generator.generate(request);
      const regions = level.blocks.map((block) => classifySpatialRegion(block, level.board));
      const centerCount = regions.filter((region) => region === "center").length;

      expect(level.generatorVersion).toBe(LEVEL_GENERATOR_VERSION);
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

    for (const levelNumber of [2, 6, 16, 31, 60, MAX_LEVEL_NUMBER]) {
      const level = generator.generate({
        levelNumber,
        seed: "difficulty-seed",
        testSeed: `test-seed-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
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

  it("安全选择搜索预算不足时保留已证明通关路径并标记难度不确定", () => {
    const generator = new LevelGenerator();
    const level = createSafeChoiceBudgetFixture();

    expect(generator.findSolvability(level).status).toBe("solvable");

    const difficulty = generator.getDifficultyMetrics(level, { branchBudget: 0 });
    expect(difficulty.solvabilityStatus).toBe("solvable");
    expect(difficulty.safeChoiceSearchStatus).toBe("budget-exhausted");
    expect(difficulty.certainty).toBe("uncertain");
    expect(difficulty.withinTarget).toBe(false);
  });
});

type SolvabilityFixture = Parameters<LevelGenerator["findSolvability"]>[0];
type SolvabilityFixtureWithPath = SolvabilityFixture & {
  readonly solutionPath: readonly string[];
};

function createLongSearchFixture(): SolvabilityFixture {
  const preferredOrder = [
    0, 3, 6, 9, 12, 15,
    1, 4, 2, 5,
    7, 8, 10, 11, 13, 14, 16, 17,
  ];
  const idByBlockIndex = new Map(
    preferredOrder.map((blockIndex, order) => [
      blockIndex,
      `block-${String(order).padStart(2, "0")}`,
    ]),
  );
  const blocks: SolvabilityFixture["blocks"] = Array.from(
    { length: 18 },
    (_, index) => ({
      id: idByBlockIndex.get(index)!,
      x: index * BLOCK_WIDTH,
      y: 0,
      z: 0,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[Math.floor(index / 3)]!,
    }),
  );

  return {
    number: 1,
    maxLayers: 3,
    board: {
      shape: "irregular",
      templateId: "test-long-search",
      width: blocks.length * BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      logicalCellSize: 4,
      playableCells: [],
    },
    patternTypes: DOG_PATTERN_TYPES.slice(0, 6),
    blocks,
  };
}

function createBudgetFixture(): SolvabilityFixture {
  const blocks: SolvabilityFixture["blocks"] = Array.from(
    { length: 8 },
    (_, index) => ({
      id: `budget-block-${String(index).padStart(2, "0")}`,
      x: index * BLOCK_WIDTH,
      y: 0,
      z: 0,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[index]!,
    }),
  );

  return {
    number: 1,
    maxLayers: 1,
    board: {
      shape: "irregular",
      templateId: "test-budget",
      width: blocks.length * BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      logicalCellSize: 4,
      playableCells: [],
    },
    patternTypes: DOG_PATTERN_TYPES.slice(0, 8),
    blocks,
  };
}

function createFiniteBranchFixture(): SolvabilityFixture {
  const blocks: SolvabilityFixture["blocks"] = Array.from(
    { length: 8 },
    (_, index) => ({
      id: `finite-branch-${index}`,
      x: index < 2 ? index * BLOCK_WIDTH * 2 : BLOCK_WIDTH * 2,
      y: 0,
      z: 2 - index,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[index]!,
    }),
  );

  return {
    number: 1,
    maxLayers: 3,
    board: {
      shape: "irregular",
      templateId: "test-finite-branch",
      width: blocks.length * BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      logicalCellSize: 4,
      playableCells: [],
    },
    patternTypes: DOG_PATTERN_TYPES.slice(0, 8),
    blocks,
  };
}

function createSafeChoiceBudgetFixture(): SolvabilityFixtureWithPath {
  const blocks: SolvabilityFixture["blocks"] = [
    {
      id: "a0",
      x: 8,
      y: 0,
      z: 5,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[0]!,
    },
    {
      id: "b0",
      x: 12,
      y: 0,
      z: 5,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[1]!,
    },
    {
      id: "c0",
      x: 0,
      y: 0,
      z: 5,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[2]!,
    },
    {
      id: "d0",
      x: 0,
      y: 0,
      z: 4,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[3]!,
    },
    {
      id: "e0",
      x: 16,
      y: 0,
      z: 5,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[4]!,
    },
    {
      id: "a1",
      x: 8,
      y: 0,
      z: 4,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[0]!,
    },
    {
      id: "b1",
      x: 12,
      y: 0,
      z: 4,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[1]!,
    },
    {
      id: "c1",
      x: 4,
      y: 0,
      z: 4,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[2]!,
    },
    {
      id: "a2",
      x: 4,
      y: 0,
      z: 3,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[0]!,
    },
    {
      id: "b2",
      x: 4,
      y: 0,
      z: 2,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[1]!,
    },
    {
      id: "c2",
      x: 4,
      y: 0,
      z: 1,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[2]!,
    },
    {
      id: "d1",
      x: 4,
      y: 0,
      z: 0,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[3]!,
    },
    {
      id: "d2",
      x: 20,
      y: 0,
      z: 5,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[3]!,
    },
    {
      id: "e1",
      x: 4,
      y: 0,
      z: -1,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[4]!,
    },
    {
      id: "e2",
      x: 4,
      y: 0,
      z: -2,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0,
      patternType: DOG_PATTERN_TYPES[4]!,
    },
  ];

  return {
    number: 1,
    maxLayers: 6,
    board: {
      shape: "irregular",
      templateId: "test-safe-choice-budget",
      width: 24,
      height: BLOCK_HEIGHT,
      logicalCellSize: 4,
      playableCells: [],
    },
    patternTypes: DOG_PATTERN_TYPES.slice(0, 5),
    blocks,
    solutionPath: [
      "c1", "a0", "a1", "a2", "c0", "b0", "b1", "b2",
      "c2", "d0", "d1", "d2", "e0", "e1", "e2",
    ],
  };
}

type SpatialRegion =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "edge";

function classifySpatialRegion(
  block: { readonly x: number; readonly y: number },
  board: { readonly width: number; readonly height: number },
): SpatialRegion {
  const centerX = (block.x + BLOCK_WIDTH / 2) / board.width;
  const centerY = (block.y + BLOCK_HEIGHT / 2) / board.height;
  const horizontal = centerX < 0.2 ? "left" : centerX > 0.8 ? "right" : "center";
  const vertical = centerY < 0.2 ? "top" : centerY > 0.8 ? "bottom" : "center";
  if (horizontal === "center" && vertical === "center") {
    return "center";
  }
  if (horizontal !== "center" && vertical !== "center") {
    return `${vertical}-${horizontal}` as Exclude<SpatialRegion, "center" | "edge">;
  }
  return "edge";
}

function hasRegionalCrossLayerOverlap(
  blocks: readonly { readonly x: number; readonly y: number; readonly z: number; readonly width: number; readonly height: number }[],
  board: { readonly width: number; readonly height: number },
  region: SpatialRegion,
): boolean {
  const regionBlocks = blocks.filter((block) => classifySpatialRegion(block, board) === region);
  for (let firstIndex = 0; firstIndex < regionBlocks.length; firstIndex += 1) {
    for (const second of regionBlocks.slice(firstIndex + 1)) {
      if (regionBlocks[firstIndex].z !== second.z && overlapArea(regionBlocks[firstIndex], second) > 0) {
        return true;
      }
    }
  }
  return false;
}

function hasCrossRegionOverlap(
  blocks: readonly { readonly x: number; readonly y: number; readonly z: number; readonly width: number; readonly height: number }[],
  board: { readonly width: number; readonly height: number },
): boolean {
  for (let firstIndex = 0; firstIndex < blocks.length; firstIndex += 1) {
    const first = blocks[firstIndex];
    for (const second of blocks.slice(firstIndex + 1)) {
      if (
        first.z !== second.z &&
        classifySpatialRegion(first, board) !== classifySpatialRegion(second, board) &&
        overlapArea(first, second) > 0
      ) {
        return true;
      }
    }
  }
  return false;
}

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

function cellKey(cell: { readonly x: number; readonly y: number }): string {
  return `${cell.x}:${cell.y}`;
}

function getLogicalPatternCount(
  blocks: readonly { readonly patternType: string; readonly specialMechanism?: { readonly type: string } }[],
  patternType: string,
): number {
  return blocks
    .filter((block) => block.patternType === patternType)
    .reduce(
      (total, block) => total + (block.specialMechanism?.type === "twin" ? 2 : 1),
      0,
    );
}

function overlapArea(
  first: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  second: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): number {
  const overlapWidth = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y),
  );
  return overlapWidth * overlapHeight;
}

function getCrossLayerOverlapRatios(
  blocks: readonly { readonly x: number; readonly y: number; readonly z: number; readonly width: number; readonly height: number }[],
): number[] {
  const ratios: number[] = [];
  for (let firstIndex = 0; firstIndex < blocks.length; firstIndex += 1) {
    const first = blocks[firstIndex];
    for (const second of blocks.slice(firstIndex + 1)) {
      if (first.z === second.z) {
        continue;
      }

      const area = overlapArea(first, second);
      if (area > 0) {
        ratios.push(area / (first.width * first.height));
      }
    }
  }
  return ratios;
}

function isConnected(cells: readonly { readonly x: number; readonly y: number }[]): boolean {
  if (cells.length === 0) {
    return false;
  }

  const all = new Set(cells.map(cellKey));
  const visited = new Set<string>();
  const queue = [cells[0]!];
  while (queue.length > 0) {
    const cell = queue.shift()!;
    const key = cellKey(cell);
    if (visited.has(key)) {
      continue;
    }

    visited.add(key);
    for (const neighbor of [
      { x: cell.x - 1, y: cell.y },
      { x: cell.x + 1, y: cell.y },
      { x: cell.x, y: cell.y - 1 },
      { x: cell.x, y: cell.y + 1 },
    ]) {
      if (all.has(cellKey(neighbor)) && !visited.has(cellKey(neighbor))) {
        queue.push(neighbor);
      }
    }
  }

  return visited.size === all.size;
}

function countInteriorConcavities(
  cells: readonly { readonly x: number; readonly y: number }[],
): number {
  const all = new Set(cells.map(cellKey));
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  let concavities = 0;
  for (let y = minY + 1; y < maxY; y += 1) {
    for (let x = minX + 1; x < maxX; x += 1) {
      if (all.has(`${x}:${y}`)) {
        continue;
      }

      const neighbors = [
        `${x - 1}:${y}`,
        `${x + 1}:${y}`,
        `${x}:${y - 1}`,
        `${x}:${y + 1}`,
      ].filter((neighbor) => all.has(neighbor)).length;
      if (neighbors >= 2) {
        concavities += 1;
      }
    }
  }
  return concavities;
}

function isReflectionSymmetric(
  cells: readonly { readonly x: number; readonly y: number }[],
): boolean {
  const all = new Set(cells.map(cellKey));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  const horizontal = cells.every((cell) => all.has(`${maxX - cell.x}:${cell.y}`));
  const vertical = cells.every((cell) => all.has(`${cell.x}:${maxY - cell.y}`));
  return horizontal || vertical;
}
