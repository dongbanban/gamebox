# 06 — 乱序与复原保持暂存槽节点

**What to build:** 乱序与复原哨改变暂存槽顺序时，游戏移动既有方块节点而不是重新创建全部槽位，并继续正确表达状态、事务与输入锁。

**Blocked by:** 03 — 三消、锁槽与容量变化保持增量

**Status:** done

- [x] 乱序状态变化只同步对应方块的状态属性、静态样式和状态文案，不恢复整槽无限脉冲。
- [x] 乱序实际改变顺序时，暂存槽按最终顺序移动既有方块节点，稳定方块 ID 与节点身份保持。
- [x] 乱序结果为稳定原序时不发生无意义的槽位结构替换。
- [x] 乱序触发后的三消、钥匙掉落和冻结进度继续使用最终 session snapshot，并复用增量暂存槽路径。
- [x] 复原哨成功使用时按事务快照恢复既有方块顺序和机制进度，只新增、删除或移动真实有差异的节点。
- [x] 触发乱序的方块在复原后继续保留并转为普通方块，复原哨次数不回滚。
- [x] 稳定原序、终局或事务失效时复原哨仍不可用，增量 renderer 不保留陈旧的可用状态。
- [x] 乱序结算与复原一次性反馈、输入锁及可访问状态保持现有时序。
- [x] 通过公开游戏入口覆盖 reordered、stable、armed、triggerable、consumed、成功复原和不可复原路径。
- [x] 运行 `pnpm test:ui` 并记录结果；本 ticket 不运行完整 QA、affected 或 focused profile。

## Comments

- 2026-09-09：修复暂存槽增量对齐在乱序新增方块位于既有方块之前时错误窃取 live slot 的问题；保留仍存在方块节点，乱序状态与 live status 原地同步，复原按事务最终快照移动/更新节点。
- 2026-09-09：通过公开 `startDogLegeDogGame` 覆盖 reordered、stable、armed、triggerable、consumed、成功复原、终局不可复原和后续动作使事务失效路径；增加最终 DOM 顺序、MutationObserver 节点集合、冻结进度、钥匙掉落回滚与触发方块普通化断言。
- 验证：`pnpm test:ui` 通过（19 files / 118 tests）；`pnpm exec vitest run tests/special-cases/shuffle-ui.test.ts tests/dog-cases/incremental-tray.test.ts tests/dog-cases/incremental-specials.test.ts --reporter=dot` 通过（32 tests）；`pnpm exec tsc --noEmit --pretty false` 通过；`git diff --check` 通过。按本 ticket 要求未运行完整 QA、`pnpm test:affected` 或 `pnpm test:focused`。
- 代码审查：以 `c086a6c` 为起点完成 Standards/Spec 双轴审查，无未处理的实现问题或范围外变更。
