# 25 — 游戏运行时模块拆分与配置迁移

**What to build:** 让游戏会话、输入控制、道具运行时、特殊机制结算与动画协调由小而深的模块协作完成；玩家可观察的选择、入槽、三消、胜负与生命周期保持稳定。

**Blocked by:** 22 — 集中配置契约。

**Status:** in-progress

- [x] GameSession、GameController、道具运行时、特殊机制运行时与动画协调责任拆分为约 500 行以内的模块。
- [x] 道具次数、槽位容量、锁槽、机制状态、输入锁与动画时序全部读取集中配置。
- [x] 普通入槽、三消、冻结、磁吸、双生、锁槽、钥匙、失败/通关与道具原子结算保持领域语义。
- [x] 模块之间通过窄接口传递状态，不复制逻辑方块单位、道具次数或输入锁规则。
- [x] 每个新模块具备 focused 测试 seam；拆分期间不保留行为相同的重复实现。

## Comments

- 2026-08-26：完成 `GameSession` 状态/选择/暂存槽/机制动作/结果模块拆分；`DogItemRuntime` 拆为契约、次数、行为与 runtime；controller 拆为输入、loadout、反馈、方块动画、道具动画、DOM/state 协调模块；特殊机制拆为 handler、composition、assignment。运行时统一接收 v13 config，新增自定义容量、冻结阈值、动画时序、loadout size seam；协调器改用窄 `Pick` 接口。
- 验证通过：`pnpm test:focused`（13 files/202 tests）、`pnpm test:core`（15 files/230 tests）、`pnpm typecheck`、`pnpm test:random`（3/3）、Worker fallback、`pnpm test:e2e:cross-browser`（9/9）、`pnpm build:pages`、`git diff --check`、`pnpm exec node scripts/check-file-lines.mjs --changed --max-lines 500`（30 files）。高难关快照回归输出 `stateReads=1`。
- 批量 QA 限制：`pnpm test:e2e` 为 17/19；`tests/e2e/register-catalog.spec.ts:166` 移动端图标既有 CSS 尺寸 42px，断言要求 48px；`:495` 幻化 glyph 既有 CSS filter 为 `saturate(0.72) contrast(0.94)`，断言要求 `none`。本票未改 `src/style.css`，视觉断言属于后续 UI ticket；状态保持 `in-progress`。
