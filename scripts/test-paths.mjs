const UI_TEST_PATTERNS = [
  /^tests\/(?:dog-loadout|sound-effects|game-runtime-modules|ui-rendering-modules)\.test\.ts$/,
  /^tests\/(?:app|dog)-cases\/.*\.test\.ts$/,
  /^tests\/special-cases\/(?:board-ui|torch-ui|visual-protocol|shuffle-ui)\.test\.ts$/,
  /^tests\/support\/(?:app-fixtures|dog-game-fixtures|dog-level-fixture)\.ts$/,
];

const HIGH_RISK_TEST_PATTERNS = [
  /^tests\/(?:difficulty-curve|dog-config|generation-failure|generation-lifecycle|generation-profile|v13-level-generation)\.test\.ts$/,
  /^tests\/level-generator-cases\/.*\.test\.ts$/,
  /^tests\/support\/level-generator-fixtures\.ts$/,
  /^tests\/special-cases\/(?:core|mechanism-runtime|restore-whistle|selection-runtime|shuffle-block)\.test\.ts$/,
];

export function classifyTestFile(file) {
  if (file === "tests/random-regression.test.ts") {
    return "random-regression";
  }
  if (file.startsWith("tests/e2e/")) {
    return "cross-browser";
  }
  if (HIGH_RISK_TEST_PATTERNS.some((pattern) => pattern.test(file))) {
    return "generator";
  }
  if (isUiOnlyTestFile(file)) {
    return "ui";
  }
  return undefined;
}

export function isUiOnlyTestFile(file) {
  return UI_TEST_PATTERNS.some((pattern) => pattern.test(file));
}

export function isHighRiskTestFile(file) {
  return HIGH_RISK_TEST_PATTERNS.some((pattern) => pattern.test(file));
}
