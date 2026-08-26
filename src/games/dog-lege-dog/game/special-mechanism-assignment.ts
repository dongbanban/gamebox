import {
  type DogBlock,
  type DogSpecialMechanismConfig,
} from "@/games/dog-lege-dog/levels/level-types";
import type { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import {
  createDogIllusionMechanism,
  createDogSpecialMechanism,
  DOG_SPECIAL_MECHANISM_DENSITY_LIMIT,
  DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO,
  DOG_TWIN_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanism-handlers";
import {
  getDogLogicalBlockCount,
  getDogSpecialMechanismLogicalUnitWeight,
  validateDogSpecialMechanismConfiguration,
} from "@/games/dog-lege-dog/game/special-mechanism-composition";

const MAX_SPECIAL_MECHANISM_CANDIDATES = 12 as const;

export interface DogSpecialMechanismAssignmentOptions {
  readonly minimumMiddleLayerRatio?: number;
  readonly maxLayers?: number;
  readonly countOverrides?: ReadonlyMap<string, number>;
}

interface ResolvedSpecialMechanismAssignment {
  readonly configuration: DogSpecialMechanismConfig;
  readonly count: number;
  readonly candidateOrder: readonly number[];
  candidatePool: number[];
  readonly mechanism: ReturnType<typeof createDogSpecialMechanism>;
}

interface SpecialMechanismAssignmentSearchState {
  readonly blocks: readonly DogBlock[];
  readonly usedIndices: ReadonlySet<number>;
  readonly selectedMiddleCount: number;
}

export function assignDogSpecialMechanisms(
  blocks: readonly DogBlock[],
  configurations: readonly DogSpecialMechanismConfig[],
  random: SeededRandom,
  isCandidateSolvable: (blocks: readonly DogBlock[]) => boolean,
  options: DogSpecialMechanismAssignmentOptions = {},
): readonly DogBlock[] {
  const minimumMiddleLayerRatio = options.minimumMiddleLayerRatio ??
    DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO;
  const inferredMaxLayers = Math.max(3, ...blocks.map((block) => block.z + 1));
  const maxLayers = options.maxLayers ?? inferredMaxLayers;
  if (!Number.isFinite(minimumMiddleLayerRatio) || minimumMiddleLayerRatio < 0 || minimumMiddleLayerRatio > 1) {
    throw new Error("狗了个狗 special mechanism middle-layer ratio is invalid");
  }
  if (!Number.isSafeInteger(maxLayers) || maxLayers < 1) {
    throw new Error("狗了个狗 special mechanism composition layer count is invalid");
  }

  const maxLayerIndex = maxLayers - 1;
  const eligibleIndices = blocks
    .map((_, index) => index)
    .filter((index) =>
      (blocks[index]?.z ?? 0) > 0 &&
      (blocks[index]?.z ?? 0) < maxLayers &&
      blocks[index]?.specialMechanism === undefined,
    );
  const assignments: ResolvedSpecialMechanismAssignment[] = [];
  const configuredTypes = new Set<string>();
  for (const configuration of configurations) {
    validateDogSpecialMechanismConfiguration(configuration);
    if (configuredTypes.has(configuration.type)) {
      throw new Error(`狗了个狗 duplicate special mechanism configuration: ${configuration.type}`);
    }
    configuredTypes.add(configuration.type);
    const requestedCount = options.countOverrides?.get(configuration.type) ??
      configuration.min + random.nextInt(configuration.max - configuration.min + 1);
    if (!Number.isSafeInteger(requestedCount) || requestedCount < configuration.min || requestedCount > configuration.max) {
      throw new Error(`狗了个狗 ${configuration.type} count override is invalid`);
    }
    const existingCount = blocks.filter(
      (block) => block.specialMechanism?.type === configuration.type,
    ).length;
    if (existingCount > requestedCount) {
      throw new Error(`狗了个狗 ${configuration.type} count exceeds configured count`);
    }
    const count = requestedCount - existingCount;
    const poolSize = Math.min(
      eligibleIndices.length,
      Math.max(MAX_SPECIAL_MECHANISM_CANDIDATES, count),
    );
    const candidateOrder = random.shuffle([...eligibleIndices]);
    assignments.push({
      configuration,
      count,
      candidateOrder,
      candidatePool: candidateOrder.slice(0, poolSize),
      mechanism: createDogSpecialMechanism(configuration.type),
    });
  }
  if (assignments.length === 0) {
    return [...blocks];
  }

  const existingSpecialBlocks = blocks.filter((block) => block.specialMechanism !== undefined);
  const totalCount = existingSpecialBlocks.length + assignments.reduce(
    (total, assignment) => total + assignment.count,
    0,
  );
  const logicalUnitCount = assignments.reduce(
    (total, assignment) =>
      total + assignment.count * getDogSpecialMechanismLogicalUnitWeight(assignment.configuration),
    existingSpecialBlocks.reduce(
      (existingTotal, block) => existingTotal + getLogicalUnitWeightForType(
        block.specialMechanism?.type ?? "",
        configurations,
      ),
      0,
    ),
  );
  const middleIndices = eligibleIndices.filter((index) => {
    const block = blocks[index];
    return block !== undefined && block.z < maxLayerIndex;
  });
  const requiredMiddleCount = Math.ceil(totalCount * minimumMiddleLayerRatio);
  const unassignedCount = assignments.reduce((total, assignment) => total + assignment.count, 0);
  if (unassignedCount > eligibleIndices.length) {
    throw new Error("狗了个狗 special mechanism has no high-layer capacity");
  }
  const existingMiddleCount = existingSpecialBlocks.filter(
    (block) => isMiddleLayer(block, maxLayerIndex),
  ).length;
  if (requiredMiddleCount > existingMiddleCount + middleIndices.length) {
    throw new Error("狗了个狗 special mechanism has no legal middle-layer capacity");
  }
  if (logicalUnitCount > getDogLogicalBlockCount(blocks, configurations) * DOG_SPECIAL_MECHANISM_DENSITY_LIMIT) {
    throw new Error(
      `狗了个狗 special mechanism density exceeds ${DOG_SPECIAL_MECHANISM_DENSITY_LIMIT * 100}%`,
    );
  }

  const solvabilityCache = new Map<string, boolean>();
  const canSolve = (candidateBlocks: readonly DogBlock[]): boolean => {
    const key = candidateBlocks
      .map((block) => `${block.id}:${block.specialMechanism?.type ?? "ordinary"}`)
      .join("|");
    const cached = solvabilityCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const solvable = isCandidateSolvable(candidateBlocks);
    solvabilityCache.set(key, solvable);
    return solvable;
  };

  const searchAssignments = (
    configurationIndex: number,
    state: SpecialMechanismAssignmentSearchState,
  ): readonly DogBlock[] | undefined => {
    const { blocks: currentBlocks, usedIndices, selectedMiddleCount } = state;
    if (configurationIndex >= assignments.length) {
      return selectedMiddleCount >= requiredMiddleCount && canSolve(currentBlocks)
        ? currentBlocks
        : undefined;
    }

    const assignment = assignments[configurationIndex];
    const count = assignment?.count ?? 0;
    const candidateIndices = assignment?.candidatePool ?? [];
    const mechanism = assignment?.mechanism;
    if (assignment === undefined || candidateIndices.length < count) {
      return undefined;
    }

    const remainingCount = assignments
      .slice(configurationIndex + 1)
      .reduce((total, nextAssignment) => total + nextAssignment.count, 0);
    const selectIndices = (
      candidatePosition: number,
      remainingToSelect: number,
      nextState: SpecialMechanismAssignmentSearchState,
    ): readonly DogBlock[] | undefined => {
      const {
        blocks: nextBlocks,
        usedIndices: nextUsedIndices,
        selectedMiddleCount: nextMiddleCount,
      } = nextState;
      if (remainingToSelect === 0) {
        if (nextMiddleCount + remainingCount < requiredMiddleCount) {
          return undefined;
        }
        if (configurationIndex === assignments.length - 1 && !canSolve(nextBlocks)) {
          return undefined;
        }
        return searchAssignments(configurationIndex + 1, nextState);
      }

      const lastStart = candidateIndices.length - remainingToSelect;
      for (let position = candidatePosition; position <= lastStart; position += 1) {
        const index = candidateIndices[position];
        if (index === undefined || nextUsedIndices.has(index)) {
          continue;
        }
        const block = blocks[index];
        if (block === undefined) {
          continue;
        }
        const nextUsed = new Set(nextUsedIndices);
        nextUsed.add(index);
        const selectedBlock = { ...block, specialMechanism: mechanism };
        const selectedBlocks = nextBlocks.map((candidateBlock, blockIndex) =>
          blockIndex === index ? selectedBlock : candidateBlock,
        );
        const result = selectIndices(
          position + 1,
          remainingToSelect - 1,
          {
            blocks: selectedBlocks,
            usedIndices: nextUsed,
            selectedMiddleCount: nextMiddleCount +
              (isMiddleLayer(block, maxLayerIndex) ? 1 : 0),
          },
        );
        if (result !== undefined) {
          return result;
        }
      }
      return undefined;
    };

    return selectIndices(0, count, state);
  };

  let assignedBlocks = searchAssignments(0, {
    blocks: [...blocks],
    usedIndices: new Set<number>(),
    selectedMiddleCount: existingSpecialBlocks.filter(
      (block) => isMiddleLayer(block, maxLayerIndex),
    ).length,
  });
  if (
    assignedBlocks === undefined &&
    assignments.some((assignment) => assignment.candidatePool.length < assignment.candidateOrder.length)
  ) {
    for (const assignment of assignments) {
      assignment.candidatePool = [...assignment.candidateOrder];
    }
    assignedBlocks = searchAssignments(0, {
      blocks: [...blocks],
      usedIndices: new Set<number>(),
      selectedMiddleCount: existingSpecialBlocks.filter(
        (block) => isMiddleLayer(block, maxLayerIndex),
      ).length,
    });
  }
  if (assignedBlocks === undefined) {
    if (requiredMiddleCount > middleIndices.length) {
      throw new Error("狗了个狗 special mechanism middle-layer ratio is below 70%");
    }
    throw new Error("狗了个狗 special mechanism assignment is unsolvable");
  }

  return assignedBlocks.map((block) =>
    block.specialMechanism?.type === "illusion"
      ? { ...block, specialMechanism: createDogIllusionMechanism(block.patternType, random) }
      : block,
  );
}

function getLogicalUnitWeightForType(
  type: string,
  configurations: readonly DogSpecialMechanismConfig[],
): number {
  const configuration = configurations.find((candidate) => candidate.type === type);
  return configuration === undefined ? (type === DOG_TWIN_MECHANISM_TYPE ? 2 : 1) :
    getDogSpecialMechanismLogicalUnitWeight(configuration);
}

function isMiddleLayer(block: DogBlock | undefined, maxLayerIndex: number): boolean {
  return block !== undefined && block.z > 0 && block.z < maxLayerIndex;
}
