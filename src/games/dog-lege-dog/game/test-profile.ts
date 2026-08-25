import {
  DOG_V13_CONFIG,
  LEVEL_GENERATOR_VERSION,
  getDogTestProfile,
  type DogV13TestProfileName,
} from "@/games/dog-lege-dog/game/game-config";

export interface DogGenerationTestCase {
  readonly testSeed: string;
  readonly runSeed: string;
  readonly levelNumber: number;
  readonly generatorVersion: number;
  readonly levelSeed?: string;
}

export function createDogGenerationTestCase(
  profileName: DogV13TestProfileName,
  levelNumber: number,
  seedIndex = 0,
): DogGenerationTestCase {
  const profile = getDogTestProfile(profileName);
  if (profile.fixedSeeds.length === 0) {
    throw new Error(`狗了个狗 test profile has no fixed seed: ${profileName}`);
  }
  const normalizedSeedIndex = Math.abs(seedIndex) % profile.fixedSeeds.length;
  const testSeed = profile.fixedSeeds[normalizedSeedIndex]!;
  return {
    testSeed,
    runSeed: `${DOG_V13_CONFIG.game.id}:${profileName}:${testSeed}:level-${levelNumber}`,
    levelNumber,
    generatorVersion: LEVEL_GENERATOR_VERSION,
  };
}

export function formatDogGenerationTestReport(
  testCase: DogGenerationTestCase,
): string {
  return [
    `testSeed=${testCase.testSeed}`,
    `runSeed=${testCase.runSeed}`,
    `levelNumber=${testCase.levelNumber}`,
    `generatorVersion=${testCase.generatorVersion}`,
    ...(testCase.levelSeed === undefined ? [] : [`levelSeed=${testCase.levelSeed}`]),
    `replay=DOG_RANDOM_TEST_SEED=${testCase.testSeed} DOG_RANDOM_RUN_SEED=${testCase.runSeed} DOG_RANDOM_LEVEL_NUMBER=${testCase.levelNumber} pnpm test:random`,
  ].join("\n");
}
