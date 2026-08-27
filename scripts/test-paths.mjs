const VITEST_ENTRY_PATTERN = /^tests\/[^/]+\.test\.ts$/;
const PLAYWRIGHT_ENTRY_PATTERN = /^tests\/e2e\/[^/]+\.spec\.ts$/;

const VITEST_CASE_RULES = [
  {
    entry: "tests/app.test.ts",
    patterns: [/^tests\/app-cases\//, /^tests\/support\/app-fixtures\.ts$/],
  },
  {
    entry: "tests/dog-lege-dog.test.ts",
    patterns: [/^tests\/dog-cases\//, /^tests\/support\/dog-game-fixtures\.ts$/],
  },
  {
    entry: "tests/game-session.test.ts",
    patterns: [/^tests\/game-session-cases\//, /^tests\/support\/game-session-fixtures\.ts$/],
  },
  {
    entry: "tests/item-runtime.test.ts",
    patterns: [/^tests\/item-cases\//, /^tests\/support\/item-fixtures\.ts$/],
  },
  {
    entry: "tests/level-generator.test.ts",
    patterns: [/^tests\/level-generator-cases\//, /^tests\/support\/level-generator-fixtures\.ts$/],
  },
  {
    entry: "tests/progress-store.test.ts",
    patterns: [/^tests\/progress-cases\//],
  },
  {
    entry: "tests/special-mechanism.test.ts",
    patterns: [/^tests\/special-cases\/(?:core|mechanism-runtime|selection-runtime)\.ts$/],
  },
  {
    entry: "tests/special-ui.test.ts",
    patterns: [/^tests\/special-cases\/(?:board-ui|torch-ui|visual-protocol)\.ts$/],
  },
];

const PLAYWRIGHT_CASE_RULES = [
  {
    entries: ["tests/e2e/full-flow.spec.ts"],
    patterns: [
      /^tests\/e2e\/full-flow-cases\//,
      /^tests\/e2e\/support\/(?:browser-solvability|full-flow-fixtures)\.ts$/,
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
  /^tests\/(?:app|dog-lege-dog|dog-loadout|sound-effects|game-runtime-modules|ui-rendering-modules|special-ui)\.test\.ts$/,
  /^tests\/app-cases\//,
  /^tests\/dog-cases\//,
  /^tests\/special-cases\/(?:board-ui|torch-ui|visual-protocol)\.ts$/,
  /^tests\/support\/(?:app-fixtures|dog-game-fixtures|dog-level-fixture)\.ts$/,
];

const HIGH_RISK_TEST_PATTERNS = [
  /^tests\/(?:difficulty-curve|dog-config|generation-failure|generation-profile|level-generator|special-mechanism|v13-level-generation)\.test\.ts$/,
  /^tests\/level-generator-cases\//,
  /^tests\/support\/level-generator-fixtures\.ts$/,
  /^tests\/special-cases\/(?:core|mechanism-runtime|selection-runtime)\.ts$/,
];

export function getVitestEntriesForFiles(files) {
  const entries = new Set();
  for (const file of files) {
    if (VITEST_ENTRY_PATTERN.test(file)) {
      entries.add(file);
    }
    for (const rule of VITEST_CASE_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(file))) {
        entries.add(rule.entry);
      }
    }
  }
  return [...entries].sort();
}

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
