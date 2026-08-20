import { execFileSync, spawnSync } from "node:child_process";

const root = process.cwd();
const focusedOnly = process.argv.includes("--focused");
const changedFiles = collectChangedFiles();

if (changedFiles.length === 0) {
  console.log("没有检测到改动，跳过受影响测试。");
  process.exit(0);
}

console.log("受影响文件：");
for (const file of changedFiles) {
  console.log(`  ${file}`);
}

if (isUiOnlyChange(changedFiles)) {
  console.log("检测到 UI-only 改动：运行 UI 单测，跳过相关测试、E2E 与重复构建。\n");
  runOrExit("pnpm", ["test:ui"]);
  process.exit(0);
}

const vitestTargets = changedFiles.filter(
  (file) =>
    /^src\/.*\.ts$/.test(file) ||
    /^tests\/[^/]+\.test\.ts$/.test(file),
);

if (vitestTargets.length > 0) {
  const vitestArgs = [
    "exec",
    "vitest",
    "related",
    ...vitestTargets,
    "--run",
    "--passWithNoTests",
    "--exclude",
    "tests/random-regression.test.ts",
  ];

  if (focusedOnly) {
    vitestArgs.push(
      "--exclude",
      "tests/level-generator.test.ts",
      "--exclude",
      "tests/generation-failure.test.ts",
    );
  }

  runOrExit("pnpm", vitestArgs);
} else {
  console.log("没有受影响的核心 Vitest 文件，跳过核心 Vitest。");
}

if (focusedOnly) {
  console.log("聚焦验证完成：跳过随机回归、Chromium E2E 与构建，等待批量 QA。\n");
  process.exit(0);
}

if (requiresRandomRegression(changedFiles)) {
  runOrExit("pnpm", ["test:random"]);
} else {
  console.log("未触发关卡生成/随机回归范围，跳过随机回归。");
}

const e2eTargets = getE2ETargets(changedFiles);
if (e2eTargets.length > 0) {
  runOrExit("pnpm", ["exec", "playwright", "test", ...e2eTargets]);
} else {
  console.log("未触发浏览器流程范围，跳过 Chromium E2E。");
}

// `build` already runs `tsc --noEmit`; avoid paying for a duplicate typecheck.
runOrExit("pnpm", ["build"]);

function collectChangedFiles() {
  const tracked = readGit(["diff", "--name-only", "HEAD", "--"]);
  const untracked = readGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].sort();
}

function readGit(args) {
  try {
    const output = execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
    });
    return output.split(/\r?\n/).filter(Boolean);
  } catch (error) {
    console.error(`读取 Git 改动失败：${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

function requiresRandomRegression(files) {
  return files.some(
    (file) =>
      /^src\/games\/dog-lege-dog\/(?:level-|first-level\.ts|game-config\.ts)/.test(file) ||
      /^tests\/(?:level-generator|generation-failure|random-regression)\.test\.ts$/.test(file),
  );
}

function isUiOnlyChange(files) {
  return (
    files.length > 0 &&
    files.every(
      (file) =>
        file === "src/style.css" ||
        /^src\/games\/dog-lege-dog\/(?:assets\/(?:animation-effects|game-assets|particle-effects|sound-effects)\.ts|game\/game-(?:controller|renderer)\.ts)$/.test(file) ||
        /^tests\/(?:app|dog-lege-dog|sound-effects)\.test\.ts$/.test(file) ||
        /^public\/audio\//.test(file),
    )
  );
}

function getE2ETargets(files) {
  const targets = new Set(
    files.filter((file) => /^tests\/e2e\/[^/]+\.spec\.ts$/.test(file)),
  );

  if (files.some((file) => file === "src/style.css")) {
    targets.add("tests/e2e/register-catalog.spec.ts");
  }

  if (
    files.some(
      (file) =>
        file === "src/app.ts" ||
        file === "src/catalog.ts" ||
        file === "src/main.ts" ||
        file === "src/progress-store.ts" ||
        file.startsWith("src/games/dog-lege-dog/") ||
        file.startsWith("public/"),
    )
  ) {
    targets.add("tests/e2e/register-catalog.spec.ts");
    targets.add("tests/e2e/full-flow.spec.ts");
    targets.add("tests/e2e/cross-browser.spec.ts");
  }

  return [...targets].sort();
}

function runOrExit(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`命令启动失败：${result.error.message}`);
    console.error("受影响验证失败，已停止后续步骤。");
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error("受影响验证失败，已停止后续步骤。");
    process.exit(result.status ?? 1);
  }
}
