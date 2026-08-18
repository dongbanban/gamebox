import type { DogDifficultyTarget, DogLevelDifficulty } from "./level-types";

export interface LevelGeneratorRequest {
  readonly levelNumber: number;
  readonly seed: string;
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
}
