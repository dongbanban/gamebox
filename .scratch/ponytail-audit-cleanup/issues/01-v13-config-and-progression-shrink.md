# 01 — v13 配置与进度 helper 收缩

**What to build:** 删除不会影响运行时行为的 v13 配置字段、无效测试 profile 字段和进度 helper 中的重复校验/复制，让集中配置只保留真正生效的契约。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 删除重复的关卡边界、未使用的棋盘/锁槽位置、未使用的道具次数标志、未使用的余数策略和不可到达的预算分支；保留所有行为配置。
- [ ] 从测试 profile schema 与 runner 校验中删除 `runUI`，现有 focused、smoke、full 选择和执行行为保持不变。
- [ ] 进度 helper 直接复用底层已校验的配置结果，不再重复校验关卡号或复制难度目标。
- [ ] 无效配置仍在展示未验证棋盘前被拒绝，并保留现有字段诊断语义。
- [ ] 现有配置、进度和 profile 测试更新为当前契约并通过。

