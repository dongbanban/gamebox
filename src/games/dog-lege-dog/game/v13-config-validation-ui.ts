import {
  DOG_V13_ITEM_COPY_KEYS,
  type DogV13ConfigIssue,
} from "@/games/dog-lege-dog/game/v13-config-types";
import { DOG_PATTERN_TYPES, type DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import {
  asRecord,
  validateAssetMap,
  validateInteger,
  validateLevelNumberArray,
  validateNonEmptyString,
  validateRange,
  validateStringArray,
  requiredObject,
} from "@/games/dog-lege-dog/game/v13-config-validation-primitives";

export function validateUiConfig(
  value: unknown,
  path: string,
  issues: DogV13ConfigIssue[],
): void {
  const ui = asRecord(value);
  if (ui === undefined) {
    return;
  }

  const visual = asRecord(ui.visual);
  if (visual === undefined) {
    requiredObject(ui, "visual", issues, path);
  } else {
    for (const key of ["blockSizePx", "boardSafeMarginPx", "keyDropSizePx", "magneticEffectHeightPx"]) {
      validateInteger(visual[key], `${path}.visual.${key}`, 1, issues);
    }
    validateRange(visual.flightTargetScale, `${path}.visual.flightTargetScale`, 0, 1, issues, false);
  }

  const copy = asRecord(ui.copy);
  if (copy === undefined) {
    requiredObject(ui, "copy", issues, path);
  } else {
    validateAppCopy(copy.app, `${path}.copy.app`, issues);
    validateLabelsCopy(copy.labels, `${path}.copy.labels`, issues);
    validateLoadoutCopy(copy.loadout, `${path}.copy.loadout`, issues);
    validateSpecialMechanismCopy(copy.specialMechanisms, `${path}.copy.specialMechanisms`, issues);
    validateResultDisplayMap(copy.result, `${path}.copy.result`, ["won", "final", "lost"], issues);
    validateItemCopyMap(copy.items, `${path}.copy.items`, DOG_V13_ITEM_COPY_KEYS, issues);
  }

  const particles = asRecord(ui.particles);
  if (particles === undefined) {
    requiredObject(ui, "particles", issues, path);
    return;
  }
  for (const effectName of ["match", "won", "lost"]) {
    const profile = asRecord(particles[effectName]);
    if (profile === undefined) {
      requiredObject(particles, effectName, issues, `${path}.particles`);
      continue;
    }
    validateInteger(profile.durationMs, `${path}.particles.${effectName}.durationMs`, 1, issues);
    validateInteger(profile.count, `${path}.particles.${effectName}.count`, 1, issues);
    if (!Array.isArray(profile.colors) || profile.colors.length === 0) {
      issues.push({ path: `${path}.particles.${effectName}.colors`, code: "required", message: "必须包含颜色" });
    } else {
      validateStringArray(profile.colors, `${path}.particles.${effectName}.colors`, issues);
    }
  }
}

function validateAppCopy(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
  const app = asRecord(value);
  if (app === undefined) {
    issues.push({ path, code: "required", message: "必须是对象" });
    return;
  }
  for (const key of [
    "brandName", "registrationTitle", "registrationIntro", "register", "registrationFinePrint",
    "catalogTitle", "reset", "catalogAriaLabel", "highestUnlockedLevel", "startGame", "activeGame",
    "returnCatalog", "soundEnabled", "soundDisabled", "persistenceSaved", "persistenceTemporary",
    "resetConfirmation", "leaveConfirmation",
  ]) {
    validateNonEmptyString(app[key], `${path}.${key}`, issues);
  }
  const generation = asRecord(app.generation);
  if (generation === undefined) {
    requiredObject(app, "generation", issues, path);
  } else {
    for (const key of [
      "loadingTitle", "loadingDescription", "errorTitle", "errorDescription", "retry",
      "runSeed", "generatorVersion", "workerFailure", "fallbackFailure",
    ]) {
      validateNonEmptyString(generation[key], `${path}.generation.${key}`, issues);
    }
  }
  const result = asRecord(app.result);
  if (result === undefined) {
    requiredObject(app, "result", issues, path);
  } else {
    for (const key of ["completedLevel", "finalReward", "totalScore", "finalTitle", "finalTitleValue", "currentLevel", "reward", "nextLevel"]) {
      validateNonEmptyString(result[key], `${path}.result.${key}`, issues);
    }
  }
  const actions = asRecord(app.actions);
  if (actions === undefined) {
    requiredObject(app, "actions", issues, path);
  } else {
    for (const key of ["loadout", "nextLevel", "retry", "replayCurrentLevel"]) {
      validateNonEmptyString(actions[key], `${path}.actions.${key}`, issues);
    }
  }
}

function validateLabelsCopy(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
  const labels = asRecord(value);
  if (labels === undefined) {
    issues.push({ path, code: "required", message: "必须是对象" });
    return;
  }
  for (const key of ["level", "activeLevel", "specialMechanism", "board", "blockSelectable", "itemTarget", "tray", "lockedTraySlot", "emptyTraySlot", "wildcard", "match"]) {
    validateNonEmptyString(labels[key], `${path}.${key}`, issues);
  }
  const status = asRecord(labels.status);
  if (status === undefined) {
    requiredObject(labels, "status", issues, path);
  } else {
    validateNonEmptyString(status.won, `${path}.status.won`, issues);
    validateNonEmptyString(status.lost, `${path}.status.lost`, issues);
  }
}

function validateLoadoutCopy(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
  const loadout = asRecord(value);
  if (loadout === undefined) {
    issues.push({ path, code: "required", message: "必须是对象" });
    return;
  }
  for (const key of [
    "initialTitle", "changeTitle", "initialIntro", "changeCurrentIntro", "changeNextIntro", "usesFallback",
    "usesPerLevel", "confirmationTitle", "confirmationNext", "confirmationCurrent", "cancel", "clear",
    "confirm", "summaryAriaLabel", "edit", "targetPrompt", "remainingUses",
  ]) {
    validateNonEmptyString(loadout[key], `${path}.${key}`, issues);
  }
}

function validateSpecialMechanismCopy(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
  const copy = asRecord(value);
  if (copy === undefined) {
    issues.push({ path, code: "required", message: "必须是对象" });
    return;
  }
  for (const key of ["title", "hint", "empty", "closeLabel", "fallbackDescription"]) {
    validateNonEmptyString(copy[key], `${path}.${key}`, issues);
  }
  validatePresentationMap(copy.presentations, `${path}.presentations`, ["freeze", "illusion", "magnetic", "twin", "shuffle"], issues);
}

function validateItemCopyMap(
  value: unknown,
  path: string,
  keys: readonly string[],
  issues: DogV13ConfigIssue[],
): void {
  const record = asRecord(value);
  if (record === undefined) {
    issues.push({ path, code: "required", message: "必须包含道具文案映射" });
    return;
  }
  for (const key of keys) {
    const item = asRecord(record[key]);
    if (item === undefined) {
      requiredObject(record, key, issues, path);
      continue;
    }
    validateNonEmptyString(item.name, `${path}.${key}.name`, issues);
    validateNonEmptyString(item.description, `${path}.${key}.description`, issues);
  }
}

function validatePresentationMap(value: unknown, path: string, keys: readonly string[], issues: DogV13ConfigIssue[]): void {
  const record = asRecord(value);
  if (record === undefined) {
    issues.push({ path, code: "required", message: "必须包含文案映射" });
    return;
  }
  for (const key of keys) {
    const presentation = asRecord(record[key]);
    if (presentation === undefined) {
      requiredObject(record, key, issues, path);
      continue;
    }
    validateNonEmptyString(presentation.name, `${path}.${key}.name`, issues);
    validateNonEmptyString(presentation.description, `${path}.${key}.description`, issues);
    const stateLabels = asRecord(presentation.stateLabels);
    if (key === "shuffle" && stateLabels === undefined) {
      if (presentation.stateLabels === undefined) {
        requiredObject(presentation, "stateLabels", issues, `${path}.${key}`);
      } else {
        issues.push({ path: `${path}.${key}.stateLabels`, code: "type", message: "必须是对象" });
      }
    } else if (stateLabels === undefined && presentation.stateLabels !== undefined) {
      issues.push({ path: `${path}.${key}.stateLabels`, code: "type", message: "必须是对象" });
    } else if (stateLabels !== undefined) {
      const states = key === "shuffle"
        ? ["dormant", "armed", "triggerable", "consumed"]
        : Object.keys(stateLabels);
      for (const state of states) {
        validateNonEmptyString(stateLabels[state], `${path}.${key}.stateLabels.${state}`, issues);
      }
    }
  }
}

function validateResultDisplayMap(value: unknown, path: string, keys: readonly string[], issues: DogV13ConfigIssue[]): void {
  const record = asRecord(value);
  if (record === undefined) {
    issues.push({ path, code: "required", message: "必须包含结果文案映射" });
    return;
  }
  for (const key of keys) {
    const display = asRecord(record[key]);
    if (display === undefined) {
      requiredObject(record, key, issues, path);
      continue;
    }
    validateNonEmptyString(display.eyebrow, `${path}.${key}.eyebrow`, issues);
    validateNonEmptyString(display.title, `${path}.${key}.title`, issues);
    validateNonEmptyString(display.description, `${path}.${key}.description`, issues);
  }
}
