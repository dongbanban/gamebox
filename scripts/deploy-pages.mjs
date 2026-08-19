import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

class GitHubApi {
  constructor(token) {
    this.token = token;
  }

  async request(path, options = {}) {
    const response = await fetch(`https://api.github.com${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gamebox-pages-deployer",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const responseText = await response.text();
    const payload = responseText === "" ? null : JSON.parse(responseText);
    if (!response.ok) {
      if (response.status === 404 && options.allowNotFound) {
        return null;
      }
      throw new Error(
        `GitHub API ${options.method ?? "GET"} ${path} 失败 (${response.status}): ${JSON.stringify(payload)}`,
      );
    }
    return payload;
  }
}

const root = process.cwd();
const distDirectory = resolve(root, "dist");
const branchName = "gh-pages";

buildPages();

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? readGhToken();
if (!token) {
  throw new Error(
    "缺少 GitHub token。请设置 GITHUB_TOKEN/GH_TOKEN，或先运行 `gh auth login`。",
  );
}

const { owner, repository } = readGitHubRepository();
const api = new GitHubApi(token);
const repositoryPath = `/repos/${owner}/${repository}`;
const files = collectFiles(distDirectory);
files.push({ path: ".nojekyll", content: Buffer.from("") });

console.log(`准备发布 ${files.length} 个静态文件到 ${owner}/${repository}:${branchName}`);
const treeEntries = [];
for (const file of files) {
  const blob = await api.request(`${repositoryPath}/git/blobs`, {
    method: "POST",
    body: {
      content: file.content.toString("base64"),
      encoding: "base64",
    },
  });
  treeEntries.push({
    path: file.path,
    mode: "100644",
    type: "blob",
    sha: blob.sha,
  });
}

const existingRef = await api.request(
  `${repositoryPath}/git/ref/heads/${branchName}`,
  { allowNotFound: true },
);
const tree = await api.request(`${repositoryPath}/git/trees`, {
  method: "POST",
  body: { tree: treeEntries },
});
const commit = await api.request(`${repositoryPath}/git/commits`, {
  method: "POST",
  body: {
    message: `deploy: publish ${new Date().toISOString()}`,
    tree: tree.sha,
    parents: existingRef === null ? [] : [existingRef.object.sha],
  },
});

if (existingRef === null) {
  await api.request(`${repositoryPath}/git/refs`, {
    method: "POST",
    body: { ref: `refs/heads/${branchName}`, sha: commit.sha },
  });
} else {
  await api.request(`${repositoryPath}/git/refs/heads/${branchName}`, {
    method: "PATCH",
    body: { sha: commit.sha, force: false },
  });
}

await configurePages(api, repositoryPath);
const siteUrl = `https://${owner}.github.io/${repository}/`;
const pagesBuild = await waitForPagesBuild(api, repositoryPath, commit.sha);
await waitForPublicSite(siteUrl);
console.log(`GitHub Pages 已发布：${siteUrl}`);
if (pagesBuild?.status) {
  console.log(`Pages build 状态：${pagesBuild.status}`);
}

function buildPages() {
  const result = spawnSync("pnpm", ["build:pages"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readGhToken() {
  try {
    return execFileSync("gh", ["auth", "token"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function readGitHubRepository() {
  const remote = execFileSync("git", ["remote", "get-url", "origin"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) {
    throw new Error(`无法从 origin 解析 GitHub 仓库：${remote}`);
  }
  return { owner: match[1], repository: match[2] };
}

function collectFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      return collectFiles(entryPath, relativePath);
    }
    if (!entry.isFile()) {
      return [];
    }
    return [{ path: relativePath.replaceAll("\\", "/"), content: readFileSync(entryPath) }];
  });
}

async function configurePages(api, repositoryPath) {
  const source = { branch: branchName, path: "/" };
  const currentPages = await api.request(`${repositoryPath}/pages`, { allowNotFound: true });
  if (currentPages === null) {
    await api.request(`${repositoryPath}/pages`, {
      method: "POST",
      body: { build_type: "legacy", source },
    });
    return;
  }
  await api.request(`${repositoryPath}/pages`, {
    method: "PUT",
    body: { build_type: "legacy", source },
  });
}

async function waitForPagesBuild(api, repositoryPath, commitSha) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const build = await api.request(`${repositoryPath}/pages/builds/latest`, {
      allowNotFound: true,
    });
    if (
      build?.status === "built" &&
      (build.commit === undefined || build.commit === commitSha)
    ) {
      return build;
    }
    if (build?.status === "errored" || build?.status === "failed") {
      throw new Error(`GitHub Pages 构建失败：${JSON.stringify(build)}`);
    }
    if (attempt < 14) {
      await delay(2000);
    }
  }
  console.warn("Pages 构建仍在异步处理中，已完成分支与 Pages source 配置。");
  return null;
}

async function waitForPublicSite(siteUrl) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const response = await fetch(siteUrl, { redirect: "follow" });
      if (response.ok) {
        console.log(`公网首页验证通过：HTTP ${response.status}`);
        return;
      }
    } catch {
      // Pages CDN propagation can briefly fail while a build is becoming public.
    }
    if (attempt < 14) {
      await delay(2000);
    }
  }
  throw new Error(`GitHub Pages 首页未在轮询窗口内返回 HTTP 2xx：${siteUrl}`);
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
