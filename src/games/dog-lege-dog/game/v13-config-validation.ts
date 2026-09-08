import {
  DOG_V13_SCHEMA_VERSION,
  type DogV13ConfigIssue,
} from "@/games/dog-lege-dog/game/v13-config-types";
import {
  asRecord,
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
  validateGeneration,
  validateItems,
  validateLevels,
  validateSpecialMechanisms,
  validateTray,
} from "@/games/dog-lege-dog/game/v13-config-validation-core";
import { validateUiConfig } from "@/games/dog-lege-dog/game/v13-config-validation-ui";

export function collectConfigIssues(input: unknown): DogV13ConfigIssue[] {
  if (!isRecord(input)) {
    return [{ path: "config", code: "type", message: "必须是对象" }];
  }

  const issues: DogV13ConfigIssue[] = [];
  const configKeys = ["schemaVersion", "game", "generation", "board", "levels", "tray", "items", "specialMechanisms", "difficulty", "animation", "assets", "audio", "ui"] as const;
  const gameMaxLevelNumber = asRecord(input.game)?.maxLevelNumber;
  for (const key of configKeys.slice(1)) {
    requiredObject(input, key, issues);
  }
  for (const key of Object.keys(input)) {
    if (!configKeys.includes(key as (typeof configKeys)[number])) {
      issues.push({ path: key, code: "value", message: "包含不受支持的字段" });
    }
  }
  if (!("schemaVersion" in input)) {
    issues.push({ path: "schemaVersion", code: "required", message: "必填" });
  } else if (input.schemaVersion !== DOG_V13_SCHEMA_VERSION) {
    issues.push({ path: "schemaVersion", code: "value", message: `必须是 ${DOG_V13_SCHEMA_VERSION}` });
  }

  validateGame(input.game, issues);
  validateGeneration(input.generation, issues);
  validateBoard(input.board, issues);
  validateLevels(input.levels, gameMaxLevelNumber, issues);
  validateTray(input.tray, issues);
  validateItems(input.items, issues);
  validateSpecialMechanisms(input.specialMechanisms, issues);
  validateDifficulty(input.difficulty, gameMaxLevelNumber, issues);
  validateAnimation(input.animation, issues);
  validateAssets(input.assets, input.items, issues);
  validateAudio(input.audio, issues);
  validateUiConfig(input.ui, "ui", issues);
  return issues;
}
