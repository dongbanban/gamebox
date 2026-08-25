import {
  DOG_FREEZE_GENERATOR_VERSION,
  DOG_FREEZE_ONLY_SPECIAL_MECHANISM_DEFINITIONS,
  DOG_ILLUSION_GENERATOR_VERSION,
  DOG_LEGACY_SPECIAL_MECHANISM_DEFINITIONS,
  DOG_LEVEL_SPECIAL_MECHANISM_DEFINITIONS,
  LEVEL_GENERATOR_VERSION,
} from "@/games/dog-lege-dog/game/game-config";
import {
  DOG_PATTERN_TYPES,
  type DogBlock,
  type DogPatternType,
  type DogSpecialMechanism,
  type DogSpecialMechanismConfig,
  type DogSpecialMechanismHandler,
  type DogSpecialMechanismStateValue,
  type DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import type { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import { getProgressStage } from "@/games/dog-lege-dog/levels/level-progression";

export const DOG_FREEZE_MECHANISM_TYPE = "freeze" as const;
export const DOG_FREEZE_MELT_TRIPLE_COUNT = 2 as const;
export const DOG_ILLUSION_MECHANISM_TYPE = "illusion" as const;
export const DOG_ILLUSION_MASK_STATUS = "masked" as const;
export const DOG_MAGNETIC_MECHANISM_TYPE = "magnetic" as const;
export const DOG_TWIN_MECHANISM_TYPE = "twin" as const;
export const DOG_SPECIAL_MECHANISM_DENSITY_LIMIT = 0.06 as const;
export const DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO = 0.7 as const;
// Keep retry search bounded. Pool still covers enough high-layer positions for
// current min/max ranges while preventing quadratic scans across full boards.
const MAX_SPECIAL_MECHANISM_CANDIDATES = 12 as const;

export const DOG_SPECIAL_MECHANISM_HANDLERS: readonly DogSpecialMechanismHandler[] =
  Object.freeze([
    Object.freeze({
      type: DOG_FREEZE_MECHANISM_TYPE,
      isMatchable: () => false,
      onSuccessfulTriples: freezeAfterSuccessfulTriples,
    }),
    Object.freeze({
      type: DOG_ILLUSION_MECHANISM_TYPE,
      isMatchable: () => true,
      onEnterTray: revealIllusionOnEnterTray,
      onSuccessfulTriples: keepIllusionBlock,
    }),
  ]);

const DOG_SUPPORTED_SPECIAL_MECHANISM_TYPES = new Set(
  DOG_SPECIAL_MECHANISM_HANDLERS.map(({ type }) => type),
);

export function getDogSpecialMechanismConfigs(
  levelNumber: number,
  generatorVersion: number = LEVEL_GENERATOR_VERSION,
): readonly DogSpecialMechanismConfig[] {
  // Resolve progression once at the game configuration seam. Downstream
  // placement, solvability and runtime consume only resolved min/max values.
  const definitions = getDogSpecialMechanismDefinitions(generatorVersion);
  const progressStage = getProgressStage(levelNumber);
  return Object.freeze(
    definitions.map((definition) => {
      const min = definition.minByStage?.[progressStage] ?? definition.min;
      const max = definition.maxByStage?.[progressStage] ?? definition.max;
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
        throw new Error("狗了个狗 special mechanism progression range is invalid");
      }
      return Object.freeze({
        type: definition.type,
        min,
        max,
        ...(definition.densityWeight === undefined
          ? {}
          : { densityWeight: definition.densityWeight }),
        ...(definition.itemUseBonus === undefined
          ? {}
          : { itemUseBonus: definition.itemUseBonus }),
      });
    }),
  );
}

/**
 * Candidate-generation view. Current metadata can include mechanisms whose
 * handlers land in later tickets; handler registration activates them here
 * without moving progression logic into placement or solving.
 */
export function getDogSpecialMechanismConfigsForGeneration(
  levelNumber: number,
  generatorVersion: number = LEVEL_GENERATOR_VERSION,
): readonly DogSpecialMechanismConfig[] {
  return getDogSpecialMechanismConfigs(levelNumber, generatorVersion).filter(
    (configuration) => DOG_SUPPORTED_SPECIAL_MECHANISM_TYPES.has(configuration.type),
  );
}

function getDogSpecialMechanismDefinitions(
  generatorVersion: number,
): readonly DogSpecialMechanismConfig[] {
  if (generatorVersion < DOG_FREEZE_GENERATOR_VERSION) {
    return [];
  }
  if (generatorVersion < DOG_ILLUSION_GENERATOR_VERSION) {
    return DOG_FREEZE_ONLY_SPECIAL_MECHANISM_DEFINITIONS;
  }
  if (generatorVersion < LEVEL_GENERATOR_VERSION) {
    return DOG_LEGACY_SPECIAL_MECHANISM_DEFINITIONS;
  }
  return DOG_LEVEL_SPECIAL_MECHANISM_DEFINITIONS;
}

export function createDogSpecialMechanism(type: string): DogSpecialMechanism {
  if (type === DOG_FREEZE_MECHANISM_TYPE) {
    return Object.freeze({
      type: DOG_FREEZE_MECHANISM_TYPE,
      state: Object.freeze({
        status: "frozen",
        completedTriples: 0,
      }),
    });
  }

  if (type === DOG_ILLUSION_MECHANISM_TYPE) {
    return Object.freeze({
      type: DOG_ILLUSION_MECHANISM_TYPE,
      state: Object.freeze({
        status: DOG_ILLUSION_MASK_STATUS,
        disguisedPatternType: null,
      }),
    });
  }

  throw new Error(`狗了个狗 special mechanism is unsupported: ${type}`);
}

export function createDogIllusionMechanism(
  realPatternType: DogPatternType,
  random: SeededRandom,
): DogSpecialMechanism {
  const candidates = DOG_PATTERN_TYPES.filter(
    (patternType) => patternType !== realPatternType,
  );
  const disguisedPatternType = candidates[random.nextInt(candidates.length)];
  if (disguisedPatternType === undefined) {
    throw new Error("狗了个狗 illusion disguised pattern cannot be selected");
  }

  return Object.freeze({
    type: DOG_ILLUSION_MECHANISM_TYPE,
    state: Object.freeze({
      status: DOG_ILLUSION_MASK_STATUS,
      disguisedPatternType,
    }),
  });
}

export function getDogIllusionDisguisedPattern(
  block: Pick<DogBlock, "patternType" | "specialMechanism">,
): DogPatternType {
  if (block.specialMechanism?.type !== DOG_ILLUSION_MECHANISM_TYPE) {
    return block.patternType;
  }

  const disguisedPatternType = block.specialMechanism.state.disguisedPatternType;
  return isDogPatternType(disguisedPatternType) && disguisedPatternType !== block.patternType
    ? disguisedPatternType
    : block.patternType;
}

export function createDogSpecialMechanismHandlerMap(
  handlers: readonly DogSpecialMechanismHandler[] = DOG_SPECIAL_MECHANISM_HANDLERS,
): ReadonlyMap<string, DogSpecialMechanismHandler> {
  const map = new Map<string, DogSpecialMechanismHandler>();
  for (const handler of handlers) {
    if (map.has(handler.type)) {
      throw new Error(`狗了个狗 duplicate special mechanism handler: ${handler.type}`);
    }
    map.set(handler.type, handler);
  }
  return map;
}

export interface DogSpecialMechanismComposition {
  readonly specialMechanismCount: number;
  readonly logicalUnitCount: number;
  readonly specialMechanismDensity: number;
  readonly middleLayerCount: number;
  readonly middleLayerRatio: number;
}

export interface DogSpecialMechanismAssignmentOptions {
  readonly minimumMiddleLayerRatio?: number;
  readonly maxLayers?: number;
}

interface ResolvedSpecialMechanismAssignment {
  readonly configuration: DogSpecialMechanismConfig;
  readonly count: number;
  readonly candidateOrder: readonly number[];
  candidatePool: number[];
  readonly mechanism: DogSpecialMechanism;
}

interface SpecialMechanismAssignmentSearchState {
  readonly blocks: readonly DogBlock[];
  readonly usedIndices: ReadonlySet<number>;
  readonly selectedMiddleCount: number;
}

export function getDogSpecialMechanismComposition(
  blocks: readonly DogBlock[],
  maxLayers: number,
  configurations: readonly DogSpecialMechanismConfig[] = [],
): DogSpecialMechanismComposition {
  const densityWeights = new Map(
    configurations.map((configuration) => [
      configuration.type,
      resolveDensityWeight(configuration),
    ]),
  );
  const specialBlocks = blocks.filter((block) => block.specialMechanism !== undefined);
  const logicalUnitCount = specialBlocks.reduce(
    (total, block) => total + (densityWeights.get(block.specialMechanism?.type ?? "") ?? 1),
    0,
  );
  const middleLayerCount = specialBlocks.filter(
    (block) => block.z > 0 && block.z < maxLayers - 1,
  ).length;

  return Object.freeze({
    specialMechanismCount: specialBlocks.length,
    logicalUnitCount,
    specialMechanismDensity: blocks.length === 0
      ? 0
      : logicalUnitCount / blocks.length,
    middleLayerCount,
    middleLayerRatio: specialBlocks.length === 0
      ? 1
      : middleLayerCount / specialBlocks.length,
  });
}

/** Returns a diagnostic string so generation can reject and redraw candidates. */
export function validateDogSpecialMechanismComposition(
  blocks: readonly DogBlock[],
  maxLayers: number,
  configurations: readonly DogSpecialMechanismConfig[],
  minimumMiddleLayerRatio = DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO,
): string | undefined {
  if (!Number.isSafeInteger(maxLayers) || maxLayers < 1) {
    return "狗了个狗 special mechanism composition layer count is invalid";
  }
  if (
    !Number.isFinite(minimumMiddleLayerRatio) ||
    minimumMiddleLayerRatio < 0 ||
    minimumMiddleLayerRatio > 1
  ) {
    return "狗了个狗 special mechanism middle-layer ratio is invalid";
  }

  const seenTypes = new Set<string>();
  for (const configuration of configurations) {
    validateConfiguration(configuration);
    if (seenTypes.has(configuration.type)) {
      return `狗了个狗 duplicate special mechanism configuration: ${configuration.type}`;
    }
    seenTypes.add(configuration.type);
  }

  const configuredTypes = new Set(configurations.map((configuration) => configuration.type));
  const counts = new Map<string, number>();
  for (const block of blocks) {
    const mechanism = block.specialMechanism;
    if (mechanism === undefined) {
      continue;
    }
    if (block.z < 0 || block.z >= maxLayers) {
      return `狗了个狗 special mechanism block ${block.id} has invalid layer`;
    }
    if (block.z <= 0) {
      return `狗了个狗 special mechanism block ${block.id} cannot be on base layer`;
    }
    if (!configuredTypes.has(mechanism.type)) {
      return `狗了个狗 special mechanism configuration is missing: ${mechanism.type}`;
    }
    counts.set(mechanism.type, (counts.get(mechanism.type) ?? 0) + 1);
  }

  if (counts.size > 0 && maxLayers < 3) {
    return "狗了个狗 special mechanism composition has no middle layer";
  }

  for (const configuration of configurations) {
    const count = counts.get(configuration.type) ?? 0;
    if (count < configuration.min || count > configuration.max) {
      return `狗了个狗 ${configuration.type} count ${count} is outside ${configuration.min}-${configuration.max}`;
    }
  }

  const composition = getDogSpecialMechanismComposition(blocks, maxLayers, configurations);
  if (composition.specialMechanismCount > 0 && composition.middleLayerRatio < minimumMiddleLayerRatio) {
    return "狗了个狗 special mechanism middle-layer ratio is below 70%";
  }
  if (composition.specialMechanismDensity > DOG_SPECIAL_MECHANISM_DENSITY_LIMIT) {
    return "狗了个狗 special mechanism density exceeds 6%";
  }
  return undefined;
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
  if (
    !Number.isFinite(minimumMiddleLayerRatio) ||
    minimumMiddleLayerRatio < 0 ||
    minimumMiddleLayerRatio > 1
  ) {
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
    validateConfiguration(configuration);
    if (configuredTypes.has(configuration.type)) {
      throw new Error(`狗了个狗 duplicate special mechanism configuration: ${configuration.type}`);
    }
    configuredTypes.add(configuration.type);
    const count = configuration.min +
      random.nextInt(configuration.max - configuration.min + 1);
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
  const totalCount = assignments.reduce((total, assignment) => total + assignment.count, 0);
  const logicalUnitCount = assignments.reduce(
    (total, assignment) =>
      total + assignment.count * resolveDensityWeight(assignment.configuration),
    0,
  );
  const middleIndices = eligibleIndices.filter((index) => {
    const block = blocks[index];
    return block !== undefined && block.z < maxLayerIndex;
  });
  const requiredMiddleCount = Math.ceil(totalCount * minimumMiddleLayerRatio);
  if (totalCount > eligibleIndices.length) {
    throw new Error("狗了个狗 special mechanism has no high-layer capacity");
  }
  if (requiredMiddleCount > middleIndices.length) {
    throw new Error("狗了个狗 special mechanism has no legal middle-layer capacity");
  }
  if (logicalUnitCount > blocks.length * DOG_SPECIAL_MECHANISM_DENSITY_LIMIT) {
    throw new Error("狗了个狗 special mechanism density exceeds 6%");
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
        if (
          configurationIndex === assignments.length - 1 &&
          !canSolve(nextBlocks)
        ) {
          return undefined;
        }
        return searchAssignments(
          configurationIndex + 1,
          {
            blocks: nextBlocks,
            usedIndices: nextUsedIndices,
            selectedMiddleCount: nextMiddleCount,
          },
        );
      }

      const lastStart = candidateIndices.length - remainingToSelect;
      for (
        let position = candidatePosition;
        position <= lastStart;
        position += 1
      ) {
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
        const selectedBlock = {
          ...block,
          specialMechanism: mechanism,
        };
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

  let assignedBlocks = searchAssignments(
    0,
    {
      blocks: [...blocks],
      usedIndices: new Set<number>(),
      selectedMiddleCount: 0,
    },
  );
  // Bounded pools cover normal generation. Expand once for direct callers or
  // future configs whose only valid placement falls outside bounded samples.
  if (
    assignedBlocks === undefined &&
    assignments.some((assignment) =>
      assignment.candidatePool.length < assignment.candidateOrder.length,
    )
  ) {
    for (const assignment of assignments) {
      assignment.candidatePool = [...assignment.candidateOrder];
    }
    assignedBlocks = searchAssignments(
      0,
      {
        blocks: [...blocks],
        usedIndices: new Set<number>(),
        selectedMiddleCount: 0,
      },
    );
  }
  if (assignedBlocks === undefined) {
    if (requiredMiddleCount > middleIndices.length) {
      throw new Error("狗了个狗 special mechanism middle-layer ratio is below 70%");
    }
    throw new Error("狗了个狗 special mechanism assignment is unsolvable");
  }

  return assignedBlocks.map((block) =>
    block.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE
      ? {
          ...block,
          specialMechanism: createDogIllusionMechanism(block.patternType, random),
        }
      : block,
  );
}

function freezeAfterSuccessfulTriples(
  block: DogTrayBlock,
  tripleCount: number,
  _triplePatterns: readonly DogPatternType[],
): DogTrayBlock {
  const mechanism = block.specialMechanism;
  if (mechanism?.type !== DOG_FREEZE_MECHANISM_TYPE || tripleCount <= 0) {
    return block;
  }

  const completedTriples = getCompletedTriples(mechanism) + tripleCount;
  if (completedTriples >= DOG_FREEZE_MELT_TRIPLE_COUNT) {
    const { specialMechanism: _specialMechanism, ...meltedBlock } = block;
    return meltedBlock;
  }

  return {
    ...block,
    specialMechanism: {
      ...mechanism,
      state: {
        ...mechanism.state,
        completedTriples,
      },
    },
  };
}

function revealIllusionOnEnterTray(block: DogTrayBlock): DogTrayBlock {
  if (block.specialMechanism?.type !== DOG_ILLUSION_MECHANISM_TYPE) {
    return block;
  }

  const { specialMechanism: _specialMechanism, ...revealedBlock } = block;
  return revealedBlock;
}

function keepIllusionBlock(block: DogTrayBlock): DogTrayBlock {
  return block;
}

function isDogPatternType(value: DogSpecialMechanismStateValue): value is DogPatternType {
  return typeof value === "string" && DOG_PATTERN_TYPES.includes(value as DogPatternType);
}

function getCompletedTriples(mechanism: DogSpecialMechanism): number {
  const completedTriples = mechanism.state.completedTriples;
  return typeof completedTriples === "number" && completedTriples >= 0
    ? completedTriples
    : 0;
}

function validateConfiguration(configuration: DogSpecialMechanismConfig): void {
  const hasValidStageRanges = [configuration.minByStage, configuration.maxByStage].every(
    (ranges) => ranges === undefined || (
      ranges.length > 0 &&
      ranges.every((range) => Number.isSafeInteger(range) && range >= 1)
    ),
  );
  if (
    typeof configuration.type !== "string" ||
    configuration.type.length === 0 ||
    !Number.isSafeInteger(configuration.min) ||
    !Number.isSafeInteger(configuration.max) ||
    configuration.min < 1 ||
    configuration.max < configuration.min ||
    !hasValidStageRanges ||
    (configuration.densityWeight !== undefined &&
      (!Number.isFinite(configuration.densityWeight) || configuration.densityWeight <= 0)) ||
    (configuration.itemUseBonus !== undefined &&
      (!Number.isSafeInteger(configuration.itemUseBonus) || configuration.itemUseBonus < 0))
  ) {
    throw new Error("狗了个狗 special mechanism count range is invalid");
  }
}

function resolveDensityWeight(configuration: DogSpecialMechanismConfig): number {
  const weight = configuration.densityWeight ?? 1;
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error("狗了个狗 special mechanism density weight is invalid");
  }
  return weight;
}

function isMiddleLayer(
  block: DogBlock | undefined,
  maxLayerIndex: number,
): boolean {
  return block !== undefined && block.z > 0 && block.z < maxLayerIndex;
}
