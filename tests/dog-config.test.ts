import { describe, expect, it } from "vitest";
import {
  DOG_V13_CONFIG,
  getDogV13DifficultyTarget,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
  getDogV13SpecialMechanismBudget,
} from "@/games/dog-lege-dog/game/v13-config";

describe("狗了个狗 v13 集中配置", () => {
  it("覆盖边界、预算、权重、道具、动画与资源", () => {
    expect(DOG_V13_CONFIG.schemaVersion).toBe(13);
    expect(Object.isFrozen(DOG_V13_CONFIG)).toBe(true);
    expect(DOG_V13_CONFIG).not.toHaveProperty("testProfiles");
    expect(Object.isFrozen(DOG_V13_CONFIG.specialMechanisms.mechanisms)).toBe(true);
    expect(Object.isFrozen(DOG_V13_CONFIG.specialMechanisms.mechanisms[0])).toBe(true);
    expect(Object.isFrozen(DOG_V13_CONFIG.ui.copy.items)).toBe(true);
    expect(DOG_V13_CONFIG.game.maxLevelNumber).toBe(99);
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

    const plans = [90, 108, 126, 144, 162, 180].map((count, index) =>
      getDogV13MechanismPlan(count, DOG_V13_CONFIG, [1, 6, 11, 16, 21, 26][index]),
    );
    expect(plans.map((plan) => plan.logicalUnitCount)).toEqual([27, 32, 37, 43, 48, 54]);
    expect(plans.map((plan) => plan.counts.shuffle)).toEqual([0, 1, 1, 1, 1, 1]);
    expect(plans.every((plan) =>
      plan.counts.freeze > 0 &&
      plan.counts.illusion > 0 &&
      plan.counts.magnetic > 0 &&
      plan.counts.twin > 0,
    )).toBe(true);
    expect(plans.map((plan) => plan.physicalBlockCount)).toEqual([22, 26, 30, 35, 39, 44]);
    expect(DOG_V13_CONFIG.specialMechanisms.mechanisms.map(({ type, logicalUnitWeight }) => [
      type,
      logicalUnitWeight,
    ])).toEqual([
      ["freeze", 1],
      ["illusion", 1],
      ["magnetic", 1],
      ["twin", 2],
      ["shuffle", 1],
    ]);
    expect(DOG_V13_CONFIG.specialMechanisms.mechanisms.map(({ type, operationCost }) => [
      type,
      operationCost,
    ])).toEqual([
      ["freeze", 2],
      ["illusion", 1],
      ["magnetic", 1],
      ["twin", 1],
      ["shuffle", 1],
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
    expect(DOG_V13_CONFIG.board).not.toHaveProperty("logicalCellSize");
    expect(DOG_V13_CONFIG.board).not.toHaveProperty("maxMechanismsPerBlock");
    expect(DOG_V13_CONFIG.levels).not.toHaveProperty("firstLevelNumber");
    expect(DOG_V13_CONFIG.levels).not.toHaveProperty("maxLevelNumber");
    expect(DOG_V13_CONFIG.tray).not.toHaveProperty("lockedSlotPlacement");
    expect(DOG_V13_CONFIG.items).toMatchObject({
      loadoutSize: 3,
      maxSuccessfulUsesPerLevel: 1,
      key: { initialUses: 0 },
    });
    expect(DOG_V13_CONFIG.items).not.toHaveProperty("defaultUsesPerLevel");
    expect(DOG_V13_CONFIG.items.key).not.toHaveProperty("usesCappedByLockedSlots");
    expect(DOG_V13_CONFIG.specialMechanisms).not.toHaveProperty("budgetRounding");
    expect(DOG_V13_CONFIG.specialMechanisms).not.toHaveProperty("remainderStrategy");
    expect(DOG_V13_CONFIG.assets).not.toHaveProperty("music");
    expect(DOG_V13_CONFIG.animation.blockFlightMs).toBeGreaterThan(0);
    expect(DOG_V13_CONFIG.generation).toMatchObject({
      preferWorker: true,
      preGenerateNextLevel: true,
      verifyReplayBeforePublish: true,
    });
    expect(DOG_V13_CONFIG.generation.workerTimeoutMs).toBeGreaterThan(0);
    expect(DOG_V13_CONFIG.assets.patterns["打工狗"]).toContain("01-working-dog.svg");
    expect(getDogV13DifficultyTarget(1)).toMatchObject({
      safeChoiceRate: { min: 0.18, max: 0.28 },
      durationMinutes: { min: 9, max: 10 },
      trayPeakPressure: { min: 0.78, max: 0.98 },
    });
    expect(getDogV13DifficultyTarget(5)).toMatchObject({
      safeChoiceRate: { min: 0.08, max: 0.24 },
      durationMinutes: { min: 9.8, max: 10.8 },
      trayPeakPressure: { min: 0.8, max: 1 },
    });
    expect(getDogV13DifficultyTarget(31)).toMatchObject({
      safeChoiceRate: { min: 0.01, max: 0.18 },
      durationMinutes: { min: 13, max: 16 },
      trayPeakPressure: { min: 0.88, max: 1 },
    });
  });

});
