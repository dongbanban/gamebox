# Issue tracker: Local Markdown

Issues and specs (you may know a spec as a PRD) for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## Ticket 验收

UI 文案、DOM、渲染器、样式、视觉资源或游戏音效改动优先运行：

```bash
pnpm test:ui
```

该命令只跑 app、狗了个狗渲染/交互与音效单测，不触发随机回归、浏览器 E2E 或构建。`pnpm test:affected` 检测到纯 UI 改动时会自动委托给同一命令；已经手动运行 `test:ui` 后不要再叠加 `test:affected`。

普通实现 ticket 完成前运行：

```bash
pnpm test:affected
```

该命令读取当前 Git 改动与未跟踪文件；纯 UI 改动直接运行 `pnpm test:ui` 并结束，避免重复的相关测试、E2E 与构建；其他改动才按 Vitest import graph 运行受影响核心测试、按源码/样式/E2E 文件范围选择 Chromium 流程，并在末尾运行一次 `pnpm build`。`build` 已包含 `tsc --noEmit`，不再重复运行独立 typecheck；任一步失败立即停止。

以下范围必须追加全量测试：

- 跨模块公共契约、进度、导航或游戏启动流程
- 关卡生成器、可解性搜索、难度筛选或随机回归
- 合并前、发布前或无法确认影响范围

目标全量命令（替代 `pnpm test:affected`，不要叠加运行）：

```bash
pnpm test:qa
```

当前 `test:core` 尚未排除 `tests/e2e/**`，`test:affected` 的生成器匹配仍使用目录整理前路径；两项由 ticket 19 跟踪。ticket 19 完成前，全量验证分别运行排除 E2E 的核心 Vitest、`pnpm test:random` 与 `pnpm test:e2e`，生成器改动必须显式运行随机回归。

响应式或浏览器兼容改动追加：

```bash
pnpm test:e2e:cross-browser
```

ticket 结尾记录实际运行命令与结果。仅文档改动可标记“未运行测试”；代码、测试、配置、样式或资源改动不得省略验证说明。
