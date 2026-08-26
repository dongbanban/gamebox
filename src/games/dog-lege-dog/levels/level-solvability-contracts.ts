import type {
  DogLevelGeometry,
  DogSafeChoiceSearchStatus,
  DogSolvabilityStatus,
  DogSpecialMechanismHandler,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";

export const MAX_SOLVABILITY_SEARCH_BRANCHES = 16 as const;

export interface SolvabilitySearchOptions {
  readonly branchBudget?: number;
  readonly specialMechanismHandlers?: readonly DogSpecialMechanismHandler[];
}

export interface SolvabilityStateOptions extends SolvabilitySearchOptions {
  readonly remainingBlockIds: readonly string[];
  readonly initialTray: readonly DogTrayBlock[];
  readonly trayCapacity?: number;
}

export interface PathVerification {
  readonly status: Exclude<DogSolvabilityStatus, "budget-exhausted">;
  readonly solvable: boolean;
  readonly path: readonly string[];
  readonly trayPeakPressure: number;
  readonly reason?: string;
}

export interface SolvabilityResult {
  readonly status: DogSolvabilityStatus;
  readonly path: readonly string[];
  readonly trayPeakPressure: number;
  readonly reason?: string;
}

export interface SafeChoiceMetrics {
  readonly safeChoiceCount: number;
  readonly searchStatus: DogSafeChoiceSearchStatus;
}

export interface SolvabilitySearchContext {
  readonly completedStates: Map<string, SolvabilityMemoEntry>;
  readonly branchBudget: number;
  branchAttempts: number;
}

export interface SolvabilityMemoEntry {
  readonly status: "solvable" | "unsolvable";
  readonly path: readonly string[];
  readonly trayPeakPressure: number;
}

export function createSolvabilityResult(
  status: DogSolvabilityStatus,
  path: readonly string[],
  trayPeakPressure: number,
  reason?: string,
): SolvabilityResult {
  return {
    status,
    path,
    trayPeakPressure,
    reason,
  };
}

export function resolveBranchBudget(options: SolvabilitySearchOptions): number {
  if (options.branchBudget === undefined) {
    return MAX_SOLVABILITY_SEARCH_BRANCHES;
  }

  if (!Number.isSafeInteger(options.branchBudget) || options.branchBudget < 0) {
    throw new Error("solvability search branch budget must be a non-negative integer");
  }

  return options.branchBudget;
}

export function createFullBlockMask(blockCount: number): bigint {
  return (1n << BigInt(blockCount)) - 1n;
}

export function blockMask(blockIndex: number): bigint {
  return 1n << BigInt(blockIndex);
}

export function countBits(value: bigint): number {
  let remaining = value;
  let count = 0;
  while (remaining !== 0n) {
    remaining &= remaining - 1n;
    count += 1;
  }
  return count;
}
