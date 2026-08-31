import {
  createDogSpecialMechanismHandlerMap,
  createDogSpecialMechanismHandlers,
  consumeDogShuffleBlock,
  getDogTrayLogicalUnitCount,
  armDogShuffleBlock,
  getDogShuffleMechanismStatus,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import {
  DOG_V13_CONFIG,
  getDogShuffleThreshold,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import {
  resolveDogTrayMatches,
} from "@/games/dog-lege-dog/levels/level-rules";
import { findSolvabilityFromState } from "@/games/dog-lege-dog/levels/level-solvability";
import { createBlockGraph, type BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import {
  createFullBlockMask,
  blockMask,
} from "@/games/dog-lege-dog/levels/level-solvability-contracts";
import {
  getSelectableBlocks,
  sortSelectableBlocks,
  stateKeyFor,
} from "@/games/dog-lege-dog/levels/level-solvability-simulation";
import {
  createDogMagneticRandom,
  resolveDogSelection,
} from "@/games/dog-lege-dog/levels/level-mechanism-resolution";
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

export type DogShuffleStateResolutionOptions = Omit<
  DogShuffleResolutionOptions,
  "triggerBlockId"
>;

export interface DogShuffleStateResolution {
  readonly tray: readonly DogTrayBlock[];
  readonly computation: DogShuffleResolutionComputation | null;
}

const SHUFFLE_TRIGGER_SEARCH_BRANCH_BUDGET = 512 as const;

export function findShuffleTriggerPath(
  level: DogLevelGeometry,
  config: DogV13Config = DOG_V13_CONFIG,
): readonly string[] | undefined {
  const handlers = createDogSpecialMechanismHandlerMap(
    createDogSpecialMechanismHandlers(config),
  );
  const graph = createBlockGraph(level.blocks);
  const preferredRank = new Map<number, number>();
  (level.solutionPath ?? []).forEach((blockId, rank) => {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex !== undefined) {
      preferredRank.set(blockIndex, rank);
    }
  });
  const effectiveTrayCapacity = config.tray.baseCapacity - (level.lockedTraySlotCount ?? 0);
  const directPath = findDirectShuffleTriggerPath(
    level,
    config,
    graph,
    effectiveTrayCapacity,
  );
  if (directPath !== undefined) {
    return directPath;
  }
  const visited = new Set<string>();
  let branchAttempts = 0;

  const search = (
    remainingMask: bigint,
    higherBlockCounts: readonly number[],
    tray: readonly DogTrayBlock[],
    magneticRandom: SeededRandom,
    path: readonly string[],
  ): readonly string[] | undefined => {
    if (remainingMask === 0n || branchAttempts >= SHUFFLE_TRIGGER_SEARCH_BRANCH_BUDGET) {
      return undefined;
    }
    const stateKey = stateKeyFor(remainingMask, tray, magneticRandom);
    if (visited.has(stateKey)) {
      return undefined;
    }
    visited.add(stateKey);

    const selectable = getSelectableBlocks(level, remainingMask, higherBlockCounts);
    sortSelectableBlocks(selectable, level, tray, handlers, preferredRank);
    for (const selectedIndex of selectable) {
      branchAttempts += 1;
      const nextMagneticRandom = magneticRandom.clone();
      const resolution = resolveDogSelection(
        level,
        selectedIndex,
        remainingMask,
        higherBlockCounts,
        tray,
        handlers,
        nextMagneticRandom,
        graph,
      );
      const nextPath = [...path, level.blocks[selectedIndex]!.id];
      const nextTray = resolution.tray.map(armDogShuffleBlock);
      if (
        getDogTrayLogicalUnitCount(nextTray) >= getDogShuffleThreshold(effectiveTrayCapacity, config) &&
        nextTray.some((block) => {
          const status = getDogShuffleMechanismStatus(block.specialMechanism);
          return status === "armed" || status === "triggerable";
        })
      ) {
        return nextPath;
      }
      if (getDogTrayLogicalUnitCount(nextTray) > effectiveTrayCapacity) {
        continue;
      }
      const nextHigherBlockCounts = [...higherBlockCounts];
      nextHigherBlockCounts.splice(0, nextHigherBlockCounts.length, ...resolution.higherBlockCounts);
      const result = search(
        resolution.remainingMask,
        nextHigherBlockCounts,
        [...nextTray],
        nextMagneticRandom,
        nextPath,
      );
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  };

  return search(
    createFullBlockMask(level.blocks.length),
    [...graph.higherBlockCounts],
    [],
    createDogMagneticRandom(level),
    [],
  );
}

function findDirectShuffleTriggerPath(
  level: DogLevelGeometry,
  config: DogV13Config,
  graph: BlockGraph,
  effectiveTrayCapacity: number,
): readonly string[] | undefined {
  const shuffleIndex = level.blocks.findIndex(
    (block) => block.specialMechanism?.type === "shuffle",
  );
  if (shuffleIndex < 0) {
    return undefined;
  }

  const handlers = createDogSpecialMechanismHandlerMap(
    createDogSpecialMechanismHandlers(config),
  );
  const magneticRandom = createDogMagneticRandom(level);
  let remainingMask = createFullBlockMask(level.blocks.length);
  let higherBlockCounts = [...graph.higherBlockCounts];
  let tray: DogTrayBlock[] = [];
  const selectedPatterns = new Set<string>();
  const path: string[] = [];
  const targetCount = getDogShuffleThreshold(effectiveTrayCapacity, config) - 1;

  for (let count = 0; count < targetCount; count += 1) {
    const selectable = getSelectableBlocks(level, remainingMask, higherBlockCounts)
      .filter((index) =>
        index !== shuffleIndex &&
        level.blocks[index]?.specialMechanism === undefined &&
        !selectedPatterns.has(level.blocks[index]?.patternType ?? ""),
      )
      .sort((first, second) => level.blocks[second]!.z - level.blocks[first]!.z);
    const selectedIndex = selectable[0];
    if (selectedIndex === undefined) {
      return undefined;
    }

    const nextMagneticRandom = magneticRandom.clone();
    const resolution = resolveDogSelection(
      level,
      selectedIndex,
      remainingMask,
      higherBlockCounts,
      tray,
      handlers,
      nextMagneticRandom,
      graph,
    );
    remainingMask = resolution.remainingMask;
    higherBlockCounts = [...resolution.higherBlockCounts];
    tray = [...resolution.tray];
    if (getDogTrayLogicalUnitCount(tray) > effectiveTrayCapacity) {
      return undefined;
    }
    selectedPatterns.add(level.blocks[selectedIndex]!.patternType);
    path.push(level.blocks[selectedIndex]!.id);
  }

  if ((remainingMask & blockMask(shuffleIndex)) === 0n || higherBlockCounts[shuffleIndex] !== 0) {
    return undefined;
  }

  const nextMagneticRandom = magneticRandom.clone();
  const resolution = resolveDogSelection(
    level,
    shuffleIndex,
    remainingMask,
    higherBlockCounts,
    tray,
    handlers,
    nextMagneticRandom,
    graph,
  );
  const triggerThreshold = getDogShuffleThreshold(effectiveTrayCapacity, config);
  const triggerable = resolution.tray.map(armDogShuffleBlock).some((block) =>
    getDogShuffleMechanismStatus(block.specialMechanism) === "armed" ||
    getDogShuffleMechanismStatus(block.specialMechanism) === "triggerable",
  );
  return getDogTrayLogicalUnitCount(resolution.tray) < triggerThreshold || !triggerable
    ? undefined
    : [...path, level.blocks[shuffleIndex]!.id];
}

export function resolveDogShuffleState(
  options: DogShuffleStateResolutionOptions,
): DogShuffleStateResolution {
  const trayLogicalUnitCount = getDogTrayLogicalUnitCount(options.tray);
  const triggerThreshold = getDogShuffleThreshold(
    options.effectiveTrayCapacity,
    options.config,
  );
  const armedTray = Object.freeze(options.tray.map(armDogShuffleBlock));
  const triggerBlock = armedTray.find((block) =>
    trayLogicalUnitCount >= triggerThreshold &&
    ["armed", "triggerable"].includes(
      getDogShuffleMechanismStatus(block.specialMechanism),
    ),
  );
  if (triggerBlock === undefined) {
    return Object.freeze({ tray: armedTray, computation: null });
  }

  const computation = resolveDogSafeShuffle({
    ...options,
    tray: armedTray,
    triggerBlockId: triggerBlock.id,
  });
  return Object.freeze({ tray: computation.afterTrayBlocks, computation });
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
  const completedStates = new Map();

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
      config: options.config,
      completedStates,
      // ponytail: generated candidates use the known-path budget; unproven
      // permutations stay stable instead of making every level exponential.
      branchBudget: hasKnownPathOverlap(options) ? 16 : 256,
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

function hasKnownPathOverlap(options: DogShuffleResolutionOptions): boolean {
  return options.level.solutionPath?.some((blockId) =>
    options.remainingBlockIds.includes(blockId),
  ) ?? false;
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
