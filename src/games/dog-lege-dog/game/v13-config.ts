import {
  DOG_V13_SCHEMA_VERSION,
  type DogConfigChangeArea,
  type DogV13Config,
  type DogV13ConfigIssue,
  type DogV13DifficultyTarget,
  type DogV13ItemId,
  type DogV13MechanismPlan,
  type DogV13MechanismType,
  type DogV13StructureStage,
  type DogV13TestProfile,
  type DogV13TestProfileName,
} from "@/games/dog-lege-dog/game/v13-config-types";
import { DOG_V13_CONFIG_SOURCE } from "@/games/dog-lege-dog/game/v13-config-source";
import {
  cloneAndFreeze,
  collectConfigIssues,
} from "@/games/dog-lege-dog/game/v13-config-validation";

export * from "@/games/dog-lege-dog/game/v13-config-types";

export class DogV13ConfigError extends Error {
  readonly issues: readonly DogV13ConfigIssue[];

  constructor(issues: readonly DogV13ConfigIssue[]) {
    super(`狗了个狗 v13 配置无效：${issues.map((issue) => `${issue.path}（${issue.message}）`).join("；")}`);
    this.name = "DogV13ConfigError";
    this.issues = Object.freeze([...issues]);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function assertDogV13Config(input: unknown): asserts input is DogV13Config {
  const issues = collectConfigIssues(input);
  if (issues.length > 0) throw new DogV13ConfigError(issues);
}

export function validateDogV13Config(input: unknown): DogV13Config {
  assertDogV13Config(input);
  return input;
}

export function getDogV13ConfigIssues(input: unknown): readonly DogV13ConfigIssue[] {
  return Object.freeze(collectConfigIssues(input));
}

export function loadDogV13Config(input: unknown = DOG_V13_CONFIG_SOURCE): DogV13Config {
  validateDogV13Config(input);
  return cloneAndFreeze(input) as DogV13Config;
}

export const DOG_V13_CONFIG = loadDogV13Config();

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

export function getDogV13LevelStageIndex(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  validateLevelNumber(levelNumber, config);
  const index = config.levels.structureStages.findIndex(
    (candidate) => levelNumber >= candidate.minLevel && levelNumber <= candidate.maxLevel,
  );
  if (index < 0) throw new Error(`狗了个狗 v13 level stage is unavailable for level ${levelNumber}`);
  return index;
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
  const { logicalBudgetRatio, budgetRounding } = config.specialMechanisms;
  const budget = logicalBlockCount * logicalBudgetRatio;
  return budgetRounding === "floor" ? Math.floor(budget + Number.EPSILON) : budget;
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

export function getDogV13MechanismPlan(
  logicalBlockCount: number,
  config: DogV13Config = DOG_V13_CONFIG,
): DogV13MechanismPlan {
  const budget = getDogV13SpecialMechanismBudget(logicalBlockCount, config);
  const definitions = config.specialMechanisms.mechanisms;
  const counts = Object.fromEntries(
    definitions.map((definition) => [definition.type, 0]),
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
    if (definition.logicalUnitWeight > remaining) {
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
  return cloneAndFreeze(target) as DogV13DifficultyTarget;
}

export function getDogV13ItemUses(
  itemId: DogV13ItemId,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  if (!config.items.ids.includes(itemId)) throw new Error(`狗了个狗 v13 item is not configured: ${itemId}`);
  return itemId === config.items.key.id ? config.items.key.initialUses : config.items.maxSuccessfulUsesPerLevel;
}

export function getDogTestProfile(
  profileName?: DogV13TestProfileName,
  config: DogV13Config = DOG_V13_CONFIG,
): DogV13TestProfile {
  const resolvedName = profileName ?? config.testProfiles.default;
  const profile = config.testProfiles.profiles[resolvedName];
  if (profile === undefined) throw new Error(`狗了个狗 v13 test profile is unavailable: ${resolvedName}`);
  return cloneAndFreeze(profile) as DogV13TestProfile;
}

export function selectDogTestProfile(
  areas: DogConfigChangeArea | readonly DogConfigChangeArea[],
): DogV13TestProfileName {
  const changedAreas = typeof areas === "string" ? [areas] : areas;
  const selection = DOG_V13_CONFIG.testProfiles.selection;
  if (changedAreas.some((area) => selection.fullAreas.includes(area))) return "full";
  if (changedAreas.some((area) => selection.smokeAreas.includes(area))) return "smoke";
  return "focused";
}

function validateLevelNumber(levelNumber: number, config: DogV13Config): void {
  if (!Number.isSafeInteger(levelNumber) || levelNumber < config.game.firstLevelNumber || levelNumber > config.game.maxLevelNumber) {
    throw new Error(`狗了个狗 v13 level number must be an integer from ${config.game.firstLevelNumber} to ${config.game.maxLevelNumber}`);
  }
}

void DOG_V13_SCHEMA_VERSION;
