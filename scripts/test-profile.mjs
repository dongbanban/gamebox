import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import DOG_TEST_PROFILES from "./v13-test-profiles.json" with { type: "json" };
import { classifyTestFile } from "./test-paths.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const PROFILE_NAMES = ["focused", "smoke", "full"];
const MAX_CHANGED_FILE_LINES = 500;
const FILE_LINE_CHECK_SCRIPT = `
set -eu
max_lines=$1
status=0
checkable_files=0
changed_files=$(mktemp "\${TMPDIR:-/tmp}/gamebox-line-check.XXXXXX")
trap 'rm -f "$changed_files"' EXIT
if ! git diff --name-only HEAD -- > "$changed_files"; then
  printf '读取改动文件失败：git diff\\n' >&2
  exit 1
fi
if ! git ls-files --others --exclude-standard >> "$changed_files"; then
  printf '读取改动文件失败：git ls-files\\n' >&2
  exit 1
fi
while IFS= read -r file; do
  case "$file" in
    src/*.ts|src/*.mjs|src/*.css|tests/*.ts|tests/*.mjs|tests/*.css|scripts/*.ts|scripts/*.mjs|scripts/*.css)
      [ -f "$file" ] || continue
      checkable_files=$((checkable_files + 1))
      lines=$(wc -l < "$file")
      if [ "$lines" -gt "$max_lines" ]; then
        printf '文件行数超限：%s %s > %s\\n' "$file" "$lines" "$max_lines" >&2
        status=1
      fi
      ;;
  esac
done < "$changed_files"
if [ "$status" -ne 0 ]; then
  exit "$status"
fi
printf '文件行数检查通过：%s 个文件，阈值 %s 行。\\n' "$checkable_files" "$max_lines"
`;

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
    for (const key of ["randomLevelPrefix", "stressLevelCount"]) {
      const minimum = 0;
      if (!Number.isSafeInteger(profile[key]) || profile[key] < minimum) {
        throw new Error(`狗了个狗 test profile number 无效: ${name}.${key}`);
      }
    }
  }
}

export function buildProfilePlan(profileName) {
  const profile = getProfile(profileName);

  if (profileName === "focused") {
    return [{
      name: "focused-affected",
      command: "pnpm",
      args: ["test:focused"],
      env: { DOG_TEST_PROFILE: profileName },
    }];
  }

  const steps = [
    {
      name: "core",
      command: "pnpm",
      args: ["test:core"],
      env: { DOG_TEST_PROFILE: profileName },
    },
    {
      name: "worker-fallback",
      command: "pnpm",
      args: [
        "exec",
        "vitest",
        "run",
        "tests/generation-lifecycle.test.ts",
      ],
      env: { DOG_TEST_PROFILE: profileName },
    },
    {
      name: "random-regression",
      command: "pnpm",
      args: ["test:random"],
      env: {
        DOG_TEST_PROFILE: profileName,
        DOG_RANDOM_TEST_SEED: profile.fixedSeeds[0],
        DOG_RANDOM_LEVEL_COUNT: String(profile.randomLevelPrefix),
        DOG_STRESS_LEVEL_COUNT: String(profile.stressLevelCount),
      },
    },
    {
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
    },
  ];

  if (profileName === "smoke") {
    return steps;
  }

  return [
    ...steps,
    {
      name: "cross-browser",
      command: "pnpm",
      args: ["test:e2e:cross-browser"],
      env: { DOG_TEST_PROFILE: profileName },
    },
    {
      name: "pages-build",
      command: "pnpm",
      args: ["build:pages"],
      env: { DOG_TEST_PROFILE: profileName },
    },
    {
      name: "diff-check",
      command: "git",
      args: ["diff", "--check"],
      env: {},
    },
    {
      name: "file-line-check",
      command: "sh",
      args: [
        "-c",
        FILE_LINE_CHECK_SCRIPT,
        "file-line-check",
        String(MAX_CHANGED_FILE_LINES),
      ],
      env: {},
    },
  ];
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
        file === "tests/support/test-profile.ts" ||
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
