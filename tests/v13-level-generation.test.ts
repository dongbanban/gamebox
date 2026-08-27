import { describe, expect, it } from "vitest";
import {
  DOG_V13_CONFIG,
  GameSession,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
  getDogLogicalBlockCount,
  isDifficultyWithinTarget,
  LEVEL_GENERATOR_VERSION,
  LevelGenerator,
} from "@/games/dog-lege-dog";

describe("狗了个狗 v13 关卡生成 seam", () => {
  it("默认生成器使用集中配置版本并兑现首关机制预算", () => {
    const generator = new LevelGenerator();
    const level = generator.generate({
      levelNumber: 1,
      runSeed: "v13-generation-red-test",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });
    const plan = getDogV13MechanismPlan(getDogV13LogicalBlockCount(level.number));
    const counts = countMechanisms(level.blocks);

    expect(LEVEL_GENERATOR_VERSION).toBe(DOG_V13_CONFIG.game.generatorVersion);
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
      generatorVersion: LEVEL_GENERATOR_VERSION,
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
      firstLevel: {
        ...DOG_V13_CONFIG.firstLevel,
        maxLayers: 4,
      },
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
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });

    expect(level.maxLayers).toBe(4);
  });

  it("数字生成 seam 使用传入配置的默认与首关 seed", () => {
    const config = {
      ...DOG_V13_CONFIG,
      game: {
        ...DOG_V13_CONFIG.game,
        defaultSeed: "v13-custom-default-seed",
      },
      firstLevel: {
        ...DOG_V13_CONFIG.firstLevel,
        seed: "v13-custom-first-level-seed",
      },
    };
    const level = new LevelGenerator({ config, candidateFilter: () => true }).generate(1);

    expect(level.runSeed).toBe("v13-custom-default-seed");
    expect(level.seed).toBe("v13-custom-first-level-seed");
  });

  it("覆盖 v13 阶段边界并保持机制计划与无道具可解", () => {
    const generator = new LevelGenerator();
    for (const levelNumber of [1, 6, 16, 31, 99]) {
      const level = generator.generate({
        levelNumber,
        runSeed: `v13-boundary-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
      });
      const plan = getDogV13MechanismPlan(getDogV13LogicalBlockCount(levelNumber));
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
      generatorVersion: LEVEL_GENERATOR_VERSION,
    });

    expect(level.difficulty.solvabilityStatus).toBe("solvable");
    expect(generator.findSolvability(level).path).toEqual(level.solutionPath);
  });

  it("level 16 的已验证路径可被 GameSession 完整执行", () => {
    const generator = new LevelGenerator();
    const level = generator.generate({
      levelNumber: 16,
      runSeed: "dog-lege-dog:random-regression:v13-full-a",
      generatorVersion: LEVEL_GENERATOR_VERSION,
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
      generatorVersion: LEVEL_GENERATOR_VERSION,
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

});

function countMechanisms(
  blocks: readonly { readonly specialMechanism?: { readonly type: string } }[],
): Record<"freeze" | "illusion" | "magnetic" | "twin", number> {
  const counts = { freeze: 0, illusion: 0, magnetic: 0, twin: 0 };
  for (const block of blocks) {
    const type = block.specialMechanism?.type;
    if (type === "freeze" || type === "illusion" || type === "magnetic" || type === "twin") {
      counts[type] += 1;
    }
  }
  return counts;
}
