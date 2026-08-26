import {
  DOG_FREEZE_GENERATOR_VERSION,
  DOG_FREEZE_ONLY_SPECIAL_MECHANISM_DEFINITIONS,
  DOG_ILLUSION_GENERATOR_VERSION,
  DOG_LEGACY_SPECIAL_MECHANISM_DEFINITIONS,
  DOG_LEVEL_SPECIAL_MECHANISM_DEFINITIONS,
  DOG_SPECIAL_MECHANISM_GENERATOR_VERSION,
  DOG_V13_CONFIG,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
  LEVEL_GENERATOR_VERSION,
} from "@/games/dog-lege-dog/game/game-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type { DogSpecialMechanismConfig } from "@/games/dog-lege-dog/levels/level-types";
import { getProgressStage } from "@/games/dog-lege-dog/levels/level-progression";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_SPECIAL_MECHANISM_DENSITY_LIMIT,
  DOG_TWIN_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanism-handlers";

export {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_FREEZE_MELT_TRIPLE_COUNT,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_ILLUSION_MASK_STATUS,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_SPECIAL_MECHANISM_DENSITY_LIMIT,
  DOG_SPECIAL_MECHANISM_HANDLERS,
  DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO,
  DOG_TWIN_MECHANISM_TYPE,
  createDogIllusionMechanism,
  createDogSpecialMechanism,
  createDogSpecialMechanismHandlerMap,
  createDogSpecialMechanismHandlers,
  getDogIllusionDisguisedPattern,
} from "@/games/dog-lege-dog/game/special-mechanism-handlers";
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
export type {
  DogSpecialMechanismAssignmentOptions,
} from "@/games/dog-lege-dog/game/special-mechanism-assignment";
export {
  assignDogSpecialMechanisms,
} from "@/games/dog-lege-dog/game/special-mechanism-assignment";

const DOG_SUPPORTED_SPECIAL_MECHANISM_TYPES = new Set<string>([
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
]);

export function getDogSpecialMechanismConfigs(
  levelNumber: number,
  generatorVersion: number = LEVEL_GENERATOR_VERSION,
  config: DogV13Config = DOG_V13_CONFIG,
): readonly DogSpecialMechanismConfig[] {
  if (generatorVersion >= config.game.generatorVersion) {
    return getDogV13SpecialMechanismConfigs(levelNumber, config);
  }

  const definitions = getDogSpecialMechanismDefinitions(generatorVersion);
  const progressStage = getProgressStage(levelNumber, config);
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

function getDogV13SpecialMechanismConfigs(
  levelNumber: number,
  config: DogV13Config,
): readonly DogSpecialMechanismConfig[] {
  const plan = getDogV13MechanismPlan(
    getDogV13LogicalBlockCount(levelNumber, config),
    config,
  );
  return Object.freeze(
    config.specialMechanisms.mechanisms.map((definition) => {
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

/**
 * Candidate-generation view. Metadata can include mechanisms whose handlers
 * are not active in current runtime; generation only places supported types.
 */
export function getDogSpecialMechanismConfigsForGeneration(
  levelNumber: number,
  generatorVersion: number = LEVEL_GENERATOR_VERSION,
  config: DogV13Config = DOG_V13_CONFIG,
): readonly DogSpecialMechanismConfig[] {
  return getDogSpecialMechanismConfigs(levelNumber, generatorVersion, config).filter(
    (configuration) => DOG_SUPPORTED_SPECIAL_MECHANISM_TYPES.has(configuration.type),
  );
}

/**
 * Keeps configured minimums compatible with shared logical-density cap.
 * Metadata still exposes every configured mechanism.
 */
export function limitDogSpecialMechanismConfigsForLogicalDensity(
  configurations: readonly DogSpecialMechanismConfig[],
  logicalBlockCount: number,
  logicalBudgetRatio = DOG_SPECIAL_MECHANISM_DENSITY_LIMIT,
): readonly DogSpecialMechanismConfig[] {
  if (!Number.isSafeInteger(logicalBlockCount) || logicalBlockCount <= 0) {
    throw new Error("狗了个狗 logical block count is invalid");
  }

  const maxLogicalUnitCount = Math.floor(
    logicalBlockCount * logicalBudgetRatio + Number.EPSILON,
  );
  const activeConfigurations = [...configurations];
  while (
    activeConfigurations.reduce(
      (total, configuration) =>
        total + configuration.min * resolveDensityWeight(configuration),
      0,
    ) > maxLogicalUnitCount
  ) {
    const removableIndex = [...activeConfigurations]
      .map((configuration, index) => ({ configuration, index }))
      .reverse()
      .find(({ configuration }) => configuration.type !== DOG_TWIN_MECHANISM_TYPE)
      ?.index;
    if (removableIndex === undefined) {
      throw new Error("狗了个狗 special mechanism minimum density is unsatisfiable");
    }
    activeConfigurations.splice(removableIndex, 1);
  }
  return Object.freeze(activeConfigurations);
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
  if (generatorVersion < DOG_SPECIAL_MECHANISM_GENERATOR_VERSION) {
    return DOG_LEGACY_SPECIAL_MECHANISM_DEFINITIONS;
  }
  return DOG_LEVEL_SPECIAL_MECHANISM_DEFINITIONS;
}

function resolveDensityWeight(configuration: DogSpecialMechanismConfig): number {
  const weight = configuration.densityWeight ?? 1;
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error("狗了个狗 special mechanism density weight is invalid");
  }
  return weight;
}
