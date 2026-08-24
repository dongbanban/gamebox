# 21 — 三消玩法与浏览器体验优化

**What to build:** 收口冻结方块终局三消、冻结方块融化、暂存槽顺序、Safari 道具栏稳定性与棋盘输入锁时长。

**Related to:** 03 — 特殊机制模型与冻结方块；08 — 动画与道具三消；13 — 道具组浮层选择与暂存槽摘要

**Blocked by:** None — can start immediately.

**Status:** done

## Acceptance Criteria

### 1. 终局三消允许包含冻结方块

- [x] 当最后触发通关的三消组包含冻结方块时，冻结方块随该组三消直接移除；不再要求额外融化回合。
- [x] 该场景只结算一次完整三消，棋盘、暂存槽不残留冻结方块；通关反馈与普通终局一致。
- [x] 增加包含冻结方块的终局三消回归测试，覆盖直接调用规则 seam 与活动游戏反馈。

**Steps to reproduce:**

1. 进入包含冻结方块的关卡。
2. 将局面推进到只剩最后一组三消，且该组包含暂存槽中的冻结方块。
3. 完成该组三消，观察冻结方块、暂存槽与通关结果。

### 2. 冻结方块融化计数稳定

- [x] 冻结方块进入暂存槽后，从 0 开始按其后的实际成功三消组数累计；每个成功三消组只计数一次。
- [x] 累计达到 2 组后立即融化，方块保留在原暂存槽位置并转为普通方块；随后立即重新检查三消。
- [x] 不因同一次操作的结算顺序、多个图案同时消除或渲染刷新而出现第三次消除才融化、提前消失或错误消失。
- [x] 冻结方块只有在符合完整三消规则时才可被移除；与其他图案三消同时发生时，除上述终局规则外不产生额外移除。
- [x] 增加连续三消、同次多组三消、融化后立即成组三类回归测试。

**Steps to reproduce:**

1. 将冻结方块点击进入暂存槽。
2. 依次完成其他图案的成功三消，记录冻结方块视觉状态与所在槽位。
3. 观察第二组三消后是否稳定融化，以及是否出现第三组三消或随其他图案直接消失。

### 3. 暂存槽严格保持点击顺序

- [x] 普通方块进入暂存槽时始终追加到末尾；不因同类图案存在而就近插入或合并。
- [x] 暂存槽顺序与玩家点击顺序一致；例如点击 `A → B → A` 后，槽内保持 `A → B → A`。
- [x] 三消移除后，未移除方块保持原有相对顺序；冻结、幻化揭示及其他特殊机制入槽不静默改写顺序。
- [x] 增加交错同类图案、三消后剩余方块与特殊方块入槽顺序回归测试。
- [x] 只有暂存槽中连续相邻的三个同图案类型方块才能触发三消；非相邻同类方块不参与同一组三消。

**Steps to reproduce:**

1. 依次点击三个不同位置的方块，图案顺序选择同类与非同类交错组合。
2. 对照点击记录与暂存槽从左到右的排列。
3. 触发三消后再次检查剩余方块顺序。

### 4. Safari 三消时道具栏不闪烁

- [x] Safari（至少 Playwright WebKit smoke）中触发三消时，道具栏不闪烁、不短暂消失、不发生位置跳动或重复重建视觉。
- [x] 三消反馈期间道具图标、剩余次数、可用/禁用状态保持正确；三消动画与道具栏可以同时展示。
- [x] 增加 Safari/WebKit 三消流程回归检查，并保留 Chromium 行为覆盖。

**Steps to reproduce:**

1. 使用 Safari 打开活动关卡，确认道具栏可见。
2. 点击同一图案方块完成三消。
3. 观察三消反馈播放期间道具栏是否闪烁、消失或重新排版。

### 5. 缩短棋盘禁止点击态

- [x] 适度缩短普通方块入槽后的棋盘禁止点击持续时间，去除不必要的额外等待；玩家体感明显快于当前行为。
- [x] 棋盘仍在飞入、三消、冻结融化、道具结算及终局反馈的必要阶段禁止冲突输入。
- [x] 动画/结算完成后立即恢复可点击状态，不产生重复点击、乱序入槽、漏结算或过早失败。
- [x] 更新输入锁定的单测与活动游戏时序测试；跨浏览器 smoke 继续验证 Safari 与移动 Chromium。

