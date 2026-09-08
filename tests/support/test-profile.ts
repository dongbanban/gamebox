import DOG_TEST_PROFILES from "../../scripts/v13-test-profiles.json";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config";

export type DogV13TestProfileName = keyof typeof DOG_TEST_PROFILES.profiles;
export type DogV13TestProfile = (typeof DOG_TEST_PROFILES.profiles)[DogV13TestProfileName];

export interface DogGenerationTestCase {
  readonly testSeed: string;
  readonly runSeed: string;
  readonly levelNumber: number;
  readonly generatorVersion: number;
  readonly levelSeed?: string;
}

export function resolveDogTestProfileName(rawProfile: string | undefined): DogV13TestProfileName {
  const profileName = rawProfile ?? DOG_TEST_PROFILES.default;
  if (Object.hasOwn(DOG_TEST_PROFILES.profiles, profileName)) {
    return profileName as DogV13TestProfileName;
  }
  throw new Error(`未知狗了个狗测试 profile: ${profileName}`);
}

export function getDogTestProfile(profileName?: string): DogV13TestProfile {
  const resolvedName = resolveDogTestProfileName(profileName);
  const profile = DOG_TEST_PROFILES.profiles[resolvedName];
  if (profile === undefined) throw new Error(`狗了个狗 test profile has no data: ${resolvedName}`);
  return profile;
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
    generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
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
