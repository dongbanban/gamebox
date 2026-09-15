# 05 — 收口「狗了个狗」与游戏目录公共出口

**What to build:** 让游戏目录只通过真实需要的关卡准备与游戏启动能力进入「狗了个狗」，让测试直接依赖行为所属模块，同时保留 Gamebox 的通用多游戏契约。

**Blocked by:** 01 — 迁移生成器与局内规则测试的直接导入；02 — 迁移应用与游戏 UI 测试的直接导入；03 — 以静态类型契约替代 v13 运行时 schema

**Status:** done

- [x] 「狗了个狗」公共入口只保留游戏目录生产消费者真实使用的准备与启动能力。
- [x] 删除只服务测试便利的内部类型、常量、配置 helper、求解 helper、道具 helper 与局内契约转发。
- [x] 游戏目录不再重复转发通用游戏定义、准备、启动和结果契约。
- [x] 应用与测试直接依赖通用游戏契约模块，不建立新的兼容别名。
- [x] 删除关卡阶段、逻辑方块数、图案数和难度目标的纯代理层，调用方直接使用 v13 配置 helper。
- [x] 保留通用游戏目录、`GameDefinition`、准备、启动、结果和按游戏保存进度的产品边界。
- [x] 注册、目录、关卡启动、Worker 准备、结果页、奖励和下一关行为保持不变。
- [x] 仓内不再存在对已删除公共符号或纯代理名称的引用。
- [x] 严格 TypeScript 未使用诊断通过，且生产构建不依赖宽 barrel。
- [x] 运行 `pnpm test:qa` 并记录结果，因为本 ticket 收窄跨模块公共契约和游戏启动入口。

## Comments

- 2026-09-15：依赖已完成的 01–03，入口只保留关卡准备服务与游戏启动；通用游戏契约改为直接从 `game-contracts` 导入，关卡进度调用方直接使用 v13 helper。
- 验证通过：`pnpm test:qa`（core 47 files / 282 tests、随机回归 3/3、Chromium E2E 28/28、跨浏览器 E2E 30/30、Pages 构建、diff 与 500 行守卫）；`pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters`；`pnpm build`；`pnpm exec vitest run tests/dog-config.test.ts`（1/1）。
