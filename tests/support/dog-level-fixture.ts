import { getDogLegeDogLevel } from "@/games/dog-lege-dog";

export const TEST_RUN_SEED = "fixture-1";
export const TEST_PATTERN_TYPES = [
  "打工狗",
  "单身狗",
  "舔狗",
  "看门狗",
  "疯狗",
  "拆家狗",
] as const;
export const TEST_LEVEL = getDogLegeDogLevel(1, TEST_RUN_SEED);
