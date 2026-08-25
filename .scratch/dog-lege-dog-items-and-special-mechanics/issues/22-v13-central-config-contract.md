# 22 — v13 集中配置与最新版契约展开

**What to build:** 让「狗了个狗」的关卡、机制、难度、道具、动画、资源、音效、App 与测试 profile 都由一份经过校验的 v13 配置驱动；配置错误时阻止进入未验证棋盘。

**Blocked by:** None — can start immediately.

**Status:** done

- [x] 配置文件覆盖游戏边界、关卡上限、逻辑方块数量、层数、图案、暂存槽、锁槽、道具次数、特殊机制数量预算、机制密度、难度目标、动画时序、资源/音效与测试 profile。
- [x] 配置加载提供类型校验、范围校验、必填字段校验与可诊断错误；配置无效时不能启动游戏或展示候选棋盘。
- [x] v13 作为当前唯一生成器契约；`floor(N × 0.30)` 逻辑机制预算、冻结/幻化/磁吸权重 1、双生权重 2、余数分配策略、非钥匙道具每关 1 次与钥匙例外均进入配置。特殊方块数量必须随 `N` 增长，不得只改密度字段。
- [x] 旧分散常量只允许作为迁移 adapter；新代码不得继续增加写死的可调参数。
- [x] 配置读取与校验有单元测试；测试 profile 选择结果可被生成器、游戏启动与 QA 流程复用。
- [x] spec、领域词汇与 ADR 明确配置是当前唯一行为来源；本票完成时记录文档-only 验证状态。

## Comments

- 2026-08-25：新增深度冻结 `DOG_V13_CONFIG`、schema/version 校验、诊断错误、机制预算/权重/余数分配、道具配额、难度目标、动画/资源/音效与 focused/smoke/full profile；生成器、启动边界均拒绝无效配置。旧 v12 生成规则与运行时常量保留为明确迁移 adapter，后续由 tickets 23–28 消费 v13 行为。
- 2026-08-25：完成 standards/spec 双轴 code review；修复难度字段边界、完整道具集合与 loadout 关系、item 资源必填、反向关卡区间、直接 `GeneratedLevelGenerator` 绕过校验等问题。
- 验证通过：`pnpm typecheck`；`pnpm exec vitest run tests/dog-config.test.ts`（7/7）；`pnpm test:focused`（10 files、189 tests）；`pnpm exec vitest run --exclude tests/random-regression.test.ts --exclude 'tests/e2e/**'`（12 files、217 tests）；`pnpm test:random`（3/3）；`pnpm test:e2e`（19/19 Chromium）；`pnpm build`；`git diff --check`。
- 文档-only 验证状态：不适用；本票包含代码、测试与 spec/领域词汇/ADR 更新。
