import {
  type DogConfigChangeArea,
  type DogV13ConfigIssue,
  type DogV13ItemId,
  type DogV13MechanismType,
} from "@/games/dog-lege-dog/game/v13-config-types";
import { DOG_PATTERN_TYPES } from "@/games/dog-lege-dog/levels/level-types";
import { SUPPORTED_ITEM_IDS } from "@/games/dog-lege-dog/game/v13-config-source";
import {
  asNumber,
  asRecord,
  isRecord,
  isFiniteNumber,
  validateAssetMap,
  requiredObject,
  validateFiniteNumber,
  validateInteger,
  validateLevelNumberArray,
  validateNonEmptyString,
  validateRange,
  validateRangeObject,
  validateStringArray,
  validateUnique,
} from "@/games/dog-lege-dog/game/v13-config-validation-primitives";

export function validateGame(value: unknown, issues: DogV13ConfigIssue[]): void {
  const game = asRecord(value);
  if (game === undefined) return;
  if (game.id !== "dog-lege-dog") {
    issues.push({ path: "game.id", code: "value", message: "必须是 dog-lege-dog" });
  }
  validateInteger(game.firstLevelNumber, "game.firstLevelNumber", 1, issues);
  validateInteger(game.maxLevelNumber, "game.maxLevelNumber", 1, issues);
  validateInteger(game.generatorVersion, "game.generatorVersion", 13, issues, 13);
  if (game.firstLevelNumber !== 1) {
    issues.push({ path: "game.firstLevelNumber", code: "value", message: "v13 必须是 1" });
  }
  if (game.maxLevelNumber !== 99) {
    issues.push({ path: "game.maxLevelNumber", code: "value", message: "v13 必须是 99" });
  }
  if (game.generatorVersion !== 13) {
    issues.push({ path: "game.generatorVersion", code: "value", message: "v13 必须是 13" });
  }
  validateFiniteNumber(game.defaultReward, "game.defaultReward", 0, issues);
}

export function validateBoard(value: unknown, issues: DogV13ConfigIssue[]): void {
  const board = asRecord(value);
  if (board === undefined) return;
  if (board.shape !== "irregular") {
    issues.push({ path: "board.shape", code: "value", message: "必须是 irregular" });
  }
  validateInteger(board.logicalCellSize, "board.logicalCellSize", 1, issues);
  validateInteger(board.blockWidth, "board.blockWidth", 1, issues);
  validateInteger(board.blockHeight, "board.blockHeight", 1, issues);
  validateInteger(board.maxMechanismsPerBlock, "board.maxMechanismsPerBlock", 1, issues, 1);
}

export function validateLevels(value: unknown, issues: DogV13ConfigIssue[]): void {
  const levels = asRecord(value);
  if (levels === undefined) return;
  validateInteger(levels.firstLevelNumber, "levels.firstLevelNumber", 1, issues);
  validateInteger(levels.maxLevelNumber, "levels.maxLevelNumber", 1, issues);
  if (levels.firstLevelNumber !== 1) {
    issues.push({ path: "levels.firstLevelNumber", code: "value", message: "v13 必须是 1" });
  }
  if (levels.maxLevelNumber !== 99) {
    issues.push({ path: "levels.maxLevelNumber", code: "value", message: "v13 必须是 99" });
  }
  const progression = asRecord(levels.logicalBlockCount);
  if (progression === undefined) {
    requiredObject(levels, "logicalBlockCount", issues, "levels");
  } else {
    validateInteger(progression.start, "levels.logicalBlockCount.start", 1, issues);
    validateInteger(progression.increment, "levels.logicalBlockCount.increment", 0, issues);
    validateInteger(progression.incrementEveryLevels, "levels.logicalBlockCount.incrementEveryLevels", 1, issues);
    validateInteger(progression.cap, "levels.logicalBlockCount.cap", 1, issues);
    if (isFiniteNumber(progression.start) && isFiniteNumber(progression.cap) && progression.cap < progression.start) {
      issues.push({ path: "levels.logicalBlockCount.cap", code: "relation", message: "不能小于 start" });
    }
  }
  validateStructureStages(levels.structureStages, "levels.structureStages", levels.maxLevelNumber, issues);
}

