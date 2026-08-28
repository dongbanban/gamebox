import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProfilePlan,
  classifyChangedFiles,
  formatProfileReport,
  getProfile,
  runProfileSteps,
  selectProfileForChangedFiles,
} from "./test-profile.mjs";
import {
  getPlaywrightEntriesForFiles,
  getVitestEntriesForFiles,
  isUiOnlyTestFile,
} from "./test-paths.mjs";

test("profile plan uses smoke boundaries and one Chromium flow", () => {
  const profile = getProfile("smoke");
  const steps = buildProfilePlan("smoke");

  assert.deepEqual(profile.levelNumbers, [1, 6, 16, 31, 99]);
  assert.deepEqual(profile.fixedSeeds, ["v13-smoke-a", "v13-smoke-b"]);
  assert.equal(
    steps.find((step) => step.name === "chromium-smoke")?.args.includes("--project=chromium"),
    true,
  );
  assert.equal(
    steps.find((step) => step.name === "chromium-smoke")?.args.includes("跨浏览器核心 smoke：注册、目录与首关入口可用"),
    true,
  );
  assert.equal(steps.some((step) => step.name === "cross-browser"), false);
});

test("full plan includes all release checks", () => {
  const steps = buildProfilePlan("full");
  assert.deepEqual(
    steps.map((step) => step.name),
    ["core", "worker-fallback", "random-regression", "chromium", "cross-browser", "pages-build", "diff-check", "file-line-check"],
  );
  assert.equal(
    steps.find((step) => step.name === "worker-fallback")?.args.includes(
      "tests/generation-lifecycle.test.ts",
    ),
    true,
  );
});

test("changed files share profile selection with affected runner", () => {
  assert.deepEqual(
    classifyChangedFiles(["src/games/dog-lege-dog/levels/level-generation-engine.ts"]),
    ["generator"],
  );
  assert.equal(
    selectProfileForChangedFiles(["src/games/dog-lege-dog/levels/level-generation-engine.ts"]),
    "full",
  );
  assert.equal(
    selectProfileForChangedFiles(["tests/random-regression.test.ts"]),
    "smoke",
  );
});

test("nested Vitest cases resolve to their root entries", () => {
  assert.deepEqual(
    getVitestEntriesForFiles([
      "tests/app-cases/app-contract.ts",
      "tests/level-generator-cases/solvability.ts",
      "tests/support/level-generator-fixtures.ts",
      "tests/special-cases/board-ui.ts",
      "tests/special-cases/mechanism-runtime.ts",
      "tests/special-cases/shuffle-block.ts",
      "tests/special-cases/shuffle-ui.ts",
    ]),
    [
      "tests/app.test.ts",
      "tests/level-generator.test.ts",
      "tests/special-mechanism.test.ts",
      "tests/special-ui.test.ts",
    ],
  );
});

test("nested E2E cases resolve to their Playwright specs", () => {
  assert.deepEqual(
    getPlaywrightEntriesForFiles([
      "tests/e2e/full-flow-cases/lifecycle.ts",
      "tests/e2e/register-catalog-cases/responsive.ts",
      "tests/e2e/support/common.ts",
    ]),
    [
      "tests/e2e/full-flow.spec.ts",
      "tests/e2e/register-catalog.spec.ts",
    ],
  );
});

test("nested test paths retain UI and high-risk profile classification", () => {
  assert.equal(isUiOnlyTestFile("tests/app-cases/app-results.ts"), true);
  assert.equal(isUiOnlyTestFile("tests/special-cases/board-ui.ts"), true);
  assert.equal(isUiOnlyTestFile("tests/special-cases/shuffle-ui.ts"), true);
  assert.deepEqual(
    classifyChangedFiles(["tests/level-generator-cases/solvability.ts"]),
    ["generator"],
  );
  assert.deepEqual(
    classifyChangedFiles(["tests/special-cases/shuffle-block.ts"]),
    ["generator"],
  );
  assert.equal(
    selectProfileForChangedFiles(["tests/level-generator-cases/solvability.ts"]),
    "full",
  );
  assert.deepEqual(
    classifyChangedFiles(["tests/e2e/full-flow-cases/lifecycle.ts"]),
    ["cross-browser"],
  );
});

test("profile runner stops after first failed step", () => {
  const seen = [];
  const result = runProfileSteps(
    [{ name: "first" }, { name: "failed" }, { name: "never" }],
    (step) => {
      seen.push(step.name);
      return step.name === "failed" ? 7 : 0;
    },
  );

  assert.deepEqual(seen, ["first", "failed"]);
  assert.deepEqual(result, { failedStep: "failed", exitCode: 7 });
});

test("profile report exposes seeds, boundaries and ordered steps", () => {
  const report = formatProfileReport("full", buildProfilePlan("full"));

  assert.match(report, /profile=full/);
  assert.match(report, /levels=1,6,16,31,99/);
  assert.match(report, /testSeeds=v13-full-a,v13-full-b/);
  assert.match(report, /steps=core,worker-fallback,random-regression,chromium,cross-browser,pages-build,diff-check,file-line-check/);
});
