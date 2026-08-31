import { describe, expect, it } from "vitest";
import {
  DOG_V13_CONFIG,
  GameSession,
  findShuffleTriggerPath,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
  getDogSpecialMechanismConfigs,
  getDogLogicalBlockCount,
  isDifficultyWithinTarget,
  LevelGenerator,
} from "@/games/dog-lege-dog";

describe("狗了个狗 v13 关卡生成 seam", () => {
  it("正式生成在第 3 关启用乱序且每关最多一个", () => {
    const generator = new LevelGenerator({ candidateFilter: () => true });

    for (const levelNumber of [1, 2, 3, 99]) {
      const level = generator.generate({
        levelNumber,
        runSeed: `v13-shuffle-boundary-${levelNumber}`,
        generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
      });
      const shuffleBlocks = level.blocks.filter(
        (block) => block.specialMechanism?.type === "shuffle",
      );
      const plan = getDogV13MechanismPlan(
        getDogV13LogicalBlockCount(levelNumber),
        DOG_V13_CONFIG,
        levelNumber,
      );

      expect(shuffleBlocks).toHaveLength(levelNumber >= 3 ? 1 : 0);
      expect(plan.counts.shuffle).toBe(levelNumber >= 3 ? 1 : 0);
      expect(getDogSpecialMechanismConfigs(levelNumber).some(
        (configuration) => configuration.type === "shuffle",
      )).toBe(levelNumber >= 3);
      expect(level.difficulty.solvabilityStatus).toBe("solvable");
    }
  });

  it("默认生成器使用集中配置版本并兑现首关机制预算", () => {
    const generator = new LevelGenerator();
    const level = generator.generate({
      levelNumber: 1,
      runSeed: "v13-generation-red-test",
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    });
    const plan = getDogV13MechanismPlan(
      getDogV13LogicalBlockCount(level.number),
      DOG_V13_CONFIG,
      level.number,
    );
    const counts = countMechanisms(level.blocks);

    expect(level.generatorVersion).toBe(DOG_V13_CONFIG.game.generatorVersion);
    expect(counts).toEqual(plan.counts);
    expect(getDogLogicalBlockCount(level.blocks, level.specialMechanisms)).toBe(
      getDogV13LogicalBlockCount(level.number),
    );
    expect(level.difficulty.specialMechanismDensity).toBe(
      plan.logicalUnitCount / getDogV13LogicalBlockCount(level.number),
    );
    expect(new Set(
      level.blocks
        .map((block) => block.specialMechanism?.type)
        .filter((type): type is string => type !== undefined),
    )).toEqual(
      new Set(["freeze", "illusion", "magnetic", "twin"]),
    );
  });

  it("相同 runSeed 可重放，其他 runSeed 产生不同候选", () => {
    const generator = new LevelGenerator();
    const request = {
      levelNumber: 1,
      runSeed: "v13-replay-red-test",
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    } as const;
    const first = generator.generate(request);
    const repeated = generator.generate(request);
    const different = generator.generate({
      ...request,
      runSeed: "v13-replay-red-test-other",
    });

    expect(repeated).toEqual(first);
    expect(generator.replay(first.generation.replay)).toEqual(first);
    expect(different).not.toEqual(first);
  });

  it("生成器读取传入配置的结构阶段", () => {
    const config = {
      ...DOG_V13_CONFIG,
      levels: {
        ...DOG_V13_CONFIG.levels,
        structureStages: DOG_V13_CONFIG.levels.structureStages.map((stage, index) =>
          index === 0 ? { ...stage, maxLayers: 4 } : stage,
        ),
      },
    };
    const generator = new LevelGenerator({
      config,
      candidateFilter: () => true,
    });
    const level = generator.generate({
      levelNumber: 1,
      runSeed: "v13-custom-config-red-test",
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    });

    expect(level.maxLayers).toBe(4);
  });

  it("覆盖 v13 阶段边界并保持机制计划与无道具可解", () => {
    const generator = new LevelGenerator();
    for (const levelNumber of [1, 6, 16, 31, 99]) {
      const level = generator.generate({
        levelNumber,
        runSeed: `v13-boundary-${levelNumber}`,
        generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
      });
      const plan = getDogV13MechanismPlan(
        getDogV13LogicalBlockCount(levelNumber),
        DOG_V13_CONFIG,
        levelNumber,
      );
      expect(level.generatorVersion).toBe(DOG_V13_CONFIG.game.generatorVersion);
      expect(countMechanisms(level.blocks)).toEqual(plan.counts);
      expect(getDogLogicalBlockCount(level.blocks, level.specialMechanisms)).toBe(
        getDogV13LogicalBlockCount(levelNumber),
      );
      expect(level.lockedTraySlotCount).toBeGreaterThanOrEqual(0);
      expect(level.lockedTraySlotCount).toBeLessThanOrEqual(
        DOG_V13_CONFIG.tray.maxLockedSlotCount,
      );
      expect(level.blocks.every((block) =>
        block.specialMechanism === undefined || typeof block.specialMechanism.type === "string",
      )).toBe(true);
      expect(level.difficulty.solvabilityStatus).toBe("solvable");
      expect(isDifficultyWithinTarget(level.difficulty)).toBe(true);
      expect(level.difficulty.trayPeakPressure).toBeGreaterThanOrEqual(
        level.difficulty.target.trayPeakPressure!.min,
      );
      expect(level.difficulty.operationCost).toBeGreaterThanOrEqual(
        level.difficulty.target.operationCost!.min,
      );
      expect(level.difficulty.mistakeRisk).toBeGreaterThanOrEqual(
        level.difficulty.target.mistakeRisk!.min,
      );
      expect(level.solutionPath.length).toBeLessThanOrEqual(level.blocks.length);
      expect(generator.findSolvability(level).path).toEqual(level.solutionPath);
    }
  });

  it("锁槽与高压机制组合可搜索替代无道具路径", () => {
    const generator = new LevelGenerator();
    const level = generator.generate({
      levelNumber: 30,
      runSeed: "dog-lege-dog:random-regression:v13-full-a",
      testSeed: "v13-full-a",
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    });

    expect(level.difficulty.solvabilityStatus).toBe("solvable");
    expect(generator.findSolvability(level).path).toEqual(level.solutionPath);
  });

  it("level 16 的已验证路径可被 GameSession 完整执行", () => {
    const generator = new LevelGenerator();
    const level = generator.generate({
      levelNumber: 16,
      runSeed: "dog-lege-dog:random-regression:v13-full-a",
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    });
    const session = new GameSession(level);
    const initialLockedTraySlotCount = session.getState().lockedTraySlotCount;

    let state = session.getState();
    for (const blockId of level.solutionPath) {
      state = session.selectBlock(blockId);
    }

    expect(state.status).toBe("won");
    expect(state.remainingBlocks).toEqual([]);
    expect(initialLockedTraySlotCount).toBeGreaterThan(0);
    expect(initialLockedTraySlotCount).toBe(level.lockedTraySlotCount);
    expect(state.lockedTraySlotCount).toBe(initialLockedTraySlotCount);
  });

  it("相同 runSeed 与操作路径复现磁吸目标序列", () => {
    const generator = new LevelGenerator();
    const level = generator.generate({
      levelNumber: 16,
      runSeed: "v13-operation-path-replay",
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    });
    const replayed = generator.replay(level.generation.replay);
    expect(replayed).toEqual(level);

    const collectMagneticTargets = (candidate: typeof level) => {
      const session = new GameSession(candidate);
      return candidate.solutionPath.flatMap((blockId) => {
        const result = session.selectBlock(blockId);
        return result.magneticResolution === null
          ? []
          : [result.magneticResolution.targetBlockId];
      });
    };

    const firstTargets = collectMagneticTargets(level);
    const replayedTargets = collectMagneticTargets(replayed);
    expect(firstTargets.length).toBeGreaterThan(0);
    expect(replayedTargets).toEqual(firstTargets);
  });

  it("正式乱序关卡的棋盘、回放与乱序事件可按 runSeed 重现", () => {
    const generator = new LevelGenerator({ candidateFilter: () => true });
    const request = {
      levelNumber: 3,
      runSeed: "v13-shuffle-replay-boundary",
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    } as const;
    const level = generator.generate(request);
    const replayed = generator.replay(level.generation.replay);
    const different = generator.generate({
      ...request,
      runSeed: "v13-shuffle-replay-boundary-other",
    });

    const play = (candidate: typeof level, path: readonly string[]) => {
      const session = new GameSession(candidate);
      let state = session.getState();
      for (const blockId of path) {
        state = session.selectBlock(blockId);
      }
      return {
        events: session.getShuffleReplayEvents(),
        status: state.status,
      };
    };

    const triggerPath = findShuffleTriggerPath(level, DOG_V13_CONFIG);
    if (triggerPath === undefined) {
      throw new Error("Expected generated level to expose a shuffle trigger path");
    }
    const firstPlay = play(level, triggerPath);
    const replayedPlay = play(replayed, triggerPath);
    const completedPlay = play(level, level.solutionPath);

    expect(replayed).toEqual(level);
    expect(different).not.toEqual(level);
    expect(firstPlay).toEqual(replayedPlay);
    expect(firstPlay.events).toHaveLength(1);
    expect(completedPlay.status).toBe("won");
  });

});

function countMechanisms(
  blocks: readonly { readonly specialMechanism?: { readonly type: string } }[],
): Record<"freeze" | "illusion" | "magnetic" | "twin" | "shuffle", number> {
  const counts = { freeze: 0, illusion: 0, magnetic: 0, twin: 0, shuffle: 0 };
  for (const block of blocks) {
    const type = block.specialMechanism?.type;
    if (
      type === "freeze" ||
      type === "illusion" ||
      type === "magnetic" ||
      type === "twin" ||
      type === "shuffle"
    ) {
      counts[type] += 1;
    }
  }
  return counts;
}
