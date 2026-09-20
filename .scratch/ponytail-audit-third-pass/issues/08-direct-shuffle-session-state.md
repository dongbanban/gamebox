# 08 — 让乱序运行时直接消费局内状态

**What to build:** 让乱序、复原哨和回放继续表现一致，同时让乱序子模块像其他局内子模块一样直接使用权威局内状态，不维护只有一个实现的 getter/setter adapter。

**Blocked by:** 06 — 将局内动作结果收敛为单一快照

**Status:** done

- [x] 乱序运行时直接接收并使用现有局内状态实例。
- [x] 删除单一生产者的乱序 context interface 以及构造时的状态字段、getter、setter 和回调转发。
- [x] 不新增第二个状态 facade、事件总线或依赖注入容器。
- [x] 乱序 dormant、armed、triggerable、consumed 状态转换保持不变。
- [x] reordered 与 stable 两种结果、候选统计、随机选择和回放事件保持确定。
- [x] 复原哨继续只恢复最近一次安全乱序事务，且不返还自身次数。
- [x] 触发乱序的方块在复原后继续保留并转为普通方块。
- [x] 棋盘方块与暂存槽方块复用一份特殊机制移除实现，删除重复对象转换。
- [x] 增量暂存槽渲染继续保持未变化节点身份，输入锁和乱序反馈时序不变。
- [x] 严格 TypeScript 未使用诊断与 `pnpm test:qa` 通过，并记录结果。

## Comments

- `pnpm typecheck` passed; `pnpm exec vitest run tests/special-cases/shuffle-block.test.ts tests/special-cases/shuffle-block-regression.test.ts tests/special-cases/restore-whistle.test.ts tests/item-cases/restore-whistle.test.ts --reporter=dot` passed: 4 files, 15 tests.
- `pnpm test:qa` passed: core 48 files/282 tests, generation lifecycle 4 tests, random regression 3 tests including the 99-level stress path, Chromium E2E 28 tests, cross-browser E2E 30 tests, Pages build, `git diff --check`, and the 500-line guard.
- The shared `removeSpecialMechanism` helper now lives in `levels/level-tray-block.ts`, so board/tray conversion uses one implementation without a session-state/runtime module cycle.
