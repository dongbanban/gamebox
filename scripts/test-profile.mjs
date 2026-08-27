import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import DOG_TEST_PROFILES from "../src/games/dog-lege-dog/game/v13-test-profiles.json" with { type: "json" };
import { classifyTestFile } from "./test-paths.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const PROFILE_NAMES = ["focused", "smoke", "full"];
const PROFILE_BOOLEAN_KEYS = [
  "runUI",
  "runCore",
  "runRandomRegression",
  "runE2E",
  "runCrossBrowser",
  "runWorkerFallback",
  "runBuild",
  "runDiffCheck",
  "runFileLineCheck",
];

assertTestProfileSource(DOG_TEST_PROFILES);

export function getProfile(profileName = process.env.DOG_TEST_PROFILE ?? DOG_TEST_PROFILES.default) {
  const profile = DOG_TEST_PROFILES.profiles[profileName];
  if (profile === undefined) {
    throw new Error(`未知狗了个狗测试 profile: ${profileName}`);
  }
  return profile;
}

function assertTestProfileSource(source) {
  if (!PROFILE_NAMES.includes(source.default)) {
    throw new Error(`狗了个狗 test profile default 无效: ${source.default}`);
  }
  if (source.selection === undefined ||
      !Array.isArray(source.selection.fullAreas) ||
      !Array.isArray(source.selection.smokeAreas)) {
    throw new Error("狗了个狗 test profile selection 无效");
  }
  const profiles = source.profiles;
  for (const name of PROFILE_NAMES) {
    const profile = profiles?.[name];
    if (profile === undefined || profile.name !== name) {
      throw new Error(`狗了个狗 test profile 缺少 profile: ${name}`);
    }
    if (!Array.isArray(profile.levelNumbers) || !Array.isArray(profile.fixedSeeds) ||
        profile.levelNumbers.length === 0 || profile.fixedSeeds.length === 0) {
      throw new Error(`狗了个狗 test profile 边界/seed 无效: ${name}`);
    }
    for (const key of PROFILE_BOOLEAN_KEYS) {
      if (typeof profile[key] !== "boolean") {
        throw new Error(`狗了个狗 test profile flag 无效: ${name}.${key}`);
      }
    }
    for (const key of ["randomLevelPrefix", "stressLevelCount", "maxChangedFileLines"]) {
      const minimum = key === "maxChangedFileLines" ? 1 : 0;
      if (!Number.isSafeInteger(profile[key]) || profile[key] < minimum) {
        throw new Error(`狗了个狗 test profile number 无效: ${name}.${key}`);
      }
    }
  }
}

export function buildProfilePlan(profileName) {
  const profile = getProfile(profileName);
  const steps = [];

  if (profileName === "focused") {
    steps.push({
      name: "focused-affected",
      command: "pnpm",
      args: ["test:focused"],
      env: { DOG_TEST_PROFILE: profileName },
    });
    return steps;
  }

  if (profile.runCore) {
    steps.push({
      name: "core",
      command: "pnpm",
      args: ["test:core"],
      env: { DOG_TEST_PROFILE: profileName },
    });
  }
  if (profile.runWorkerFallback) {
    steps.push({
      name: "worker-fallback",
      command: "pnpm",
      args: [
        "exec",
        "vitest",
        "run",
        "tests/generation-profile.test.ts",
        "--testNamePattern",
        "fallback profile",
      ],
      env: { DOG_TEST_PROFILE: profileName },
    });
  }
  if (profile.runRandomRegression) {
    steps.push({
      name: "random-regression",
      command: "pnpm",
      args: ["test:random"],
      env: {
        DOG_TEST_PROFILE: profileName,
        DOG_RANDOM_TEST_SEED: profile.fixedSeeds[0],
        DOG_RANDOM_LEVEL_COUNT: String(profile.randomLevelPrefix),
        DOG_STRESS_LEVEL_COUNT: String(profile.stressLevelCount),
      },
    });
  }
  if (profile.runE2E) {
    steps.push({
      name: profileName === "smoke" ? "chromium-smoke" : "chromium",
      command: "pnpm",
      args: profileName === "smoke"
        ? [
            "exec",
            "playwright",
            "test",
            "tests/e2e/cross-browser.spec.ts",
            "--project=chromium",
            "--grep",
            "跨浏览器核心 smoke：注册、目录与首关入口可用",
          ]
        : ["test:e2e"],
      env: { DOG_TEST_PROFILE: profileName },
    });
  }
  if (profile.runCrossBrowser) {
    steps.push({
      name: "cross-browser",
      command: "pnpm",
      args: ["test:e2e:cross-browser"],
      env: { DOG_TEST_PROFILE: profileName },
    });
  }
  if (profile.runBuild) {
    steps.push({
      name: "pages-build",
      command: "pnpm",
      args: ["build:pages"],
      env: { DOG_TEST_PROFILE: profileName },
    });
  }
  if (profile.runDiffCheck) {
    steps.push({
      name: "diff-check",
      command: "git",
      args: ["diff", "--check"],
      env: {},
    });
  }
  if (profile.runFileLineCheck) {
    steps.push({
      name: "file-line-check",
      command: "node",
      args: [
        "scripts/check-file-lines.mjs",
        "--changed",
        "--max-lines",
        String(profile.maxChangedFileLines),
      ],
      env: {},
    });
  }

  return steps;
}

