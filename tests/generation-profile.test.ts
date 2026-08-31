import { describe, expect, it } from "vitest";
import {
  DOG_V13_CONFIG,
  getDogTestProfile,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
  getDogV13SpecialMechanismBudget,
  type DogV13TestProfileName,
  LevelGenerator,
  createDogGenerationTestCase,
  formatDogGenerationTestReport,
} from "@/games/dog-lege-dog";

const profileName = readProfileName(process.env.DOG_TEST_PROFILE);
const profile = getDogTestProfile(profileName);

describe(`狗了个狗 ${profileName} generation profile`, () => {
  it("覆盖配置声明关卡，机制预算保持 floor(N × 0.30)", () => {
    const expectedBudgets = new Map([
      [1, 27],
      [6, 32],
      [16, 43],
      [31, 54],
      [99, 54],
    ]);

    for (const [index, levelNumber] of profile.levelNumbers.entries()) {
      const logicalBlockCount = getDogV13LogicalBlockCount(levelNumber);
      const budget = getDogV13SpecialMechanismBudget(logicalBlockCount);
      const plan = getDogV13MechanismPlan(logicalBlockCount, DOG_V13_CONFIG, levelNumber);
      const expectedBudget = expectedBudgets.get(levelNumber);

      if (expectedBudget !== undefined) {
        expect(budget, `level=${levelNumber}`).toBe(expectedBudget);
      }
      expect(plan.logicalUnitCount, `level=${levelNumber}`).toBe(budget);
      expect(plan.logicalUnitCount).toBeLessThanOrEqual(logicalBlockCount * 0.3);
      expect(
        plan.counts.freeze > 0 &&
          plan.counts.illusion > 0 &&
          plan.counts.magnetic > 0 &&
          plan.counts.twin > 0,
        `level=${levelNumber}`,
      ).toBe(true);
      expect(
        plan.counts.twin * 2 +
          plan.counts.freeze +
          plan.counts.illusion +
          plan.counts.magnetic +
          plan.counts.shuffle,
        `level=${levelNumber}`,
      ).toBe(plan.logicalUnitCount);

      const testCase = createDogGenerationTestCase(profileName, levelNumber, index);
      expect(formatDogGenerationTestReport(testCase)).toContain(`runSeed=${testCase.runSeed}`);
    }

    const boundaryPlans = [1, 6, 16, 31].map((levelNumber) =>
      getDogV13MechanismPlan(
        getDogV13LogicalBlockCount(levelNumber),
        DOG_V13_CONFIG,
        levelNumber,
      ),
    );
    for (const type of ["freeze", "illusion", "magnetic", "twin"] as const) {
      const counts = boundaryPlans.map((plan) => plan.counts[type]);
      expect(counts.every((count, index) => index === 0 || count >= counts[index - 1]!)).toBe(true);
      expect(counts.at(-1)).toBeGreaterThan(counts[0]!);
    }
  });

  it("生成 profile 关卡并保留完整 replay metadata", () => {
    const generator = new LevelGenerator();
    for (const [index, levelNumber] of profile.levelNumbers.entries()) {
      const testCase = createDogGenerationTestCase(profileName, levelNumber, index);
      const level = generator.generate({
        levelNumber: testCase.levelNumber,
        runSeed: testCase.runSeed,
        testSeed: testCase.testSeed,
        generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
      });

      expect(level.generation.replay).toMatchObject({
        testSeed: testCase.testSeed,
        runSeed: testCase.runSeed,
        levelNumber,
        generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
        accepted: true,
      });
      expect(level.generation.replay.randomSeed).toBeTruthy();
      expect(level.generation.failures.every((failure) =>
        failure.testSeed === testCase.testSeed &&
        failure.runSeed === testCase.runSeed &&
        failure.levelNumber === levelNumber &&
        failure.generatorVersion === DOG_V13_CONFIG.game.generatorVersion,
      )).toBe(true);
    }
  });

  it("fallback profile 保留失败诊断与可重放入口", () => {
    const testCase = createDogGenerationTestCase(profileName, profile.levelNumbers[0] ?? 1);
    const generator = new LevelGenerator({ candidateFilter: () => false });
    const level = generator.generate({
      levelNumber: testCase.levelNumber,
      runSeed: testCase.runSeed,
      testSeed: testCase.testSeed,
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    });

    expect(level.generation.fallbackUsed).toBe(true);
    expect(level.difficulty.withinTarget).toBe(true);
    expect(level.generation.failures[0]).toMatchObject({
      testSeed: testCase.testSeed,
      runSeed: testCase.runSeed,
      levelNumber: testCase.levelNumber,
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    });
  });
});

function readProfileName(rawProfile: string | undefined): DogV13TestProfileName {
  if (rawProfile === undefined) {
    return DOG_V13_CONFIG.testProfiles.default;
  }
  if (rawProfile === "focused" || rawProfile === "smoke" || rawProfile === "full") {
    return rawProfile;
  }
  throw new Error(`未知狗了个狗测试 profile: ${rawProfile}`);
}
