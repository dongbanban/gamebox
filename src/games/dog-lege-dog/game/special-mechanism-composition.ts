import {
  type DogBlock,
  type DogSpecialMechanism,
  type DogSpecialMechanismConfig,
  type DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  DOG_SPECIAL_MECHANISM_DENSITY_LIMIT,
  DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO,
  DOG_TWIN_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanism-handlers";
import type { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";

export interface DogSpecialMechanismComposition {
  readonly specialMechanismCount: number;
  readonly logicalUnitCount: number;
  readonly specialMechanismDensity: number;
  readonly middleLayerCount: number;
  readonly middleLayerRatio: number;
}

export function getDogSpecialMechanismComposition(
  blocks: readonly DogBlock[],
  maxLayers: number,
  configurations: readonly DogSpecialMechanismConfig[] = [],
): DogSpecialMechanismComposition {
  const specialBlocks = blocks.filter((block) => block.specialMechanism !== undefined);
  const logicalUnitCount = specialBlocks.reduce(
    (total, block) => total + getLogicalUnitWeightForType(
      block.specialMechanism?.type ?? "",
      configurations,
    ),
    0,
  );
  const logicalBlockCount = getDogLogicalBlockCount(blocks, configurations);
  const middleLayerCount = specialBlocks.filter(
    (block) => block.z > 0 && block.z < maxLayers - 1,
  ).length;
  return Object.freeze({
    specialMechanismCount: specialBlocks.length,
    logicalUnitCount,
    specialMechanismDensity: logicalBlockCount === 0 ? 0 : logicalUnitCount / logicalBlockCount,
    middleLayerCount,
    middleLayerRatio: specialBlocks.length === 0 ? 1 : middleLayerCount / specialBlocks.length,
  });
}

export function getDogSpecialMechanismLogicalUnitWeight(
  mechanism: Pick<DogSpecialMechanism, "type"> | DogSpecialMechanismConfig,
): number {
  if ("densityWeight" in mechanism) {
    return resolveDensityWeight(mechanism);
  }
  return mechanism.type === DOG_TWIN_MECHANISM_TYPE ? 2 : 1;
}

export function getDogBlockLogicalUnitCount(
  block: Pick<DogBlock, "specialMechanism">,
  configurations: readonly DogSpecialMechanismConfig[] = [],
): number {
  return block.specialMechanism === undefined
    ? 1
    : getLogicalUnitWeightForType(block.specialMechanism.type, configurations);
}

export function getDogTrayLogicalUnitCount(
  tray: readonly Pick<DogTrayBlock, "specialMechanism">[],
): number {
  return tray.reduce((total, block) => total + getDogBlockLogicalUnitCount(block), 0);
}

export function getDogLogicalBlockCount(
  blocks: readonly Pick<DogBlock, "specialMechanism">[],
  configurations: readonly DogSpecialMechanismConfig[] = [],
): number {
  return blocks.reduce(
    (total, block) => total + getDogBlockLogicalUnitCount(block, configurations),
    0,
  );
}

export function selectDogSpecialMechanismCounts(
  configurations: readonly DogSpecialMechanismConfig[],
  random: SeededRandom,
  logicalBlockCount?: number,
  logicalBudgetRatio = DOG_SPECIAL_MECHANISM_DENSITY_LIMIT,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const configuration of configurations) {
    validateDogSpecialMechanismConfiguration(configuration);
    counts.set(
      configuration.type,
      configuration.min + random.nextInt(configuration.max - configuration.min + 1),
    );
  }
  if (logicalBlockCount !== undefined) {
    const maxLogicalUnitCount = Math.floor(
      logicalBlockCount * logicalBudgetRatio + Number.EPSILON,
    );
    while ([...counts.entries()].reduce((total, [type, count]) => {
      const configuration = configurations.find((candidate) => candidate.type === type);
      return total + count * (configuration === undefined ? 1 : resolveDensityWeight(configuration));
    }, 0) > maxLogicalUnitCount) {
      const reducible = [...configurations]
        .reverse()
        .find((configuration) =>
          configuration.type !== DOG_TWIN_MECHANISM_TYPE &&
          (counts.get(configuration.type) ?? configuration.min) > configuration.min,
        ) ?? [...configurations]
          .reverse()
          .find((configuration) => (counts.get(configuration.type) ?? configuration.min) > configuration.min);
      if (reducible === undefined) {
        throw new Error("狗了个狗 special mechanism count density is unsatisfiable");
      }
      counts.set(reducible.type, (counts.get(reducible.type) ?? reducible.min) - 1);
    }
  }
  return counts;
}

export function validateDogSpecialMechanismComposition(
  blocks: readonly DogBlock[],
  maxLayers: number,
  configurations: readonly DogSpecialMechanismConfig[],
  minimumMiddleLayerRatio = DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO,
  densityLimit = DOG_SPECIAL_MECHANISM_DENSITY_LIMIT,
): string | undefined {
  if (!Number.isSafeInteger(maxLayers) || maxLayers < 1) {
    return "狗了个狗 special mechanism composition layer count is invalid";
  }
  if (!Number.isFinite(minimumMiddleLayerRatio) || minimumMiddleLayerRatio < 0 || minimumMiddleLayerRatio > 1) {
    return "狗了个狗 special mechanism middle-layer ratio is invalid";
  }

  const seenTypes = new Set<string>();
  for (const configuration of configurations) {
    validateDogSpecialMechanismConfiguration(configuration);
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
  if (composition.specialMechanismDensity > densityLimit) {
    return `狗了个狗 special mechanism density exceeds ${densityLimit * 100}%`;
  }
  return undefined;
}

function getLogicalUnitWeightForType(
  type: string,
  configurations: readonly DogSpecialMechanismConfig[],
): number {
  const configuration = configurations.find((candidate) => candidate.type === type);
  return configuration === undefined ? (type === DOG_TWIN_MECHANISM_TYPE ? 2 : 1) :
    getDogSpecialMechanismLogicalUnitWeight(configuration);
}

export function validateDogSpecialMechanismConfiguration(
  configuration: DogSpecialMechanismConfig,
): void {
  if (
    typeof configuration.type !== "string" ||
    configuration.type.length === 0 ||
    !Number.isSafeInteger(configuration.min) ||
    !Number.isSafeInteger(configuration.max) ||
    configuration.min < 1 ||
    configuration.max < configuration.min ||
    (configuration.densityWeight !== undefined &&
      (!Number.isFinite(configuration.densityWeight) || configuration.densityWeight <= 0))
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
