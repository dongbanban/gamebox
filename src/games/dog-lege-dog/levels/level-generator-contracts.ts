import type { DogDifficultyTarget, DogLevelDifficulty } from "@/games/dog-lege-dog/levels/level-types";

export interface LevelGeneratorRequest {
  readonly levelNumber: number;
  readonly testSeed?: string;
  readonly runSeed: string;
  readonly generatorVersion?: number;
}

export interface NormalizedLevelGeneratorRequest {
  readonly levelNumber: number;
  readonly runSeed: string;
  readonly testSeed?: string;
  readonly generatorVersion: number;
}

/** Candidate acceptance seam for regression tests and generator diagnostics. */
export type LevelCandidateFilter = (
  difficulty: DogLevelDifficulty,
  target: DogDifficultyTarget,
  attempt: number,
) => boolean;

export interface LevelGeneratorOptions {
  readonly gameId?: string;
  readonly candidateFilter?: LevelCandidateFilter;
  /** Optional validated-config seam for generator and QA profile callers. */
  readonly config?: unknown;
}
