import { defineConfig } from "vite";

const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: isGitHubPagesBuild ? "/gamebox/" : "/",
});
