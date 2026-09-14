# 01 — 迁移生成器与局内规则测试的直接导入

**What to build:** 让生成器、可解性、局内状态、特殊机制与道具规则测试直接依赖行为所属模块，同时暂时保留旧公共出口，使迁移过程始终可验证且不改变任何玩家行为。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 生成器、可解性、难度、随机回归和关卡结构测试不再通过「狗了个狗」宽公共入口导入内部类型、常量或 helper。
- [x] `GameSession`、特殊机制、暂存槽、乱序和道具规则测试从实际负责模块导入对应契约。
- [x] 测试 fixture 与 support helper 同步改为直接导入，不新增替代 barrel 或测试专属转发文件。
- [x] 旧公共出口在本 ticket 中继续保留，确保调用方迁移与契约删除分开落地。
- [x] 所有 import 调整保持测试语义、测试数量与用户可见行为不变。
- [x] 严格 TypeScript 未使用诊断不产生新的无效 import、参数或声明。
- [x] 运行 `pnpm test:qa` 并记录结果，因为改动覆盖生成器、可解性与特殊机制测试入口。

## Comments

- `pnpm typecheck`：通过。
- `pnpm test:qa`：通过；核心测试 46 个文件、287 个用例，随机回归 3 个用例，Chromium 28 个用例，跨浏览器 30 个用例，Pages build、diff check 与 49 个改动文件的 500 行守卫均通过。
- 测试对 `@/games/dog-lege-dog` 宽入口零引用；旧公共出口保持不变。
- 为满足既有 500 行守卫，拆分两份已超限测试；增量特殊状态仍为 17 个用例，乱序 UI 仍为 9 个用例。