export function validateTray(value: unknown, issues: DogV13ConfigIssue[]): void {
  const tray = asRecord(value);
  if (tray === undefined) return;
  validateInteger(tray.baseCapacity, "tray.baseCapacity", 1, issues);
  validateInteger(tray.maxCapacity, "tray.maxCapacity", 1, issues);
  validateInteger(tray.maxLockedSlotCount, "tray.maxLockedSlotCount", 0, issues);
  if (tray.lockedSlotPlacement !== "right") {
    issues.push({ path: "tray.lockedSlotPlacement", code: "value", message: "必须是 right" });
  }
  if (isFiniteNumber(tray.baseCapacity) && isFiniteNumber(tray.maxCapacity) && tray.maxCapacity < tray.baseCapacity) {
    issues.push({ path: "tray.maxCapacity", code: "relation", message: "不能小于 baseCapacity" });
  }
  if (isFiniteNumber(tray.maxLockedSlotCount) && isFiniteNumber(tray.baseCapacity) && tray.maxLockedSlotCount > tray.baseCapacity) {
    issues.push({ path: "tray.maxLockedSlotCount", code: "relation", message: "不能大于 baseCapacity" });
  }
}

export function validateItems(value: unknown, issues: DogV13ConfigIssue[]): void {
  const items = asRecord(value);
  if (items === undefined) return;
  const ids = items.ids;
  validateStringArray(ids, "items.ids", issues);
  if (Array.isArray(ids)) {
    validateUnique(ids, "items.ids", issues);
    for (const [index, itemId] of ids.entries()) {
      if (!SUPPORTED_ITEM_IDS.includes(itemId as DogV13ItemId)) {
        issues.push({ path: `items.ids[${index}]`, code: "value", message: "道具 ID 不受支持" });
      }
    }
    if (ids.length !== SUPPORTED_ITEM_IDS.length || SUPPORTED_ITEM_IDS.some((id) => !ids.includes(id))) {
      issues.push({ path: "items.ids", code: "relation", message: "必须完整包含 v13 道具集合" });
    }
  }
  validateInteger(items.loadoutSize, "items.loadoutSize", 1, issues);
  if (isFiniteNumber(items.loadoutSize) && Array.isArray(ids) && items.loadoutSize > ids.length) {
    issues.push({ path: "items.loadoutSize", code: "relation", message: "不能大于道具数量" });
  }
  validateInteger(items.defaultUsesPerLevel, "items.defaultUsesPerLevel", 1, issues, 1);
  validateInteger(items.maxSuccessfulUsesPerLevel, "items.maxSuccessfulUsesPerLevel", 1, issues, 1);
  const key = asRecord(items.key);
  if (key === undefined) {
    requiredObject(items, "key", issues, "items");
    return;
  }
  if (key.id !== "key") issues.push({ path: "items.key.id", code: "value", message: "必须是 key" });
  validateInteger(key.initialUses, "items.key.initialUses", 0, issues, 0);
  if (key.usesCappedByLockedSlots !== true) {
    issues.push({ path: "items.key.usesCappedByLockedSlots", code: "value", message: "必须为 true" });
  }
  validateRange(key.dropRate, "items.key.dropRate", 0, 1, issues);
  if (Array.isArray(items.ids) && !items.ids.includes("key")) {
    issues.push({ path: "items.ids", code: "relation", message: "必须包含 key" });
  }
}

export function validateSpecialMechanisms(value: unknown, issues: DogV13ConfigIssue[]): void {
  const special = asRecord(value);
  if (special === undefined) return;
  validateRange(special.logicalBudgetRatio, "specialMechanisms.logicalBudgetRatio", 0, 1, issues, false);
  if (special.logicalBudgetRatio !== 0.3) issues.push({ path: "specialMechanisms.logicalBudgetRatio", code: "value", message: "v13 必须是 0.3" });
  if (special.budgetRounding !== "floor") issues.push({ path: "specialMechanisms.budgetRounding", code: "value", message: "必须是 floor" });
  if (special.remainderStrategy !== "stable-round-robin") issues.push({ path: "specialMechanisms.remainderStrategy", code: "value", message: "必须是 stable-round-robin" });
  if (special.requireAllTypes !== true) issues.push({ path: "specialMechanisms.requireAllTypes", code: "value", message: "必须为 true" });
  validateInteger(special.freezeMeltTripleCount, "specialMechanisms.freezeMeltTripleCount", 1, issues);
  const mechanisms = special.mechanisms;
  if (!Array.isArray(mechanisms) || mechanisms.length === 0) {
    issues.push({ path: "specialMechanisms.mechanisms", code: "required", message: "必须包含机制定义" });
    return;
  }
  const expectedTypes: readonly DogV13MechanismType[] = ["freeze", "illusion", "magnetic", "twin"];
  const types = mechanisms.map((mechanism) => asRecord(mechanism)?.type);
  validateUnique(types, "specialMechanisms.mechanisms.type", issues);
  for (const type of expectedTypes) {
    if (!types.includes(type)) issues.push({ path: "specialMechanisms.mechanisms", code: "relation", message: `必须包含 ${type}` });
  }
  for (const [index, mechanism] of mechanisms.entries()) {
    const record = asRecord(mechanism);
    if (record === undefined) {
      issues.push({ path: `specialMechanisms.mechanisms[${index}]`, code: "type", message: "必须是对象" });
      continue;
    }
    if (!expectedTypes.includes(record.type as DogV13MechanismType)) {
      issues.push({ path: `specialMechanisms.mechanisms[${index}].type`, code: "value", message: "机制类型不受支持" });
    }
    validateInteger(record.logicalUnitWeight, `specialMechanisms.mechanisms[${index}].logicalUnitWeight`, 1, issues);
    validateFiniteNumber(record.operationCost, `specialMechanisms.mechanisms[${index}].operationCost`, 0, issues);
    const expectedWeight = record.type === "twin" ? 2 : 1;
    if (record.logicalUnitWeight !== expectedWeight) {
      issues.push({ path: `specialMechanisms.mechanisms[${index}].logicalUnitWeight`, code: "value", message: `${String(record.type)} 的 v13 权重必须是 ${expectedWeight}` });
    }
  }
}

