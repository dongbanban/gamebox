import {
  DOG_V13_CONFIG,
  getDogV13ActiveMechanismDefinitions,
  getDogV13LogicalBlockCount,
  getDogV13MechanismPlan,
} from "@/games/dog-lege-dog/game/v13-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type { DogSpecialMechanismConfig } from "@/games/dog-lege-dog/levels/level-types";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_SHUFFLE_ARMED_STATUS,
  DOG_SHUFFLE_CONSUMED_STATUS,
  DOG_SHUFFLE_DORMANT_STATUS,
  DOG_SHUFFLE_MECHANISM_TYPE,
  DOG_SHUFFLE_TRIGGERABLE_STATUS,
  DOG_SPECIAL_MECHANISM_DENSITY_LIMIT,
  DOG_TWIN_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanism-handlers";

export {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_FREEZE_MELT_TRIPLE_COUNT,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_ILLUSION_MASK_STATUS,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_SHUFFLE_ARMED_STATUS,
  DOG_SHUFFLE_CONSUMED_STATUS,
  DOG_SHUFFLE_DORMANT_STATUS,
  DOG_SHUFFLE_MECHANISM_TYPE,
  DOG_SPECIAL_MECHANISM_DENSITY_LIMIT,
  DOG_SPECIAL_MECHANISM_HANDLERS,
  DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO,
  DOG_TWIN_MECHANISM_TYPE,
  DOG_SHUFFLE_TRIGGERABLE_STATUS,
  armDogShuffleBlock,
  consumeDogShuffleBlock,
  createDogIllusionMechanism,
  createDogShuffleMechanism,
  createDogSpecialMechanism,
  createDogSpecialMechanismHandlerMap,
  createDogSpecialMechanismHandlers,
  getDogIllusionDisguisedPattern,
  getDogShuffleMechanismStatus,
  isDogSpecialMechanismResolved,
  triggerDogShuffleBlock,
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
  );
  return Object.freeze(
    getDogV13ActiveMechanismDefinitions(config)
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
