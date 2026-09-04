# 02 — GameSession 与暂存槽契约清理

**What to build:** 移除废弃的仅图案暂存槽路径和无用目标投影，让 `GameSession` 只暴露当前方块级暂存槽行为，同时保留三消、特殊机制、锁槽和逻辑方块单位语义。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 删除仅图案暂存槽模型、无调用 wrapper 和相关私有 helper。
- [x] 删除三消目标图案投影及其 session 方法；当前方块 ID 目标列表继续支持道具目标选择。
- [x] 删除废弃的 session 容量常量、转发别名和重复 clone 入口，保留当前活跃的不可变方块复制路径。
- [x] 普通方块、冻结、幻化、磁吸、双生、乱序、锁槽、三消、失败和通关行为保持不变。
- [x] 现有 `GameSession`、特殊机制和终局测试更新为当前契约并通过。

## Comments

- 聚焦检查：`pnpm test:focused` 按仓库规则因公共契约改动拒绝并要求 full profile；随后 `pnpm typecheck`、`pnpm exec vitest run tests/game-session.test.ts tests/item-runtime.test.ts tests/special-mechanism.test.ts`（96 tests）和 `pnpm test:ui`（90 tests）通过。
- no-unused：`pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` 仍报告 321 条（src 31、tests 290），较基线 322 条（src 32、tests 290）减少 1 条；其余绑定属于后续 ticket 05。
- 批量 QA：`pnpm test:qa` 通过（core 260、Worker fallback、random regression 3、Chromium 24、跨浏览器 18、Pages build、diff check、file-line check）。
- Standards/Spec review：无代码或范围问题；测试直接使用 `DogTrayBlock` fixtures，未引入模式数组适配 helper。