export function validateDifficulty(value: unknown, maxLevelValue: unknown, issues: DogV13ConfigIssue[]): void {
  const difficulty = asRecord(value);
  if (difficulty === undefined) return;
  validateDifficultyTargets(difficulty.targets, "difficulty.targets", maxLevelValue, issues);
  validateDifficultyScoring(difficulty.scoring, "difficulty.scoring", issues);
}

export function validateAnimation(value: unknown, issues: DogV13ConfigIssue[]): void {
  const animation = asRecord(value);
  if (animation === undefined) return;
  for (const key of ["blockFlightMs", "illusionRevealMs", "itemFeedbackMs", "freezeMeltMs", "twinSplitMs", "magneticAttractionMs", "keyDropMs", "trayUnlockMs"]) {
    validateInteger(animation[key], `animation.${key}`, 1, issues);
  }
  if (animation.inputLockedDuringAnimation !== true) {
    issues.push({ path: "animation.inputLockedDuringAnimation", code: "value", message: "必须为 true" });
  }
}

export function validateAssets(value: unknown, itemsValue: unknown, issues: DogV13ConfigIssue[]): void {
  const assets = asRecord(value);
  if (assets === undefined) return;
  validateAssetMap(assets.patterns, "assets.patterns", DOG_PATTERN_TYPES, issues);
  validateAssetMap(assets.items, "assets.items", asRecord(itemsValue)?.ids, issues);
  validateNonEmptyString(assets.music, "assets.music", issues);
}

export function validateAudio(value: unknown, issues: DogV13ConfigIssue[]): void {
  const audio = asRecord(value);
  if (audio === undefined) return;
  const music = asRecord(audio.music);
  if (music === undefined) requiredObject(audio, "music", issues, "audio");
  else {
    validateNonEmptyString(music.path, "audio.music.path", issues);
    validateRange(music.volume, "audio.music.volume", 0, 1, issues);
  }
  const effects = asRecord(audio.effects);
  if (effects === undefined || Object.keys(effects).length === 0) {
    requiredObject(audio, "effects", issues, "audio");
    return;
  }
  for (const effectName of ["select", "match", "won", "lost"]) {
    if (!isRecord(effects[effectName])) issues.push({ path: `audio.effects.${effectName}`, code: "required", message: "必须配置" });
  }
  for (const [name, effect] of Object.entries(effects)) validateAudioEffect(effect, `audio.effects.${name}`, issues);
}

export function validateTestProfiles(value: unknown, maxLevelValue: unknown, issues: DogV13ConfigIssue[]): void {
  const testProfiles = asRecord(value);
  if (testProfiles === undefined) return;
  if (!["focused", "smoke", "full"].includes(String(testProfiles.default))) {
    issues.push({ path: "testProfiles.default", code: "value", message: "profile 不受支持" });
  }
  const selection = asRecord(testProfiles.selection);
  if (selection === undefined) requiredObject(testProfiles, "selection", issues, "testProfiles");
  else validateProfileAreas(selection, issues);
  const profiles = asRecord(testProfiles.profiles);
  if (profiles === undefined) {
    requiredObject(testProfiles, "profiles", issues, "testProfiles");
    return;
  }
  for (const name of ["focused", "smoke", "full"] as const) validateProfile(profiles[name], name, maxLevelValue, issues);
}

