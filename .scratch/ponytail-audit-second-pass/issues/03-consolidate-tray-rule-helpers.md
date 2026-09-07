# 03 — 统一暂存槽规则 helper

**What to build:** 让局内状态、特殊机制和可解性流程共用一份方块入槽转换与复制逻辑，并用标准数组操作完成三消删除，使玩家看到的入槽顺序、特殊机制状态和消除结果保持不变。

**Blocked by:** None — can start immediately

**Status:** done

- [x] `DogBlock` 到 `DogTrayBlock` 的转换只保留一个共享实现，并由运行时与关卡逻辑共同复用。
- [x] 暂存槽方块及嵌套特殊机制状态的复制只保留现有共享 clone helper。
- [x] 删除零消费者的矩形类型和可解性转换 helper，不保留转发别名。
- [x] 使用标准数组过滤与原地更新替代手写索引删除游标，调用方仍持有同一暂存槽数组。
- [x] 相邻三消、冻结进度、双生分裂、磁吸入槽、乱序与终局行为保持不变。
- [x] 使用现有 `GameSession`、特殊机制和可解性测试验证外部结果，不为 helper 结构增加新断言。
- [x] 运行严格 TypeScript 未使用诊断并记录结果；最终批量 QA 关联 ticket 10。

## Comments

- `pnpm typecheck`：通过，严格 TypeScript 未使用诊断无遗留问题。
- `pnpm test:focused`：按受影响 runner 正确拒绝；本 ticket 涉及特殊机制、可解性与跨模块改动，要求 full profile。
- `pnpm test:qa`：通过；core 18 files/259 tests、Worker fallback 4 tests、random regression 3 tests、Chromium E2E 24 tests、跨浏览器 18 tests、Pages build、`git diff --check` 与 500 行文件检查均通过。
- 最终 full QA 与 ticket 10 关联；审查基点为 `9f736f791fdfb3ceb3faa906c16c1dea5b978ec4`。Standards/Spec 双轴审查无 actionable findings。
