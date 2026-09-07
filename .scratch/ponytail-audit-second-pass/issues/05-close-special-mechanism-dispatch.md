# 05 — 收口特殊机制直接分派

**What to build:** 将固定的五种特殊机制收口为运行时与求解器共享的直接分派规则，删除没有仓内消费者的可插拔 handler registry，同时保持每种机制对玩家的行为、配置和反馈不变。

**Blocked by:** 03 — 统一暂存槽规则 helper

**Status:** done

- [x] 可匹配性、入槽处理和成功三消效果由一组共享直接函数负责。
- [x] 冻结、幻化、磁吸、双生和乱序继续使用同一套状态变化语义。
- [x] 冻结融化阈值等可调行为继续读取已验证 v13 配置，不引入散落常量。
- [x] 局内状态、道具、乱序、可解性和难度流程全部迁移到直接分派，且每一步保持可构建。
- [x] 删除 handler interface、handler 数组/Map、构造函数、重复/缺失校验、注入选项和参数透传。
- [x] 不增加新的 switch wrapper、registry adapter 或未来扩展接口。
- [x] 使用现有特殊机制、`GameSession`、关卡生成、可解性和随机回归测试验证行为。
- [x] 运行严格 TypeScript 未使用诊断并记录结果；最终批量 QA 关联 ticket 10。

## Comments

- 2026-09-07：删除特殊机制 handler interface、数组/Map、构造函数、注入选项和参数透传；冻结、幻化、磁吸、双生、乱序改由共享直接分派负责，冻结融化阈值继续读取 v13 配置。移除无消费者的 `special-mechanism-handlers.ts`。
- 验证通过：`pnpm exec tsc --noEmit`；`pnpm exec vitest run tests/special-mechanism.test.ts tests/game-session.test.ts tests/game-runtime-modules.test.ts --maxWorkers=1 --minWorkers=1 --reporter dot`（71 tests）；最终批量 QA（关联 ticket 10）`pnpm test:qa`：core 259 tests、Worker lifecycle 4 tests、random regression 3 tests、Playwright 24 tests、cross-browser 18 tests、Pages build、`git diff --check` 与 500 行检查全部通过。
