import {
  DOG_V13_MECHANISM_TYPES,
  type DogV13Config,
  type DogV13DifficultyTarget,
  type DogV13ItemId,
  type DogV13MechanismDefinition,
  type DogV13MechanismPlan,
  type DogV13MechanismType,
  type DogV13StructureStage,
} from "@/games/dog-lege-dog/game/v13-config-types";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config-source";

export * from "@/games/dog-lege-dog/game/v13-config-types";

export { DOG_V13_CONFIG };

export function getDogV13LevelStage(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): DogV13StructureStage {
  validateLevelNumber(levelNumber, config);
  const stage = config.levels.structureStages.find(
    (candidate) => levelNumber >= candidate.minLevel && levelNumber <= candidate.maxLevel,
  );
  if (stage === undefined) throw new Error(`狗了个狗 v13 level stage is unavailable for level ${levelNumber}`);
  return { ...stage };
}

export function getDogV13LogicalBlockCount(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  validateLevelNumber(levelNumber, config);
  const progression = config.levels.logicalBlockCount;
  return Math.min(
    progression.cap,
    progression.start + Math.floor((levelNumber - 1) / progression.incrementEveryLevels) * progression.increment,
  );
}

export function getDogV13SpecialMechanismBudget(
  logicalBlockCount: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  if (!Number.isSafeInteger(logicalBlockCount) || logicalBlockCount < 0) {
    throw new Error("狗了个狗 v13 logical block count must be a non-negative integer");
  }
  const { logicalBudgetRatio } = config.specialMechanisms;
  const budget = logicalBlockCount * logicalBudgetRatio;
  return Math.floor(budget + Number.EPSILON);
}

export function getDogShuffleThreshold(
  effectiveTrayCapacity: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  if (!Number.isSafeInteger(effectiveTrayCapacity) || effectiveTrayCapacity < 1) {
    throw new Error("狗了个狗 shuffle effective tray capacity must be a positive integer");
  }

  const { maxLogicalUnitCount, capacityBuffer } = config.specialMechanisms.shuffle.threshold;
  return Math.min(
    maxLogicalUnitCount,
    Math.max(0, effectiveTrayCapacity - capacityBuffer),
  );
}

export function getDogV13ActiveMechanismDefinitions(
  config: DogV13Config = DOG_V13_CONFIG,
  levelNumber?: number,
): readonly DogV13MechanismDefinition[] {
  if (levelNumber !== undefined) {
    validateLevelNumber(levelNumber, config);
  }
  return Object.freeze(
    config.specialMechanisms.mechanisms.filter(
      (definition) => definition.type !== "shuffle" || (
        config.specialMechanisms.shuffle.enabled &&
        (levelNumber === undefined ||
          levelNumber >= config.specialMechanisms.shuffle.firstLevelNumber)
      ),
    ),
  );
}

export function getDogV13MechanismPlan(
  logicalBlockCount: number,
  config: DogV13Config = DOG_V13_CONFIG,
  levelNumber: number = config.game.firstLevelNumber,
): DogV13MechanismPlan {
  const budget = getDogV13SpecialMechanismBudget(logicalBlockCount, config);
  const definitions = getDogV13ActiveMechanismDefinitions(config, levelNumber);
  const counts = Object.fromEntries(
    DOG_V13_MECHANISM_TYPES.map((type) => [type, 0]),
  ) as Record<DogV13MechanismType, number>;
  const requiredLogicalUnits = definitions.reduce((total, definition) => total + definition.logicalUnitWeight, 0);
  if (config.specialMechanisms.requireAllTypes && budget < requiredLogicalUnits) {
    throw new Error(`狗了个狗 v13 special mechanism budget ${budget} cannot include all mechanism types`);
  }

  let remaining = budget;
  let cursor = 0;
  let skippedThisRound = 0;
  while (remaining > 0 && skippedThisRound < definitions.length) {
    const definition = definitions[cursor % definitions.length];
    cursor += 1;
    const maxCount = definition.type === "shuffle"
      ? config.specialMechanisms.shuffle.maxPerLevel
      : Number.MAX_SAFE_INTEGER;
    if (
      definition.logicalUnitWeight > remaining ||
      counts[definition.type] >= maxCount
    ) {
      skippedThisRound += 1;
      continue;
    }
    counts[definition.type] += 1;
    remaining -= definition.logicalUnitWeight;
    skippedThisRound = 0;
  }
  return Object.freeze({
    budget,
    counts: Object.freeze(counts),
    logicalUnitCount: budget - remaining,
    physicalBlockCount: Object.values(counts).reduce((total, count) => total + count, 0),
    unallocatedLogicalUnitCount: remaining,
  });
}

export function getDogV13DifficultyTarget(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): DogV13DifficultyTarget {
  validateLevelNumber(levelNumber, config);
  const target = config.difficulty.targets.find(
    (candidate) => levelNumber >= candidate.minLevel && levelNumber <= candidate.maxLevel,
  );
  if (target === undefined) throw new Error(`狗了个狗 v13 difficulty target is unavailable for level ${levelNumber}`);
  return target;
}

export function getDogV13ItemUses(
  itemId: DogV13ItemId,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  if (!config.items.ids.includes(itemId)) throw new Error(`狗了个狗 v13 item is not configured: ${itemId}`);
  return itemId === config.items.key.id ? config.items.key.initialUses : config.items.maxSuccessfulUsesPerLevel;
}

function validateLevelNumber(levelNumber: number, config: DogV13Config): void {
  if (!Number.isSafeInteger(levelNumber) || levelNumber < config.game.firstLevelNumber || levelNumber > config.game.maxLevelNumber) {
    throw new Error(`狗了个狗 v13 level number must be an integer from ${config.game.firstLevelNumber} to ${config.game.maxLevelNumber}`);
  }
}