function validateDifficultyTargets(value: unknown, path: string, maxLevelValue: unknown, issues: DogV13ConfigIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, code: "required", message: "必须包含难度目标" });
    return;
  }
  const maxLevel = asNumber(maxLevelValue);
  let previousMaxLevel = 0;
  for (const [index, target] of value.entries()) {
    const record = asRecord(target);
    if (record === undefined) {
      issues.push({ path: `${path}[${index}]`, code: "type", message: "必须是对象" });
      continue;
    }
    validateInteger(record.minLevel, `${path}[${index}].minLevel`, 1, issues);
    validateInteger(record.maxLevel, `${path}[${index}].maxLevel`, 1, issues);
    if (isFiniteNumber(record.minLevel) && isFiniteNumber(record.maxLevel) && record.maxLevel < record.minLevel) {
      issues.push({ path: `${path}[${index}].maxLevel`, code: "relation", message: "不能小于 minLevel" });
    }
    if (asNumber(record.minLevel) !== undefined && asNumber(record.minLevel) !== previousMaxLevel + 1) {
      issues.push({ path: `${path}[${index}].minLevel`, code: "relation", message: "目标区间必须连续" });
    }
    previousMaxLevel = asNumber(record.maxLevel) ?? previousMaxLevel;
    for (const key of ["safeChoiceCount", "safeChoiceRate", "durationMinutes", "trayPeakPressure", "mechanismDensity", "operationCost", "mistakeRisk"] as const) {
      const rangePath = `${path}[${index}].${key}`;
      const integer = key === "safeChoiceCount";
      const max = integer ? Number.MAX_SAFE_INTEGER : key === "durationMinutes" ? Number.MAX_SAFE_INTEGER : 1;
      validateRangeObject(record[key], rangePath, issues, integer ? 1 : 0, max, integer);
    }
  }
  if (maxLevel !== undefined && previousMaxLevel !== maxLevel) issues.push({ path, code: "relation", message: "目标区间必须覆盖全部关卡" });
}

function validateDifficultyScoring(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
  const scoring = asRecord(value);
  if (scoring === undefined) {
    issues.push({ path, code: "required", message: "必须是对象" });
    return;
  }
  const sections = ["trayPressure", "operationCost", "duration", "mistakeRisk"] as const;
  const records = Object.fromEntries(sections.map((key) => [key, asRecord(scoring[key])])) as Record<typeof sections[number], Record<string, unknown> | undefined>;
  for (const key of sections) if (records[key] === undefined) requiredObject(scoring, key, issues, path);
  const tray = records.trayPressure;
  validateWeight(tray?.occupancyWeight, `${path}.trayPressure.occupancyWeight`, issues);
  validateWeight(tray?.choicePressureWeight, `${path}.trayPressure.choicePressureWeight`, issues);
  if (isFiniteNumber(tray?.occupancyWeight) && isFiniteNumber(tray?.choicePressureWeight) && tray.occupancyWeight + tray.choicePressureWeight !== 1) {
    issues.push({ path: `${path}.trayPressure`, code: "relation", message: "压力权重之和必须是 1" });
  }
  validateWeight(records.operationCost?.magneticTargetWeight, `${path}.operationCost.magneticTargetWeight`, issues);
  for (const key of ["operationCostWeight", "lockWeight"] as const) validateWeight(records.duration?.[key], `${path}.duration.${key}`, issues);
  for (const key of ["base", "choiceWeight", "trayPressureWeight", "operationCostWeight", "lockWeight"] as const) validateWeight(records.mistakeRisk?.[key], `${path}.mistakeRisk.${key}`, issues);
  const mistakeWeights = [records.mistakeRisk?.base, records.mistakeRisk?.choiceWeight, records.mistakeRisk?.trayPressureWeight, records.mistakeRisk?.operationCostWeight, records.mistakeRisk?.lockWeight];
  if (mistakeWeights.every(isFiniteNumber) && mistakeWeights.reduce((total, weight) => total + weight, 0) !== 1) {
    issues.push({ path: `${path}.mistakeRisk`, code: "relation", message: "误操作风险权重之和必须是 1" });
  }
}

