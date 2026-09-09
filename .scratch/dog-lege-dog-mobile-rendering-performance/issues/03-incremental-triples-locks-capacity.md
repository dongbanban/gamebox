# 03 — 三消、锁槽与容量变化保持增量

**What to build:** 玩家触发三消或改变暂存槽容量和锁槽时，游戏只增删、移动或更新真实变化的槽位节点，未变化方块与槽位保持稳定。

**Blocked by:** 02 — 普通选择增量更新棋盘与暂存槽

**Status:** done

- [x] 连续三个相同图案类型方块触发三消后，只移除对应暂存槽方块并按最终严格顺序收拢剩余节点。
- [x] 同轮多组三消和连续区段中的多组三连使用一次最终状态同步，不逐组重建全部暂存槽。
- [x] 不触发三消的暂存槽方块保持节点身份、图案、机制状态和无障碍名称。
- [x] 道具三消移除只更新目标槽内方块、自动补充的棋盘方块及真实被移除节点，其他节点保持稳定。
- [x] 万能方块只在暂存槽末尾新增必要节点，并按最终三消结果移除真实消失的方块。
- [x] 暂存槽容量提升只新增必要有效槽位；现有方块、空槽及连续右侧锁槽不被整体替换。
- [x] 钥匙解锁只更新被解锁槽位、容器容量属性和钥匙次数，其他槽位保持原节点。
- [x] 暂存槽总容量、有效容量、空闲有效槽位和锁槽数量等可观察属性始终与最新 session snapshot 一致。
- [x] 输入锁、道具可用状态、三消反馈、钥匙掉落和失败判定保持既有时序与规则。
- [x] 通过公开游戏入口覆盖普通三消、多组三消、道具三消移除、万能方块、容量提升和钥匙解锁的最终行为与结构变化。
- [x] 运行 `pnpm test:ui` 并记录结果；本 ticket 不运行完整 QA、affected 或 focused profile。

## Comments

- 2026-09-09：复用现有 ID 增量同步路径，新增公开游戏入口结构回归覆盖普通三消、连续多组三消、道具三消移除、万能方块、容量提升和钥匙解锁；断言最终顺序、真实移除节点、未变化节点身份、锁槽属性及输入/反馈时序。
- 2026-09-09：`pnpm exec vitest run tests/dog-cases/incremental-tray.test.ts` 通过（6 tests）；`pnpm test:ui` 通过（18 files / 97 tests）；`pnpm exec tsc --noEmit --pretty false` 通过；`git diff --check` 通过。按本 ticket 要求未运行完整 QA、`pnpm test:affected` 或 `pnpm test:focused`。
- 2026-09-09：关联最终联合 QA ticket 07：`pnpm test:qa`、独立 `pnpm test:e2e:cross-browser`、`pnpm build:pages` 与 `git diff --check` 均通过；性能采样、三消/容量/锁槽及节点复用证据见 [07-performance-and-final-qa.md](07-performance-and-final-qa.md)。
