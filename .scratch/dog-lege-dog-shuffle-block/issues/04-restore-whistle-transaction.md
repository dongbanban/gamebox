# 04 — 复原哨恢复乱序事务

**What to build:** 将「复原哨」加入道具目录。玩家在乱序成功后、下一次其他动作前可直接使用复原哨，恢复乱序前的完整槽内状态，而不是只交换图案顺序。恢复后乱序方块不再触发，复原哨每关最多成功使用一次。

**Blocked by:** 02 — 安全乱序与二次结算

**Status:** done

- [x] 复原哨加入道具集合与资源、文案、可访问标签，目标类型为无目标；道具组仍保持 3 选 1 组。
- [x] 只有实际改变槽序并创建快照的乱序事务才开放复原哨；稳定原序、乱序未触发、次数用尽与终局状态下不可用。
- [x] 使用复原哨恢复乱序前槽序、方块 ID 与数量、二次三消移除内容、冻结进度、其他机制状态及乱序相关终局状态。
- [x] 复原哨消耗不回滚；触发乱序的方块保留在槽内并转为已消耗普通方块，不再次触发乱序。
- [x] 下一次其他棋盘选择、其他道具、道具组变更、结果确认或离开关卡后快照失效；结果页不可复原。
- [x] 乱序后二次三消、机制进度与钥匙掉落在复原前后保持事务一致，不产生重复奖励或状态残差。
- [x] 复原动画期间锁定输入，完成后正确刷新槽、道具可用性与反馈；核心、道具、UI 测试覆盖成功、失败、过期与一次性使用。

## Comments

- 2026-09-01：新增第 8 种无目标道具「复原哨」、资源与反向乱序反馈；道具组仍固定 3 选 1。新增 ADR-0008，限定为最近一次安全乱序事务恢复，不扩展为普通撤销。
- 2026-09-01：成功安全乱序保存短生命周期完整暂存槽事务；复原恢复方块 ID/数量、二次三消内容、冻结等机制进度与乱序相关钥匙掉落随机状态。触发方块恢复为普通方块，哨次数不返还。
- 2026-09-01：成功棋盘选择或其他道具提交会使旧快照失效；稳定原序、未触发、次数用尽和终局均不可复原。乱序与复原动画期间沿用统一输入锁。
- 聚焦验证：`pnpm exec vitest run tests/game-session.test.ts tests/item-runtime.test.ts tests/special-mechanism.test.ts tests/special-ui.test.ts --reporter=dot`（116 passed）；`pnpm typecheck`；`pnpm build:pages`；`git diff --check`；`node scripts/check-file-lines.mjs --changed --max-lines 500`（23 files passed）。
- 批量 QA：`pnpm test:qa` 的 full profile 通过 core（254）、Worker/fallback（4）、随机 1–99 回归（3）与 Chromium（21）；长时间并发后的 cross-browser 发生既有 smoke 超时，失败批次最终用 `CI=1 pnpm test:e2e:cross-browser` 完整重跑通过（9/9）。Pages build、diff、file-line 门禁随后全部通过。
- 代码审查修复：玩家动作的快照过期收拢到 `GameSession.runPlayerAction`；钥匙 checkpoint 改为接收生产路径传入的首次/二次总三消数，覆盖混合结算并回滚整次乱序原子操作的钥匙次数与随机状态。
