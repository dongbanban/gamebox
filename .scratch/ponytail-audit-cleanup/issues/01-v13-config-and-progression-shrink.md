# 01 — v13 配置与进度 helper 收缩

**What to build:** 删除不会影响运行时行为的 v13 配置字段、无效测试 profile 字段和进度 helper 中的重复校验/复制，让集中配置只保留真正生效的契约。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 删除重复的关卡边界、无消费者的逻辑网格尺寸与单方块机制上限、固定锁槽位置、无效道具次数标志、余数策略、重复音乐路径和不可到达的预算分支；保留所有行为配置。
- [x] 从测试 profile schema 与 runner 校验中删除 `runUI`，现有 focused、smoke、full 选择和执行行为保持不变。
- [x] 进度 helper 直接复用底层已校验的配置结果，不再重复校验关卡号或复制难度目标。
- [x] 无效配置仍在展示未验证棋盘前被拒绝，并保留现有字段诊断语义。
- [x] 现有配置、进度和 profile 测试更新为当前契约并通过。

## Comments

- 聚焦检查通过：`pnpm typecheck`；`pnpm exec vitest run tests/dog-config.test.ts tests/progress-store.test.ts`（27 tests）；`node --test scripts/test-profile.test.mjs`（8 tests）；复审后的变量命名调整也已重跑这些检查。
- 批量 QA 通过：`pnpm test:qa`（core 260 tests、random regression 3 tests、Chromium 24、跨浏览器 18、Pages build、diff check、file-line check）。
- no-unused 诊断：`pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` 返回 322 条既有诊断，属于后续死代码/绑定清理范围，本票未引入新增诊断。
- Standards/Spec review：无行为或范围问题；保留用户已有的 ticket/spec 文案修改。
