# 06 — 将局内动作结果收敛为单一快照

**What to build:** 让每次选择、融化、揭示、消磁、解锁、万能方块和三消操作只返回动作元数据与一份权威局内快照，使控制器、道具行为和测试读取同一个结果来源。

**Blocked by:** 01 — 迁移生成器与局内规则测试的直接导入；02 — 迁移应用与游戏 UI 测试的直接导入

**Status:** done

- [x] 所有局内动作结果不再把完整 `GameSessionSnapshot` 展开到结果根部。
- [x] 动作是否成功、消除数量、三消数量、机制结果和目标身份继续作为动作元数据返回。
- [x] 每个动作结果只包含一个 `snapshot`，其中保存最终状态、剩余方块、暂存槽、容量、锁槽与可点击方块。
- [x] 删除依赖属性描述符和双份快照的结果构造逻辑，使用最小不可变对象构造。
- [x] 游戏控制器、动画协调、道具行为和其他生产调用方统一从 `snapshot` 读取局面状态。
- [x] 现有局内与 UI 测试统一迁移到单快照契约，不保留兼容根字段。
- [x] 方块选择、磁吸、双生、乱序、三消、融化、揭示、消磁、解锁、万能方块、通关和失败行为保持不变。
- [x] 快照继续保持不可变，且关卡对象继续安全共享。
- [x] 严格 TypeScript 未使用诊断通过。
- [x] 运行 `pnpm test:qa` 并记录结果，因为本 ticket 修改局内公共契约并跨越运行时与 UI。

## Comments

- Focused validation: `pnpm exec vitest run tests/special-cases/shuffle-block.test.ts tests/special-cases/shuffle-block-regression.test.ts tests/game-session-cases` — passed (38 tests).
- `pnpm typecheck`, `git diff --check`, and `sh scripts/check-file-lines.sh 500` — passed.
- Full QA: `pnpm test:qa` — passed: core, generated-path and random regression tests; Chromium E2E; Safari/mobile cross-browser E2E; Pages build; diff and 500-line checks.
- QA exposed the pre-existing 581-line shuffle test file once this ticket touched it. Its two regression cases now live in a 163-line companion file; the original is 448 lines, with behavior preserved.
