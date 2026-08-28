// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  DOG_V13_CONFIG,
  DogV13ConfigError,
  getDogV13DifficultyTarget,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
  getDogV13SpecialMechanismBudget,
  getDogTestProfile,
  loadDogV13Config,
  selectDogTestProfile,
} from "@/games/dog-lege-dog/game/v13-config";
import { LevelGenerator } from "@/games/dog-lege-dog/levels/level-generation-engine";
import { createDogLegeDogGame } from "@/games/dog-lege-dog/game/game-controller";

describe("狗了个狗 v13 集中配置", () => {
  it("覆盖边界、预算、权重、道具、动画、资源与测试 profile", () => {
    expect(DOG_V13_CONFIG.schemaVersion).toBe(13);
    expect(Object.isFrozen(DOG_V13_CONFIG)).toBe(true);
    expect(Object.isFrozen(DOG_V13_CONFIG.specialMechanisms.mechanisms)).toBe(true);
    expect(DOG_V13_CONFIG.levels.maxLevelNumber).toBe(99);
    expect([1, 5, 6, 15, 16, 30, 31, 99].map((levelNumber) => getDogV13LogicalBlockCount(levelNumber))).toEqual([
      90,
      90,
      108,
      126,
      144,
      180,
      180,
      180,
    ]);
    expect([90, 108, 126, 144, 162, 180].map((count) => getDogV13SpecialMechanismBudget(count))).toEqual([
      27,
      32,
      37,
      43,
      48,
      54,
    ]);

    const plans = [90, 108, 126, 144, 162, 180].map((count) => getDogV13MechanismPlan(count));
    expect(plans.map((plan) => plan.logicalUnitCount)).toEqual([27, 32, 37, 43, 48, 54]);
    expect(plans.every((plan) =>
      plan.counts.freeze > 0 &&
      plan.counts.illusion > 0 &&
      plan.counts.magnetic > 0 &&
      plan.counts.twin > 0,
    )).toBe(true);
    expect(plans.map((plan) => plan.physicalBlockCount)).toEqual([22, 26, 30, 35, 39, 44]);
    expect(DOG_V13_CONFIG.specialMechanisms.remainderStrategy).toBe("stable-round-robin");
    expect(DOG_V13_CONFIG.specialMechanisms.mechanisms.map(({ type, logicalUnitWeight }) => [
      type,
      logicalUnitWeight,
    ])).toEqual([
      ["freeze", 1],
      ["illusion", 1],
      ["magnetic", 1],
      ["twin", 2],
    ]);
    expect(DOG_V13_CONFIG.specialMechanisms.mechanisms.map(({ type, operationCost }) => [
      type,
      operationCost,
    ])).toEqual([
      ["freeze", 2],
      ["illusion", 1],
      ["magnetic", 1],
      ["twin", 1],
    ]);
    expect(DOG_V13_CONFIG.difficulty.scoring).toMatchObject({
      trayPressure: { occupancyWeight: 0.88, choicePressureWeight: 0.12 },
      operationCost: { magneticTargetWeight: 1 },
      duration: { operationCostWeight: 0.2, lockWeight: 0.15 },
      mistakeRisk: {
        base: 0.15,
        choiceWeight: 0.35,
        trayPressureWeight: 0.25,
        operationCostWeight: 0.15,
        lockWeight: 0.1,
      },
    });

    expect(DOG_V13_CONFIG.tray).toMatchObject({
      baseCapacity: 7,
      maxCapacity: 8,
      maxLockedSlotCount: 2,
    });
    expect(DOG_V13_CONFIG.items).toMatchObject({
      loadoutSize: 3,
      maxSuccessfulUsesPerLevel: 1,
      key: { initialUses: 0, usesCappedByLockedSlots: true },
    });
    expect(DOG_V13_CONFIG.animation.blockFlightMs).toBeGreaterThan(0);
    expect(DOG_V13_CONFIG.generation).toMatchObject({
      preferWorker: true,
      preGenerateNextLevel: true,
      verifyReplayBeforePublish: true,
    });
    expect(DOG_V13_CONFIG.generation.workerTimeoutMs).toBeGreaterThan(0);
    expect(DOG_V13_CONFIG.assets.patterns["打工狗"]).toContain("01-working-dog.svg");
    expect(getDogTestProfile("smoke")).toMatchObject({
      levelNumbers: [1, 6, 16, 31, 99],
      fixedSeeds: ["v13-smoke-a", "v13-smoke-b"],
      randomLevelPrefix: 5,
      stressLevelCount: 5,
      runWorkerFallback: true,
    });
    expect(getDogTestProfile("full")).toMatchObject({
      randomLevelPrefix: 99,
      stressLevelCount: 99,
      runCrossBrowser: true,
      runDiffCheck: true,
      runFileLineCheck: true,
      maxChangedFileLines: 500,
    });
    expect(DOG_V13_CONFIG.testProfiles.selection.fullAreas).toContain("generator");
    expect(DOG_V13_CONFIG.testProfiles.selection.smokeAreas).toEqual(["random-regression"]);
    expect(getDogV13DifficultyTarget(1)).toMatchObject({
      safeChoiceRate: { min: 0.18, max: 0.28 },
      durationMinutes: { min: 9, max: 10 },
      trayPeakPressure: { min: 0.78, max: 0.98 },
    });
    expect(getDogV13DifficultyTarget(5)).toMatchObject({
      safeChoiceRate: { min: 0.16, max: 0.24 },
      durationMinutes: { min: 9.8, max: 10.8 },
      trayPeakPressure: { min: 0.8, max: 0.99 },
    });
    expect(getDogV13DifficultyTarget(31)).toMatchObject({
      safeChoiceRate: { min: 0.09, max: 0.18 },
      durationMinutes: { min: 13, max: 16 },
      trayPeakPressure: { min: 0.88, max: 0.99 },
    });
  });

  it("配置错误提供路径、类别与消息，并阻止配置加载", () => {
    const invalid = {
      ...DOG_V13_CONFIG,
      levels: {
        ...DOG_V13_CONFIG.levels,
        maxLevelNumber: 0,
      },
      tray: {
        ...DOG_V13_CONFIG.tray,
        baseCapacity: 0,
      },
      generation: {
        ...DOG_V13_CONFIG.generation,
        workerTimeoutMs: 0,
      },
    };

    expect(() => loadDogV13Config(invalid)).toThrow(DogV13ConfigError);
    try {
      loadDogV13Config(invalid);
      throw new Error("expected config validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DogV13ConfigError);
      const configError = error as DogV13ConfigError;
      expect(configError.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          "levels.maxLevelNumber",
          "tray.baseCapacity",
          "generation.workerTimeoutMs",
        ]),
      );
      expect(configError.message).toContain("levels.maxLevelNumber");
      expect(configError.message).toContain("tray.baseCapacity");
      expect(configError.message).toContain("generation.workerTimeoutMs");
    }
  });

  it("拒绝缺失 item 资源与反向关卡区间", () => {
    const assetsWithoutKey = Object.fromEntries(
      Object.entries(DOG_V13_CONFIG.assets.items).filter(([itemId]) => itemId !== "key"),
    );
    const invalid = {
      ...DOG_V13_CONFIG,
      assets: {
        ...DOG_V13_CONFIG.assets,
        items: assetsWithoutKey,
      },
      levels: {
        ...DOG_V13_CONFIG.levels,
        structureStages: DOG_V13_CONFIG.levels.structureStages.map((stage, index) =>
          index === 0 ? { ...stage, minLevel: 2, maxLevel: 1 } : stage,
        ),
      },
      difficulty: {
        ...DOG_V13_CONFIG.difficulty,
        targets: DOG_V13_CONFIG.difficulty.targets.map((target, index) =>
          index === 0 ? { ...target, minLevel: 2, maxLevel: 1 } : target,
        ),
      },
    };

    expect(() => loadDogV13Config(invalid)).toThrow(DogV13ConfigError);
    try {
      loadDogV13Config(invalid);
      throw new Error("expected config validation to fail");
    } catch (error) {
      const configError = error as DogV13ConfigError;
      expect(configError.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          "assets.items.key",
          "levels.structureStages[0].maxLevel",
          "difficulty.targets[0].maxLevel",
        ]),
      );
    }
  });

  it("拒绝越界难度值与不完整道具集合", () => {
    const invalid = {
      ...DOG_V13_CONFIG,
      items: {
        ...DOG_V13_CONFIG.items,
        ids: DOG_V13_CONFIG.items.ids.slice(0, 2),
        loadoutSize: 8,
      },
      difficulty: {
        ...DOG_V13_CONFIG.difficulty,
        targets: DOG_V13_CONFIG.difficulty.targets.map((target, index) =>
          index === 0
            ? {
                ...target,
                safeChoiceCount: { min: 1.5, max: 2 },
                safeChoiceRate: { min: 0, max: 2 },
                mistakeRisk: { min: 0, max: 1.5 },
              }
            : target,
        ),
        scoring: {
          ...DOG_V13_CONFIG.difficulty.scoring,
          mistakeRisk: {
            ...DOG_V13_CONFIG.difficulty.scoring.mistakeRisk,
            base: 1.5,
          },
        },
      },
    };

    expect(() => loadDogV13Config(invalid)).toThrow(DogV13ConfigError);
    try {
      loadDogV13Config(invalid);
      throw new Error("expected config validation to fail");
    } catch (error) {
      const configError = error as DogV13ConfigError;
      expect(configError.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          "items.ids",
          "items.loadoutSize",
          "difficulty.targets[0].safeChoiceCount.min",
          "difficulty.targets[0].safeChoiceRate.max",
          "difficulty.targets[0].mistakeRisk.max",
          "difficulty.scoring.mistakeRisk.base",
        ]),
      );
    }
  });

  it("profile 选择可供生成器、启动与 QA 共用", () => {
    expect(selectDogTestProfile("ui")).toBe("focused");
    expect(selectDogTestProfile("runtime")).toBe("full");
    expect(selectDogTestProfile(["game-startup", "generator"])).toBe("full");
    expect(selectDogTestProfile("random-regression")).toBe("smoke");
    expect(selectDogTestProfile("docs")).toBe("focused");
  });

  it("生成器在候选棋盘前拒绝无效配置", () => {
    const invalid = {
      ...DOG_V13_CONFIG,
      specialMechanisms: {
        ...DOG_V13_CONFIG.specialMechanisms,
        logicalBudgetRatio: 1.2,
      },
    };

    expect(() => new LevelGenerator({ config: invalid })).toThrow(DogV13ConfigError);
  });

  it("游戏启动在展示棋盘前拒绝无效配置", () => {
    const invalid = {
      ...DOG_V13_CONFIG,
      tray: {
        ...DOG_V13_CONFIG.tray,
        maxCapacity: 6,
      },
    };

    expect(() => createDogLegeDogGame(document.createElement("div"), { config: invalid }))
      .toThrow(DogV13ConfigError);
  });
});
