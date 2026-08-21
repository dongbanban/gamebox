import { DOG_LEVEL_SPECIAL_MECHANISM_DEFINITIONS } from "@/games/dog-lege-dog/game/game-config";
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

export const DOG_FREEZE_MECHANISM_TYPE = "freeze" as const;
export const DOG_FREEZE_MELT_TRIPLE_COUNT = 2 as const;
export const DOG_ILLUSION_MECHANISM_TYPE = "illusion" as const;
export const DOG_ILLUSION_MASK_STATUS = "masked" as const;

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

export function getDogSpecialMechanismConfigs(
  blockCount: number,
): readonly DogSpecialMechanismConfig[] {
  if (!Number.isSafeInteger(blockCount) || blockCount < 1) {
    throw new Error("狗了个狗 special mechanism block count must be positive");
  }

  const scale = Math.max(1, Math.floor(blockCount / 45));
  return Object.freeze(
    DOG_LEVEL_SPECIAL_MECHANISM_DEFINITIONS.map((definition) =>
      Object.freeze({
        ...definition,
        max: Math.min(
          definition.max,
          Math.max(definition.min, definition.min * scale),
        ),
      }),
    ),
  );
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

export function assignDogSpecialMechanisms(
  blocks: readonly DogBlock[],
  configurations: readonly DogSpecialMechanismConfig[],
  random: SeededRandom,
  isCandidateSolvable: (blocks: readonly DogBlock[]) => boolean,
): readonly DogBlock[] {
  let assignedBlocks: readonly DogBlock[] = [...blocks];
  const assignedIndices = new Set<number>();
  const candidateValidity = new Map<string, boolean>();

  for (const configuration of configurations) {
    validateConfiguration(configuration);
    const count = configuration.min +
      random.nextInt(configuration.max - configuration.min + 1);
    const candidateIndices = random.shuffle(
      blocks
        .map((_, index) => index)
        .filter((index) => !assignedIndices.has(index)),
    );
    const mechanism = createDogSpecialMechanism(configuration.type);
    const selected = chooseMechanismBlocks(
      assignedBlocks,
      candidateIndices,
      mechanism,
      count,
      0,
      (candidateBlocks) => {
        const key = candidateBlocks
          .map((block) => block.specialMechanism?.type ?? "ordinary")
          .join("|");
        const cached = candidateValidity.get(key);
        if (cached !== undefined) {
          return cached;
        }

        const valid = isCandidateSolvable(candidateBlocks);
        candidateValidity.set(key, valid);
        return valid;
      },
    );
    if (selected === undefined) {
      throw new Error(
        `狗了个狗 could not place ${count} ${configuration.type} special blocks`,
      );
    }

    assignedBlocks = selected.blocks;
    if (configuration.type === DOG_ILLUSION_MECHANISM_TYPE) {
      const selectedIndexSet = new Set(selected.indices);
      assignedBlocks = assignedBlocks.map((block, index) =>
        selectedIndexSet.has(index)
          ? {
              ...block,
              specialMechanism: createDogIllusionMechanism(block.patternType, random),
            }
          : block,
      );
    }
    for (const index of selected.indices) {
      assignedIndices.add(index);
    }
  }

  return assignedBlocks;
}

function chooseMechanismBlocks(
  blocks: readonly DogBlock[],
  candidateIndices: readonly number[],
  mechanism: DogSpecialMechanism,
  remainingCount: number,
  startIndex: number,
  isCandidateSolvable: (blocks: readonly DogBlock[]) => boolean,
): { readonly blocks: readonly DogBlock[]; readonly indices: readonly number[] } | undefined {
  if (remainingCount === 0) {
    return { blocks, indices: [] };
  }

  for (let candidatePosition = startIndex; candidatePosition < candidateIndices.length; candidatePosition += 1) {
    const blockIndex = candidateIndices[candidatePosition];
    if (blockIndex === undefined) {
      continue;
    }

    const candidateBlocks = blocks.map((block, index) =>
      index === blockIndex ? { ...block, specialMechanism: mechanism } : block,
    );
    if (!isCandidateSolvable(candidateBlocks)) {
      continue;
    }

    const next = chooseMechanismBlocks(
      candidateBlocks,
      candidateIndices,
      mechanism,
      remainingCount - 1,
      candidatePosition + 1,
      isCandidateSolvable,
    );
    if (next !== undefined) {
      return {
        blocks: next.blocks,
        indices: [blockIndex, ...next.indices],
      };
    }
  }

  return undefined;
}

function freezeAfterSuccessfulTriples(
  block: DogTrayBlock,
  tripleCount: number,
  triplePatterns: readonly DogPatternType[],
): DogTrayBlock {
  const mechanism = block.specialMechanism;
  if (mechanism?.type !== DOG_FREEZE_MECHANISM_TYPE || tripleCount <= 0) {
    return block;
  }

  const otherTripleCount = triplePatterns.length === 0
    ? tripleCount
    : triplePatterns.filter((patternType) => patternType !== block.patternType).length;
  const completedTriples = getCompletedTriples(mechanism) + otherTripleCount;
  if (otherTripleCount === 0) {
    return block;
  }
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
  if (
    typeof configuration.type !== "string" ||
    configuration.type.length === 0 ||
    !Number.isSafeInteger(configuration.min) ||
    !Number.isSafeInteger(configuration.max) ||
    configuration.min < 1 ||
    configuration.max < configuration.min
  ) {
    throw new Error("狗了个狗 special mechanism count range is invalid");
  }
}
