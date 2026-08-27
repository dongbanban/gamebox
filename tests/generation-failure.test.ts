import { describe, expect, it } from "vitest";
import {
  DOG_V13_CONFIG,
  MAX_LEVEL_GENERATION_ATTEMPTS,
  LevelGenerator,
} from "@/games/dog-lege-dog";

describe("LevelGenerator 候选筛选失败", () => {
  it("筛选全部失败时保留 replay metadata，并可重放失败候选", () => {
    const generator = new LevelGenerator({
      candidateFilter: () => false,
    });
    const request = {
      levelNumber: 2,
      runSeed: "qa-filter-failure",
      testSeed: "qa-filter-test-seed",
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
    } as const;

    const level = generator.generate(request);
    const failure = level.generation.failures[0];

    expect(level.generation.fallbackUsed).toBe(true);
    expect(level.generation.attempts).toBe(MAX_LEVEL_GENERATION_ATTEMPTS);
    expect(level.difficulty.safeChoiceCount).toBeGreaterThanOrEqual(
      level.difficulty.target.safeChoiceCount.min,
    );
    expect(level.difficulty.safeChoiceRate).toBeGreaterThanOrEqual(
      level.difficulty.target.safeChoiceRate?.min ?? 0,
    );
    expect(level.difficulty.estimatedDurationMinutes).toBeGreaterThanOrEqual(
      level.difficulty.target.durationMinutes.min,
    );
    expect(level.difficulty.withinTarget).toBe(true);
    expect(level.generation.failures).toHaveLength(MAX_LEVEL_GENERATION_ATTEMPTS);
    expect(failure).toMatchObject({
      levelNumber: request.levelNumber,
      runSeed: request.runSeed,
      testSeed: request.testSeed,
      generatorVersion: request.generatorVersion,
    });
    expect(failure).toBeDefined();

    const replayedFailure = generator.replayAttempt(failure!);
    expect(replayedFailure).toMatchObject({
      number: request.levelNumber,
      seed: level.seed,
      runSeed: request.runSeed,
    });
    expect(replayedFailure.generation.replay).toMatchObject({
      attempt: failure!.attempt,
      randomSeed: failure!.randomSeed,
      testSeed: request.testSeed,
    });
    expect(replayedFailure.blocks).toEqual(
      generator.replayAttempt(failure!).blocks,
    );
    expect(generator.replay(level.generation.replay)).toEqual(level);
  });
});
