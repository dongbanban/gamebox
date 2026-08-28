import {
  consumeDogShuffleBlock,
  getDogTrayLogicalUnitCount,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import {
  resolveDogTrayMatches,
} from "@/games/dog-lege-dog/levels/level-rules";
import { findSolvabilityFromState } from "@/games/dog-lege-dog/levels/level-solvability";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import { cloneDogTrayBlock } from "@/games/dog-lege-dog/levels/level-tray-block";
import type {
  DogLevelGeometry,
  DogSpecialMechanismHandler,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";

export interface DogShuffleResolutionComputation {
  readonly triggerBlockId: string;
  readonly outcome: "reordered" | "stable";
  readonly candidateCount: number;
  readonly uniqueCandidateCount: number;
  readonly safeCandidateCount: number;
  readonly selectedCandidateIndex: number | null;
  readonly randomSeed: string;
  readonly beforeTrayBlocks: readonly DogTrayBlock[];
  readonly afterTrayBlocks: readonly DogTrayBlock[];
  readonly secondaryRemovedBlockIds: readonly string[];
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
}

export interface DogShuffleResolutionOptions {
  readonly level: DogLevelGeometry;
  readonly config: DogV13Config;
  readonly tray: readonly DogTrayBlock[];
  readonly triggerBlockId: string;
  readonly remainingBlockIds: readonly string[];
  readonly effectiveTrayCapacity: number;
  readonly handlers: ReadonlyMap<string, DogSpecialMechanismHandler>;
  readonly magneticRandom: SeededRandom;
  readonly sequence: number;
}

export function resolveDogSafeShuffle(
  options: DogShuffleResolutionOptions,
): DogShuffleResolutionComputation {
  const beforeTrayBlocks = Object.freeze(options.tray.map(cloneDogTrayBlock));
  const consumedTray = Object.freeze(
    beforeTrayBlocks.map((block) =>
      block.id === options.triggerBlockId
        ? cloneDogTrayBlock(consumeDogShuffleBlock(block))
        : cloneDogTrayBlock(block),
    ),
  );
  const randomSeed = createDogShuffleRandomSeed(options);
  const random = new SeededRandom(randomSeed);
  const candidates = createCandidatePermutations(
    consumedTray,
    options.config.specialMechanisms.shuffle.candidateCount,
    random,
  );
  const safeCandidates: CandidateResolution[] = [];

  for (const candidate of candidates) {
    const resolvedTray = candidate.tray.map(cloneDogTrayBlock);
    const resolution = resolveDogTrayMatches(
      resolvedTray,
      options.handlers,
      { allowFrozenFinalTriple: options.remainingBlockIds.length === 0 },
    );
    if (getDogTrayLogicalUnitCount(resolvedTray) > options.effectiveTrayCapacity) {
      continue;
    }

    const solvability = findSolvabilityFromState(options.level, {
      remainingBlockIds: options.remainingBlockIds,
      initialTray: resolvedTray,
      trayCapacity: options.effectiveTrayCapacity,
      branchBudget: Math.max(256, options.remainingBlockIds.length * 8),
      specialMechanismHandlers: [...options.handlers.values()],
      magneticRandom: options.magneticRandom.clone(),
    });
    if (solvability.status !== "solvable") {
      continue;
    }

    safeCandidates.push({
      ...candidate,
      tray: Object.freeze(resolvedTray.map(cloneDogTrayBlock)),
      removedCount: resolution.removedCount,
      tripleCount: resolution.tripleCount,
      meltedBlockIds: Object.freeze([...resolution.meltedBlockIds]),
    });
  }

  const selectedCandidate = safeCandidates.length === 0
    ? undefined
    : safeCandidates[random.nextInt(safeCandidates.length)];
  if (selectedCandidate === undefined) {
    return createStableShuffleResolution(
      options,
      randomSeed,
      beforeTrayBlocks,
      consumedTray,
      candidates.length,
    );
  }

  const afterTrayBlocks = Object.freeze(selectedCandidate.tray.map(cloneDogTrayBlock));
  return Object.freeze({
    triggerBlockId: options.triggerBlockId,
    outcome: "reordered",
    candidateCount: options.config.specialMechanisms.shuffle.candidateCount,
    uniqueCandidateCount: candidates.length,
    safeCandidateCount: safeCandidates.length,
    selectedCandidateIndex: selectedCandidate.index,
    randomSeed,
    beforeTrayBlocks,
    afterTrayBlocks,
    secondaryRemovedBlockIds: Object.freeze(getRemovedBlockIds(beforeTrayBlocks, afterTrayBlocks)),
    removedCount: selectedCandidate.removedCount,
    tripleCount: selectedCandidate.tripleCount,
    meltedBlockIds: selectedCandidate.meltedBlockIds,
  });
}

interface CandidatePermutation {
  readonly index: number;
  readonly tray: readonly DogTrayBlock[];
}

interface CandidateResolution extends CandidatePermutation {
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
}

function createStableShuffleResolution(
  options: DogShuffleResolutionOptions,
  randomSeed: string,
  beforeTrayBlocks: readonly DogTrayBlock[],
  consumedTray: readonly DogTrayBlock[],
  uniqueCandidateCount: number,
): DogShuffleResolutionComputation {
  return Object.freeze({
    triggerBlockId: options.triggerBlockId,
    outcome: "stable",
    candidateCount: options.config.specialMechanisms.shuffle.candidateCount,
    uniqueCandidateCount,
    safeCandidateCount: 0,
    selectedCandidateIndex: null,
    randomSeed,
    beforeTrayBlocks,
    afterTrayBlocks: Object.freeze(consumedTray.map(cloneDogTrayBlock)),
    secondaryRemovedBlockIds: Object.freeze([]),
    removedCount: 0,
    tripleCount: 0,
    meltedBlockIds: Object.freeze([]),
  });
}

function createCandidatePermutations(
  tray: readonly DogTrayBlock[],
  candidateCount: number,
  random: SeededRandom,
): CandidatePermutation[] {
  const candidates: CandidatePermutation[] = [];
  const seen = new Set<string>([serializeTray(tray)]);
  const maxAttempts = Math.max(candidateCount * 32, 32);
  let attempts = 0;
  while (candidates.length < candidateCount && attempts < maxAttempts) {
    attempts += 1;
    const candidate = random.shuffle(tray.map(cloneDogTrayBlock));
    const signature = serializeTray(candidate);
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    candidates.push({ index: candidates.length, tray: Object.freeze(candidate) });
  }

  for (let offset = 1; candidates.length < candidateCount && offset < tray.length; offset += 1) {
    const candidate = [
      ...tray.slice(offset),
      ...tray.slice(0, offset),
    ].map(cloneDogTrayBlock);
    const signature = serializeTray(candidate);
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    candidates.push({ index: candidates.length, tray: Object.freeze(candidate) });
  }

  return candidates;
}

function createDogShuffleRandomSeed(options: DogShuffleResolutionOptions): string {
  const runSeed = options.level.runSeed ?? `level-${options.level.number}`;
  const generatorVersion = options.level.generatorVersion ?? options.config.game.generatorVersion;
  return `${runSeed}:shuffle:v${generatorVersion}:trigger-${options.sequence}`;
}

function getRemovedBlockIds(
  beforeTrayBlocks: readonly DogTrayBlock[],
  afterTrayBlocks: readonly DogTrayBlock[],
): string[] {
  const afterIds = new Set(afterTrayBlocks.map((block) => block.id));
  return beforeTrayBlocks
    .filter((block) => !afterIds.has(block.id))
    .map((block) => block.id);
}

function serializeTray(tray: readonly DogTrayBlock[]): string {
  return tray.map((block) => [
    block.id,
    block.patternType,
    block.visualMarker ?? "",
    block.specialMechanism?.type ?? "",
    ...Object.entries(block.specialMechanism?.state ?? {})
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
      .map(([key, value]) => `${key}=${String(value)}`),
  ].join("|")).join(",");
}
