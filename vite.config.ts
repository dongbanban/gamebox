import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: isGitHubPagesBuild ? "/gamebox/" : "/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