function validateStructureStages(value: unknown, path: string, maxLevelValue: unknown, issues: DogV13ConfigIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, code: "required", message: "必须包含关卡结构阶段" });
    return;
  }
  let previousMaxLevel = 0;
  for (const [index, stage] of value.entries()) {
    const record = asRecord(stage);
    if (record === undefined) {
      issues.push({ path: `${path}[${index}]`, code: "type", message: "必须是对象" });
      continue;
    }
    for (const key of ["minLevel", "maxLevel", "maxLayers", "patternTypeCount"]) validateInteger(record[key], `${path}[${index}].${key}`, 1, issues);
    if (isFiniteNumber(record.minLevel) && isFiniteNumber(record.maxLevel) && record.maxLevel < record.minLevel) issues.push({ path: `${path}[${index}].maxLevel`, code: "relation", message: "不能小于 minLevel" });
    if (asNumber(record.minLevel) !== undefined && asNumber(record.minLevel) !== previousMaxLevel + 1) issues.push({ path: `${path}[${index}].minLevel`, code: "relation", message: "阶段区间必须连续" });
    previousMaxLevel = asNumber(record.maxLevel) ?? previousMaxLevel;
  }
  const maxLevel = asNumber(maxLevelValue);
  if (maxLevel !== undefined && previousMaxLevel !== maxLevel) issues.push({ path, code: "relation", message: "阶段必须覆盖全部关卡" });
}

function validateAudioEffect(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
  const effect = asRecord(value);
  if (effect === undefined) {
    issues.push({ path, code: "type", message: "必须是对象" });
    return;
  }
  if (!Array.isArray(effect.frequencies) || effect.frequencies.length === 0) {
    issues.push({ path: `${path}.frequencies`, code: "required", message: "必须包含频率" });
  } else {
    for (const [index, frequency] of effect.frequencies.entries()) if (!isFiniteNumber(frequency) || frequency <= 0) issues.push({ path: `${path}.frequencies[${index}]`, code: "range", message: "必须是正数" });
  }
  validateRange(effect.durationSeconds, `${path}.durationSeconds`, 0, 10, issues, false);
  validateRange(effect.volume, `${path}.volume`, 0, 1, issues);
  validateRange(effect.noteSpacingSeconds, `${path}.noteSpacingSeconds`, 0, 10, issues);
  if (!["sine", "square", "sawtooth", "triangle"].includes(String(effect.waveform))) issues.push({ path: `${path}.waveform`, code: "value", message: "波形不受支持" });
}

function validateProfileAreas(selection: Record<string, unknown>, issues: DogV13ConfigIssue[]): void {
  const allowed: readonly DogConfigChangeArea[] = ["docs", "ui", "runtime", "generator", "solvability", "difficulty", "public-contract", "game-startup", "worker", "random-regression", "cross-browser"];
  for (const key of ["fullAreas", "smokeAreas"] as const) {
    const path = `testProfiles.selection.${key}`;
    validateStringArray(selection[key], path, issues);
    if (Array.isArray(selection[key])) {
      validateUnique(selection[key], path, issues);
      for (const [index, area] of selection[key].entries()) if (!allowed.includes(area as DogConfigChangeArea)) issues.push({ path: `${path}[${index}]`, code: "value", message: "改动领域不受支持" });
    }
  }
}

function validateProfile(value: unknown, name: string, maxLevelValue: unknown, issues: DogV13ConfigIssue[]): void {
  const profile = asRecord(value);
  if (profile === undefined) {
    issues.push({ path: `testProfiles.profiles.${name}`, code: "required", message: "必须是对象" });
    return;
  }
  const path = `testProfiles.profiles.${name}`;
  if (profile.name !== name) issues.push({ path: `${path}.name`, code: "value", message: `必须是 ${name}` });
  validateLevelNumberArray(profile.levelNumbers, `${path}.levelNumbers`, asNumber(maxLevelValue), issues);
  validateStringArray(profile.fixedSeeds, `${path}.fixedSeeds`, issues);
  validateInteger(profile.randomLevelPrefix, `${path}.randomLevelPrefix`, 0, issues, asNumber(maxLevelValue));
  validateInteger(profile.stressLevelCount, `${path}.stressLevelCount`, 0, issues, asNumber(maxLevelValue));
  for (const key of ["runUI", "runCore", "runRandomRegression", "runE2E", "runCrossBrowser", "runWorkerFallback", "runBuild", "runDiffCheck", "runFileLineCheck"]) if (typeof profile[key] !== "boolean") issues.push({ path: `${path}.${key}`, code: "type", message: "必须是布尔值" });
  validateInteger(profile.maxChangedFileLines, `${path}.maxChangedFileLines`, 1, issues);
}

function validateWeight(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
  validateRange(value, path, 0, 1, issues);
}
