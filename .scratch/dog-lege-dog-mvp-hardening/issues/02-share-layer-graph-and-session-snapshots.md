# 02 — 共享层叠关系图并收敛局内快照

**What to build:** 让局内选择与关卡生成共享同一套层叠关系语义，并减少一次方块选择中的重复状态计算，使 90–180 个方块的关卡在移动端保持稳定响应。

**Blocked by:** 01 — 拆分关卡生成器深模块

**Status:** done

- [x] 共享层叠关系图根据正面积重叠建立上层计数与下层依赖。
- [x] `GameSession` 的可点击方块、移除后解锁与生成器路径验证使用同一层叠关系语义。
- [x] 仅接触边或角不算遮挡；任意更高层正面积重叠继续阻挡下层方块。
- [x] 关卡对象构造后深度不可变，局内快照安全共享关卡引用。
- [x] 方块选择结果同时表达是否选中、消除数量、最终状态与用于渲染的新快照。
- [x] 控制器复用选择返回的快照，不为同一次操作重复深拷贝完整关卡。
- [x] 高难关选择性能具有回归保护，但测试不锁定私有函数调用次数。
- [x] 三消、暂存槽、通关、失败与输入锁公开行为保持不变。

## Comments

- 共享 `BlockGraph` 缓存正面积遮挡关系；`GameSession` 递减活动上层计数，生成器路径验证与 placement 使用同一 graph 语义。
- level 构造入口深度冻结；snapshot 共享不可变 level 引用，仅复制剩余方块集合、暂存槽与可点击 ID。
- selection result 提供 `selected`、`removedCount`、`status` 与 `snapshot`；controller 直接复用该 snapshot 完成渲染与动画。
- 性能回归：level 31 / 180 blocks，生成 1368.2ms，单次选择 0.4ms，公开 `getState` 读取 1 次。
- 验证：`pnpm typecheck`、`pnpm build`、`pnpm test:core`（51 tests）、`pnpm test:random`（3 tests，含压力档）、`pnpm test:e2e`（12 tests）。
