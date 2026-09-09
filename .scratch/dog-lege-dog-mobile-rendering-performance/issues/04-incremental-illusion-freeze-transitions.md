# 04 — 幻化与冻结状态变化保持增量

**What to build:** 玩家选择幻化方块或改变幻化、冻结状态时，游戏只更新真实改变视觉身份的方块，并保留揭示、融化、输入锁和三消时序。

**Blocked by:** 03 — 三消、锁槽与容量变化保持增量

**Status:** done

- [x] 幻化方块开始选择时只移除对应棋盘节点，飞行期间继续显示伪装图案，不提前创建或展示真实图案的暂存槽节点。
- [x] 幻化方块入槽完成后只在目标槽位显示真实图案的普通方块，其他棋盘和暂存槽节点保持稳定。
- [x] 检测仪原位揭示时只更新目标幻化方块的视觉身份与机制属性，不重建全部棋盘。
- [x] 冻结方块进入暂存槽后保持冻结状态和独立三消计数，未变化冻结方块节点继续复用。
- [x] 冻结进度变化只同步对应槽内节点；达到融化条件后只更新或替换真实融化的方块。
- [x] 火把作用于棋盘或暂存槽冻结方块时只改变目标节点，随后三消和终局重检结果保持一致。
- [x] 幻化揭示、冻结融化及道具一次性反馈继续使用原有目标位置，增量更新不会使动画绑定到失效节点。
- [x] 输入锁在飞行、揭示和融化完成前保持，动画结束后合法方块正确恢复可点击。
- [x] 通过公开游戏入口覆盖直接选择幻化、检测仪、冻结自然融化及火把的行为、节点变化和一次性反馈。
- [x] 运行 `pnpm test:ui` 并记录结果；本 ticket 不运行完整 QA、affected 或 focused profile。

## Comments

- 2026-09-09：为延迟完成的幻化选择保留选择前暂存槽位置，并在真实入槽结算后启动冻结融化反馈；无有效幻化目标时跳过不存在节点的揭示等待。新增公开游戏入口测试覆盖幻化飞行/揭示、立即三消、检测仪原位揭示、冻结进度/融化及火把棋盘/暂存槽目标，断言目标节点变化、未变化节点复用、输入锁和反馈。
- 2026-09-09：`pnpm test:ui` 通过（19 files / 104 tests）；`pnpm exec vitest run tests/dog-cases/incremental-specials.test.ts` 通过（7 tests）；`pnpm exec tsc --noEmit --pretty false` 通过；`git diff --check` 通过。按仓库 `AGENTS.md` 对特殊机制运行时的高风险规则额外运行 `pnpm test:qa`，通过（core 44 files / 272 tests、random regression 3 tests、Chromium E2E 24 tests、cross-browser 18 tests、Pages build、diff check、500-line check）；未运行 `pnpm test:affected` 或 `pnpm test:focused`。