export function classifyChangedFiles(files) {
  const areas = new Set();
  for (const file of files) {
    if (
      file.startsWith(".scratch/") ||
      file === "README.md" ||
      file.startsWith("docs/")
    ) {
      areas.add("docs");
      continue;
    }
    if (file === "src/style.css" || file.startsWith("public/")) {
      areas.add("ui");
      continue;
    }
    if (file === "tests/random-regression.test.ts") {
      areas.add("random-regression");
      continue;
    }
    if (file.startsWith("tests/e2e/") || file === "playwright.config.ts") {
      areas.add("cross-browser");
      continue;
    }
    const testArea = classifyTestFile(file);
    if (testArea !== undefined) {
      areas.add(testArea);
      continue;
    }
    if (file.startsWith("src/games/dog-lege-dog/levels/") ||
        file === "src/games/dog-lege-dog/game/special-mechanisms.ts" ||
        /^src\/games\/dog-lege-dog\/game\/v13-config(?:-[^/]+)?\.ts$/.test(file) ||
        file === "src/games/dog-lege-dog/game/v13-test-profiles.json" ||
        file === "src/games/dog-lege-dog/game/test-profile.ts" ||
        file === "tests/generation-profile.test.ts") {
      areas.add("generator");
      continue;
    }
    if (file === "src/games/dog-lege-dog/index.ts" || file === "src/game-contracts.ts") {
      areas.add("public-contract");
      continue;
    }
    if (
      file === "src/app.ts" ||
      file === "src/main.ts" ||
      file === "src/catalog.ts" ||
      file === "src/progress-store.ts" ||
      file === "src/games/dog-lege-dog/game/game-controller.ts"
    ) {
      areas.add("game-startup");
      continue;
    }
    if (file === "package.json" || file.startsWith("scripts/")) {
      areas.add("runtime");
      continue;
    }
    if (file.startsWith("src/")) {
      areas.add("runtime");
    }
  }
  return [...areas];
}

export function selectProfileForAreas(areas) {
  if (areas.some((area) => DOG_TEST_PROFILES.selection.fullAreas.includes(area))) {
    return "full";
  }
  if (areas.some((area) => DOG_TEST_PROFILES.selection.smokeAreas.includes(area))) {
    return "smoke";
  }
  return "focused";
}

export function selectProfileForChangedFiles(files) {
  return selectProfileForAreas(classifyChangedFiles(files));
}

export function formatProfileReport(profileName, steps) {
  const profile = getProfile(profileName);
  return [
    `profile=${profileName}`,
    `levels=${profile.levelNumbers.join(",")}`,
    `testSeeds=${profile.fixedSeeds.join(",")}`,
    `randomLevelPrefix=${profile.randomLevelPrefix}`,
    `stressLevelCount=${profile.stressLevelCount}`,
    `steps=${steps.map((step) => step.name).join(",")}`,
  ].join("\n");
}

export function runProfileSteps(steps, executeStep = runCommand) {
  for (const step of steps) {
    const result = executeStep(step);
    if (result !== 0) {
      return { failedStep: step.name, exitCode: result };
    }
  }
  return { failedStep: undefined, exitCode: 0 };
}

function runCommand(step) {
  console.log(`\n$ ${step.command} ${step.args.join(" ")}`);
  const result = spawnSync(step.command, step.args, {
    cwd: root,
    env: { ...process.env, ...step.env },
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`命令启动失败：${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

function main() {
  const profileName = process.argv[2] ?? process.env.DOG_TEST_PROFILE ?? DOG_TEST_PROFILES.default;
  const steps = buildProfilePlan(profileName);
  console.log(formatProfileReport(profileName, steps));
  const result = runProfileSteps(steps);
  if (result.failedStep !== undefined) {
    console.error(`\nprofile=${profileName} status=failed step=${result.failedStep}`);
    process.exit(result.exitCode);
  }
  console.log(`\nprofile=${profileName} status=passed`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
