# 07 — 改用 Vitest 原生测试发现

**What to build:** 让 Vitest 直接发现并运行每个核心与 UI 测试 case，删除只负责 import 的代理入口和手写 case 映射，同时保持原有测试语义与 ticket 验收档位。

**Blocked by:** 06 — 将 QA profile 移出生产配置

**Status:** done

- [x] 所有 Vitest case 使用框架原生测试命名并可被直接收集。
- [x] 需要 DOM 的测试通过测试级标注或统一 runner 配置继续使用 jsdom。
- [x] 删除只负责 import case 的根代理入口，不保留空壳兼容文件。
- [x] 删除 Vitest case 到代理入口的手写路径映射，受影响测试改用现有 import graph/related 能力。
- [x] `test:ui`、`test:core`、`test:focused`、`test:smoke` 和 `test:full` 继续覆盖各自原有语义范围。
- [x] 对比改动前后被收集的语义测试 case，除明确删除的内部基础设施断言外不得降低覆盖。
- [x] 更新 agent 验收说明和 README，使其描述原生测试发现。
- [x] 运行 runner 单元检查与相关 Vitest 档位并记录结果；最终批量 QA 关联 ticket 10。

## Comments

- 2026-09-08：32 个 Vitest case 改为原生 `.test.ts` 文件，删除 8 个纯 import 代理入口及 Vitest case-to-entry 映射；DOM case 使用文件级 `@vitest-environment jsdom`，Playwright 路由保持给 ticket 08。
- 收集对比：改动前后 `vitest list` 均为 259 个语义 case，剥离文件路径后结果完全一致；仅删除 runner 单测中验证已移除 Vitest 映射表的 1 个内部断言。
- 聚焦验证：`pnpm typecheck`；`pnpm test:profile:unit`（7/7）；`pnpm exec vitest related tests/game-session-cases/core.test.ts --run --passWithNoTests --exclude tests/random-regression.test.ts --exclude 'tests/e2e/**'`（1 file/9 tests）；`pnpm test:ui`（17 files/90 tests）。
- 本票全量验证：`pnpm test:qa` 通过 full profile——core 42 files/259 tests、Worker fallback 4/4、随机回归 3/3、Chromium 24/24、跨浏览器 18/18、Pages build、diff check、文件行数检查 35 files；最终仓库批量 QA 收口仍关联 ticket 10。
