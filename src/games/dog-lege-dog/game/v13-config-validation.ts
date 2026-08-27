import {
  DOG_V13_SCHEMA_VERSION,
  type DogV13ConfigIssue,
} from "@/games/dog-lege-dog/game/v13-config-types";
import {
  asRecord,
  cloneAndFreeze,
  isRecord,
  requiredObject,
} from "@/games/dog-lege-dog/game/v13-config-validation-primitives";
import {
  validateAnimation,
  validateAssets,
  validateAudio,
  validateBoard,
  validateDifficulty,
  validateGame,
  validateItems,
  validateLevels,
  validateSpecialMechanisms,
  validateTestProfiles,
  validateTray,
} from "@/games/dog-lege-dog/game/v13-config-validation-core";
import { validateUiConfig } from "@/games/dog-lege-dog/game/v13-config-validation-ui";

export { cloneAndFreeze } from "@/games/dog-lege-dog/game/v13-config-validation-primitives";

export function collectConfigIssues(input: unknown): DogV13ConfigIssue[] {
  if (!isRecord(input)) {
    return [{ path: "config", code: "type", message: "必须是对象" }];
  }

  const issues: DogV13ConfigIssue[] = [];
  for (const key of ["game", "board", "levels", "tray", "items", "specialMechanisms", "difficulty", "animation", "assets", "audio", "ui", "testProfiles"]) {
    requiredObject(input, key, issues);
  }
  if (!("schemaVersion" in input)) {
    issues.push({ path: "schemaVersion", code: "required", message: "必填" });
  } else if (input.schemaVersion !== DOG_V13_SCHEMA_VERSION) {
    issues.push({ path: "schemaVersion", code: "value", message: `必须是 ${DOG_V13_SCHEMA_VERSION}` });
  }

  validateGame(input.game, issues);
  validateBoard(input.board, issues);
  validateLevels(input.levels, issues);
  validateTray(input.tray, issues);
  validateItems(input.items, issues);
  validateSpecialMechanisms(input.specialMechanisms, issues);
  validateDifficulty(input.difficulty, asRecord(input.levels)?.maxLevelNumber, issues);
  validateAnimation(input.animation, issues);
  validateAssets(input.assets, input.items, issues);
  validateAudio(input.audio, issues);
  validateUiConfig(input.ui, "ui", issues);
  validateTestProfiles(input.testProfiles, asRecord(input.levels)?.maxLevelNumber, issues);
  return issues;
}
