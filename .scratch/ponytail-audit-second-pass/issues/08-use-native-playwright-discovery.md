# 08 — 改用 Playwright 原生测试发现

**What to build:** 让 Playwright 直接发现浏览器 case，并在共享浏览器 helper 变化时运行小规模完整 E2E 范围，从而删除代理 spec 和手写路径映射，同时保持桌面与跨浏览器流程覆盖。

**Blocked by:** 04 — E2E 复用已验证关卡解法；07 — 改用 Vitest 原生测试发现

**Status:** done

- [x] 所有浏览器 case 使用 Playwright 原生 spec 命名并可被直接收集。
- [x] 删除只负责 import 浏览器 case 的代理 spec，不保留兼容入口。
- [x] 删除 Playwright case 到代理 spec 的手写路径映射。
- [x] 共享 E2E helper 或浏览器基础设施变化时直接运行当前小规模 E2E 套件，而不是维护另一张依赖表。
- [x] Chromium、WebKit 与移动 Chromium 的项目选择和跨浏览器 smoke 语义保持不变。
- [x] ticket 04 建立的 `solutionPath` 浏览器通关流程在直接发现后继续通过。
- [x] 对比改动前后浏览器测试 case，注册、目录、活动关卡、结果、存储、响应式和特殊反馈覆盖不得减少。
- [x] 运行相关 Chromium 与跨浏览器验证并记录结果；最终批量 QA 关联 ticket 10。

## Comments

- Playwright 原生发现前后 Chromium 均收集 7 个文件、24 个语义 case；跨浏览器 smoke 均为 Chromium、WebKit、移动 Chromium 共 18 个 case，覆盖未减少。
- 删除 2 个 import-only 代理 spec、Playwright case 路径映射及其内部断言；共享 E2E helper 与 `playwright.config.ts` 继续按 `cross-browser` 风险直接升级 full profile，运行完整小规模 E2E 套件。
- 验证通过：`pnpm test:profile:unit`（6/6）、`pnpm typecheck`、`pnpm test:qa`（core 42 files/259 tests、Worker fallback 4/4、random regression 3/3、Chromium E2E 24/24、cross-browser 18/18、Pages build、`git diff --check`、500 行检查）；review 修复后复跑 `pnpm test:profile:unit`、`pnpm typecheck` 与 `git diff --check`。最终批量 QA 关联 ticket 10。