**Steps to reproduce:**

1. 在活动关卡中点击一个可点击方块。
2. 记录方块入槽后到棋盘再次可操作的等待时间。
3. 在缩短后的时序下快速连续选择，确认交互更快且状态结算仍保持原子性。

## Verification

- 普通规则改动：运行 `pnpm test:focused`。
- UI/渲染改动：运行 `pnpm test:ui`。
- Safari 或响应式改动：追加 `pnpm test:e2e:cross-browser`。
- 本 ticket 完成前：按项目规则运行并记录关联的批量 QA 结果。

## Comments

- 2026-08-24 — 认领 ticket。基线 commit：`479f667f0285d630862da43dae4cbe9a1cd2b651`。
- 2026-08-24 — 实现终局冻结三消规则 seam、冻结计数/融化后即时重检、严格点击顺序；普通飞入时长 `240ms -> 180ms`；棋盘在飞入、三消、融化、道具、终局阶段锁定。道具栏更新改为保留摘要 DOM，仅同步次数/可用态；补 deterministic controller seam。
- 2026-08-24 — `pnpm test:focused`：通过，8 files / 122 tests。`pnpm test:ui`：通过，3 files / 45 tests。`pnpm typecheck`：通过。`pnpm build`：通过。
- 2026-08-24 — 批量 QA 按仓库规则拆分：排除 `tests/e2e/**` 的 Vitest 通过，10 files / 146 tests；`pnpm test:random` 通过，3 tests；`pnpm test:e2e` 通过，19 tests；`pnpm test:e2e:cross-browser` 通过，9 tests（Chromium、WebKit Safari、mobile Chromium）。首次直接运行 `pnpm test:qa` 因 `test:core` 误收集 `tests/e2e/**` 后长时间无输出而停止，未计为通过。
- 2026-08-24 — code review 修复：去除测试 DOM identity 断言与 E2E 状态篡改；保留原始 WebKit wait 超时；抽 loadout target helper；跟踪自动融化 Promise，融化视觉结束前拒绝重复输入。修复后 focused/UI/typecheck/build/cross-browser/Chromium E2E 再次通过。
- 2026-08-24 — 按最新需求收口三消：暂存槽严格追加点击顺序；仅连续相邻三连可消除；更新冻结终局级联判断、道具补齐后缀判断、生成器连续三连路径与求解器顺序状态键；生成器版本升至 9。同步更新 `CONTEXT.md`、feature spec、issues 03/08 的冲突表述。
- 2026-08-24 — 验证通过：`pnpm test:focused`（8 files / 126 tests）、`pnpm test:ui`（3 files / 45 tests）、`pnpm typecheck`、`pnpm exec vitest run --exclude 'tests/e2e/**' --exclude 'tests/random-regression.test.ts'`（10 files / 150 tests）、`pnpm test:random`（3 tests）、`pnpm test:e2e`（19 tests）、`pnpm test:e2e:cross-browser`（9 tests）。
- 2026-08-24 — code review P1/P2 已修复：终局冻结三消支持级联、道具目标只展示可形成连续三连的图案、E2E 使用独立黑盒邻接规则模拟器；定向回归与最终全量 QA 通过。
- 2026-08-24 — `pnpm build`：通过。
- 2026-08-24 — 复跑最终验证：核心 Vitest（10 files / 150 tests）、随机回归（3 tests）、Chromium E2E（19 tests）、跨浏览器（9 tests）、`pnpm typecheck`、`pnpm build` 均通过；旧 E2E 贪心路径在邻接规则下会走入死局，已改为独立黑盒搜索并验证完整闭环。
- 2026-08-24 — 最终 Standards review 收敛 E2E 复杂度：移除独立规则模拟器，改为基于真实 DOM 可点击态与暂存槽尾部连续数的黑盒贪心；`pnpm typecheck` 通过，`pnpm test:e2e` 19 tests 通过。
