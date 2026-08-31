# 02 — GameSession 与暂存槽契约清理

**What to build:** 移除废弃的仅图案暂存槽路径和无用目标投影，让 `GameSession` 只暴露当前方块级暂存槽行为，同时保留三消、特殊机制、锁槽和逻辑方块单位语义。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 删除仅图案暂存槽模型、无调用 wrapper 和相关私有 helper。
- [ ] 删除三消目标图案投影及其 session 方法；当前方块 ID 目标列表继续支持道具目标选择。
- [ ] 删除废弃的 session 容量常量、转发别名和重复 clone 入口，保留当前活跃的不可变方块复制路径。
- [ ] 普通方块、冻结、幻化、磁吸、双生、乱序、锁槽、三消、失败和通关行为保持不变。
- [ ] 现有 `GameSession`、特殊机制和终局测试更新为当前契约并通过。

