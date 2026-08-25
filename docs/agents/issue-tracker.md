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

默认采用“聚焦检查逐票、完整 QA 分批”策略，避免每个 ticket 重复支付构建、E2E 与随机回归成本。

- 文档-only 改动：可标记“未运行测试”。
- 普通实现 ticket：完成前运行 `pnpm test:focused`。该命令只运行受影响核心 Vitest，排除随机回归与生成器压力套件，不运行 Chromium E2E 或构建；没有可定位核心测试时，记录“无可定位聚焦测试，待批量 QA”。
- UI-only 改动：优先运行 `pnpm test:ui`；不再额外叠加 `pnpm test:focused` 或 `pnpm test:affected`。
- 每 3–5 个 ticket、一个功能阶段结束、进入高风险 ticket 前、合并前或发布前，统一运行 `pnpm test:qa`。
- 生成器、可解性/难度、公共契约、进度、导航、游戏启动、测试基础设施、跨模块或无法确认影响范围的改动，完成当前 ticket 前直接运行完整 QA；响应式或浏览器兼容改动追加 `pnpm test:e2e:cross-browser`。
- ticket 专属 spec 更严格时，以 spec 为准。

批量 QA 结果可由一个 ticket 记录完整命令与结果，其余 ticket 记录同一批次的关联 ticket/记录位置；失败时先修复，再重跑受影响批次。每个 ticket 仍记录实际聚焦检查与批量 QA 状态。

UI 文案、DOM、渲染器、样式、视觉资源或游戏音效改动优先运行：

```bash
pnpm test:ui
```

该命令只跑 app、狗了个狗渲染/交互与音效单测，不触发随机回归、浏览器 E2E 或构建。`pnpm test:affected` 检测到纯 UI 改动时会自动委托给同一命令；已经手动运行 `test:ui` 后不要再叠加 `test:affected`。

需要按当前 diff 同时检查相关 E2E 与构建、但尚未触发完整 QA 时运行：

```bash
pnpm test:affected
```

该命令读取当前 Git 改动与未跟踪文件；纯 UI 改动直接运行 `pnpm test:ui` 并结束，其他改动按 Vitest import graph 运行受影响核心测试、按源码/样式/E2E 文件范围选择 Chromium 流程，并在末尾运行一次 `pnpm build`。它不属于普通 ticket 默认门槛，也不与 `pnpm test:qa` 叠加。`build` 已包含 `tsc --noEmit`，不再重复运行独立 typecheck；任一步失败立即停止。

以下范围必须追加全量测试：

- 跨模块公共契约、进度、导航或游戏启动流程
- 关卡生成器、可解性搜索、难度筛选或随机回归
- 合并前、发布前或无法确认影响范围

目标全量命令（替代 `pnpm test:affected`，不要叠加运行）：

```bash
pnpm test:qa
```

当前 v13 升级由 ticket 22–28、20、11 收口。ticket 23 完成前，`test:core` 排除 E2E/随机、生成器路径匹配、profile 选择与行数守卫仍视为待实现；ticket 11 完成前，全量验证分别运行排除 E2E 的核心 Vitest、`pnpm test:random` 与 `pnpm test:e2e`，生成器改动必须显式运行随机回归。旧 hardening ticket 19 已归档，不再作为实现入口。

v13 测试 profile 目标：focused 只跑受影响核心或 UI；smoke 覆盖 1/6/16/31/99 关与少量 seed；full 覆盖核心、随机 1–100、Chromium、WebKit、移动 Chromium、Worker/fallback、页面构建、diff 检查与文件行数检查。具体入口与自动选择由 ticket 23 实现，完成前不把目标命令当作已存在能力。

响应式或浏览器兼容改动追加：

```bash
pnpm test:e2e:cross-browser
```

ticket 结尾记录实际运行命令与结果。仅文档改动可标记“未运行测试”；代码、测试、配置、样式或资源改动不得省略验证说明。
