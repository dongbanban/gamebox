# 23 — 测试 profile 与生成流程精细控制

**What to build:** 让开发、生成器回归与发布 QA 使用明确的测试 profile，按改动风险选择最小充分流程；生成器改动不得漏跑随机回归或完整验证。

**Blocked by:** 22 — 测试 profile 与配置校验必须先有统一来源。

**Status:** ready-for-agent

- [ ] focused profile 只运行受影响核心测试；UI-only 改动优先运行 UI 测试；不触发随机回归、E2E 或构建。
- [ ] smoke profile 覆盖 1、6、16、31、99 关、少量固定 seed、严格生成验证与单个 Chromium 流程；同时断言机制逻辑单位预算分别贴合 27、32、43、54、54。
- [ ] full profile 覆盖排除 E2E/随机的核心 Vitest、随机 1–100 前缀、关键边界、Chromium、WebKit、移动 Chromium、Worker/fallback、页面构建、diff 检查与文件行数检查；随机回归校验 `floor(N × 0.30)`、四类数量随 `N` 增长、双生权重与密度不超上限。
- [ ] 核心测试明确排除 tests/e2e 与随机回归；受影响测试路径覆盖当前生成器目录与 import graph。
- [ ] 生成器、可解性、难度、公共契约、游戏启动、Worker 与跨模块改动自动提升到 full profile；生成测试显式记录 testSeed、runSeed、关卡号与生成器版本。
- [ ] profile 选择、失败短路、报告格式与生成代码/测试模板接入有回归测试和使用说明。
