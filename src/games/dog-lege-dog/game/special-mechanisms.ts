import {
  DOG_PATTERN_TYPES,
  type DogBlock,
  type DogPatternType,
  type DogShuffleMechanismStatus,
  type DogSpecialMechanism,
  type DogSpecialMechanismStateValue,
  type DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import type { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import {
  DOG_V13_CONFIG,
  getDogV13ActiveMechanismDefinitions,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
} from "@/games/dog-lege-dog/game/v13-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type { DogSpecialMechanismConfig } from "@/games/dog-lege-dog/levels/level-types";

export const DOG_FREEZE_MECHANISM_TYPE = "freeze" as const;
export const DOG_FREEZE_MELT_TRIPLE_COUNT =
  DOG_V13_CONFIG.specialMechanisms.freezeMeltTripleCount;
export const DOG_ILLUSION_MECHANISM_TYPE = "illusion" as const;
export const DOG_ILLUSION_MASK_STATUS = "masked" as const;
export const DOG_MAGNETIC_MECHANISM_TYPE = "magnetic" as const;
export const DOG_TWIN_MECHANISM_TYPE = "twin" as const;
export const DOG_SHUFFLE_MECHANISM_TYPE = "shuffle" as const;
export const DOG_SHUFFLE_DORMANT_STATUS = "dormant" as const;
export const DOG_SHUFFLE_ARMED_STATUS = "armed" as const;
export const DOG_SHUFFLE_TRIGGERABLE_STATUS = "triggerable" as const;
export const DOG_SHUFFLE_CONSUMED_STATUS = "consumed" as const;
export const DOG_SPECIAL_MECHANISM_DENSITY_LIMIT =
  DOG_V13_CONFIG.specialMechanisms.logicalBudgetRatio;
export const DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO = 0.7 as const;

export type {
  DogSpecialMechanismComposition,
} from "@/games/dog-lege-dog/game/special-mechanism-composition";
export {
  getDogBlockLogicalUnitCount,
  getDogLogicalBlockCount,
  getDogSpecialMechanismComposition,
  getDogSpecialMechanismLogicalUnitWeight,
  getDogTrayLogicalUnitCount,
  selectDogSpecialMechanismCounts,
  validateDogSpecialMechanismComposition,
  validateDogSpecialMechanismConfiguration,
} from "@/games/dog-lege-dog/game/special-mechanism-composition";

export function prepareDogTrayBlocks(block: DogTrayBlock): readonly DogTrayBlock[] {
  switch (block.specialMechanism?.type) {
    case undefined:
    case DOG_FREEZE_MECHANISM_TYPE:
    case DOG_SHUFFLE_MECHANISM_TYPE:
      return [block];
    case DOG_ILLUSION_MECHANISM_TYPE:
    case DOG_MAGNETIC_MECHANISM_TYPE: {
      const { specialMechanism: _specialMechanism, ...ordinaryBlock } = block;
      return [ordinaryBlock];
    }
    case DOG_TWIN_MECHANISM_TYPE: {
      const { specialMechanism: _specialMechanism, ...ordinaryBlock } = block;
      return Object.freeze([
        Object.freeze({ ...ordinaryBlock, id: `${block.id}-1` }),
        Object.freeze({ ...ordinaryBlock, id: `${block.id}-2` }),
      ]);
    }
    default:
      throw new Error(`狗了个狗 special mechanism is unsupported: ${block.specialMechanism?.type}`);
  }
}

export function isDogSpecialMechanismMatchable(
  mechanism: DogSpecialMechanism,
  allowFrozenMatches = false,
): boolean {
  switch (mechanism.type) {
    case DOG_FREEZE_MECHANISM_TYPE:
      return allowFrozenMatches;
    case DOG_ILLUSION_MECHANISM_TYPE:
    case DOG_MAGNETIC_MECHANISM_TYPE:
    case DOG_TWIN_MECHANISM_TYPE:
    case DOG_SHUFFLE_MECHANISM_TYPE:
      return true;
    default:
      throw new Error(`狗了个狗 special mechanism is unsupported: ${mechanism.type}`);
  }
}

export function applyDogSpecialMechanismSuccessfulTripleEffects(
  block: DogTrayBlock,
  tripleCount: number,
  config: DogV13Config = DOG_V13_CONFIG,
): DogTrayBlock {
  switch (block.specialMechanism?.type) {
    case undefined:
    case DOG_ILLUSION_MECHANISM_TYPE:
    case DOG_MAGNETIC_MECHANISM_TYPE:
    case DOG_TWIN_MECHANISM_TYPE:
    case DOG_SHUFFLE_MECHANISM_TYPE:
      return block;
    case DOG_FREEZE_MECHANISM_TYPE:
      return freezeAfterSuccessfulTriples(
        block,
        tripleCount,
        config.specialMechanisms.freezeMeltTripleCount,
      );
    default:
      throw new Error(`狗了个狗 special mechanism is unsupported: ${block.specialMechanism?.type}`);
  }
}

export function createDogSpecialMechanism(type: string): DogSpecialMechanism {
  if (type === DOG_FREEZE_MECHANISM_TYPE) {
    return Object.freeze({
      type: DOG_FREEZE_MECHANISM_TYPE,
      state: Object.freeze({ status: "frozen", completedTriples: 0 }),
    });
  }
  if (type === DOG_ILLUSION_MECHANISM_TYPE) {
    return Object.freeze({
      type: DOG_ILLUSION_MECHANISM_TYPE,
      state: Object.freeze({ status: DOG_ILLUSION_MASK_STATUS, disguisedPatternType: null }),
    });
  }
  if (type === DOG_MAGNETIC_MECHANISM_TYPE) {
    return Object.freeze({
      type: DOG_MAGNETIC_MECHANISM_TYPE,
      state: Object.freeze({ status: DOG_MAGNETIC_MECHANISM_TYPE }),
    });
  }
  if (type === DOG_TWIN_MECHANISM_TYPE) {
    return Object.freeze({
      type: DOG_TWIN_MECHANISM_TYPE,
      state: Object.freeze({ status: DOG_TWIN_MECHANISM_TYPE }),
    });
  }
  if (type === DOG_SHUFFLE_MECHANISM_TYPE) {
    return createDogShuffleMechanism();
  }
  throw new Error(`狗了个狗 special mechanism is unsupported: ${type}`);
}

export function createDogShuffleMechanism(): DogSpecialMechanism {
  return Object.freeze({
    type: DOG_SHUFFLE_MECHANISM_TYPE,
    state: Object.freeze({ status: DOG_SHUFFLE_DORMANT_STATUS }),
  });
}

export function getDogShuffleMechanismStatus(
  mechanism: Pick<DogSpecialMechanism, "type" | "state"> | undefined,
): DogShuffleMechanismStatus {
  if (mechanism?.type !== DOG_SHUFFLE_MECHANISM_TYPE) {
    return DOG_SHUFFLE_DORMANT_STATUS;
  }

  const status = mechanism.state.status;
  return isDogShuffleMechanismStatus(status) ? status : DOG_SHUFFLE_DORMANT_STATUS;
}

export function armDogShuffleBlock(block: DogTrayBlock): DogTrayBlock {
  return withDogShuffleStatus(block, DOG_SHUFFLE_DORMANT_STATUS, DOG_SHUFFLE_ARMED_STATUS);
}

export function triggerDogShuffleBlock(block: DogTrayBlock): DogTrayBlock {
  return withDogShuffleStatus(block, DOG_SHUFFLE_ARMED_STATUS, DOG_SHUFFLE_TRIGGERABLE_STATUS);
}

export function consumeDogShuffleBlock(block: DogTrayBlock): DogTrayBlock {
  const status = getDogShuffleMechanismStatus(block.specialMechanism);
  if (status !== DOG_SHUFFLE_ARMED_STATUS && status !== DOG_SHUFFLE_TRIGGERABLE_STATUS) {
    return block;
  }

  return {
    ...block,
    specialMechanism: {
      ...block.specialMechanism!,
      state: { ...block.specialMechanism!.state, status: DOG_SHUFFLE_CONSUMED_STATUS },
    },
  };
}

export function isDogSpecialMechanismResolved(
  mechanism: DogSpecialMechanism | undefined,
): boolean {
  return mechanism === undefined || (
    mechanism.type === DOG_SHUFFLE_MECHANISM_TYPE &&
    getDogShuffleMechanismStatus(mechanism) === DOG_SHUFFLE_CONSUMED_STATUS
  );
}

export function createDogIllusionMechanism(
  realPatternType: DogPatternType,
  random: SeededRandom,
): DogSpecialMechanism {
  const candidates = DOG_PATTERN_TYPES.filter((patternType) => patternType !== realPatternType);
  const disguisedPatternType = candidates[random.nextInt(candidates.length)];
  if (disguisedPatternType === undefined) {
    throw new Error("狗了个狗 illusion disguised pattern cannot be selected");
  }
  return Object.freeze({
    type: DOG_ILLUSION_MECHANISM_TYPE,
    state: Object.freeze({ status: DOG_ILLUSION_MASK_STATUS, disguisedPatternType }),
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

const SUPPORTED_MECHANISM_TYPES = new Set<string>([
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_SHUFFLE_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
]);

/** Resolves current v13 counts from logical block budget. */
export function getDogSpecialMechanismConfigs(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): readonly DogSpecialMechanismConfig[] {
  const plan = getDogV13MechanismPlan(
    getDogV13LogicalBlockCount(levelNumber, config),
    config,
    levelNumber,
  );
  return Object.freeze(
    getDogV13ActiveMechanismDefinitions(config, levelNumber)
      .filter((definition) => SUPPORTED_MECHANISM_TYPES.has(definition.type))
      .map((definition) => {
        const count = plan.counts[definition.type];
        if (!Number.isSafeInteger(count) || count < 1) {
          throw new Error(`狗了个狗 v13 special mechanism count is invalid: ${definition.type}`);
        }
        return Object.freeze({
          type: definition.type,
          min: count,
          max: count,
          densityWeight: definition.logicalUnitWeight,
        });
      }),
  );
}

function freezeAfterSuccessfulTriples(
  block: DogTrayBlock,
  tripleCount: number,
  meltTripleCount: number,
): DogTrayBlock {
  const mechanism = block.specialMechanism;
  if (mechanism?.type !== DOG_FREEZE_MECHANISM_TYPE || tripleCount <= 0) {
    return block;
  }
  const completedTriples = getCompletedTriples(mechanism) + tripleCount;
  if (completedTriples >= meltTripleCount) {
    const { specialMechanism: _specialMechanism, ...meltedBlock } = block;
    return meltedBlock;
  }
  return {
    ...block,
    specialMechanism: {
      ...mechanism,
      state: { ...mechanism.state, completedTriples },
    },
  };
}

function withDogShuffleStatus(
  block: DogTrayBlock,
  expectedStatus: DogShuffleMechanismStatus,
  nextStatus: DogShuffleMechanismStatus,
): DogTrayBlock {
  if (
    block.specialMechanism?.type !== DOG_SHUFFLE_MECHANISM_TYPE ||
    getDogShuffleMechanismStatus(block.specialMechanism) !== expectedStatus
  ) {
    return block;
  }

  return {
    ...block,
    specialMechanism: {
      ...block.specialMechanism,
      state: { ...block.specialMechanism.state, status: nextStatus },
    },
  };
}

function isDogPatternType(value: DogSpecialMechanismStateValue): value is DogPatternType {
  return typeof value === "string" && DOG_PATTERN_TYPES.includes(value as DogPatternType);
}

function isDogShuffleMechanismStatus(
  value: DogSpecialMechanismStateValue,
): value is DogShuffleMechanismStatus {
  return value === DOG_SHUFFLE_DORMANT_STATUS ||
    value === DOG_SHUFFLE_ARMED_STATUS ||
    value === DOG_SHUFFLE_TRIGGERABLE_STATUS ||
    value === DOG_SHUFFLE_CONSUMED_STATUS;
}

function getCompletedTriples(mechanism: DogSpecialMechanism): number {
  const completedTriples = mechanism.state.completedTriples;
  return typeof completedTriples === "number" && completedTriples >= 0 ? completedTriples : 0;
}
