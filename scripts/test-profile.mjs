import DOG_TEST_PROFILES from "./v13-test-profiles.json" with { type: "json" };
import { classifyTestFile } from "./test-paths.mjs";

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
    if (
      file.startsWith("src/games/dog-lege-dog/levels/") ||
      file === "src/games/dog-lege-dog/game/special-mechanisms.ts" ||
      /^src\/games\/dog-lege-dog\/game\/v13-config(?:-[^/]+)?\.ts$/.test(
        file,
      ) ||
      file === "tests/support/test-profile.ts" ||
      file === "tests/generation-profile.test.ts"
    ) {
      areas.add("generator");
      continue;
    }
    if (
      file === "src/games/dog-lege-dog/index.ts" ||
      file === "src/game-contracts.ts"
    ) {
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
  if (
    areas.some((area) => DOG_TEST_PROFILES.selection.fullAreas.includes(area))
  ) {
    return "full";
  }
  if (
    areas.some((area) => DOG_TEST_PROFILES.selection.smokeAreas.includes(area))
  ) {
    return "smoke";
  }
  return "focused";
}

export function selectProfileForChangedFiles(files) {
  return selectProfileForAreas(classifyChangedFiles(files));
}
