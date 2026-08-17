import { describe, expect, it } from "vitest";
import {
  LEVEL_GENERATOR_VERSION,
  MAX_LEVEL_GENERATION_ATTEMPTS,
  LevelGenerator,
} from "../src/games/dog-lege-dog";

describe("LevelGenerator 候选筛选失败", () => {
  it("筛选全部失败时保留 replay metadata，并可重放失败候选", () => {
    const generator = new LevelGenerator({
      candidateFilter: () => false,
    });
    const request = {
      levelNumber: 2,
      seed: "qa-filter-failure",
      testSeed: "qa-filter-test-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    } as const;

    const level = generator.generate(request);
    const failure = level.generation.failures[0];

    expect(level.generation.fallbackUsed).toBe(true);
    expect(level.generation.attempts).toBe(MAX_LEVEL_GENERATION_ATTEMPTS);
    expect(level.generation.failures).toHaveLength(MAX_LEVEL_GENERATION_ATTEMPTS);
    expect(failure).toMatchObject({
      levelNumber: request.levelNumber,
      seed: request.seed,
      testSeed: request.testSeed,
      generatorVersion: request.generatorVersion,
    });
    expect(failure).toBeDefined();

    const replayedFailure = generator.replayFailure(failure!);
    expect(replayedFailure).toMatchObject({
      number: request.levelNumber,
      seed: level.seed,
    });
    expect(replayedFailure.blocks).toEqual(
      generator.replayAttempt(failure!).blocks,
    );
    expect(generator.replay(level.generation.replay)).toEqual(level);
  });
});
