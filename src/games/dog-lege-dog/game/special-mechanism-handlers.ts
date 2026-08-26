import {
  DOG_PATTERN_TYPES,
  type DogBlock,
  type DogPatternType,
  type DogSpecialMechanism,
  type DogSpecialMechanismHandler,
  type DogSpecialMechanismStateValue,
  type DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import type { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";

export const DOG_FREEZE_MECHANISM_TYPE = "freeze" as const;
export const DOG_FREEZE_MELT_TRIPLE_COUNT =
  DOG_V13_CONFIG.specialMechanisms.freezeMeltTripleCount;
export const DOG_ILLUSION_MECHANISM_TYPE = "illusion" as const;
export const DOG_ILLUSION_MASK_STATUS = "masked" as const;
export const DOG_MAGNETIC_MECHANISM_TYPE = "magnetic" as const;
export const DOG_TWIN_MECHANISM_TYPE = "twin" as const;
export const DOG_SPECIAL_MECHANISM_DENSITY_LIMIT =
  DOG_V13_CONFIG.specialMechanisms.logicalBudgetRatio;
export const DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO = 0.7 as const;

export function createDogSpecialMechanismHandlers(
  config: DogV13Config = DOG_V13_CONFIG,
): readonly DogSpecialMechanismHandler[] {
  return Object.freeze([
    Object.freeze({
      type: DOG_FREEZE_MECHANISM_TYPE,
      isMatchable: () => false,
      onSuccessfulTriples: (
        block: DogTrayBlock,
        tripleCount: number,
        triplePatterns: readonly DogPatternType[],
      ) => freezeAfterSuccessfulTriples(
        block,
        tripleCount,
        triplePatterns,
        config.specialMechanisms.freezeMeltTripleCount,
      ),
    }),
    Object.freeze({
      type: DOG_ILLUSION_MECHANISM_TYPE,
      isMatchable: () => true,
      onEnterTray: revealIllusionOnEnterTray,
      onSuccessfulTriples: keepIllusionBlock,
    }),
    Object.freeze({
      type: DOG_MAGNETIC_MECHANISM_TYPE,
      isMatchable: () => true,
      onEnterTray: consumeMagneticOnEnterTray,
      onSuccessfulTriples: keepMagneticBlock,
    }),
    Object.freeze({
      type: DOG_TWIN_MECHANISM_TYPE,
      isMatchable: () => true,
      onEnterTray: splitTwinBlock,
      onSuccessfulTriples: keepTwinBlock,
    }),
  ]);
}

export const DOG_SPECIAL_MECHANISM_HANDLERS = createDogSpecialMechanismHandlers();

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
  throw new Error(`狗了个狗 special mechanism is unsupported: ${type}`);
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

function freezeAfterSuccessfulTriples(
  block: DogTrayBlock,
  tripleCount: number,
  _triplePatterns: readonly DogPatternType[],
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

function consumeMagneticOnEnterTray(block: DogTrayBlock): DogTrayBlock {
  if (block.specialMechanism?.type !== DOG_MAGNETIC_MECHANISM_TYPE) {
    return block;
  }
  const { specialMechanism: _specialMechanism, ...ordinaryBlock } = block;
  return ordinaryBlock;
}

function keepMagneticBlock(block: DogTrayBlock): DogTrayBlock {
  return block;
}

function splitTwinBlock(block: DogTrayBlock): readonly DogTrayBlock[] {
  if (block.specialMechanism?.type !== DOG_TWIN_MECHANISM_TYPE) {
    return [block];
  }
  const { specialMechanism: _specialMechanism, ...ordinaryBlock } = block;
  return Object.freeze([
    Object.freeze({ ...ordinaryBlock, id: `${block.id}-1` }),
    Object.freeze({ ...ordinaryBlock, id: `${block.id}-2` }),
  ]);
}

function keepTwinBlock(block: DogTrayBlock): DogTrayBlock {
  return block;
}

function isDogPatternType(value: DogSpecialMechanismStateValue): value is DogPatternType {
  return typeof value === "string" && DOG_PATTERN_TYPES.includes(value as DogPatternType);
}

function getCompletedTriples(mechanism: DogSpecialMechanism): number {
  const completedTriples = mechanism.state.completedTriples;
  return typeof completedTriples === "number" && completedTriples >= 0 ? completedTriples : 0;
}
