# 08 — 改用 Playwright 原生测试发现

**What to build:** 让 Playwright 直接发现浏览器 case，并在共享浏览器 helper 变化时运行小规模完整 E2E 范围，从而删除代理 spec 和手写路径映射，同时保持桌面与跨浏览器流程覆盖。

**Blocked by:** 04 — E2E 复用已验证关卡解法；07 — 改用 Vitest 原生测试发现

**Status:** ready-for-agent

- [ ] 所有浏览器 case 使用 Playwright 原生 spec 命名并可被直接收集。
- [ ] 删除只负责 import 浏览器 case 的代理 spec，不保留兼容入口。
- [ ] 删除 Playwright case 到代理 spec 的手写路径映射。
- [ ] 共享 E2E helper 或浏览器基础设施变化时直接运行当前小规模 E2E 套件，而不是维护另一张依赖表。
- [ ] Chromium、WebKit 与移动 Chromium 的项目选择和跨浏览器 smoke 语义保持不变。
- [ ] ticket 04 建立的 `solutionPath` 浏览器通关流程在直接发现后继续通过。
- [ ] 对比改动前后浏览器测试 case，注册、目录、活动关卡、结果、存储、响应式和特殊反馈覆盖不得减少。
- [ ] 运行相关 Chromium 与跨浏览器验证并记录结果；最终批量 QA 关联 ticket 10。
