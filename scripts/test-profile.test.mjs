import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyChangedFiles,
  selectProfileForChangedFiles,
} from "./test-profile.mjs";
import { isUiOnlyTestFile } from "./test-paths.mjs";

test("file line check reports violations through shell exit status", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "gamebox-line-check-"));
  const fakeGit = join(temporaryDirectory, "git");

  try {
    writeFileSync(
      fakeGit,
      "#!/bin/sh\nprintf '%s\\n' 'scripts/test-profile.mjs'\n",
    );
    chmodSync(fakeGit, 0o755);
    const result = spawnSync("sh", ["scripts/check-file-lines.sh", "1"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${temporaryDirectory}:${process.env.PATH ?? ""}`,
      },
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /文件行数超限：scripts\/test-profile\.mjs/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("changed files share profile selection with affected runner", () => {
  assert.deepEqual(
    classifyChangedFiles([
      "src/games/dog-lege-dog/levels/level-generation-engine.ts",
    ]),
    ["generator"],
  );
  assert.equal(
    selectProfileForChangedFiles([
      "src/games/dog-lege-dog/levels/level-generation-engine.ts",
    ]),
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
  assert.equal(
    isUiOnlyTestFile("tests/special-cases/shuffle-ui.test.ts"),
    true,
  );
  assert.deepEqual(
    classifyChangedFiles(["tests/level-generator-cases/solvability.test.ts"]),
    ["generator"],
  );
  assert.deepEqual(classifyChangedFiles(["tests/level-random.test.ts"]), [
    "generator",
  ]);
  assert.deepEqual(
    classifyChangedFiles(["tests/special-cases/shuffle-block.test.ts"]),
    ["generator"],
  );
  assert.equal(
    selectProfileForChangedFiles([
      "tests/level-generator-cases/solvability.test.ts",
    ]),
    "full",
  );
  assert.equal(
    selectProfileForChangedFiles(["tests/level-random.test.ts"]),
    "full",
  );
  assert.deepEqual(classifyChangedFiles(["tests/e2e/support/common.ts"]), [
    "cross-browser",
  ]);
  assert.equal(
    selectProfileForChangedFiles(["tests/e2e/support/common.ts"]),
    "full",
  );
  assert.equal(selectProfileForChangedFiles(["playwright.config.ts"]), "full");
});
