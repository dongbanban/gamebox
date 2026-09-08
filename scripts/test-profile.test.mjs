import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
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
import { isUiOnlyTestFile } from "./test-paths.mjs";

test("profile plan uses smoke boundaries and one Chromium flow", () => {
  const profile = getProfile("smoke");
  const steps = buildProfilePlan("smoke");

  assert.deepEqual(profile.levelNumbers, [1, 2, 3, 6, 16, 31, 99]);
  assert.deepEqual(profile.fixedSeeds, ["v13-smoke-a", "v13-smoke-b"]);
  assert.equal(profile.randomLevelPrefix, 5);
  assert.equal(profile.stressLevelCount, 5);
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

test("full file line check uses Git and standard shell tools", () => {
  const step = buildProfilePlan("full").find((item) => item.name === "file-line-check");

  assert.equal(step?.command, "sh");
  assert.match(step?.args[1] ?? "", /git diff --name-only HEAD/);
  assert.match(step?.args[1] ?? "", /git ls-files --others --exclude-standard/);
  assert.match(step?.args[1] ?? "", /wc -l/);
  assert.equal(step?.args[3], "500");
});

test("file line check reports violations through shell exit status", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "gamebox-line-check-"));
  const fakeGit = join(temporaryDirectory, "git");

  try {
    writeFileSync(fakeGit, "#!/bin/sh\nprintf '%s\\n' 'scripts/test-profile.mjs'\n");
    chmodSync(fakeGit, 0o755);
    const step = buildProfilePlan("full").find((item) => item.name === "file-line-check");
    const result = spawnSync(
      step?.command ?? "sh",
      [...(step?.args ?? []).slice(0, -1), "1"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, PATH: `${temporaryDirectory}:${process.env.PATH ?? ""}` },
      },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /文件行数超限：scripts\/test-profile\.mjs/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
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

test("native test paths retain profile classification", () => {
  assert.equal(isUiOnlyTestFile("tests/app-cases/app-results.test.ts"), true);
  assert.equal(isUiOnlyTestFile("tests/special-cases/board-ui.test.ts"), true);
  assert.equal(isUiOnlyTestFile("tests/special-cases/shuffle-ui.test.ts"), true);
  assert.deepEqual(
    classifyChangedFiles(["tests/level-generator-cases/solvability.test.ts"]),
    ["generator"],
  );
  assert.deepEqual(
    classifyChangedFiles(["tests/special-cases/shuffle-block.test.ts"]),
    ["generator"],
  );
  assert.equal(
    selectProfileForChangedFiles(["tests/level-generator-cases/solvability.test.ts"]),
    "full",
  );
  assert.deepEqual(
    classifyChangedFiles(["tests/e2e/support/common.ts"]),
    ["cross-browser"],
  );
  assert.equal(
    selectProfileForChangedFiles(["tests/e2e/support/common.ts"]),
    "full",
  );
  assert.equal(
    selectProfileForChangedFiles(["playwright.config.ts"]),
    "full",
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
  assert.match(report, /levels=1,2,3,6,16,31,99/);
  assert.match(report, /testSeeds=v13-full-a,v13-full-b/);
  assert.match(report, /steps=core,worker-fallback,random-regression,chromium,cross-browser,pages-build,diff-check,file-line-check/);
});
