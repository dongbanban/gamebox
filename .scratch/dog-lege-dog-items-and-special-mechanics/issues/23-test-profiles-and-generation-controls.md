# 23 — 测试 profile 与生成流程精细控制

**What to build:** 让开发、生成器回归与发布 QA 使用明确的测试 profile，按改动风险选择最小充分流程；生成器改动不得漏跑随机回归或完整验证。

**Blocked by:** 22 — 测试 profile 与配置校验必须先有统一来源。

**Status:** done

- [x] focused profile 只运行受影响核心测试；UI-only 改动优先运行 UI 测试；不触发随机回归、E2E 或构建。
- [x] smoke profile 覆盖 1、6、16、31、99 关、少量固定 seed、严格生成验证与单个 Chromium 流程；同时断言机制逻辑单位预算分别贴合 27、32、43、54、54。
- [x] 核心测试明确排除 tests/e2e 与随机回归；受影响测试路径覆盖当前生成器目录与 import graph。
- [x] 生成器、可解性、难度、公共契约、游戏启动、Worker 与跨模块改动自动提升到 full profile；生成测试显式记录 testSeed、runSeed、关卡号与生成器版本。
- [x] profile 选择、失败短路、报告格式与生成代码/测试模板接入有回归测试和使用说明。

## Comments

- 2026-08-25：新增共享 profile 来源 `src/games/dog-lege-dog/game/v13-test-profiles.json`、profile runner、失败短路、报告输出、文件行数检查、受影响路径自动升级、生成 replay metadata 与使用说明。
- `test:core` 明确排除 `tests/e2e/**`、`tests/random-regression.test.ts`；smoke/full runner 显式执行 fallback seam。UI-only 路径优先走 UI 测试。
- 验证通过：`pnpm typecheck`；`pnpm test:profile:unit`（5/5）；`pnpm test:focused`（11 files/192 tests）；`pnpm test:core`（13 files/220 tests）；`pnpm test:smoke`（core 13/220、fallback 1、random 3、Chromium 1）；`pnpm test:full` 批次（core 13/220、random 3、Chromium 19、跨浏览器 9、页面构建、diff、行数检查）；review 修复后再跑 typecheck、profile unit、smoke；`git diff --check`。
- 2026-08-26：未完成的 full profile 端到端执行与 v13 生成断言移交 ticket 11「生成加载、后台预生成与最终 QA」；本票保留 profile 定义、选择、短路、报告与受影响路径控制，依赖 24 的循环解除。
