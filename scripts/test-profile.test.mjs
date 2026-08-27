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
