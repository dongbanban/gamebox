const PLAYWRIGHT_ENTRY_PATTERN = /^tests\/e2e\/[^/]+\.spec\.ts$/;

const PLAYWRIGHT_CASE_RULES = [
  {
    entries: ["tests/e2e/full-flow.spec.ts"],
    patterns: [
      /^tests\/e2e\/full-flow-cases\//,
      /^tests\/e2e\/support\/full-flow-fixtures\.ts$/,
    ],
  },
  {
    entries: ["tests/e2e/register-catalog.spec.ts"],
    patterns: [/^tests\/e2e\/register-catalog-cases\//],
  },
  {
    entries: [
      "tests/e2e/full-flow.spec.ts",
      "tests/e2e/register-catalog.spec.ts",
    ],
    patterns: [/^tests\/e2e\/support\/common\.ts$/],
  },
];

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

export function getPlaywrightEntriesForFiles(files) {
  const entries = new Set();
  for (const file of files) {
    if (PLAYWRIGHT_ENTRY_PATTERN.test(file)) {
      entries.add(file);
    }
    for (const rule of PLAYWRIGHT_CASE_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(file))) {
        for (const entry of rule.entries) {
          entries.add(entry);
        }
      }
    }
  }
  return [...entries].sort();
}

export function classifyTestFile(file) {
  if (file === "tests/random-regression.test.ts") {
    return "random-regression";
  }
  if (
    PLAYWRIGHT_ENTRY_PATTERN.test(file) ||
    file.startsWith("tests/e2e/")
  ) {
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
